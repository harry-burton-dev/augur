#!/usr/bin/env python3
"""Assemble the grammar sheets: each vN-*.tpl.html gets the shared CSS, sample data and helpers inlined."""
import pathlib, re
src = pathlib.Path(__file__).parent
out = src.parent
css = (src / 'common.css').read_text()
data = (src / 'data.js').read_text()
js = (src / 'common.js').read_text()
for tpl in sorted(src.glob('v*.tpl.html')):
    t = tpl.read_text()
    t = t.replace('/*COMMON_CSS*/', css).replace('/*DATA*/', data).replace('/*COMMON_JS*/', js)
    (out / tpl.name.replace('.tpl', '')).write_text(t)
    print('built', tpl.name.replace('.tpl', ''))
