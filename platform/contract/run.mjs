// Runs the contract tests against each build of the reference app: its source
// (today's SDK), with Folio on and off, then every frozen build from an earlier SDK release.
//   pnpm --filter @augur/contract-tests test:contract
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const frozen = join(here, 'frozen');
// Folio ships with AUGUR but can be turned off, so today's build runs with it and without it,
// and each frozen build beside it, as released apps now run.
const targets = [
  { name: 'source', folio: false, env: {} },
  { name: 'source', folio: true, env: {} },
  ...(existsSync(frozen) ? readdirSync(frozen) : []).sort().map((release) => ({
    name: release,
    folio: true,
    env: { DEV_APP_ENTRY: '/apps/reference/entry.js', APP_DIST: `reference=${join(frozen, release)}` },
  })),
];
const label = (target) => `${target.name}, Folio ${target.folio ? 'on' : 'off'}`;

// Side by side, each with its own shell on its own port, so three builds take
// about as long as one. Each build's output is printed whole once it finishes.
const results = await Promise.all(
  targets.map(
    (target, i) =>
      new Promise((resolve) => {
        const run = spawn('pnpm', ['exec', 'playwright', 'test'], {
          cwd: here,
          env: {
            ...process.env,
            DEV_APP: join(here, 'reference-app'),
            CONTRACT_TARGET: target.name,
            CONTRACT_PORT: String(5180 + i),
            CONTRACT_FOLIO: target.folio ? 'on' : 'off',
            CONTRACT_FOLIO_PORT: String(8190 + i),
            FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
            ...target.env,
          },
        });
        let output = '';
        run.stdout.on('data', (chunk) => (output += chunk));
        run.stderr.on('data', (chunk) => (output += chunk));
        run.on('close', (status) => {
          console.log(`\n── The reference app built from ${label(target)} ──\n${output}`);
          resolve({ name: label(target), ok: status === 0 });
        });
      }),
  ),
);
const failed = results.filter((r) => !r.ok).map((r) => r.name);
if (failed.length) {
  console.error(`\n✗ The shell broke the reference app built from: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\nThe shell keeps its promise in all ${targets.length} runs of the reference app, with Folio on and off.`);
