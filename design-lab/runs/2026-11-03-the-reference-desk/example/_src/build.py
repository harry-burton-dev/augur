#!/usr/bin/env python3
"""Inline the shared CSS, data and helpers into each variant. Run from anywhere."""
import pathlib, re
src = pathlib.Path(__file__).parent
out = src.parent
css = (src / 'common.css').read_text()
data = (src / 'data.js').read_text()
common = (src / 'common.js').read_text()
for f in sorted(src.glob('v[0-9]-*.html')):
    t = f.read_text()
    t = t.replace('/*COMMON_CSS*/', css).replace('/*DATA*/', data).replace('/*COMMON_JS*/', common)
    (out / f.name).write_text(t)
    print('built', f.name)
