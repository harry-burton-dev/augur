// The platform's API contracts come from the services' own route schemas (ADR 0055): each service
// that has a src/contract.ts builds its routes in memory, and @fastify/swagger writes what they say
// to contracts/<service>.openapi.yaml. CI checks the files are in step, then Spectral lints them.
//   pnpm contracts           write them (after pnpm build: it uses the services' builds)
//   pnpm check:contracts     fail if one is out of step, and lint them all
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';

const root = new URL('..', import.meta.url).pathname;
// Spectral runs through pnpm dlx at a pinned version: it lints, it never ships, and its own dependencies
// stay out of pnpm-lock.yaml and the dependency scan (ADR 0055). Renovate doesn't move it: bump it here.
const SPECTRAL = '@stoplight/spectral-cli@6.17.0';
const mode = process.argv[2] ?? 'check';
if (!['write', 'check'].includes(mode)) {
  console.error('Usage: node scripts/check-contracts.mjs write|check');
  process.exit(2);
}
process.env.NODE_ENV = 'test';

const header = (service) =>
  [
    `# Generated from platform/services/${service}: its routes' TypeBox schemas and src/contract.ts (ADR 0055).`,
    '# Change those, then run pnpm contracts. CI fails when this file is out of step.',
    '# Paths below are relative to the server: the major of info.version is the path prefix.',
    '# A breaking change bumps the major and is served under /v2 beside /v1.',
    '',
  ].join('\n');

const problems = [];
const generated = [];
const services = readdirSync(join(root, 'platform/services')).filter((s) => existsSync(join(root, 'platform/services', s, 'src/contract.ts')));
for (const service of services) {
  const built = join(root, 'platform/services', service, 'dist/app.js');
  if (!existsSync(built)) {
    problems.push(`platform/services/${service} is not built yet. Run: pnpm build`);
    continue;
  }
  const { buildApp } = await import(built);
  // Only the routes are read: a service that needs its stores to answer gets none here.
  const app = await buildApp({});
  await app.ready();
  const text = header(service) + stringify(app.swagger(), { lineWidth: 0, aliasDuplicateObjects: false });
  await app.close();
  const file = join(root, 'contracts', `${service}.openapi.yaml`);
  generated.push(`contracts/${service}.openapi.yaml`);
  const before = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (before === text) continue;
  if (mode === 'write') {
    writeFileSync(file, text);
    console.log(`Wrote contracts/${service}.openapi.yaml`);
  } else problems.push(`contracts/${service}.openapi.yaml is out of step with platform/services/${service}. Run: pnpm build && pnpm contracts`);
}

// Only the generated ones: a hand-written contract is linted once its service generates it.
if (mode === 'check' && !problems.length && generated.length) {
  try {
    execFileSync('pnpm', ['dlx', SPECTRAL, 'lint', '--fail-severity', 'error', '--ruleset', join(root, '.spectral.yaml'), ...generated], { cwd: root, stdio: 'inherit' });
  } catch {
    problems.push('Spectral found errors in contracts/ (above).');
  }
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
if (mode === 'check') console.log(`${services.length} generated contract${services.length === 1 ? '' : 's'} in step; each lints clean.`);
