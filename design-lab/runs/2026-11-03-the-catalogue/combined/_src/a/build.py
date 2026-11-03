# Builds the combined screens for designer "a".
# 1. Generates the 132 sample contracts (fixed seed) into DATA.CONTRACTS.
# 2. Inlines data.js, common.css and common.js into each vN.src.html.
# Run: python3 _src/a/build.py   (from the combined/ folder or anywhere)
import json, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..'))
R = random.Random(11)

services = [('Cleaning', 26, ['Kestrel Cleaning', 'Brightside Services']),
            ('Repairs', 30, ['Corvane Facilities Ltd', 'Ridge Roofing', 'Harrow Electrical']),
            ('Waste', 18, ['Greenbin Recycling Ltd', 'Northgate Haulage']),
            ('Grounds maintenance', 14, ['Meadow Grounds Ltd', 'Greenway Landscapes']),
            ('Security', 16, ['Linden Security']),
            ('Catering', 12, ['Fairhaven Catering']),
            ('Utilities', 16, ['Vale Water', 'Southern Power'])]
lots = {'Cleaning': ['Office cleaning', 'Window cleaning', 'Deep clean'],
        'Repairs': ['Reactive repairs', 'Roof repair', 'Electrical testing', 'Lift servicing'],
        'Waste': ['Kerbside collection', 'Skip hire', 'Clinical waste'],
        'Grounds maintenance': ['Grounds maintenance', 'Tree surgery', 'Gritting of yards'],
        'Security': ['Manned guarding', 'Alarm monitoring', 'Key holding'],
        'Catering': ['Staff canteen', 'Vending'],
        'Utilities': ['Water supply', 'Electricity supply', 'Gas supply']}
sites = ['Halden Road depot', 'Marrow Bridge offices', 'Kingsmead salt barn', 'Fenside recycling centre',
         'Westgate offices', 'Elm Road yard', 'Mill Lane works', 'Station Road library', 'Upton care home',
         'Old Quay garage', 'Bridge Street hub', 'Copse Lane store', 'Greyfriars hall', 'Ashby clinic']
short = {s: ('Halden' if s.startswith('Halden') else ' '.join(s.split(' ')[:2])) for s in sites}

rows = []
for svc, n, sups in services:
    for i in range(n):
        site = None if R.random() < .05 else R.choice(sites)
        if svc == 'Grounds maintenance' and site == 'Halden Road depot':
            site = 'Elm Road yard'  # the two Halden grounds contracts are added by hand below
        r = R.random()
        end = None if r < .06 else ('2026' if r < .2 else ('2027' if r < .55 else '2028+'))
        lot = R.choice(lots[svc])
        rows.append({'n': f"{lot} · {short[site] if site else 'all sites'}", 'svc': svc, 'site': site,
                     'end': end, 'alt': None, 'sup': R.choice(sups),
                     'val': R.choice([18, 24, 36, 42, 55, 64, 80, 96, 120, 150, 210, 340])})
# replace two grounds rows with the demo pair, so the walk lands on one real record
g = [i for i, r in enumerate(rows) if r['svc'] == 'Grounds maintenance']
rows[g[0]] = {'n': 'Grounds maintenance · Halden', 'svc': 'Grounds maintenance', 'site': 'Halden Road depot', 'end': '2026', 'alt': '2027',
              'sup': 'Meadow Grounds Ltd', 'val': 96, 'id': 'grounds'}
rows[g[1]] = {'n': 'Tree surgery · Halden', 'svc': 'Grounds maintenance', 'site': 'Halden Road depot', 'end': '2028+', 'alt': None,
              'sup': 'Greenway Landscapes', 'val': 24}
rows.sort(key=lambda r: r['n'])
seen = {}
for r in rows:  # names are unique, as a register's would be: a second lot gets a number
    seen[r['n']] = seen.get(r['n'], 0) + 1
    if seen[r['n']] > 1:
        r['n'] = f"{r['n']} \u00b7 lot {seen[r['n']]}"
assert len(rows) == 132, len(rows)

data = open(os.path.join(HERE, 'data.js')).read().replace('/*CONTRACTS*/[]', json.dumps(rows, ensure_ascii=False))
css = open(os.path.join(HERE, 'common.css')).read()
js = open(os.path.join(HERE, 'common.js')).read()

for src, out in (('v1.src.html', 'v1-three-ways-to-read.html'), ('v2.src.html', 'v2-operators-first-day.html')):
    p = os.path.join(HERE, src)
    if not os.path.exists(p):
        continue
    t = open(p).read()
    t = t.replace('/*@COMMON_CSS@*/', css).replace('/*@DATA@*/', data).replace('/*@COMMON_JS@*/', js)
    open(os.path.join(OUT, out), 'w').write(t)
    print('wrote', out)
