"""Device mockups for crisp-diagrams scenes (see references/visuals.md).

Every component returns a list of SVG element strings in its own local coordinates.
Place one with g(x, y, elements). Example:

    import sys; sys.path.insert(0, "<skill-dir>/scripts")
    from components import *
    parts = [g(40, 80, phone(scr_login("Acme", key_alt=True))),
             g(350, 188, rack("teal")),
             arrow("M202 218H338", "mydiagram")]
    parts += chip(270, 190, "challenge")
    parts += caption(115, "Your phone", "Face ID unlocks the passkey")

Then wrap the strings in the template's <svg> (assets/template.svg), keeping its <style>
and a marker whose id matches the arrow() calls ("<slug>-arrow").
"""
import html

UI_CW = 5.2  # avg px per character for 10px UI text


def esc(s):
    return html.escape(s, quote=False)


def R(x, y, w, h, cls, rx=0):
    return '<rect class="%s" x="%g" y="%g" width="%g" height="%g" rx="%g"/>' % (cls, x, y, w, h, rx)


def C(cx, cy, r, cls):
    return '<circle class="%s" cx="%g" cy="%g" r="%g"/>' % (cls, cx, cy, r)


def P(d, cls):
    return '<path class="%s" d="%s"/>' % (cls, d)


def T(x, y, s, cls):
    return '<text class="%s" x="%g" y="%g">%s</text>' % (cls, x, y, esc(s))


def g(x, y, els):
    return '<g transform="translate(%g %g)">%s</g>' % (x, y, "".join(els))


def uwrap(s, width):
    maxc = max(6, int(width / UI_CW))
    lines, cur = [], ""
    for w in s.split():
        if cur and len(cur) + 1 + len(w) > maxc:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    return lines + ([cur] if cur else [])


# ------------------------------------------------------------ icons

try:
    from icons import ICONS
except ImportError:  # imported as a package
    from .icons import ICONS


def icon(name, x, y, size=20, hue="", accent=False):
    """A line icon from icons.py, size x size, top-left at (x, y). hue tints it in colorful themes; accent=True
    draws it in the accent color (only inside the key element)."""
    if name not in ICONS:
        raise KeyError("unknown icon %r; see icons.py for the %d names" % (name, len(ICONS)))
    cls = " ".join(c for c in ("icon", hue, "accent" if accent else "") if c)
    return '<g class="%s" transform="translate(%g %g) scale(%g)">%s</g>' % (cls, x, y, size / 24.0, "".join(ICONS[name]))


def badge(name, x, y, hue="", size=32):
    """An icon on a small rounded tile (size x size): gray in the quiet theme, the group's color in colorful ones."""
    pad = (size - 20) / 2.0
    return [R(x, y, size, size, ("badge " + hue).strip(), 9), icon(name, x + pad, y + pad, 20, hue)]


# ------------------------------------------------------------ devices

def phone(screen):
    """150 x 300. Screen content area: x 17..133, y 36..276."""
    return [R(0, 0, 150, 300, "device", 24), R(7, 7, 136, 286, "screen", 18), R(56, 15, 38, 11, "island", 5.5)] + screen + \
           [R(56, 283, 38, 3, "ui", 1.5)]


def window(w, h, top):
    """Browser or terminal frame: three dots, a divider at y=28, content from y=36."""
    return [R(0, 0, w, h, "device", 10), C(14, 14, 3.5, "ui"), C(26, 14, 3.5, "ui"), C(38, 14, 3.5, "ui"),
            P("M0 28H%g" % w, "line")] + top


def browser(url, content, w=260, h=170):
    return window(w, h, [R(52, 6, w - 64, 16, "field", 8), T(62, 18, url, "uinote")]) + content


def terminal(lines, w=240, h=150):
    return window(w, h, []) + [T(14, 50 + 16 * i, l, "uitext code") for i, l in enumerate(lines)]


def laptop(content, w=268, h=170):
    """Laptop: lid with a screen (content area x 14..w-14, y 14..h-14) and a base. Total height h+14."""
    return [R(6, 0, w - 12, h, "device", 10), R(14, 10, w - 28, h - 20, "screen", 4)] + content + \
           [P("M0 %g H%g L%g %g Q%g %g %g %g H%g Q%g %g 0 %g Z" % (h, w, w - 4, h + 10, w - 6, h + 14, w - 12, h + 14, 12, 6, h + 14, h), "device")]


def rack(hue="", w=100, units=3):
    """Server: stacked units 24 tall, 6 apart (3 units = 84 tall)."""
    els = []
    for i in range(units):
        y = 30 * i
        els += [R(0, y, w, 24, ("device " + hue).strip(), 6), C(14, y + 12, 3, "ui"), C(25, y + 12, 3, "ui"),
                R(w - 38, y + 10, 26, 4, "ui", 2)]
    return els


def database(hue="", w=84, h=96):
    rx, ry = w / 2, 12
    return [P("M0 %g A%g %g 0 0 1 %g %g V%g A%g %g 0 0 1 0 %g Z" % (ry, rx, ry, w, ry, h - ry, rx, ry, h - ry), ("device " + hue).strip()),
            P("M0 %g A%g %g 0 0 0 %g %g" % (ry, rx, ry, w, ry), "glyph")]


def bot(hue=""):
    """Agent: 56 x 52; the body is y 12..52."""
    return [P("M28 3V12", "glyph"), C(28, 3, 3, "btn"), R(4, 12, 48, 40, ("device " + hue).strip(), 12),
            C(20, 31, 3.5, "btn"), C(36, 31, 3.5, "btn"), P("M22 41H34", "glyph")]


def person():
    """48 x 50."""
    return [C(24, 14, 10, "glyph"), P("M4 50C4 37 13 31 24 31C35 31 44 37 44 50", "glyph")]


def qr():
    """64 x 64 stylized QR code."""
    els = [R(0, 0, 64, 64, "field", 4)]
    for fx, fy in ((6, 6), (44, 6), (6, 44)):
        els += [R(fx, fy, 14, 14, "btn", 2), R(fx + 3, fy + 3, 8, 8, "field", 1), R(fx + 5, fy + 5, 4, 4, "btn", 1)]
    for mx, my in ((26, 8), (32, 14), (26, 20), (38, 26), (26, 32), (44, 32), (32, 38), (50, 44), (26, 46), (38, 50), (50, 54), (32, 54)):
        els.append(R(mx, my, 4, 4, "btn", 1))
    return els


# ------------------------------------------------------------ phone screens

def scr_login(app, field="you@example.com", primary="Continue", alt="Use a passkey", key_alt=False):
    els = [C(75, 66, 13, "ui"), T(75, 100, "Sign in to " + app, "uitext strong mid"),
           R(17, 114, 116, 26, "field", 7), T(27, 131, field, "uinote"),
           R(17, 148, 116, 26, "btn", 7), T(75, 165, primary, "btn-text mid"),
           T(75, 194, "or", "uinote mid")]
    if key_alt:
        els.append(R(11, 198, 128, 38, "key", 10))
    return els + [R(17, 204, 116, 26, "field", 7), T(75, 221, alt, "uitext mid")]


def scr_list(title, rows):
    els = [T(17, 52, title, "uitext strong")]
    for i, (a, b) in enumerate(rows[:4]):
        y = 64 + 46 * i
        els += [R(17, y, 116, 38, "field", 8), C(33, y + 19, 8, "ui"), T(47, y + 16, a, "uitext"), T(47, y + 29, b, "uinote")]
    return els + [P("M17 250H133", "line"), C(43, 264, 4, "btn"), C(75, 264, 4, "ui"), C(107, 264, 4, "ui")]


def scr_chat(title, msgs):
    els = [T(75, 52, title, "uitext strong mid")]
    y = 66
    for side, text in msgs:
        lines = uwrap(text, 90)
        w = min(110, max(len(l) for l in lines) * UI_CW + 18)
        h = 10 + 13 * len(lines)
        x = 17 if side == "in" else 133 - w
        els.append(R(x, y, w, h, "field" if side == "in" else "btn", 9))
        for j, l in enumerate(lines):
            els.append(T(x + 9, y + 16 + 13 * j, l, "uitext" if side == "in" else "uitext inv"))
        y += h + 8
    return els + [R(17, 248, 116, 24, "field", 12), T(29, 264, "Message", "uinote")]


def scr_channel(channel, msgs, filler=1):
    """Team chat channel (Slack-style): msgs = [(name, text)], newest last. Names are bold, text wraps at ~20 chars."""
    els = [T(17, 52, "# " + channel, "uitext strong"), P("M17 60H133", "line")]
    y = 72
    for _ in range(filler):
        els += [C(25, y + 6, 6, "ui"), R(36, y, 60, 5, "ui", 2.5), R(36, y + 9, 88, 5, "ui", 2.5)]
        y += 26
    for name, text in msgs:
        lines = uwrap(text, 92)
        els += [C(25, y + 6, 6, "ui"), T(36, y + 9, name, "uitext strong")]
        for j, l in enumerate(lines):
            els.append(T(36, y + 22 + 13 * j, l, "uitext"))
        y += 22 + 13 * len(lines) + 10
    return els + [R(17, 248, 116, 24, "field", 12), T(29, 264, "Message #" + channel, "uinote")]


def scr_consent(app, scopes, key=True):
    els = [C(75, 60, 12, "ui"), T(75, 90, app, "uitext strong mid"), T(75, 104, "wants to:", "uinote mid")]
    if key:
        els.append(R(11, 114, 128, 24 * len(scopes) + 12, "key", 10))
    for i, (label, on) in enumerate(scopes):
        y = 122 + 24 * i
        if on:
            els += [R(19, y, 12, 12, "btn", 3), P("M22 %g l2.5 2.5 l4.5 -5" % (y + 6.5), "tick")]
        else:
            els.append(R(19, y, 12, 12, "field", 3))
        els.append(T(38, y + 10, label, "uitext"))
    by = 122 + 24 * len(scopes) + 24
    return els + [R(17, by, 54, 26, "field", 7), T(44, by + 17, "Cancel", "uitext mid"),
                  R(79, by, 54, 26, "btn", 7), T(106, by + 17, "Allow", "btn-text mid")]


def scr_push(app, title, body, key=True):
    els = [T(75, 50, "14:02", "uitext strong mid"), T(75, 63, "Tuesday 8 October", "uinote mid")]
    if key:
        els.append(R(9, 74, 132, 122, "key", 14))
    els += [R(15, 80, 120, 110, "field", 12), C(29, 96, 6, "ui"), T(41, 99, app, "uitext strong")]
    lines = uwrap(title, 100)[:2]
    for j, l in enumerate(lines):
        els.append(T(23, 120 + 13 * j, l, "uitext"))
    els.append(T(23, 120 + 13 * len(lines), body, "uinote"))
    return els + [R(19, 160, 54, 22, "field", 6), T(46, 175, "Decline", "uitext mid"),
                  R(77, 160, 54, 22, "btn", 6), T(104, 175, "Approve", "btn-text mid")]


def scr_code(code, key=True):
    els = [C(75, 66, 13, "ui"), T(75, 100, "Connect a device", "uitext strong mid"), T(75, 114, "Enter the code shown", "uinote mid")]
    if key:
        els.append(R(11, 124, 128, 38, "key", 10))
    return els + [R(17, 130, 116, 26, "field", 7), T(75, 147, code, "uitext code strong mid"),
                  R(17, 176, 116, 26, "btn", 7), T(75, 193, "Continue", "btn-text mid")]


def scr_approve(title, sub, yes="Sign in", no="Not me", key=True):
    els = [C(75, 70, 14, "ui")]
    lines = uwrap(title, 104)
    for j, l in enumerate(lines):
        els.append(T(75, 106 + 13 * j, l, "uitext strong mid"))
    els.append(T(75, 110 + 13 * len(lines), sub, "uinote mid"))
    els += [R(17, 170, 116, 26, "field", 7), T(75, 187, no, "uitext mid")]
    if key:
        els.append(R(11, 206, 128, 38, "key", 10))
    return els + [R(17, 212, 116, 26, "btn", 7), T(75, 229, yes, "btn-text mid")]


# ------------------------------------------------------------ scene helpers

def arrow(d, slug):
    """A connector path with the diagram's arrowhead (marker id "<slug>-arrow")."""
    return '<g class="line"><path d="%s" marker-end="url(#%s-arrow)"/></g>' % (d, slug)


def row(widths, left=24, right=736, captions=None):
    """x positions for objects of these widths, spread so every gap is equal. Returns (xs, gap).
    Pass captions (the longest line under each object) so a narrow object at either end is pulled
    in far enough for its centered caption to stay inside the 24px margins."""
    if captions:
        cw = [len(c) * 6.0 for c in captions]
        left = max(left, 24 + cw[0] / 2 - widths[0] / 2)
        right = min(right, 736 - cw[-1] / 2 + widths[-1] / 2)
    gap = (right - left - sum(widths)) / max(len(widths) - 1, 1)
    xs, x = [], left
    for w in widths:
        xs.append(x)
        x += w + gap
    return xs, gap


def chip(cx, y, text, key=False, num=None):
    """A code chip centered on cx, 22 tall, 10px monospace. key=True makes it the accent; num prefixes a step number."""
    if num is not None:
        text = "%s %s" % (num, text)
    w = round(len(text) * 6.0 + 16)
    return [R(cx - w / 2, y, w, 22, "key" if key else "field", 6), T(cx, y + 15, text, "uitext code mid")]


def caption(cx, name, note, y):
    """Name and note under an object, centered on cx. Use one shared y for every object in a scene."""
    return [T(cx, y, name, "name mid"), T(cx, y + 16, note, "note mid")]


def two_way(x1, x2, req, resp, slug, axis=230, req_key=False, stack=None, nums=(None, None)):
    """Request arrow above the axis (x1 -> x2) with its chip, response below (x2 -> x1) with its chip.
    stack adds a second chip above the request (for example the token that rides along)."""
    els = [arrow("M%g %gH%g" % (x1, axis - 12, x2), slug), arrow("M%g %gH%g" % (x2, axis + 12, x1), slug)]
    cx = (x1 + x2) / 2
    if stack:
        els += chip(cx, axis - 68, stack)
    if req:
        els += chip(cx, axis - 40, req, key=req_key, num=nums[0])
    if resp:
        els += chip(cx, axis + 18, resp, num=nums[1])
    return els


def one_way(x1, x2, label, slug, axis=230, key=False, num=None):
    """A single arrow on the axis with its chip above."""
    els = [arrow("M%g %gH%g" % (x1, axis, x2), slug)]
    if label:
        els += chip((x1 + x2) / 2, axis - 28, label, key=key, num=num)
    return els
