#!/usr/bin/env python3
"""Assemble every <surface>/_src/v*.src.html into <surface>/v*.html with the run's shared
CSS, data and helpers inlined (the kit itself stays linked). usage: python3 _src/build.py [surface]"""
import pathlib, sys
here = pathlib.Path(__file__).parent
run = here.parent
css = (here / 'common.css').read_text()
data = (here / 'data.js').read_text()
lib = (here / 'lib.js').read_text()
only = sys.argv[1:] or None
for src in sorted(run.glob('*/_src/v*.src.html')):
    surface = src.parent.parent
    if only and surface.name not in only: continue
    out = src.read_text().replace('/*@CSS@*/', css).replace('/*@DATA@*/', data).replace('/*@LIB@*/', lib)
    (surface / src.name.replace('.src', '')).write_text(out)
    print('built', surface.name + '/' + src.name.replace('.src', ''))
