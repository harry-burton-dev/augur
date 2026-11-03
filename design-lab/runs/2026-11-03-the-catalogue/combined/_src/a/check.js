// Runs all nine view x task paths at a window size; prints honesty warnings and console errors.
const {chromium}=require('playwright');
(async()=>{const [,,url,w,h]=process.argv;const b=await chromium.launch();const p=await b.newPage({viewport:{width:+w,height:+h}});
const out=[];p.on('console',m=>{if(m.type()==='warning'||m.type()==='error')out.push(m.text())});p.on('pageerror',e=>out.push('ERR '+e.message));
await p.goto(url);await p.waitForTimeout(500);
for(const v of ['1','2','3'])for(const t of ['a','b','c']){await p.keyboard.press(v);await p.keyboard.press(t);await p.waitForTimeout(7000);}
console.log(w+'x'+h, out.length?out.join('\n'):'clean');await b.close();})();
