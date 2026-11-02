#!/usr/bin/env python3
"""Inline _kit/tokens.css and a subset of _kit/icons.js into each prototype so it stands alone.
usage: build.py SRC_DIR OUT_DIR  (copies .md files as they are)"""
import sys,os,re,json,shutil
src,out=sys.argv[1],sys.argv[2]
K=os.path.dirname(os.path.abspath(__file__))
css=open(os.path.join(K,'tokens.css')).read()
ijs=open(os.path.join(K,'icons.js')).read()
m=re.search(r'var M=(\{.*?\});\nfunction svg',ijs,re.S); icons=json.loads(m.group(1))
for root,dirs,files in os.walk(src):
  if any(c.startswith('_') for c in os.path.relpath(root,src).split(os.sep)): continue
  for f in files:
    p=os.path.join(root,f); rel=os.path.relpath(p,src); o=os.path.join(out,rel)
    os.makedirs(os.path.dirname(o),exist_ok=True)
    if f.endswith('.html'):
      h=open(p).read()
      used={n for n in re.findall(r'''["'`]([a-z0-9]+(?:-[a-z0-9]+)*)["'`]''',h) if n in icons}
      sub=ijs[:m.start(1)]+json.dumps({n:icons[n] for n in sorted(used)},separators=(',',':'))+ijs[m.end(1):]
      h=re.sub(r'<link[^>]+href="[./]*_kit/tokens\.css"[^>]*>',lambda _:'<style>\n'+css+'\n</style>',h)
      h=re.sub(r'<script[^>]+src="[./]*_kit/icons\.js"[^>]*></script>',lambda _:'<script>\n'+sub+'\n</script>',h)
      open(o,'w').write(h)
    elif f.endswith(('.md','.png','.webp','.jpg')): shutil.copy(p,o)
print('built')
