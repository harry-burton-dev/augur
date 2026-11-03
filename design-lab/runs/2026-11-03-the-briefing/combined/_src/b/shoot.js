/* usage: node shoot.js <file.html> <out.png> <w> <h> <wait> [keys...]  keys pressed after wait, 500ms apart */
const path = require('path');
const { chromium } = require(require.resolve('playwright', { paths: [path.resolve(__dirname, '../../../../../_kit'), process.cwd()] }));
(async () => {
  const [, , file, out, w, h, wait, ...keys] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(file)); await p.waitForTimeout(+wait);
  for (const k of keys) { if (k.startsWith('wait')) { await p.waitForTimeout(+k.slice(4)); continue; } await p.keyboard.press(k); await p.waitForTimeout(500); }
  await p.screenshot({ path: out });
  const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (ov) console.log('HSCROLL');
  if (errs.length) console.log('ERR', errs.join('\n')); await b.close();
})();
