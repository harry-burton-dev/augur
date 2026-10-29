// Nothing is obtuse, enforced for the platform's own screens: a kit button or
// icon button that can be disabled must say why, with reason="…" (empty while
// it can be used). Apps from other repos get the kit's development warning only.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const skip = new Set(['node_modules', 'dist', 'storybook-static', '.turbo', 'coverage', 'stories']);

/** The disabled kit controls in one source file that don't carry a reason, as `line: tag`. */
export const missingReasons = (text) => {
  const found = [];
  const tag = /<ui-(button|icon-button)\b/g;
  for (let m; (m = tag.exec(text)); ) {
    // The opening tag runs to the first '>' outside a ${…} expression.
    let depth = 0;
    let end = m.index;
    for (let i = m.index; i < text.length; i++) {
      const c = text[i];
      if (c === '$' && text[i + 1] === '{') { depth++; i++; continue; }
      if (c === '{' && depth) depth++;
      else if (c === '}' && depth) depth--;
      else if (c === '>' && !depth && text[i - 1] !== '=') { end = i; break; }
    }
    const open = text.slice(m.index, end);
    const disabled = /[\s?]disabled(=|\s|$)|\sdisabled=\{/.test(open);
    if (disabled && !/\sreason=/.test(open)) found.push(`${text.slice(0, m.index).split('\n').length}: <ui-${m[1]}>`);
  }
  return found;
};

const walk = (dir, visit) => {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, visit);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) visit(path);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = [];
  for (const top of [join(root, 'apps'), join(root, 'platform', 'frontends')]) {
    walk(top, (path) => {
      for (const p of missingReasons(readFileSync(path, 'utf8'))) problems.push(`${relative(root, path)}:${p}`);
    });
  }
  if (problems.length) {
    console.error(`${problems.length} disabled kit controls don't say why. Add reason="…" (see docs/build-an-app.md, Nothing is obtuse):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log('Every disabled kit control says why.');
}
