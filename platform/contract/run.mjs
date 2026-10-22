// Runs the contract tests against each build of the reference app: its source
// (today's SDK), then every frozen build from an earlier SDK release.
//   pnpm --filter @platform/contract-tests test:contract
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const frozen = join(here, 'frozen');
const targets = [
  { name: 'source', env: {} },
  ...(existsSync(frozen) ? readdirSync(frozen) : []).sort().map((release) => ({
    name: release,
    env: { DEV_APP_ENTRY: '/apps/reference/entry.js', APP_DIST: `reference=${join(frozen, release)}` },
  })),
];

let failed = [];
for (const target of targets) {
  console.log(`\n── The reference app built from ${target.name} ──`);
  const run = spawnSync('pnpm', ['exec', 'playwright', 'test'], {
    cwd: here,
    stdio: 'inherit',
    env: { ...process.env, DEV_APP: join(here, 'reference-app'), CONTRACT_TARGET: target.name, ...target.env },
  });
  if (run.status !== 0) failed.push(target.name);
}
if (failed.length) {
  console.error(`\n✗ The shell broke the reference app built from: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\nThe shell keeps its promise to ${targets.length} build${targets.length === 1 ? '' : 's'} of the reference app.`);
