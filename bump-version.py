#!/usr/bin/env python3
"""Cache-busting for the static site. Run this before every deploy that changes anything in assets/:

    python3 bump-version.py

Browsers (and GitHub Pages) keep ES modules in cache, so a visitor could run a NEW analysis.js against an OLD
analysisData.js and see an empty page. This gives every module and the stylesheet a version in its URL
(?v=<timestamp>): it rewrites the stylesheet link and the entry <script> of each page, and writes an import map
that maps every assets/*.js to the same versioned URL, so modules that import each other stay in step."""
import glob
import json
import os
import re
import time

VER = time.strftime("%Y%m%d%H%M%S")
mods = sorted(os.path.basename(p) for p in glob.glob("assets/*.js"))
imap = {"imports": {f"./assets/{m}": f"./assets/{m}?v={VER}" for m in mods}}
block = '<script type="importmap" data-bump>\n' + json.dumps(imap, indent=1) + "\n</script>"
for page in sorted(glob.glob("*.html")):
    h = open(page, encoding="utf-8").read()
    h = re.sub(r'<script type="importmap" data-bump>.*?</script>\n?', "", h, flags=re.S)
    h = re.sub(r'href="assets/style\.css(\?v=\d+)?"', f'href="assets/style.css?v={VER}"', h)
    h = re.sub(r'(<script type="module" src="assets/[A-Za-z0-9_.-]+?\.js)(\?v=\d+)?"', lambda m: f'{m.group(1)}?v={VER}"', h)
    entry = re.search(r'<script type="module" src="assets/', h)
    if entry:
        h = h[:entry.start()] + block + "\n" + h[entry.start():]
    open(page, "w", encoding="utf-8").write(h)
print("version", VER, "->", len(mods), "modules,", len(glob.glob("*.html")), "pages")
