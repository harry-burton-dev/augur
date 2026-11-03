#!/usr/bin/env python3
"""Assemble each variant page: kit links + shared css/js + the variant's own body (vN-slug.src.html).
A body file holds three parts split by lines '<!--css-->', '<!--html-->', '<!--js-->' and a first line 'title: ...'."""
import glob, os, re
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.dirname(here)
ccss = open(os.path.join(here, 'common.css')).read()
cjs = open(os.path.join(here, 'common.js')).read()
for src in sorted(glob.glob(os.path.join(here, 'v*.src.html'))):
    s = open(src).read()
    title = re.match(r'title: (.*)\n', s).group(1)
    css = s.split('<!--css-->')[1].split('<!--html-->')[0]
    html = s.split('<!--html-->')[1].split('<!--js-->')[0]
    js = s.split('<!--js-->')[1]
    page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<link rel="stylesheet" href="../../../_kit/tokens.css">
<script src="../../../_kit/icons.js"></script>
<style>
{ccss}
{css}
</style></head>
<body>
<div class="water"></div><div class="horizon"></div>
{html}
<div class="toast" role="status" aria-live="polite"></div>
<div class="keys"></div>
<script>
{cjs}
{js}
</script>
</body></html>
'''
    name = os.path.basename(src).replace('.src.html', '.html')
    open(os.path.join(out, name), 'w').write(page)
    print('built', name)
