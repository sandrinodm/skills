#!/usr/bin/env python3
"""Check a crisp-diagrams SVG and render light/dark PNG previews.

usage: python3 check.py diagram.svg [--png OUT_DIR] [--no-layout]

Static checks (always): canvas, accessibility, palette tokens, dark mode, banned elements.
Layout checks (needs Google Chrome or Chromium): measures every label as the browser
draws it and reports text that overflows or crosses a box, overlapping labels, solid
lines running through labels, boxes that partially overlap, content off the canvas or
inside the 24px house margin, colors outside the theme's palette,
and font sizes outside the scale. Works with every theme in assets/themes/.

Exit code 1 when there are errors. Warnings are worth reading but may be intentional.
"""
import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

NS = "{http://www.w3.org/2000/svg}"
BANNED = {"filter", "radialGradient", "pattern", "image",
          "foreignObject", "script", "animate", "animateTransform", "animateMotion"}
TOKENS = ["ink", "quiet", "edge", "grid", "accent", "tint"]
FONT_SIZES = [15.0, 13.0, 11.5, 10.0]
LIGHT_BG, DARK_BG = "#ffffff", "#1f1e1d"


def find_chrome():
    env = os.environ.get("CHROME")
    candidates = [env] if env else []
    candidates += [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ]
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"):
        path = shutil.which(name)
        if path:
            candidates.append(path)
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return None


def static_checks(svg_text, errors, warnings):
    if re.search(r"<!(DOCTYPE|ENTITY)", svg_text, re.I):
        errors.append("remove the DOCTYPE/ENTITY declarations: plain <svg> only")
        return None
    try:
        root = ET.fromstring(svg_text)
    except ET.ParseError as e:
        errors.append("not valid XML: %s" % e)
        return None
    if root.tag != NS + "svg":
        errors.append("root element is not <svg> in the SVG namespace (add xmlns=\"http://www.w3.org/2000/svg\")")
        return None
    vb = root.get("viewBox")
    if not vb:
        errors.append("missing viewBox")
        return None
    parts = [float(v) for v in re.split(r"[ ,]+", vb.strip())]
    vw, vh = parts[2], parts[3]
    if root.get("width") is None or root.get("height") is None:
        errors.append("set width and height to match the viewBox (%g x %g) so the file has an intrinsic size" % (vw, vh))
    elif float(root.get("width")) != vw or float(root.get("height")) != vh:
        warnings.append("width/height (%s x %s) differ from the viewBox (%g x %g)" % (root.get("width"), root.get("height"), vw, vh))
    if vw != 760:
        warnings.append("canvas is %g wide; the house canvas is 760 (use it unless the content truly needs otherwise)" % vw)
    if root.get("role") != "img":
        errors.append('add role="img" to the <svg>')
    if not (root.get("aria-label") or root.find(NS + "title") is not None):
        errors.append("add aria-label (the diagram's title) to the <svg>")
    style = "".join((s.text or "") for s in root.iter(NS + "style"))
    if not style:
        errors.append("no <style> block: start from assets/template.svg (or run scripts/theme.py on the file)")
    else:
        missing = [t for t in TOKENS if style.count("--%s:" % t) < 2]
        if missing:
            errors.append("style kit incomplete: tokens %s need a light and a dark value" % ", ".join("--" + m for m in missing))
        if "prefers-color-scheme" not in style:
            errors.append("no dark mode: the theme's @media (prefers-color-scheme:dark) block is missing")
        ids = {el.get("id") for el in root.iter() if el.get("id")}
        missing_defs = sorted(set(re.findall(r"url\(#(cd-[a-z-]+)\)", style)) - ids)
        if missing_defs:
            errors.append("the theme fills boxes with gradients (%s) that aren't defined: run scripts/theme.py to add them" % ", ".join(missing_defs))
    for el in root.iter():
        name = el.tag.replace(NS, "")
        if name == "linearGradient":
            stops = [st for st in el.iter(NS + "stop")]
            if not (el.get("id") or "").startswith("cd-") or any("var(" not in (st.get("style") or "") + (st.get("stop-color") or "") for st in stops):
                errors.append("gradients come only from the gradient theme (scripts/theme.py --theme gradient), not hand-written <linearGradient>")
            continue
        if name in BANNED:
            errors.append("<%s> is not part of this style (no gradients, filters, images, scripts or animation)" % name)
        for attr in ("fill", "stroke", "stop-color", "color"):
            v = (el.get(attr) or "").strip()
            if v and v not in ("none", "transparent", "currentColor") and not v.startswith("url(") and not v.startswith("var("):
                errors.append("hard-coded %s=\"%s\" on <%s>: use a class from the style kit or var(--token)" % (attr, v, name))
        st = el.get("style") or ""
        for m in re.finditer(r"(fill|stroke|color)\s*:\s*([^;]+)", st):
            v = m.group(2).strip()
            if v not in ("none", "transparent", "currentColor") and not v.startswith("var(") and not v.startswith("url("):
                errors.append("hard-coded %s:%s in style on <%s>: use var(--token)" % (m.group(1), v, name))
    return vw, vh


MEASURE_JS = r"""
(function(){
const svg = document.querySelector('svg');
const vb = svg.viewBox.baseVal;
const inv = svg.getScreenCTM().inverse();
function box(el){
  const b = el.getBBox();
  const m = inv.multiply(el.getScreenCTM());
  const pts = [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>{
    const p = svg.createSVGPoint(); p.x=x; p.y=y; const q=p.matrixTransform(m); return [q.x,q.y];});
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  return {x:Math.min(...xs), y:Math.min(...ys), w:Math.max(...xs)-Math.min(...xs), h:Math.max(...ys)-Math.min(...ys)};
}
function inDefs(el){ return !!el.closest('defs,marker,clipPath,mask,symbol'); }
const out = {vb:[vb.x,vb.y,vb.width,vb.height], texts:[], rects:[], segs:[], paints:[]};
for (const t of svg.querySelectorAll('text')) {
  if (inDefs(t)) continue;
  const cs = getComputedStyle(t);
  out.texts.push({s:t.textContent.trim(), b:box(t), size:parseFloat(cs.fontSize), weight:cs.fontWeight});
}
for (const r of svg.querySelectorAll('rect,circle,ellipse')) {
  if (inDefs(r) || r.closest('.icon')) continue;
  out.rects.push({b:box(r), tag:r.tagName, cls:r.getAttribute('class')||''});
}
for (const l of svg.querySelectorAll('line,path,polyline,polygon')) {
  if (inDefs(l) || l.closest('.icon')) continue;
  const cs = getComputedStyle(l);
  out.segs.push({b:box(l), dashed: cs.strokeDasharray && cs.strokeDasharray !== 'none', stroke: cs.stroke});
}
for (const el of svg.querySelectorAll('*')) {
  if (inDefs(el) && el.tagName !== 'path') continue;
  if (['style','defs','marker','g','svg','title','desc','tspan'].includes(el.tagName)) continue;
  const cs = getComputedStyle(el);
  out.paints.push({tag:el.tagName, fill:cs.fill, stroke:cs.stroke, text:(el.textContent||'').trim().slice(0,40)});
}
out.keycount = [...svg.querySelectorAll('.key')].filter(e => !inDefs(e)).length;
// Boxes completely covered by an opaque box painted after them (invisible in colorful themes).
out.covered = [];
const allRects = [...svg.querySelectorAll('rect')].filter(r => !inDefs(r) && !r.closest('.icon'));
for (let i = 0; i < allRects.length; i++) {
  const a = allRects[i], ab = box(a);
  for (let j = i + 1; j < allRects.length; j++) {
    const b = allRects[j], cs = getComputedStyle(b);
    if (cs.fill === 'none' || cs.fill === 'rgba(0, 0, 0, 0)' || cs.fill.startsWith('url(') === false && parseFloat(cs.fillOpacity) < 0.9) continue;
    if (/rgba\([^)]*,\s*0?\.\d+\)/.test(cs.fill)) continue;
    const bb = box(b);
    if (ab.x >= bb.x - 0.5 && ab.y >= bb.y - 0.5 && ab.x + ab.w <= bb.x + bb.w + 0.5 && ab.y + ab.h <= bb.y + bb.h + 0.5) {
      out.covered.push({b: ab, by: bb, cls: a.getAttribute('class') || ''}); break;
    }
  }
}
// Circles big enough to hold text (rings, loop markers): text must sit fully inside or fully outside.
out.circles = [...svg.querySelectorAll('circle')].filter(c => !inDefs(c) && !c.closest('.icon') && c.r.baseVal.value >= 12)
  .map(c => { const b = box(c); return {cx: b.x + b.w / 2, cy: b.y + b.h / 2, r: b.w / 2}; });
// Icons count as one object each.
out.icons = [];
for (const ic of svg.querySelectorAll('g.icon')) { if (!inDefs(ic)) out.icons.push({b: box(ic)}); }
// Arrowheads hidden under a filled box that is painted after them.
out.hidden = [];
const fillRects = [...svg.querySelectorAll('rect')].filter(r => !inDefs(r));
for (const l of svg.querySelectorAll('[marker-end]')) {
  if (inDefs(l) || !l.getTotalLength) continue;
  const len = l.getTotalLength();
  if (len < 6) continue;
  const m = inv.multiply(l.getScreenCTM());
  const pt = l.getPointAtLength(len - 3).matrixTransform(m);
  for (const r of fillRects) {
    if (!(l.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    const cs = getComputedStyle(r);
    if (cs.fill === 'none' || cs.fill === 'rgba(0, 0, 0, 0)' || parseFloat(cs.fillOpacity) === 0) continue;
    const b = box(r);
    if (pt.x > b.x + 1 && pt.x < b.x + b.w - 1 && pt.y > b.y + 1 && pt.y < b.y + b.h - 1) { out.hidden.push({b: b, at: [pt.x, pt.y]}); break; }
  }
}
// The palette as this browser resolves it, for comparison.
const probe = document.createElementNS('http://www.w3.org/2000/svg','rect');
svg.appendChild(probe);
out.palette = {};
const names = new Set(%TOKENS%);
for (const s of svg.querySelectorAll('style')) for (const m of s.textContent.matchAll(/--([a-z0-9-]+)\s*:/g)) names.add(m[1]);
for (const t of names) { probe.style.fill = 'var(--' + t + ')'; out.palette[t] = getComputedStyle(probe).fill; }
probe.remove();
document.getElementById('result').textContent = btoa(unescape(encodeURIComponent(JSON.stringify(out))));
})();
"""


def run_chrome(chrome, html, args, timeout=60):
    tmp = tempfile.mkdtemp(prefix="crisp-diagrams-")
    try:
        page = os.path.join(tmp, "page.html")
        with open(page, "w") as f:
            f.write(html)
        # Headless Chrome uses its own throwaway profile; a fresh --user-data-dir makes it linger.
        cmd = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
               "--no-default-browser-check"] + args + ["file://" + page]
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def page_html(svg_text, dark, script=""):
    scheme, bg = ("dark", DARK_BG) if dark else ("light", LIGHT_BG)
    svg_body = re.sub(r"^\s*<\?xml[^>]*\?>", "", svg_text)
    return ('<!doctype html><html style="color-scheme:%s;background:%s"><body style="margin:0">%s'
            '<pre id="result" style="display:none"></pre><script>%s</script></body></html>' % (scheme, bg, svg_body, script))


def inter(a, b):
    w = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
    h = min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"])
    return (w, h) if w > 0 and h > 0 else None


def inside(a, b, pad_x=0.0, pad_y=0.0):
    return (a["x"] >= b["x"] + pad_x and a["y"] >= b["y"] + pad_y and
            a["x"] + a["w"] <= b["x"] + b["w"] - pad_x and a["y"] + a["h"] <= b["y"] + b["h"] - pad_y)


def fmt(b):
    return "(%d,%d %dx%d)" % (round(b["x"]), round(b["y"]), round(b["w"]), round(b["h"]))


def layout_checks(chrome, svg_text, errors, warnings, show_labels=False):
    js = MEASURE_JS.replace("%TOKENS%", json.dumps(TOKENS))
    # Pin the color scheme: otherwise headless Chrome follows the OS appearance (dark at night).
    res = run_chrome(chrome, page_html(svg_text, False, js), ["--dump-dom", "--blink-settings=preferredColorScheme=1"])
    m = re.search(r'<pre id="result"[^>]*>([A-Za-z0-9+/=]+)</pre>', res.stdout)
    if not m:
        warnings.append("layout checks skipped: Chrome did not return measurements (%s)" % res.stderr.strip()[-200:])
        return
    data = json.loads(base64.b64decode(m.group(1)).decode("utf-8"))
    vx, vy, vw, vh = data["vb"]
    canvas = {"x": vx, "y": vy, "w": vw, "h": vh}
    texts, rects, segs = data["texts"], data["rects"], data["segs"]

    for c in data.get("circles", []):
        for t in texts:
            b = t["b"]
            # The text box includes line spacing above and below the letters; measure the letters themselves.
            x0, x1, y0, y1 = b["x"] + 1, b["x"] + b["w"] - 1, b["y"] + 3, b["y"] + b["h"] - 3
            # Sample a grid over the letters: a wide label can straddle an arc with all four corners outside it.
            pts = [(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * j / 2) for i in range(9) for j in range(3)]
            n_in = sum(1 for x, y in pts if (x - c["cx"]) ** 2 + (y - c["cy"]) ** 2 < (c["r"] - 0.5) ** 2)
            if 0 < n_in < len(pts):
                errors.append("text '%s' %s crosses the outline of a circle (r=%d at %d,%d): move it fully inside the ring's band, or shorten it" % (
                    t["s"][:40], fmt(b), c["r"], c["cx"], c["cy"]))
    for t in texts:
        if t["size"] not in FONT_SIZES:
            errors.append("font size %gpx on '%s': use 15 (title), 13 (names, labels), 11.5 (notes, chips) or 10 (only inside device screens and code chips)" % (t["size"], t["s"][:40]))
    for el in texts + rects + segs:
        b = el["b"]
        label = el.get("s") or el.get("tag") or "line"
        if not inside(b, canvas):
            errors.append("'%s' %s runs off the %gx%g canvas" % (str(label)[:40], fmt(b), vw, vh))
        elif not inside(b, canvas, 23.5, 15.5):
            warnings.append("'%s' %s enters the canvas margin (24 at the sides): move it in or shorten it" % (str(label)[:40], fmt(b)))

    # Text against boxes: every label must sit fully inside a box or fully outside it.
    for t in texts:
        tb = t["b"]
        for r in rects:
            rb = r["b"]
            if not inter(tb, rb):
                continue
            if inside(rb, tb):
                continue
            if not inside(tb, rb, 1, 1):
                errors.append("text '%s' %s crosses the edge of a box %s: widen the box, shorten the text or wrap it" % (t["s"][:40], fmt(tb), fmt(rb)))
            elif not inside(tb, rb, 6, 1):
                tight = min(tb["x"] - rb["x"], rb["x"] + rb["w"] - tb["x"] - tb["w"])
                # Only warn for the innermost box that holds the text.
                holders = [o for o in rects if inside(tb, o["b"], 1, 1) and o["b"]["w"] * o["b"]["h"] < rb["w"] * rb["h"]]
                if not holders:
                    warnings.append("text '%s' is %.0fpx from the side of its box %s; leave at least 8" % (t["s"][:40], tight, fmt(rb)))
    # Text against text.
    for i, a in enumerate(texts):
        for b in texts[i + 1:]:
            ov = inter(a["b"], b["b"])
            if ov and ov[0] > 1 and ov[1] > 2:
                errors.append("labels overlap: '%s' and '%s'" % (a["s"][:30], b["s"][:30]))
    # Text against straight connector lines.
    for t in texts:
        tb = dict(t["b"])
        tb = {"x": tb["x"] + 1, "y": tb["y"] + 2, "w": tb["w"] - 2, "h": tb["h"] - 4}
        for s in segs:
            sb = s["b"]
            straight = sb["w"] <= 3 or sb["h"] <= 3
            if not straight or not inter(tb, {"x": sb["x"] - 0.5, "y": sb["y"] - 0.5, "w": sb["w"] + 1, "h": sb["h"] + 1}):
                continue
            if s["dashed"]:
                warnings.append("dashed line runs through '%s' (fine for sequence lifelines, otherwise move the label)" % t["s"][:40])
            else:
                errors.append("a line %s runs through the label '%s': move the label beside the line (8px gap)" % (fmt(sb), t["s"][:40]))
    # Boxes against boxes: nest or separate, never half-overlap.
    for i, a in enumerate(rects):
        for b in rects[i + 1:]:
            ov = inter(a["b"], b["b"])
            if ov and ov[0] > 1.5 and ov[1] > 1.5 and not inside(a["b"], b["b"]) and not inside(b["b"], a["b"]):
                errors.append("boxes %s and %s partly overlap: nest one inside the other or separate them" % (fmt(a["b"]), fmt(b["b"])))

    # Colors must come from the palette.
    allowed = set(data["palette"].values()) | {"none", "rgba(0, 0, 0, 0)"}
    stray = {}
    for p in data["paints"]:
        for prop in ("fill", "stroke"):
            v = p[prop]
            if v.startswith("url("):
                continue
            if v not in allowed:
                stray.setdefault(v, p["tag"] + (" '%s'" % p["text"] if p["text"] else ""))
    for v, where in stray.items():
        errors.append("color %s (on %s) is outside the theme's palette: use the theme's classes or var(--token)" % (v, where))

    for ic in data.get("icons", []):
        ib = ic["b"]
        for t in texts:
            ov = inter(ib, t["b"])
            if ov and ov[0] > 1 and ov[1] > 1:
                errors.append("an icon %s overlaps the label '%s': move the text past the icon" % (fmt(ib), t["s"][:30]))
        for r in rects:
            if inter(ib, r["b"]) and not inside(ib, r["b"], 1, 1) and not inside(r["b"], ib):
                errors.append("an icon %s crosses the edge of a box %s" % (fmt(ib), fmt(r["b"])))
    for cv in data.get("covered", []):
        errors.append("a %s box %s is hidden under a filled box %s painted after it: draw the outer box first" % (
            cv["cls"] or "plain", fmt(cv["b"]), fmt(cv["by"])))
    for h in data.get("hidden", []):
        errors.append("an arrowhead at (%d,%d) is hidden under a filled box %s painted after it: draw connectors after the boxes" % (
            round(h["at"][0]), round(h["at"][1]), fmt(h["b"])))
    accents = [r for r in rects if "key" in r["cls"].split()] or ([None] * data.get("keycount", 0))
    if len(accents) > 1:
        warnings.append("%d accent boxes (.key): the accent marks the one thing to remember; use one unless two are truly equal" % len(accents))
    if not accents:
        warnings.append("no accent box (.key): most diagrams have one idea the reader should leave with; highlight it")
    print("measured %d labels, %d boxes, %d lines, %d icons" % (len(texts), len(rects), len(segs), len(data.get("icons", []))))
    if show_labels:
        for t in texts:
            b = t["b"]
            print("label   x %6.1f to %6.1f   y %6.1f to %6.1f   '%s'" % (b["x"], b["x"] + b["w"], b["y"], b["y"] + b["h"], t["s"][:50]))


def render_pngs(chrome, svg_text, svg_path, out_dir, size):
    os.makedirs(out_dir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(svg_path))[0]
    paths = []
    for dark in (False, True):
        out = os.path.abspath(os.path.join(out_dir, "%s.%s.png" % (stem, "dark" if dark else "light")))
        args = ["--force-device-scale-factor=2", "--window-size=%d,%d" % size, "--screenshot=" + out,
                "--blink-settings=preferredColorScheme=%d" % (0 if dark else 1)]
        if dark:
            args.append("--force-dark-mode")
        run_chrome(chrome, page_html(svg_text, dark), args)
        if os.path.exists(out):
            paths.append(out)
    return paths


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svg")
    ap.add_argument("--png", metavar="OUT_DIR", help="write <name>.light.png and <name>.dark.png previews here")
    ap.add_argument("--no-layout", action="store_true", help="skip the Chrome-based checks")
    ap.add_argument("--labels", action="store_true", help="print each label's measured extent")
    args = ap.parse_args()
    svg_text = open(args.svg, encoding="utf-8").read()
    errors, warnings = [], []
    size = static_checks(svg_text, errors, warnings)
    chrome = None if args.no_layout else find_chrome()
    if size and not args.no_layout:
        if chrome:
            layout_checks(chrome, svg_text, errors, warnings, args.labels)
        else:
            warnings.append("layout checks skipped: no Chrome/Chromium found (set CHROME=/path/to/chrome)")
    for e in errors:
        print("ERROR   " + e)
    for w in warnings:
        print("warning " + w)
    if args.png and size and chrome:
        for p in render_pngs(chrome, svg_text, args.svg, args.png, (int(size[0]), int(size[1]))):
            print("preview " + p)
    print("%s: %d error(s), %d warning(s)" % (os.path.basename(args.svg), len(errors), len(warnings)))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
