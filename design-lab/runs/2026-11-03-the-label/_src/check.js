// usage: node check.js OUTDIR file.html ... : screenshots at 1600x900 and 1280x800 (3.5 s), reports console
// errors and warnings, sideways scroll, and words a person must never read.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
(async()=>{const [,,out,...files]=process.argv;const b=await chromium.launch();
for(const f of files){for(const [w,h] of [[1600,900],[1280,800]]){const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];
 p.on('pageerror',e=>errs.push('pageerror '+e.message));p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+' '+m.text())});
 await p.goto('file://'+path.resolve(f));await p.waitForTimeout(3500);
 const info=await p.evaluate(()=>({sx:document.documentElement.scrollWidth>innerWidth+1,txt:document.body.innerText}));
 const bad=(info.txt.match(/platform|folio|auspex/gi)||[]);
 const name=path.basename(path.dirname(f))+'__'+path.basename(f,'.html')+'_'+w+'.png';await p.screenshot({path:path.join(out,name)});
 if(errs.length||info.sx||bad.length)console.log('!!',name,errs.slice(0,4).join(' | '),info.sx?'SIDEWAYS':'',bad.join(','));await p.close();}}
await b.close();console.log('checked',files.length);})();
