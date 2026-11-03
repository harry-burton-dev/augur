#!/usr/bin/env python3
"""Assemble each v*.src.html into ../v*.html with the shared CSS, data and helpers inlined
(the kit itself stays linked). usage: python3 build.py"""
import pathlib
here = pathlib.Path(__file__).parent
css = (here / 'common.css').read_text()
data = (here / 'data.js').read_text()
lib = (here / 'lib.js').read_text()
for src in sorted(here.glob('v*.src.html')):
    out = src.read_text().replace('/*@CSS@*/', css).replace('/*@DATA@*/', data).replace('/*@LIB@*/', lib)
    (here.parent / src.name.replace('.src', '')).write_text(out)
    print('built', src.name.replace('.src', ''))
