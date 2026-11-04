// Nothing is obtuse, enforced for AUGUR's own screens: a kit button or icon
// button that can be disabled must say why, with reason="…" (empty while it can
// be used). Apps from other repos get the kit's development warning only.
//
// Also the product's name (AGENTS.md, Names): nothing a person reads says "the
// platform". Outside comments, the words are taken as text people read, in the
// frontends and in the services' messages. A line that only uses them in code
// says so with `check-reasons: code-only` in a comment on it or the line above.
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

/** Blanks out comments, keeping strings, template text and line breaks, so what's left is code and text. */
export const withoutComments = (text) => {
  let out = '';
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += text[++i] ?? '';
      } else if (c === quote || (c === '\n' && quote !== '`')) quote = '';
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop - 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    out += c;
  }
  return out;
};

const PLATFORM = /\bthe platform\b/i;
const CODE_ONLY = /check-reasons: code-only/;

/** Where text people read calls AUGUR "the platform", as `line: words`. */
export const platformWords = (text) => {
  const lines = text.split('\n');
  return withoutComments(text)
    .split('\n')
    .flatMap((line, i) => (PLATFORM.test(line) && !CODE_ONLY.test(lines[i]) && !CODE_ONLY.test(lines[i - 1] ?? '') ? [`${i + 1}: ${line.trim().slice(0, 120)}`] : []));
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
  const named = [];
  for (const top of [join(root, 'apps'), join(root, 'platform', 'frontends'), join(root, 'platform', 'services')]) {
    walk(top, (path) => {
      for (const p of platformWords(readFileSync(path, 'utf8'))) named.push(`${relative(root, path)}:${p}`);
    });
  }
  if (problems.length) console.error(`${problems.length} disabled kit controls don't say why. Add reason="…" (see docs/build-an-app.md, Nothing is obtuse):\n  ${problems.join('\n  ')}`);
  if (named.length) {
    console.error(
      `${named.length} lines call AUGUR "the platform" in text people read. Say AUGUR, or say it plainly (AGENTS.md, Names). If the words are only code, add a comment "check-reasons: code-only" on the line or the one above:\n  ${named.join('\n  ')}`,
    );
  }
  if (problems.length || named.length) process.exit(1);
  console.log('Every disabled kit control says why, and nothing people read says "the platform".');
}
