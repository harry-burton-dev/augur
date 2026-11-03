#!/usr/bin/env python3
"""Builds designer a's round-2 pages: inlines common.css, data.js and lib.js
into each *.src.html. The built pages link the kit as the brief says."""
import pathlib
here = pathlib.Path(__file__).parent
out = here.parent.parent
css = (here / 'common.css').read_text()
js = (here / 'data.js').read_text() + '\n' + (here / 'lib.js').read_text()
for src in sorted(here.glob('*.src.html')):
    page = src.read_text().replace('/*@CSS*/', css).replace('/*@JS*/', js)
    (out / src.name.replace('.src.html', '.html')).write_text(page)
    print('built', src.name.replace('.src.html', '.html'))
