// Assembles v*.html from common parts + one variant file each.
// Variant file sections: /*@meta {json}*/  /*@css*/ ... /*@html*/ ... /*@js*/ ...
const fs = require('fs'), path = require('path');
const here = __dirname, out = path.join(here, '..');
const common = { css: fs.readFileSync(path.join(here, 'common.css'), 'utf8'), data: fs.readFileSync(path.join(here, 'data.js'), 'utf8'), js: fs.readFileSync(path.join(here, 'common.js'), 'utf8') };
for (const f of fs.readdirSync(here).filter(f => /^v\d-.*\.src$/.test(f)).sort()) {
  const s = fs.readFileSync(path.join(here, f), 'utf8');
  const part = n => { const m = s.split('/*@' + n + '*/')[1]; return m ? m.split(/\/\*@(css|html|js)\*\//)[0].trim() : ''; };
  const meta = JSON.parse(s.match(/\/\*@meta (\{[\s\S]*?\})\*\//)[1]);
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Placing · V${meta.n} · ${meta.title}</title>
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
  <nav class="rail" id="rail" aria-label="${'Data Atlas'}"></nav>
  <main class="main">
    <div class="head">
      <div><div class="eyebrow" id="crumb"></div><h1 id="h1"></h1><div class="sub" id="sub"></div></div>
      <div class="steps" id="steps" aria-label="Steps"></div>
    </div>
    <div class="work" id="work">
${part('html')}
    </div>
  </main>
</div>
<div class="keys" id="keys" aria-label="Keyboard"></div>
<div class="x-cap"><b>Placing · V${meta.n}</b> ${meta.cap}</div>
<script>
${common.data}
${common.js}
/* ====================== V${meta.n}: ${meta.title} ====================== */
${part('js')}
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(out, f.replace('.src', '.html')), html);
  console.log('wrote', f.replace('.src', '.html'));
}
