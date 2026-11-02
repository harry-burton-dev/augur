// usage: node batchshot.js OUTDIR file1.html file2.html ...  -> OUTDIR/<parent>__<name>.png ; prints errors per file
const {chromium}=require('playwright');const path=require('path');
(async()=>{const [,,out,...files]=process.argv;const b=await chromium.launch();
for(const f of files){const p=await b.newPage({viewport:{width:1600,height:900}});const errs=[];
 p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 try{const src=require('fs').readFileSync(f,'utf8');const mw=src.match(/name="x-shot-wait" content="(\d+)"/);await p.goto('file://'+path.resolve(f));await p.waitForTimeout(mw?+mw[1]:3800);
 const name=path.basename(path.dirname(f))+'__'+path.basename(f,'.html')+'.png';await p.screenshot({path:path.join(out,name)});}catch(e){errs.push(String(e))}
 if(errs.length)console.log('ERR',f,errs.slice(0,3).join(' | '));await p.close();}
await b.close();})();
