#!/usr/bin/env python3
"""Restyle a crisp-diagrams SVG with another theme or with the project's brand palette.

usage: python3 theme.py diagram.svg --style [STYLE.md]   # apply the project's style (finds the library's STYLE.md)
       python3 theme.py diagram.svg --theme pastel [-o out.svg]
       python3 theme.py diagram.svg --brand STYLE.md [--treatment gradient] [-o out.svg]
       python3 theme.py diagram.svg --all OUT_DIR          # every stock theme, or every treatment with --brand

Stock themes live in ../assets/themes/<name>.css. STYLE.md names a stock theme (**Theme:** pastel), or
holds a brand palette as a ```css token block written by palette.py: the tokens replace the stock ones,
and the treatment (quiet, pastel, gradient, zones) decides how boxes use them. The script swaps the
<style> block and adds or removes the gradient definitions; geometry and text are untouched.
"""
import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
THEMES_DIR = os.path.join(HERE, "..", "assets", "themes")
GRADIENT_RE = re.compile(r'\s*<linearGradient id="cd-[^"]*".*?</linearGradient>', re.S)
TREATMENTS = ["quiet", "pastel", "gradient", "zones"]


def themes():
    return sorted(f[:-4] for f in os.listdir(THEMES_DIR) if f.endswith(".css"))


def find_style_md():
    """The library's STYLE.md (see library.py), or None."""
    sys.path.insert(0, HERE)
    import library
    lib = library.find_library()
    return os.path.join(lib, "STYLE.md") if lib else None


def style_of(md_path):
    """('brand', treatment) when STYLE.md holds a palette, else (stock theme, None)."""
    s = open(md_path, encoding="utf-8").read()
    if re.search(r"```css\s*svg\{", s):
        return "brand", None
    t = re.search(r"\*\*Theme:\*\*\s*([a-z]+)", s)
    theme = t.group(1) if t else "quiet"
    return (theme if theme in themes() else "quiet"), None


def read_brand(md_path):
    s = open(md_path, encoding="utf-8").read()
    m = re.search(r"```css\s*(svg\{.*?)```", s, re.S)
    if not m:
        sys.exit("%s has no ```css block with the svg{...} tokens (palette.py writes one)" % md_path)
    t = re.search(r"\*\*Treatment:\*\*\s*([a-z]+)", s)
    return m.group(1).strip(), (t.group(1) if t and t.group(1) in TREATMENTS else "pastel")


def stock_css(theme):
    path = os.path.join(THEMES_DIR, theme + ".css")
    if not os.path.exists(path):
        sys.exit("unknown theme %r; choose from %s, or use --brand STYLE.md" % (theme, ", ".join(themes())))
    return open(path).read().strip()


def brand_css(md_path, treatment=None):
    tokens, default = read_brand(md_path)
    treatment = treatment or default
    base = stock_css(treatment)
    base = re.sub(r"^svg\{[^}]*\}\n?", "", base, count=1, flags=re.M)
    base = re.sub(r"@media \(prefers-color-scheme:dark\)\{svg\{[^}]*\}\}\n?", "", base, count=1)
    head, _, rest = base.partition("\n")
    comment = "/* crisp-diagrams brand palette from STYLE.md, %s treatment */" % treatment
    return comment + "\n" + tokens + "\n" + (rest if head.startswith("/*") else base), treatment


def apply_css(svg, css, treatment):
    if not re.search(r"<style[^>]*>.*?</style>", svg, re.S):
        sys.exit("no <style> block found: start from assets/template.svg")
    svg = re.sub(r"(<style[^>]*>).*?(</style>)", lambda m: m.group(1) + "\n" + css + "\n" + m.group(2), svg, count=1, flags=re.S)
    svg = GRADIENT_RE.sub("", svg)
    defs_path = os.path.join(THEMES_DIR, treatment + "-defs.svg")
    if os.path.exists(defs_path):
        defs = "\n".join("    " + l for l in open(defs_path).read().strip().splitlines())
        if re.search(r"<defs\s*>", svg):
            svg = re.sub(r"(<defs\s*>)", lambda m: m.group(1) + "\n" + defs, svg, count=1)
        else:
            svg = re.sub(r"(</style>)", lambda m: m.group(1) + "\n  <defs>\n" + defs + "\n  </defs>", svg, count=1)
    return svg


def apply(svg, theme):
    return apply_css(svg, stock_css(theme), theme)


def apply_brand(svg, md_path, treatment=None):
    css, treatment = brand_css(md_path, treatment)
    return apply_css(svg, css, treatment)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svg")
    ap.add_argument("--style", nargs="?", const="auto", metavar="STYLE.md",
                    help="apply whatever STYLE.md says (a stock theme or a brand palette); without a path, use the library's")
    ap.add_argument("--theme", help="one of: %s, or 'brand' to use the library's STYLE.md palette" % ", ".join(themes()))
    ap.add_argument("--brand", metavar="STYLE.md", help="apply the palette from this STYLE.md")
    ap.add_argument("--treatment", choices=TREATMENTS, help="with --brand: override the treatment named in STYLE.md")
    ap.add_argument("-o", "--out", help="output path (default: overwrite the input)")
    ap.add_argument("--all", metavar="OUT_DIR", help="write every stock theme (or, with --brand, every treatment) into OUT_DIR")
    args = ap.parse_args()
    brand = args.brand
    if args.style:
        path = find_style_md() if args.style == "auto" else args.style
        if not path or not os.path.exists(path):
            sys.exit("no STYLE.md found: the library creates one when the first diagram is published (library.py publish)")
        kind, _ = style_of(path)
        if kind == "brand":
            brand = path
        else:
            args.theme = kind
    elif args.theme == "brand":
        brand = find_style_md()
        if not brand or style_of(brand)[0] != "brand":
            sys.exit("no brand palette in the library's STYLE.md; create one with palette.py")
    src = open(args.svg, encoding="utf-8").read()
    stem = os.path.splitext(os.path.basename(args.svg))[0]
    if args.all:
        os.makedirs(args.all, exist_ok=True)
        for t in (TREATMENTS if brand else themes()):
            out = os.path.join(args.all, "%s.%s%s.svg" % (stem, "brand-" if brand else "", t))
            open(out, "w", encoding="utf-8").write(apply_brand(src, brand, t) if brand else apply(src, t))
            print(out)
        return
    if not brand and not args.theme:
        ap.error("pass --style, --theme, --brand or --all")
    out = args.out or args.svg
    open(out, "w", encoding="utf-8").write(apply_brand(src, brand, args.treatment) if brand else apply(src, args.theme))
    print(out)


if __name__ == "__main__":
    main()
