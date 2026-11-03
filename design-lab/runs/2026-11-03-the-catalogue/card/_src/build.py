#!/usr/bin/env python3
"""Builds each vN-*.html in the card folder from _src/vN-*.src.html plus the shared
common.css and common.js (inlined, so every prototype is one file that only links the kit)."""
import pathlib
here = pathlib.Path(__file__).resolve().parent
css = (here / 'common.css').read_text()
js = (here / 'common.js').read_text()
for f in sorted(here.glob('v*.src.html')):
    out = here.parent / f.name.replace('.src', '')
    t = f.read_text().replace('/*@COMMON_CSS*/', css).replace('/*@COMMON_JS*/', js)
    out.write_text(t)
    print('built', out.name)
