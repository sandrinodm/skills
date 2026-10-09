#!/usr/bin/env python3
"""Turn a brand image (logo, slide, screenshot) into a subtle diagram palette in the library's STYLE.md.

usage: python3 palette.py brand.png [more.png ...] [--out STYLE.md] [--treatment pastel]
                          [--accent "#5b3cc4"] [--preview DIR] [--force]

What it does:
  1. Reads the image(s) and clusters their pixels in OKLab (perceptual) space.
  2. Picks the brand's main color (the most prominent saturated cluster) as the accent,
     and up to four other brand colors for the group hues. Missing hues are derived from
     the accent (analogous and complementary), so the set stays on-brand.
  3. Turns them into subtle shades: very light fills, soft lines, a dark-mode version of
     everything, contrast-checked text and accent. The background stays white.
  4. Writes STYLE.md (palette tables + the exact tokens) for theme.py --style to apply,
     and with --preview renders swatches and example diagrams in the new palette.
     The default --out is the library's STYLE.md (see library.py). A plain STYLE.md (a stock
     theme, no palette yet) is upgraded in place; an existing palette needs --force. Either
     way the "Project notes" section is kept.

Reads images with Pillow if installed, else ImageMagick (magick/convert), else macOS sips.
"""
import argparse
import datetime
import math
import os
import random
import re
import shutil
import struct
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
SLOTS = [  # assignment order and meaning
    ("teal", "the system you're explaining (its parts)"),
    ("violet", "people and the apps they use"),
    ("green", "outside systems and destinations"),
    ("amber", "channels, standards and teams"),
    ("rose", "risks, failures and untrusted things"),
    ("blue", "spare; it sits in the accent's family, so use it last"),
]
SHORT = {"teal": "the system's parts", "violet": "people and their apps", "green": "outside systems",
         "amber": "channels and teams", "rose": "risks and failures", "blue": "spare, accent family"}
DARK_BG = (0x1f / 255, 0x1e / 255, 0x1d / 255)


# ------------------------------------------------------------------ color math (OKLab / OKLCH)

def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _gam(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def _cbrt(x):
    return math.copysign(abs(x) ** (1 / 3), x)


def rgb_to_oklab(rgb):
    r, g, b = (_lin(c) for c in rgb)
    l = _cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = _cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = _cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def oklab_to_rgb_raw(lab):
    L, a, b = lab
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return (_gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) if 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s >= 0 else -1,
            _gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) if -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s >= 0 else -1,
            _gam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s) if -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s >= 0 else -1)


def lab_to_lch(lab):
    L, a, b = lab
    return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360


def lch(L, C, h):
    """OKLCH to sRGB, reducing chroma until the color fits the sRGB gamut."""
    L = min(max(L, 0.0), 1.0)
    for _ in range(40):
        rgb = oklab_to_rgb_raw((L, C * math.cos(math.radians(h)), C * math.sin(math.radians(h))))
        if all(-0.0005 <= c <= 1.0005 for c in rgb):
            return tuple(min(max(c, 0.0), 1.0) for c in rgb)
        C *= 0.9
    return tuple(min(max(c, 0.0), 1.0) for c in oklab_to_rgb_raw((L, 0, 0)))


def hexc(rgb):
    return "#%02x%02x%02x" % tuple(int(round(c * 255)) for c in rgb)


def parse_hex(s):
    s = s.strip().lstrip("#")
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    return tuple(int(s[i:i + 2], 16) / 255 for i in (0, 2, 4))


def luminance(rgb):
    def ch(v):
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a, b):
    l1, l2 = sorted((luminance(a), luminance(b)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def hue_dist(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


# ------------------------------------------------------------------ reading images

def read_pixels(path, size=160):
    """Return a list of (r, g, b) floats, downsampled so the long side is at most `size`."""
    try:
        from PIL import Image  # noqa
        im = Image.open(path).convert("RGBA")
        im.thumbnail((size, size))
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        return [(r / 255, g / 255, b / 255) for r, g, b, _ in bg.getdata()]
    except ImportError:
        pass
    tool = shutil.which("magick") or shutil.which("convert")
    if tool:
        out = subprocess.run([tool, path, "-background", "white", "-alpha", "remove", "-alpha", "off",
                              "-resize", "%dx%d>" % (size, size), "-depth", "8", "ppm:-"], capture_output=True)
        if out.returncode == 0 and out.stdout.startswith(b"P6"):
            return parse_ppm(out.stdout)
    if shutil.which("sips"):
        tmp = tempfile.mkdtemp()
        try:
            bmp = os.path.join(tmp, "x.bmp")
            subprocess.run(["sips", "-s", "format", "bmp", "-Z", str(size), path, "--out", bmp], capture_output=True)
            if os.path.exists(bmp):
                return parse_bmp(open(bmp, "rb").read())
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    sys.exit("Can't read %s: install Pillow (pip install pillow) or ImageMagick." % path)


def parse_ppm(data):
    parts, i = [], 0
    while len(parts) < 4:
        while data[i:i + 1].isspace():
            i += 1
        if data[i:i + 1] == b"#":
            while data[i:i + 1] not in (b"\n", b""):
                i += 1
            continue
        j = i
        while not data[j:j + 1].isspace():
            j += 1
        parts.append(data[i:j])
        i = j
    w, h = int(parts[1]), int(parts[2])
    px = data[i + 1:i + 1 + w * h * 3]
    return [(px[k] / 255, px[k + 1] / 255, px[k + 2] / 255) for k in range(0, len(px) - 2, 3)]


def parse_bmp(data):
    off = struct.unpack_from("<I", data, 10)[0]
    w, h = struct.unpack_from("<ii", data, 18)
    bpp = struct.unpack_from("<H", data, 28)[0]
    step = bpp // 8
    row = (w * step + 3) & ~3
    out = []
    for y in range(abs(h)):
        base = off + y * row
        for x in range(w):
            b, g, r = data[base + x * step:base + x * step + 3]
            a = data[base + x * step + 3] if step == 4 else 255
            t = a / 255
            out.append((r / 255 * t + (1 - t), g / 255 * t + (1 - t), b / 255 * t + (1 - t)))
    return out


# ------------------------------------------------------------------ clustering

def kmeans(points, k, iters=14, seed=7):
    rnd = random.Random(seed)
    centers = [rnd.choice(points)]
    while len(centers) < min(k, len(points)):
        d2 = [min((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2 for c in centers) for p in points]
        total = sum(d2) or 1
        r, acc = rnd.random() * total, 0
        for p, d in zip(points, d2):
            acc += d
            if acc >= r:
                centers.append(p)
                break
    for _ in range(iters):
        groups = [[] for _ in centers]
        for p in points:
            i = min(range(len(centers)), key=lambda j: (p[0] - centers[j][0]) ** 2 + (p[1] - centers[j][1]) ** 2 + (p[2] - centers[j][2]) ** 2)
            groups[i].append(p)
        centers = [tuple(sum(c) / len(g) for c in zip(*g)) if g else centers[i] for i, g in enumerate(groups)]
    return [(c, len(g)) for c, g in zip(centers, groups) if g]


def brand_colors(paths):
    labs = []
    for p in paths:
        labs += [rgb_to_oklab(px) for px in read_pixels(p)]
    total = len(labs)
    # Drop the near-white background and near-black text before clustering.
    content = [l for l in labs if not (l[0] > 0.95 and math.hypot(l[1], l[2]) < 0.03) and l[0] > 0.12]
    if not content:
        return [], []
    clusters = kmeans(content, 8)
    chromatic, neutral = [], []
    for c, n in clusters:
        L, C, h = lab_to_lch(c)
        item = {"lab": c, "L": L, "C": C, "h": h, "share": n / total, "hex": hexc(oklab_to_rgb_safe(c))}
        (chromatic if C >= 0.045 else neutral).append(item)
    # Merge near-identical hues, keep the stronger one.
    merged = []
    for c in sorted(chromatic, key=lambda x: -x["share"]):
        twin = next((m for m in merged if hue_dist(m["h"], c["h"]) < 14 and abs(m["L"] - c["L"]) < 0.18), None)
        if twin:
            twin["share"] += c["share"]
        else:
            merged.append(c)
    for c in merged:
        c["score"] = math.sqrt(c["share"]) * c["C"]
    return sorted(merged, key=lambda x: -x["score"]), neutral


def oklab_to_rgb_safe(lab):
    L, C, h = lab_to_lch(lab)
    return lch(L, C, h)


# ------------------------------------------------------------------ palette

def pick(colors, accent_hex=None):
    if accent_hex:
        L, C, h = lab_to_lch(rgb_to_oklab(parse_hex(accent_hex)))
        primary = {"L": L, "C": C, "h": h, "hex": accent_hex.lower(), "share": None}
        others = [c for c in colors if hue_dist(c["h"], h) >= 25]
    elif colors:
        primary, others = colors[0], colors[1:]
    else:
        primary = {"L": 0.55, "C": 0.15, "h": 255, "hex": "#2a78d6", "share": None}
        others = []
    chosen = []
    for c in others:
        if all(hue_dist(c["h"], x["h"]) >= 25 for x in chosen + [primary]):
            chosen.append(c)
        if len(chosen) == 4:
            break
    return primary, chosen


def accent_pair(p):
    L, C, h = p["L"], p["C"], p["h"]
    light = lch(L, C, h)
    while contrast(light, (1, 1, 1)) < 3.0 and L > 0.25:
        L -= 0.01
        light = lch(L, C, h)
    Ld = max(p["L"], 0.66)
    dark = lch(Ld, C, h)
    while contrast(dark, DARK_BG) < 4.5 and Ld < 0.95:
        Ld += 0.01
        dark = lch(Ld, C, h)
    return light, dark


def build(primary, secondaries, treatment, sources):
    h0 = primary["h"]
    acc_l, acc_d = accent_pair(primary)
    # Group hues: brand colors first, then hues derived from the accent.
    # (hue, strength, source): brand colors keep more color than the hues derived for missing slots.
    hues = [(c["h"], 1.0, "brand color %s" % c["hex"]) for c in secondaries]
    for off in (40, -40, 150, -150, 90, -90, 180):
        cand = (h0 + off) % 360
        if all(hue_dist(cand, x[0]) >= 28 for x in hues) and hue_dist(cand, h0) >= 30:
            hues.append((cand, 0.65, "derived from the accent (%+d°)" % off))
    slots = {}
    for (name, meaning), hue in zip(SLOTS[:5], hues):
        slots[name] = {"h": hue[0], "k": hue[1], "from": hue[2], "meaning": meaning}
    slots["blue"] = {"h": h0, "k": 0.8, "from": "the accent's family", "meaning": SLOTS[5][1]}

    def shade(L, C, h):
        return hexc(lch(L, C, h))

    light, dark = {}, {}
    nC = 0.012  # neutrals carry a whisper of the brand hue
    light.update({"--ink": shade(0.21, 0.008, h0), "--quiet": shade(0.46, nC, h0), "--edge": shade(0.82, nC, h0),
                  "--grid": "rgba(%d,%d,%d,.1)" % tuple(int(c * 255) for c in lch(0.21, 0.008, h0)),
                  "--accent": hexc(acc_l), "--tint": "rgba(%d,%d,%d,.14)" % tuple(int(c * 255) for c in lch(0.6, 0.02, h0)),
                  "--paper": "#ffffff", "--screen": shade(0.978, 0.004, h0), "--ui": shade(0.905, 0.008, h0), "--island": "#0b0b0b",
                  "--key-fill": shade(0.94, min(primary["C"], 0.05), h0),
                  "--paper-0": "#ffffff", "--paper-1": shade(0.958, 0.006, h0),
                  "--key-0": shade(0.975, min(primary["C"], 0.025), h0), "--key-1": shade(0.92, min(primary["C"], 0.06), h0)})
    dark.update({"--ink": shade(0.95, 0.006, h0), "--quiet": shade(0.80, 0.01, h0), "--edge": shade(0.47, nC, h0),
                 "--grid": "rgba(255,255,255,.1)", "--accent": hexc(acc_d),
                 "--tint": "rgba(%d,%d,%d,.16)" % tuple(int(c * 255) for c in lch(0.7, 0.02, h0)),
                 "--paper": shade(0.255, 0.004, h0), "--screen": shade(0.215, 0.004, h0), "--ui": shade(0.37, 0.006, h0), "--island": "#050505",
                 "--key-fill": shade(0.31, min(primary["C"], 0.06), h0),
                 "--paper-0": shade(0.285, 0.004, h0), "--paper-1": shade(0.245, 0.004, h0),
                 "--key-0": shade(0.34, min(primary["C"], 0.06), h0), "--key-1": shade(0.285, min(primary["C"], 0.05), h0)})
    # Subtle by design: fills are barely tinted, lines carry a little more color.
    for name, s in slots.items():
        k = s["k"]
        c_fill, c_line = 0.028 * k, 0.07 * k
        light["--" + name] = shade(0.96, c_fill, s["h"])
        light["--%s-line" % name] = shade(0.79, c_line, s["h"])
        light["--%s-0" % name] = shade(0.988, c_fill * 0.45, s["h"])
        light["--%s-1" % name] = shade(0.945, c_fill * 1.15, s["h"])
        dark["--" + name] = shade(0.30, 0.035 * k, s["h"])
        dark["--%s-line" % name] = shade(0.55, 0.075 * k, s["h"])
        dark["--%s-0" % name] = shade(0.33, 0.035 * k, s["h"])
        dark["--%s-1" % name] = shade(0.265, 0.03 * k, s["h"])
        light["--%s-ink" % name] = shade(0.47, 0.10 * k, s["h"])
        dark["--%s-ink" % name] = shade(0.80, 0.08 * k, s["h"])
        s["fill"], s["line"], s["fill_dark"], s["line_dark"] = light["--" + name], light["--%s-line" % name], dark["--" + name], dark["--%s-line" % name]
    return {"primary": primary, "secondaries": secondaries, "slots": slots, "light": light, "dark": dark,
            "treatment": treatment, "sources": sources}


def tokens_css(p):
    light = ";".join("%s:%s" % kv for kv in p["light"].items())
    dark = ";".join("%s:%s" % kv for kv in p["dark"].items())
    return "svg{%s}\n@media (prefers-color-scheme:dark){svg{%s}}" % (light, dark)


def diagram_md(p, colors):
    acc = p["light"]["--accent"]
    prim = p["primary"]
    sys.path.insert(0, HERE)
    import library
    lines = ["# Diagram style", "", library.MARKER,
             "Every diagram in this folder is drawn with the crisp-diagrams skill and the brand palette below, so they read as one family. "
             "The skill reads this file before drawing and applies it with `theme.py --style`.", "",
             "- **Theme:** brand",
             "- **Treatment:** %s" % p["treatment"],
             "- **Background:** always white (#ffffff) in light mode. Brand colors go into the accent, the group fills and the lines, never the canvas.",
             "- **Accent:** %s, from the brand color %s%s. It marks one thing per diagram." % (
                 acc, prim["hex"], "" if prim["hex"].lower() == acc else " (darkened slightly so it reads on white)"),
             "- **Source:** %s, extracted %s" % (", ".join("`%s`" % os.path.basename(s) for s in p["sources"]) or "manual", datetime.date.today().isoformat()),
             "", "## Brand colors found", "",
             "| Color | Share of the image | Used as |", "| --- | --- | --- |"]
    used = {prim["hex"]: "accent"}
    for c in p["secondaries"]:
        slot = next((n for n, s in p["slots"].items() if s["from"] == "brand color %s" % c["hex"]), None)
        used[c["hex"]] = "group color `%s`" % slot if slot else "group color"
    for c in colors[:8]:
        lines.append("| %s | %.0f%% | %s |" % (c["hex"], c["share"] * 100, used.get(c["hex"], "not used (too close to another)")))
    lines += ["", "## Group colors", "",
              "Mark groups with these classes (`box teal`, `chip amber`, `box zone violet`). The names are slots, not literal colors: here is what each one looks like in this project.", "",
              "| Class | Use it for | Fill | Line | Dark fill | Dark line | From |", "| --- | --- | --- | --- | --- | --- | --- |"]
    for name, meaning in SLOTS:
        s = p["slots"][name]
        lines.append("| `%s` | %s | %s | %s | %s | %s | %s |" % (name, meaning, s["fill"], s["line"], s["fill_dark"], s["line_dark"], s["from"]))
    lines += ["", "## Neutrals", "", "| Token | Light | Dark | Role |", "| --- | --- | --- | --- |"]
    for t, role in (("--ink", "titles and names"), ("--quiet", "notes and arrow labels"), ("--edge", "outlines and arrows"),
                    ("--paper", "the canvas and device bodies"), ("--accent", "the one highlight")):
        lines.append("| `%s` | %s | %s | %s |" % (t, p["light"][t], p["dark"][t], role))
    lines += ["", "## Tokens", "",
              "This block is what `theme.py --brand` applies. Edit values here to adjust the palette, and keep the light and dark blocks in step.", "",
              "```css", tokens_css(p), "```", "",
              "## Project notes", "",
              "Add any house rules here (for example: \"always use the pastel treatment for slides\" or \"customers are always `violet`\"). The skill reads this section too.", ""]
    return "\n".join(lines)


SWATCH = """<svg xmlns="http://www.w3.org/2000/svg" width="760" height="{h}" viewBox="0 0 760 {h}" role="img" aria-label="Diagram palette">
  <style>
</style>
  <defs><marker id="pal-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="head" d="M0 0L10 5L0 10z"/></marker></defs>
  <text class="title" x="24" y="34">Diagram palette</text>
  <text class="note" x="24" y="54">Group colors, the accent and the neutrals, as the {t} treatment draws them</text>
{body}
</svg>
"""


def swatch_svg(p):
    els, y = [], 80
    for i, (name, meaning) in enumerate(SLOTS):
        x = 24 + (i % 3) * 240
        yy = y + (i // 3) * 96
        els.append('  <rect class="box %s" x="%d" y="%d" width="224" height="72" rx="8"/>' % (name, x, yy))
        els.append('  <text class="name" x="%d" y="%d">%s</text>' % (x + 12, yy + 24, name))
        els.append('  <text class="note" x="%d" y="%d">%s</text>' % (x + 12, yy + 40, SHORT[name]))
        els.append('  <rect class="chip %s" x="%d" y="%d" width="76" height="22" rx="11"/>' % (name, x + 12, yy + 44))
        els.append('  <text class="small mid" x="%d" y="%d">%s</text>' % (x + 50, yy + 59, p["slots"][name]["fill"]))
    y += 2 * 96 + 8
    els.append('  <rect class="key" x="24" y="%d" width="712" height="40" rx="8"/>' % y)
    els.append('  <text class="name" x="40" y="%d">Accent</text>' % (y + 24))
    els.append('  <text x="112" y="%d">%s marks the one thing to remember</text>' % (y + 24, p["light"]["--accent"]))
    return SWATCH.format(h=y + 64, t=p["treatment"], body="\n".join(els))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("images", nargs="*", help="logo, slide or screenshot with the brand's colors")
    ap.add_argument("--out", help="where to write the palette (default: the library's STYLE.md)")
    ap.add_argument("--treatment", default="pastel", choices=["quiet", "pastel", "gradient", "zones"])
    ap.add_argument("--accent", help="force the accent (hex), e.g. when the image's main color isn't the one you want")
    ap.add_argument("--preview", metavar="DIR", help="render swatches and example diagrams in the new palette")
    ap.add_argument("--force", action="store_true", help="replace an existing brand palette in STYLE.md")
    args = ap.parse_args()
    if not args.images and not args.accent:
        ap.error("give at least one image, or --accent")
    if not args.out:
        sys.path.insert(0, HERE)
        import library
        args.out = os.path.join(library.resolve(), "STYLE.md")
    notes = None
    if os.path.exists(args.out):
        old = open(args.out, encoding="utf-8").read()
        if re.search(r"```css\s*svg\{", old) and not args.force:
            sys.exit("%s already has a brand palette. Show the user what would change, then rerun with --force to replace it." % args.out)
        m = re.search(r"^## Project notes\n.*", old, re.S | re.M)
        notes = m.group(0) if m else None
    colors, _ = brand_colors(args.images) if args.images else ([], [])
    primary, secondaries = pick(colors, args.accent)
    p = build(primary, secondaries, args.treatment, args.images)
    md = diagram_md(p, colors)
    if notes:
        md = re.sub(r"^## Project notes\n.*", lambda _: notes, md, count=1, flags=re.S | re.M)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    open(args.out, "w", encoding="utf-8").write(md if md.endswith("\n") else md + "\n")
    print("wrote %s" % args.out)
    print("accent %s (from %s)" % (p["light"]["--accent"], primary["hex"]))
    for c in colors[:6]:
        print("  found %s  %4.1f%%  L=%.2f C=%.3f h=%3.0f" % (c["hex"], c["share"] * 100, c["L"], c["C"], c["h"]))
    for name, _ in SLOTS:
        s = p["slots"][name]
        print("  %-6s fill %s line %s  (%s)" % (name, s["fill"], s["line"], s["from"]))
    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        sys.path.insert(0, HERE)
        import theme as theme_mod
        sw = os.path.join(args.preview, "palette.svg")
        open(sw, "w").write(theme_mod.apply_brand(swatch_svg(p), args.out))
        outs = [sw]
        for ex in ("smart-speaker-anatomy", "scene-passkey-login"):
            src = os.path.join(SKILL, "references", "examples", ex + ".svg")
            if os.path.exists(src):
                dst = os.path.join(args.preview, ex + ".brand.svg")
                open(dst, "w").write(theme_mod.apply_brand(open(src).read(), args.out))
                outs.append(dst)
        for f in outs:
            subprocess.run([sys.executable, "-I", os.path.join(HERE, "check.py"), f, "--png", args.preview], capture_output=True)
        print("previews in %s (look at the .light.png and .dark.png files)" % args.preview)


if __name__ == "__main__":
    main()
