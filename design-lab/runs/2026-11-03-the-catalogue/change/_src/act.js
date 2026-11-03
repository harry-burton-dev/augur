// node act.js file out w h wait key1 key2 ... (each key followed by 900ms)
const {chromium}=require('playwright');
(async()=>{const [,,url,out,w,h,wait,...ks]=process.argv;const b=await chromium.launch();const p=await b.newPage({viewport:{width:+w,height:+h}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text())});
await p.goto(url);await p.waitForTimeout(+wait);for(const k of ks){await p.keyboard.press(k);await p.waitForTimeout(1300);}await p.screenshot({path:out});if(errs.length)console.log('ERR',errs.slice(0,5).join('\n'));await b.close();})();
