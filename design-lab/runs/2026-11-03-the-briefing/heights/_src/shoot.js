// node shoot.js <file.html> <out.png> <w> <h> <waitMs> [keys...]  keys like "k:ArrowDown" "w:800" "c:.selector"
const path=require('path');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve(__dirname,'../../../../_kit'),process.cwd()]}));
(async()=>{const [,,file,out,w,h,wt,...steps]=process.argv;const b=await chromium.launch();
const p=await b.newPage({viewport:{width:+w,height:+h}});const errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('file://'+path.resolve(file));await p.waitForTimeout(+wt);
for(const s of steps){const [k,v]=[s.slice(0,1),s.slice(2)];if(k==='k')await p.keyboard.press(v);else if(k==='w')await p.waitForTimeout(+v);else if(k==='c')await p.click(v);}
await p.screenshot({path:out});if(errs.length)console.log('ERR',errs.slice(0,5).join('\n'));await b.close();})();
