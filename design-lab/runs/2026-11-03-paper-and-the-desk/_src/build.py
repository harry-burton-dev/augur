#!/usr/bin/env python3
"""Assemble every <surface>/v*.src.html into ../<surface>/v*.html with the shared CSS, data and
helpers inlined (the kit itself stays linked, as the brief says). usage: python3 build.py"""
import pathlib
here = pathlib.Path(__file__).parent
css = (here / 'common.css').read_text()
data = (here / 'data.js').read_text()
lib = (here / 'lib.js').read_text()
for src in sorted(here.glob('*/v*.src.html')):
    out = src.read_text().replace('/*@CSS@*/', css).replace('/*@DATA@*/', data).replace('/*@LIB@*/', lib)
    dest = here.parent / src.parent.name / src.name.replace('.src', '')
    dest.write_text(out)
    print('built', dest.relative_to(here.parent))
