// render a page, press keys, screenshot: node keys.js url out w h keys...
const {chromium}=require('playwright');
(async()=>{const [,,url,out,w,h,...keys]=process.argv;const b=await chromium.launch();const p=await b.newPage({viewport:{width:+w,height:+h}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.text())});
await p.goto(url);await p.waitForTimeout(3500);for(const k of keys){await p.keyboard.press(k);await p.waitForTimeout(900);}
await p.screenshot({path:out});console.log(errs.length?'ERR '+errs.join(' | '):'clean');await b.close();})();
