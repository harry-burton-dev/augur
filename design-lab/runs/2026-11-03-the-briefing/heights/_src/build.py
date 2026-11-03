#!/usr/bin/env python3
"""Assemble each variant from _src: shared data, CSS and helpers plus the
variant's own css/html/js. Writes v*-*.html next to _src. Run from anywhere."""
import pathlib
SRC = pathlib.Path(__file__).resolve().parent
OUT = SRC.parent
common_css = (SRC / 'common.css').read_text()
data_js = (SRC / 'data.js').read_text()
common_js = (SRC / 'common.js').read_text()
for html in sorted(SRC.glob('v*.html')):
    stem = html.stem
    css = (SRC / f'{stem}.css').read_text()
    js = (SRC / f'{stem}.js').read_text()
    body = html.read_text()
    title, body = body.split('\n', 1)
    page = f'''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>{title.strip()}</title>
<link rel="stylesheet" href="../../../_kit/tokens.css">
<script src="../../../_kit/icons.js"></script>
<style>
{common_css}
/* ===================== this variant ===================== */
{css}
</style>
</head>
<body>
{body}
<script>
{data_js}
{common_js}
/* ===================== this variant ===================== */
{js}
</script>
</body>
</html>
'''
    (OUT / f'{stem}.html').write_text(page)
    print('wrote', stem)
