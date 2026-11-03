import glob, os
here = os.path.dirname(os.path.abspath(__file__))
rd = lambda n: open(os.path.join(here, n)).read()
css, js, data = rd('base.css'), rd('base.js'), rd('data.js')
for src in sorted(glob.glob(os.path.join(here, 'v*.src.html'))):
    s = open(src).read().replace('/*@BASE_CSS*/', css).replace('/*@DATA*/', data).replace('/*@BASE_JS*/', js)
    out = os.path.join(here, '..', os.path.basename(src).replace('.src.html', '.html'))
    open(out, 'w').write(s); print('built', os.path.basename(out))
