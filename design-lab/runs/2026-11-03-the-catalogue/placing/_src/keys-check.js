// Presses keys on each variant and saves screenshots: node _src/keys-check.js
const {chromium}=require('playwright');const path=require('path');
const dir=path.join(__dirname,'..');
const plan={ 'v1-key':['Enter'], 'v2-questions':['y'], 'v3-example':['Enter'], 'v4-trays':['Enter'], 'v5-table':['s'], 'v6-sentence':['s'] };
(async()=>{const b=await chromium.launch();
for(const [f,ks] of Object.entries(plan)){const p=await b.newPage({viewport:{width:1600,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+dir+'/'+f+'.html');await p.waitForTimeout(3500);for(const k of ks){await p.keyboard.press(k);await p.waitForTimeout(900);}
await p.screenshot({path:'/tmp/cat-placing-k-'+f+'.png'});
await p.keyboard.press('n');await p.waitForTimeout(3600);await p.keyboard.press('r');await p.waitForTimeout(3600);
console.log(f,errs.length?errs:'ok');await p.close();}
await b.close();})();
