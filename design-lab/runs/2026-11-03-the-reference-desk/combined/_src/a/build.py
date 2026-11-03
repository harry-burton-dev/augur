#!/usr/bin/env python3
"""Combined round, prefix a. Builds v1 and v2 from one shared sample (data.js),
shared CSS and helpers, plus each screen's own JS. python3 _src/a/build.py
Each output links the kit exactly and keeps the one DATA object at the top of its script."""
import pathlib
SRC = pathlib.Path(__file__).resolve().parent
OUT = SRC.parent.parent
V = [
    ('v1', 'one-question-a-week-later', 'Reference desk · Combined V1 · One question, a week later',
     'Reference desk · Combined V1</b> one question, vague words to a colleague’s rerun a week later · reference interview, method cards, press cuttings'),
    ('v2', 'with-and-without-the-model', 'Reference desk · Combined V2 · With and without the model',
     'Reference desk · Combined V2</b> one question twice, model on and off: same ink, different route · double reading, transcripts, keys'),
]
css = (SRC / 'common.css').read_text()
data = (SRC / 'data.js').read_text()
common = (SRC / 'common.js').read_text()
for vid, slug, title, cap in V:
    own_css = (SRC / f'{vid}.css').read_text()
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
{css}
/* ================= {vid}: {slug} ================= */
{own_css}
</style>
</head>
<body>
<div class="app" id="app"></div>
<div class="x-cap"><b>{cap}</div>
<script>
{data}
{common}
/* ================= {vid}: {slug} ================= */
{js}
</script>
</body>
</html>
'''
    (OUT / f'{vid}-{slug}.html').write_text(html)
    print('built', f'{vid}-{slug}.html')
