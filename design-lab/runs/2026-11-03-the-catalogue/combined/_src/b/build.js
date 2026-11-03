// Assembles combined/vN-*.html from the shared parts + one .src per screen.
// .src sections: /*@meta {json}*/ /*@css*/ ... /*@html*/ ... /*@js*/ ...
// Run: node combined/_src/b/build.js
const fs = require('fs'), path = require('path');
const here = __dirname, out = path.join(here, '..', '..');
const read = f => fs.readFileSync(path.join(here, f), 'utf8');
const common = { css: read('common.css'), data: read('data.js'), js: read('common.js') };
for (const f of fs.readdirSync(here).filter(f => /^v\d-.*\.src$/.test(f)).sort()) {
  const s = read(f);
  const part = n => { const m = s.split('/*@' + n + '*/')[1]; return m ? m.split(/\/\*@(css|html|js)\*\//)[0].trim() : ''; };
  const meta = JSON.parse(s.match(/\/\*@meta (\{[\s\S]*?\})\*\//)[1]);
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Catalogue · Combined V${meta.n} · ${meta.title}</title>
<link rel="stylesheet" href="../../../_kit/tokens.css">
<script src="../../../_kit/icons.js"></script>
<style>
${common.css}
/* ====================== V${meta.n}: ${meta.title} ====================== */
${part('css')}
</style>
</head>
<body>
<div class="app">
  <nav class="rail" id="rail" aria-label="Data Atlas"></nav>
  <main class="main">
    <div class="head">
      <div><div class="eyebrow" id="crumb"></div><h1 id="h1"></h1><div class="sub" id="sub"></div></div>
      <div id="headR"></div>
    </div>
    <div class="work" id="work">
${part('html')}
    </div>
  </main>
</div>
<div class="keys" id="keys" aria-label="Keyboard"></div>
<div class="x-cap"><b>Catalogue · combined V${meta.n}</b> ${meta.cap}</div>
<script>
${common.data}
${common.js}
/* ====================== V${meta.n}: ${meta.title} ====================== */
${part('js')}
</script>
</body>
</html>
`;
  const name = f.replace('.src', '.html');
  fs.writeFileSync(path.join(out, name), html);
  console.log('wrote', name);
}
