# Inlines the shared data, engine and styles into each variant. Run: python3 _src/build.py
import os, glob
here = os.path.dirname(os.path.abspath(__file__)); out = os.path.dirname(here)
read = lambda n: open(os.path.join(here, n)).read()
data, eng, css = read('data.js'), read('engine.js'), read('common.css')
for t in sorted(glob.glob(os.path.join(here, 'v*.html'))):
    s = open(t).read()
    s = s.replace('/*@CSS*/', css).replace('/*@DATA*/', data).replace('/*@ENGINE*/', eng)
    name = os.path.basename(t)
    open(os.path.join(out, name), 'w').write(s); print('built', name)
