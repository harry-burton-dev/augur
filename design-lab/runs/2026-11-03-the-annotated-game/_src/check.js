/* Check pages: node check.js OUTDIR surface[/vN] ...
   loads each page at 1600x900 and 1280x800, waits 3.5 s, screenshots both, presses T, T and R,
   reports console errors and sideways scroll. */
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require(require.resolve('playwright', { paths: [path.resolve(__dirname, '../../../_kit'), '/usr/lib/node_modules', '/usr/local/lib/node_modules'] })); }
(async () => {
  const [, , out, ...targets] = process.argv;
  const run = path.resolve(__dirname, '..');
  const files = [];
  for (const t of targets) {
    const [s, v] = t.split('/');
    fs.readdirSync(path.join(run, s)).filter(f => /^v\d.*\.html$/.test(f) && (!v || f.startsWith(v))).sort().forEach(f => files.push(path.join(run, s, f)));
  }
  const b = await pw.chromium.launch();
  for (const f of files) {
    for (const [w, h] of [[1600, 900], [1280, 800]]) {
      const p = await b.newPage({ viewport: { width: w, height: h } });
      const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
      await p.goto('file://' + f); await p.waitForTimeout(3500);
      const name = path.basename(path.dirname(f)) + '__' + path.basename(f, '.html') + '-' + w;
      await p.screenshot({ path: path.join(out, name + '.png') });
      const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight);
      for (const k of ['t', 't', 'r']) { await p.keyboard.press(k); await p.waitForTimeout(150); }
      await p.waitForTimeout(400);
      console.log(path.basename(path.dirname(f)) + '/' + path.basename(f), w, over ? 'OVERFLOW' : 'ok', errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : '');
      await p.close();
    }
  }
  await b.close();
})();
