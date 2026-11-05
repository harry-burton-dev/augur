// Separation of concerns, enforced: nothing under platform/ may depend on an app,
// and apps may not depend on each other. Apps reach the platform only through
// @augur/* packages, the gateway, the registry manifest and events. Aerie
// (@augur/shell-kit, from the augur-kit repository) is the shell's own kit: only the shell
// may import it (ADR 0015); everything else builds with Quill (@augur/app-kit). SDK 2 dropped
// Lit and the Lit kit (@augur/ui-kit, once @platform/ui-kit): nothing under platform/ or in the
// app template may import them, except the frozen builds the contract tests keep.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const skip = new Set(['node_modules', 'dist', 'storybook-static', '.turbo', 'coverage']);
const problems = [];
const SHELL_KIT = '@augur/shell-kit';
const mayUseShellKit = ['platform/frontends/shell/'];
/** `lit`, `lit/…`, `@augur/ui-kit`, `@augur/ui-kit/…` and the old `@platform/ui-kit` name. */
const LIT = /^(?:lit|@augur\/ui-kit|@platform\/ui-kit)(?:\/.*)?$/;
const mayUseLit = ['platform/contract/frozen/'];
/** `import … from 'x'`, `import 'x'`, `import('x')`, `export … from 'x'` and `require('x')`. */
const IMPORTS = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

/** Every Lit import (or package.json dependency on it) in a file, by specifier. */
const litIn = (path, text) => {
  if (path.endsWith('package.json')) {
    try {
      const pkg = JSON.parse(text);
      return DEPENDENCY_FIELDS.flatMap((f) => Object.keys(pkg[f] ?? {})).filter((name) => LIT.test(name));
    } catch {
      return [];
    }
  }
  if (path.endsWith('.json')) return [];
  return [...text.matchAll(IMPORTS)].map(([, spec]) => spec).filter((spec) => LIT.test(spec));
};

const walk = (dir, visit) => {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, visit);
    else if (/\.(ts|tsx|js|mjs|json)$/.test(name)) visit(path);
  }
};

const appOf = (path) => {
  const parts = relative(root, path).split(sep);
  return parts[0] === 'apps' ? parts[1] : null;
};

/** Which app each @apps/* package belongs to: an app's frontend and service are both its own. */
const appOfPackage = new Map();
for (const app of readdirSync(join(root, 'apps'), { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const part of readdirSync(join(root, 'apps', app.name), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const pkg = join(root, 'apps', app.name, part.name, 'package.json');
    try {
      appOfPackage.set(JSON.parse(readFileSync(pkg, 'utf8')).name, app.name);
    } catch {
      // Not a readable package.json: nothing to map.
    }
  }
}

const posix = (rel) => rel.split(sep).join('/');

for (const top of ['platform']) {
  walk(join(root, top), (path) => {
    const rel = posix(relative(root, path));
    if (mayUseLit.some((dir) => rel.startsWith(dir))) return;
    for (const spec of new Set(litIn(path, readFileSync(path, 'utf8')))) {
      problems.push(`${rel}: SDK 2 dropped Lit and the Lit kit, so nothing may use ${spec}; build with React and @augur/app-kit (Quill)`);
    }
  });
}

for (const top of ['platform', 'apps']) {
  walk(join(root, top), (path) => {
    const text = readFileSync(path, 'utf8');
    const rel = relative(root, path);
    const app = appOf(path);
    for (const [, name] of text.matchAll(/["'](@apps\/[\w-]+)/g)) {
      const target = appOfPackage.get(name) ?? name.slice('@apps/'.length);
      if (!app) problems.push(`${rel}: the platform must not depend on ${name}`);
      else if (target !== app) problems.push(`${rel}: app "${app}" must not depend on another app (${name})`);
    }
    if (text.match(/["']@augur\/shell-kit(?:\/[^"']*)?["']/) && !mayUseShellKit.some((dir) => rel.split(sep).join('/').startsWith(dir))) {
      problems.push(`${rel}: only the shell may use ${SHELL_KIT} (Aerie); build with @augur/app-kit (Quill)`);
    }
    for (const [, spec] of text.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const resolved = relative(root, join(path, '..', spec)).split(sep);
      if (!app && resolved[0] === 'apps') problems.push(`${rel}: the platform must not import from apps/ (${spec})`);
      if (app && resolved[0] === 'apps' && resolved[1] !== app) problems.push(`${rel}: app "${app}" must not import another app (${spec})`);
    }
  });
}

if (problems.length) {
  console.error(`Boundary check failed:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('Boundary check passed: the platform depends on no app, apps depend on no other app, only the shell uses Aerie, and nothing uses Lit.');
