const {chromium}=require('playwright');
(async()=>{const [,,url,out,w,h,wait]=process.argv;const b=await chromium.launch();const p=await b.newPage({viewport:{width:+w||1600,height:+h||900}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto(url);await p.waitForTimeout(+wait||2500);await p.screenshot({path:out});if(errs.length)console.log('ERR',errs.slice(0,5).join('\n'));await b.close();})();
