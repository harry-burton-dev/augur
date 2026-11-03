const {chromium}=require('playwright');
(async()=>{const [,,dir]=process.argv;const fs=require('fs');const b=await chromium.launch();
for (const f of fs.readdirSync(dir).filter(x=>/^v\d.*\.html$/.test(x))){
 const p=await b.newPage({viewport:{width:1600,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto('file://'+dir+'/'+f);await p.waitForTimeout(2500);
 for (const k of ['t','ArrowDown','ArrowDown','Enter','e','n','b','a','k']){await p.keyboard.press(k);await p.waitForTimeout(200);}
 await p.waitForTimeout(3500);await p.screenshot({path:'/tmp/cat-card-k-'+f.slice(0,2)+'.png'});
 console.log(f, errs.length?('ERR '+errs.join(' | ')):'ok');await p.close();}
await b.close();})();
