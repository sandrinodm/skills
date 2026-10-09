#!/usr/bin/env python3
"""Keep a project's diagrams in one folder: one subfolder per diagram, a STYLE.md and a browsable index.html.

usage: python3 library.py where [--dir DIR]                 # print the library folder (creates nothing)
       python3 library.py publish <library>/<name>/<name>.svg  # PNG + STYLE.md if missing + index.html
       python3 library.py index [--dir DIR]                 # rebuild index.html only

Layout:
  <library>/STYLE.md             the project's diagram style: theme or brand palette, plus house rules
  <library>/index.html           every diagram, each viewable as SVG, PNG or prompt
  <library>/<name>/<name>.svg    the diagram; switches to dark mode by itself
  <library>/<name>/<name>.png    a 3x light-mode PNG for slides and tools that can't show SVG
  <library>/<name>/prompt.md     the request and the brief, so the diagram can be redrawn or tweaked

The library is the folder given with --dir; otherwise the folder of an existing STYLE.md written by this
skill anywhere in the project; otherwise ./diagrams.
"""
import argparse
import datetime
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
TEMPLATE = os.path.join(SKILL, "assets", "library.html")
MARKER = "<!-- crisp-diagrams style -->"
SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "dist", "build", "vendor", ".next", "target", "__pycache__"}

DEFAULT_STYLE = """# Diagram style

{marker}
Every diagram in this folder is drawn with the crisp-diagrams skill, which reads this file before drawing. Edit it by hand, or tell the skill what you want ("use pastel from now on", "customers are always teal") and it updates this file.

- **Theme:** quiet
- **Created:** {date}

Themes: `quiet` (outlines and one blue accent; docs and READMEs), `pastel` (soft group colors; slides), `gradient` (product pages), `zones` (trust boundaries and teams). Brand colors from a logo or slide replace this list with a palette (`palette.py`).

## Project notes

House rules for this project's diagrams, one per line. The skill follows them in every diagram.

"""


def project_root(start=None):
    d = os.path.abspath(start or os.getcwd())
    while True:
        if os.path.exists(os.path.join(d, ".git")):
            return d
        if os.path.dirname(d) == d:
            return os.path.abspath(start or os.getcwd())
        d = os.path.dirname(d)


def find_library(start=None, max_depth=4):
    """The folder holding this skill's STYLE.md, searching the project from its root. None if there isn't one."""
    root = project_root(start)
    found = []
    for d, dirs, files in os.walk(root):
        depth = os.path.relpath(d, root).count(os.sep) + (0 if d == root else 1)
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS and not x.startswith(".") and depth < max_depth]
        if "STYLE.md" in files:
            with open(os.path.join(d, "STYLE.md"), encoding="utf-8") as f:
                if MARKER in f.read():
                    found.append(d)
    return min(found, key=lambda p: (p.count(os.sep), p)) if found else None


def resolve(dir_arg=None):
    if dir_arg:
        return os.path.abspath(dir_arg)
    return find_library() or os.path.join(os.getcwd(), "diagrams")


def ensure_style(library):
    path = os.path.join(library, "STYLE.md")
    if not os.path.exists(path):
        os.makedirs(library, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(DEFAULT_STYLE.format(marker=MARKER, date=datetime.date.today().isoformat()))
        print("created " + path)
    return path


def svg_size(svg_text):
    w = re.search(r'<svg[^>]*\swidth="([\d.]+)"', svg_text)
    h = re.search(r'<svg[^>]*\sheight="([\d.]+)"', svg_text)
    if w and h:
        return float(w.group(1)), float(h.group(1))
    vb = re.search(r'<svg[^>]*\sviewBox="[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"', svg_text)
    return (float(vb.group(1)), float(vb.group(2))) if vb else (760.0, 480.0)


def render_png(svg_path, png_path, scale=3, dark=False):
    sys.path.insert(0, HERE)
    import check
    chrome = check.find_chrome()
    if not chrome:
        print("warning no Chrome/Chromium found (set CHROME=/path/to/chrome): skipped " + png_path)
        return False
    svg_text = open(svg_path, encoding="utf-8").read()
    w, h = svg_size(svg_text)
    args = ["--force-device-scale-factor=%s" % scale, "--window-size=%d,%d" % (round(w), round(h)),
            "--screenshot=" + os.path.abspath(png_path), "--blink-settings=preferredColorScheme=%d" % (0 if dark else 1)]
    if dark:
        args.append("--force-dark-mode")
    if os.path.exists(png_path):
        os.remove(png_path)
    check.run_chrome(chrome, check.page_html(svg_text, dark), args)
    return os.path.exists(png_path)


def diagram_svg(folder):
    name = os.path.basename(folder)
    preferred = os.path.join(folder, name + ".svg")
    if os.path.exists(preferred):
        return preferred
    svgs = sorted(f for f in os.listdir(folder) if f.endswith(".svg"))
    return os.path.join(folder, svgs[0]) if svgs else None


def diagram_info(library, folder):
    svg = diagram_svg(folder)
    text = open(svg, encoding="utf-8").read()
    label = re.search(r'<svg[^>]*\saria-label="([^"]*)"', text) or re.search(r"<title>(.*?)</title>", text, re.S)
    stem = os.path.splitext(os.path.basename(svg))[0]
    png = os.path.join(folder, stem + ".png")
    prompt = os.path.join(folder, "prompt.md")
    w, h = svg_size(text)
    rel = lambda p: os.path.relpath(p, library).replace(os.sep, "/")
    return {
        "name": os.path.basename(folder),
        "title": html.unescape(label.group(1).strip()) if label else os.path.basename(folder),
        "svg": rel(svg),
        "png": rel(png) if os.path.exists(png) else None,
        "prompt": open(prompt, encoding="utf-8").read() if os.path.exists(prompt) else None,
        "promptFile": rel(prompt) if os.path.exists(prompt) else None,
        "updated": datetime.date.fromtimestamp(os.path.getmtime(svg)).isoformat(),
        "mtime": os.path.getmtime(svg),
        "width": w,
        "height": h,
    }


def display_path(library):
    """The library's path from the project root (docs/diagrams), or its folder name."""
    for base in (project_root(library), project_root()):
        rel = os.path.relpath(library, base)
        if rel != "." and not rel.startswith(".."):
            return rel.replace(os.sep, "/")
    return os.path.basename(library)


def build_index(library):
    folders = [os.path.join(library, d) for d in os.listdir(library)
               if os.path.isdir(os.path.join(library, d)) and not d.startswith(".")]
    diagrams = sorted((diagram_info(library, f) for f in folders if diagram_svg(f)), key=lambda d: -d["mtime"])
    for d in diagrams:
        del d["mtime"]
    data = json.dumps(diagrams, ensure_ascii=False).replace("</", "<\\/")
    page = open(TEMPLATE, encoding="utf-8").read()
    page = page.replace("__DIAGRAMS_JSON__", data)
    page = page.replace("__HAS_STYLE__", "true" if os.path.exists(os.path.join(library, "STYLE.md")) else "false")
    page = page.replace("__LIBRARY_PATH__", html.escape(display_path(library)))
    out = os.path.join(library, "index.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(page)
    print("wrote %s (%d diagram%s)" % (out, len(diagrams), "" if len(diagrams) == 1 else "s"))
    return out


def publish(target, scale, dark):
    svg = os.path.abspath(target)
    if os.path.isdir(svg):
        svg = diagram_svg(svg) or sys.exit("no .svg in " + target)
    folder = os.path.dirname(svg)
    library = os.path.dirname(folder)
    stem = os.path.splitext(os.path.basename(svg))[0]
    if stem != os.path.basename(folder):
        print("warning %s: name the file after its folder (%s.svg) so the library stays predictable" % (svg, os.path.basename(folder)))
    png = os.path.join(folder, stem + ".png")
    if render_png(svg, png, scale):
        print("wrote " + png)
    if dark and render_png(svg, os.path.join(folder, stem + ".dark.png"), scale, dark=True):
        print("wrote " + os.path.join(folder, stem + ".dark.png"))
    if not os.path.exists(os.path.join(folder, "prompt.md")):
        print("warning no prompt.md in %s: write the request and the brief there so the diagram can be redrawn" % folder)
    ensure_style(library)
    build_index(library)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    w = sub.add_parser("where", help="print the library folder")
    w.add_argument("--dir", help="use this folder (for example docs/diagrams)")
    p = sub.add_parser("publish", help="render the PNG, create STYLE.md if missing and rebuild index.html")
    p.add_argument("svg", help="<library>/<name>/<name>.svg, or the diagram's folder")
    p.add_argument("--scale", type=float, default=3, help="PNG pixel density (default 3)")
    p.add_argument("--dark", action="store_true", help="also write <name>.dark.png")
    i = sub.add_parser("index", help="rebuild index.html")
    i.add_argument("--dir", help="the library folder")
    args = ap.parse_args()
    if args.cmd == "where":
        lib = resolve(args.dir)
        print(lib)
        if not os.path.exists(os.path.join(lib, "STYLE.md")):
            print("(new library: STYLE.md is created when the first diagram is published)", file=sys.stderr)
    elif args.cmd == "publish":
        publish(args.svg, args.scale, args.dark)
    else:
        build_index(resolve(args.dir))


if __name__ == "__main__":
    main()
