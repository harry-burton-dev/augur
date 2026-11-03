#!/usr/bin/env python3
"""Inline common.css and common.js into each variant. Run: python3 -I _src/build.py (from the folder)."""
import pathlib, re
src = pathlib.Path(__file__).resolve().parent
out = src.parent
css = (src / 'common.css').read_text()
js = (src / 'common.js').read_text()
for f in sorted(src.glob('v*.html')):
    s = f.read_text().replace('/*@CSS*/', css).replace('/*@JS*/', js)
    (out / f.name).write_text(s)
    print('built', f.name)
