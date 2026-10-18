// Separation of concerns, enforced: nothing under platform/ may depend on an app,
// and apps may not depend on each other. Apps reach the platform only through
// @platform/* packages, the gateway, the registry manifest and events.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const skip = new Set(['node_modules', 'dist', 'storybook-static', '.turbo', 'coverage']);
const problems = [];

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

for (const top of ['platform', 'apps']) {
  walk(join(root, top), (path) => {
    const text = readFileSync(path, 'utf8');
    const rel = relative(root, path);
    const app = appOf(path);
    for (const [, name] of text.matchAll(/["'](@apps\/[\w-]+)/g)) {
      const target = name.slice('@apps/'.length);
      if (!app) problems.push(`${rel}: the platform must not depend on ${name}`);
      else if (target !== app) problems.push(`${rel}: app "${app}" must not depend on another app (${name})`);
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
console.log('Boundary check passed: the platform depends on no app, and apps depend on no other app.');
