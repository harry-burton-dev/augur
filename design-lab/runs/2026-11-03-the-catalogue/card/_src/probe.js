const {chromium}=require('playwright');
(async()=>{const [,,url,w,h,expr]=process.argv;const b=await chromium.launch();const p=await b.newPage({viewport:{width:+w,height:+h}});
await p.goto(url);await p.waitForTimeout(3000);console.log(JSON.stringify(await p.evaluate(expr)));await b.close();})();
