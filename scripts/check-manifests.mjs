// Checks every app's manifest.json the way the registry will when the app registers:
// the registry's own schema and rules, against a registry running in memory.
//   pnpm check:manifest      (after pnpm build: it uses the registry's build)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
process.env.NODE_ENV = 'test';
const built = join(root, 'platform/services/registry/dist/app.js');
if (!existsSync(built)) {
  console.error('✗ The registry is not built yet. Run: pnpm build');
  process.exit(1);
}
const { buildApp } = await import(built);
const { appEntrySchema } = await import(join(root, 'platform/services/registry/dist/manifest.js'));
// Each app registers as itself, as its service would once signed in.
const registry = await buildApp({ verifyService: async (headers) => ({ kind: 'app', app: String(headers['x-check-app']) }) });

const problems = [];
let checked = 0;
for (const app of readdirSync(join(root, 'apps'), { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const file = `apps/${app.name}/manifest.json`;
  if (!existsSync(join(root, file))) continue;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(root, file), 'utf8'));
  } catch (err) {
    problems.push(`${file}: not JSON (${err.message})`);
    continue;
  }
  checked++;
  if (manifest.id !== app.name) problems.push(`${file}: id is "${manifest.id}", but the app's folder is apps/${app.name}. They must match.`);
  // One registry for every app, so two apps asking for the same route are caught too.
  const res = await registry.inject({
    method: 'PUT',
    url: `/v1/apps/${encodeURIComponent(manifest.id ?? app.name)}`,
    headers: { 'x-check-app': manifest.id ?? app.name },
    payload: manifest,
  });
  if (res.statusCode >= 300) {
    // The registry refuses unknown fields without naming them; name the top-level ones here.
    const unknown = Object.keys(manifest).filter((k) => !(k in appEntrySchema.properties));
    const hint = unknown.length ? ` (unknown: ${unknown.join(', ')})` : '';
    problems.push(`${file}: the registry would refuse it (${res.statusCode}): ${res.json().message}${hint}`);
  }
}
await registry.close();

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`${checked} app manifest${checked === 1 ? '' : 's'} would be accepted by the registry.`);
