#!/usr/bin/env python3
"""Build the explorations gallery. usage: gallery.py SRC OUT
- inlines kit into every prototype (build.py)
- screenshots every v*.html, writes OUT/<surface>/thumbs/<name>.webp
- renders <surface>/notes.md -> notes.html, SHORTLIST.md and README.md -> index.html"""
import sys,os,re,subprocess,glob,html,json
import markdown
from PIL import Image
src,out=sys.argv[1],sys.argv[2]
K=os.path.dirname(os.path.abspath(__file__))
subprocess.run(['python3',os.path.join(K,'build.py'),src,out],check=True)
SH=os.path.join(os.path.dirname(src),'shots'); os.makedirs(SH,exist_ok=True)
ORDER=['grammar','home','floors','alerts','radial','telemetry','focus']
surfaces=[d for d in ORDER if os.path.isdir(os.path.join(src,d))]+sorted(d for d in os.listdir(src) if os.path.isdir(os.path.join(src,d)) and d not in ORDER and not d.startswith(('_','.')))
files=[f for s in surfaces for f in sorted(glob.glob(os.path.join(src,s,'v*.html')))]
if '--noshots' not in sys.argv:
  r=subprocess.run(['node',os.path.join(K,'batchshot.js'),SH]+files,capture_output=True,text=True,cwd=K); print(r.stdout,r.stderr[-2000:])
TOK=open(os.path.join(K,'tokens.css')).read()
CSS="""
body{overflow:auto}
.wrap{max-width:1180px;margin:0 auto;padding:var(--space-7) var(--edge) var(--space-8)}
.eyebrow{font:400 11px/16px var(--font-mono);letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--ink-muted)}
h1{font-weight:200;font-size:var(--type-display);line-height:var(--leading-display);letter-spacing:var(--tracking-title);text-transform:uppercase;margin:var(--space-3) 0 var(--space-4)}
h2{font-weight:300;font-size:var(--type-title-s);line-height:var(--leading-title-s);letter-spacing:var(--tracking-caps);text-transform:uppercase;margin:var(--space-7) 0 var(--space-2)}
h3{font-weight:400;font-size:var(--type-lead);line-height:var(--leading-lead);margin:var(--space-5) 0 var(--space-2)}
p,li{color:var(--ink);max-width:78ch}
a{color:var(--info)} a:focus-visible{outline:var(--focus-ring) solid var(--focus);outline-offset:var(--focus-gap)}
.lede{font-size:var(--type-lead);line-height:var(--leading-lead);color:var(--ink-muted);max-width:64ch}
.rule{height:1px;background:linear-gradient(90deg,var(--hairline-strong),transparent);margin:var(--space-3) 0 var(--space-5)}
.sheet{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:var(--space-5)}
.frame{display:block;text-decoration:none;color:inherit}
.frame .img{position:relative;aspect-ratio:16/9;border-radius:var(--radius-inset);overflow:hidden;border:1px solid var(--hairline);background:var(--slate-deep);transition:transform var(--motion-base) var(--ease-out),border-color var(--motion-base) var(--ease-standard)}
.frame img{width:100%;height:100%;object-fit:cover;display:block}
.frame:hover .img,.frame:focus-visible .img{transform:translateY(calc(var(--space-1) * -1));border-color:var(--hairline-strong)}
.frame .no{position:absolute;top:var(--space-2);left:var(--space-2);font:500 11px/16px var(--font-mono);letter-spacing:var(--tracking-caps);background:var(--scrim);padding:2px var(--space-2);border-radius:var(--radius-key)}
.frame .t{margin-top:var(--space-2);font-size:var(--type-meta);line-height:var(--leading-meta)}
.frame .c{font-size:var(--type-small);line-height:var(--leading-small);color:var(--ink-muted)}
.md{max-width:820px}
.md table{border-collapse:collapse;font-size:var(--type-meta);margin:var(--space-4) 0}
.md th,.md td{border-bottom:1px solid var(--hairline);padding:var(--space-2) var(--space-3);text-align:left;vertical-align:top}
.md code{font-family:var(--font-mono);font-size:.9em;color:var(--green)}
.md hr{border:0;height:1px;background:var(--hairline);margin:var(--space-6) 0}
.md strong{font-weight:500;color:var(--light)}
.nav{display:flex;gap:var(--space-4);flex-wrap:wrap;margin-top:var(--space-4)}
.nav a{font:400 12px/16px var(--font-mono);letter-spacing:var(--tracking-caps);text-transform:uppercase;color:var(--ink-muted);text-decoration:none;border:1px solid var(--hairline-strong);padding:var(--space-1) var(--space-3);border-radius:var(--radius-pill)}
.nav a:hover{color:var(--ink)}
"""
def page(title,body,depth=0):
  return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title><style>{TOK}{CSS}</style></head><body><div class="wrap">{body}</div></body></html>'
def md(p):
  if not os.path.exists(p): return ''
  L=open(p).read().split('\n'); o=[]
  for l in L:
    if re.match(r'\s*([-*]|\d+\.) ',l) and o and o[-1].strip() and not re.match(r'\s*([-*]|\d+\.) ',o[-1]) and not o[-1].startswith(('  ','|')): o.append('')
    o.append(l)
  return markdown.markdown('\n'.join(o),extensions=['tables','fenced_code','sane_lists'])
NAMES={'grammar':'Grammar · camera moves and light','combined':'Round 2 · combined screens','home':'Home · what needs you','floors':'Floor picker and travel','alerts':'Alerts and escalation','radial':'Right-click radial menu','telemetry':'Telemetry ribbons','focus':'Depth and focus system'}
sections=[]
for s in surfaces:
  os.makedirs(os.path.join(out,s,'thumbs'),exist_ok=True)
  cards=[]
  for f in sorted(glob.glob(os.path.join(src,s,'v*.html'))):
    n=os.path.basename(f)[:-5]; png=os.path.join(SH,f'{s}__{n}.png')
    if os.path.exists(png):
      im=Image.open(png).convert('RGB'); im.thumbnail((960,540)); im.save(os.path.join(out,s,'thumbs',n+'.webp'),'WEBP',quality=78)
    h=open(f).read(); cap=re.search(r'class="x-cap"[^>]*>(.*?)</div>',h,re.S)
    capt=re.sub('<[^>]+>','',cap.group(1)).strip() if cap else n
    t=re.search(r'<title>(.*?)</title>',h); tt=t.group(1) if t else n
    no=n.split('-')[0].upper()
    cards.append(f'<a class="frame" href="{s}/{n}.html"><div class="img"><img loading="lazy" src="{s}/thumbs/{n}.webp" alt=""><span class="no">{no}</span></div><div class="t">{html.escape(tt)}</div><div class="c">{html.escape(capt)}</div></a>')
  nb=md(os.path.join(src,s,'notes.md'))
  if nb: open(os.path.join(out,s,'notes.html'),'w').write(page(NAMES.get(s,s)+' · critique',f'<div class="eyebrow"><a href="../index.html">Explorations</a> / {html.escape(NAMES.get(s,s))}</div><div class="md">{nb}</div>'))
  sections.append(f'<section id="{s}"><h2>{html.escape(NAMES.get(s,s))}</h2><div class="rule"></div><p><a href="{s}/notes.html">Read the critique →</a></p><div class="sheet">{"".join(cards)}</div></section>')
intro=md(os.path.join(src,'README.md')); short=md(os.path.join(src,'SHORTLIST.md'))
nav='<nav class="nav">'+''.join(f'<a href="#{s}">{html.escape(NAMES.get(s,s))}</a>' for s in surfaces)+('<a href="#shortlist">Shortlist</a>' if short else '')+'</nav>'
body=f'<div class="eyebrow">AUGUR · design explorations · {len(files)} prototypes</div><h1>Cinematic UI</h1><div class="md lede">{intro}</div>{nav}'
if short: body+=f'<section id="shortlist"><h2>Ranked shortlist</h2><div class="rule"></div><div class="md">{short}</div></section>'
body+=''.join(sections)
open(os.path.join(out,'index.html'),'w').write(page('Cinematic UI explorations',body))
print('gallery',len(files))
