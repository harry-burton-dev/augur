#!/usr/bin/env python3
"""Builds v1..v6 from shared data, CSS and helpers plus each variant's own parts.
Run from anywhere: python3 _src/build.py. Each output keeps the kit links exact and
puts the one DATA object at the top of its script."""
import pathlib
SRC = pathlib.Path(__file__).resolve().parent
OUT = SRC.parent
V = [
    ('v1', 'date-due-slip', 'Saved · V1 · The date-due slip', 'Saved questions · V1</b> the question as a library card; each rerun stamps its slip · date-due slips, catalogue cards'),
    ('v2', 'register', 'Saved · V2 · The register', 'Saved questions · V2</b> each run is a column; a line of marks shows when a supplier joined or left, and why · attendance registers, muster rolls'),
    ('v3', 'two-clocks', 'Saved · V3 · Two clocks', 'Saved questions · V3</b> time as an address: drag what we knew past when it happened · bitemporal data, accounting “as at”, dynamic queries'),
    ('v4', 'two-desks', 'Saved · V4 · Two desks', 'Saved questions · V4</b> the same question rerun on another floor, rack-focused side by side · split screen, diff tools, focal planes'),
    ('v5', 'share-preview', 'Saved · V5 · Share with a preview', 'Saved questions · V5</b> choosing a floor previews what its people get when they rerun it · consequence preview, printer’s proofs'),
    ('v6', 'why-it-changed', 'Saved · V6 · Why it changed', 'Saved questions · V6</b> a watched question says which of five reasons moved its answer · press-cutting bureaus, corrections columns'),
]
common_css = (SRC / 'common.css').read_text()
data = (SRC / 'data.js').read_text()
common_js = (SRC / 'common.js').read_text()
for vid, slug, title, cap in V:
    if not (SRC / f'{vid}.js').exists():
        continue
    css = (SRC / f'{vid}.css').read_text()
    body = (SRC / f'{vid}.body.html').read_text()
    js = (SRC / f'{vid}.js').read_text()
    html = f'''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<link rel="stylesheet" href="../../../_kit/tokens.css">
<script src="../../../_kit/icons.js"></script>
<style>
{common_css}
/* ================= {vid}: {slug} ================= */
{css}
</style>
</head>
<body>
{body}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<div class="x-cap"><b>{cap}</div>
<script>
{data}
{common_js}
/* ================= {vid}: {slug} ================= */
{js}
</script>
</body>
</html>
'''
    (OUT / f'{vid}-{slug}.html').write_text(html)
    print('wrote', f'{vid}-{slug}.html')
