// Load each page, press the keys, report console errors; optional screenshots of G off and an open drawer.
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require.resolve('playwright', { paths: [path.resolve(__dirname, '../../../../_kit'), '/usr/lib/node_modules', '/usr/local/lib/node_modules'] })); }
const fs = require('fs');
(async () => {
  const dir = path.resolve(__dirname, '..');
  const files = fs.readdirSync(dir).filter(f => /^v\d-.*\.html$/.test(f)).sort();
  const b = await pw.chromium.launch();
  for (const f of files) {
    for (const [w, h] of [[1600, 900], [1280, 800]]) {
      const p = await b.newPage({ viewport: { width: w, height: h } });
      const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
      await p.goto('file://' + path.join(dir, f)); await p.waitForTimeout(3000);
      const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      for (const k of ['t', 'g']) { await p.keyboard.press(k); await p.waitForTimeout(300); }
      if (w === 1600 && process.argv[2]) await p.screenshot({ path: `${process.argv[2]}/${f.replace('.html', '')}-gt.png` });
      await p.keyboard.press('g'); await p.keyboard.press('t');
      await p.evaluate(() => { const c = document.querySelector('[data-claim]'); if (c) c.click(); });
      await p.waitForTimeout(500);
      if (w === 1600 && process.argv[2]) await p.screenshot({ path: `${process.argv[2]}/${f.replace('.html', '')}-dr.png` });
      await p.keyboard.press('Escape'); await p.keyboard.press('r'); await p.waitForTimeout(2500);
      console.log(f, w, over ? 'H-SCROLL' : 'ok', errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : '');
      await p.close();
    }
  }
  await b.close();
})();
