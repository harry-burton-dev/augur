#!/usr/bin/env python3
"""Assemble each _src/<surface>/v*.src.html into <surface>/v*.html with the shared CSS,
data and helpers inlined (the kit itself stays linked). usage: python3 build.py [surface]"""
import pathlib, sys
here = pathlib.Path(__file__).parent
css = (here / 'common.css').read_text()
data = (here / 'data.js').read_text()
lib = (here / 'lib.js').read_text()
only = sys.argv[1:] or None
for src in sorted(here.glob('*/v*.src.html')):
    surface = src.parent.name
    if only and surface not in only:
        continue
    out = src.read_text().replace('/*@CSS@*/', css).replace('/*@DATA@*/', data).replace('/*@LIB@*/', lib)
    dest = here.parent / surface / src.name.replace('.src', '')
    dest.write_text(out)
    print('built', surface + '/' + dest.name)
