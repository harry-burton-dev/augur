// Builds ../v1-*.html .. ../v6-*.html from data.js, lib.js, common.css and vN-*.src.html.
// Usage: node _src/build.js  (from the picture folder or anywhere)
const fs = require('fs'), path = require('path');
const here = __dirname, out = path.join(here, '..');
const data = fs.readFileSync(path.join(here, 'data.js'), 'utf8');
const lib = fs.readFileSync(path.join(here, 'lib.js'), 'utf8');
const css = fs.readFileSync(path.join(here, 'common.css'), 'utf8');
for (const f of fs.readdirSync(here).filter(f => /^v\d-.*\.src\.html$/.test(f)).sort()) {
  const src = fs.readFileSync(path.join(here, f), 'utf8');
  const part = k => { const m = src.match(new RegExp('@@' + k + '\\n([\\s\\S]*?)(?=\\n@@|$)')); return m ? m[1].trim() : ''; };
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${part('title')}</title>
<link rel="stylesheet" href="../../../_kit/tokens.css">
<script src="../../../_kit/icons.js"></script>
<style>
${css}
/* ---------- this variant ---------- */
${part('css')}
</style>
</head>
<body class="pre">
${part('body')}
<script>
${data}
${lib}
/* ---------- this variant ---------- */
${part('js')}
</script>
</body>
</html>
`;
  const name = f.replace('.src.html', '.html');
  fs.writeFileSync(path.join(out, name), html);
  console.log('built', name);
}
