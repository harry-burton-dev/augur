// usage: node keys.js file.html ... : loads each page with reduced motion, presses S, T and R, clicks the first deed,
// and reports console errors, warnings and sideways scroll. Prints one line per page with a problem.
const {chromium}=require('playwright');const path=require('path');
(async()=>{const [,,...files]=process.argv;const b=await chromium.launch();let bad=0;
for(const f of files){const p=await b.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});const errs=[];
 p.on('pageerror',e=>errs.push('pageerror '+e.message));p.on('console',m=>{if(['error','warning'].includes(m.type()))errs.push(m.type()+' '+m.text())});
 await p.goto('file://'+path.resolve(f));await p.waitForTimeout(600);
 for(const k of ['s','t','s','t','r']){await p.keyboard.press(k);await p.waitForTimeout(250);}
 await p.keyboard.press('Escape');await p.waitForTimeout(100);const why=await p.$('[data-why]:visible');if(why){await why.click({timeout:2000}).catch(e=>errs.push('click failed'));await p.waitForTimeout(200);const has=await p.$('.deedpop');if(!has)errs.push('deed did not open');await p.keyboard.press('Escape');}
 const sx=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 if(errs.length||sx){bad++;console.log('!!',path.basename(path.dirname(f))+'/'+path.basename(f),errs.slice(0,3).join(' | '),sx?'SIDEWAYS':'');}await p.close();}
await b.close();console.log('keys checked',files.length,'problems',bad);})();
