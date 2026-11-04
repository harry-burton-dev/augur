// Writes the email theme's layout (src/email/html/template.ftl) from email-layout.ftl, filling each
// {{token}} with Common's value: email clients don't read CSS variables, so the values go in as they are.
// Run by `pnpm jar` before Keycloakify packs the theme.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokens } from '@augur/kit-common/tokens';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function fillTokens(layout, values = tokens) {
  return layout.replace(/\{\{([a-z0-9-]+)\}\}/g, (_, name) => {
    if (!(name in values)) throw new Error(`email-layout.ftl names {{${name}}}, which isn't one of Common's tokens.`);
    // A value in quotes (a font list) goes inside a style="…" attribute.
    return values[name].replaceAll('"', "'");
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(root, 'src/email/html/template.ftl');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, fillTokens(readFileSync(join(root, 'email-layout.ftl'), 'utf8')));
  console.info(`Wrote ${out}`);
}
