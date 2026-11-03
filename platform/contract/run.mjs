// Runs the contract tests against each build of the reference app: its source
// (today's SDK), with Folio on and off, then every frozen build from an earlier SDK release.
//   pnpm --filter @augur/contract-tests test:contract
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { availableParallelism, totalmem } from 'node:os';
import { join, resolve } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const frozen = join(here, 'frozen');
// Every frozen build, or with CONTRACT_FROZEN=edges only the oldest and the newest: CI's choice on an
// ordinary pull request, to keep its minutes down, while the Version packages pull request runs them
// all before anything is released (docs/ci-cd.md).
const releases = (existsSync(frozen) ? readdirSync(frozen) : []).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const chosen = process.env.CONTRACT_FROZEN === 'edges' && releases.length > 2 ? [releases[0], releases.at(-1)] : releases;
// Folio ships with AUGUR but can be turned off, so today's build runs with it and without it,
// and each frozen build beside it, as released apps now run.
// Folio comes from the release AUGUR ships, laid out by infra/shipped-app.sh; without it (on a laptop
// that hasn't run that), every run has Folio off, and says so. CI always has it.
const folioDir = resolve(here, process.env.CONTRACT_FOLIO_DIR ?? '../../.shipped/apps/folio');
const folio = existsSync(join(folioDir, 'service', 'dist', 'index.js'));
if (!folio) {
  if (process.env.CI) {
    console.error(`✗ Folio isn't laid out in ${folioDir}. Run: infra/shipped-app.sh folio`);
    process.exit(1);
  }
  console.log(`Folio isn't laid out in ${folioDir}, so every run has it off. To run with it: infra/shipped-app.sh folio`);
}
const targets = [
  { name: 'source', folio: false, env: {} },
  ...(folio ? [{ name: 'source', folio: true, env: {} }] : []),
  ...chosen.map((release) => ({
    name: release,
    folio,
    env: { DEV_APP_ENTRY: '/apps/reference/entry.js', APP_DIST: `reference=${join(frozen, release)}` },
  })),
];
const label = (target) => `${target.name}, Folio ${target.folio ? 'on' : 'off'}`;

// Side by side, each with its own shell on its own port, so three builds take
// about as long as one. Each build's output is printed whole once it finishes.
// Each run (a shell, Folio's service, two browsers) takes up to about 2.5 GB, so a
// machine or container with less memory runs fewer at once rather than having the
// kernel kill one part way through (as on a small CI runner).
// Each also keeps about two cores busy, and the tests give the shell a few seconds to
// answer a key or a floor change: on a 2-core hosted runner, three at once starved them
// and different tests timed out on each run. CONTRACT_AT_ONCE sets it outright.
const constrained = process.constrainedMemory?.();
const memory = constrained && constrained < totalmem() ? constrained : totalmem();
const cores = availableParallelism();
const fits = Math.min(Math.floor(memory / 2.5e9), Math.floor(cores / 2));
const atOnce = Math.max(1, Math.min(targets.length, Number(process.env.CONTRACT_AT_ONCE) || fits));
console.log(`${targets.length} runs of the reference app, ${atOnce} at a time (${(memory / 1e9).toFixed(1)} GB, ${cores} cores).`);
if (chosen.length < releases.length) console.log(`Frozen builds: ${chosen.join(' and ')} of ${releases.length}; the Version packages pull request runs every one.`);
const run = (target, i) =>
  new Promise((resolve) => {
    const child = spawn('pnpm', ['exec', 'playwright', 'test'], {
      cwd: here,
      env: {
        ...process.env,
        DEV_APP: join(here, 'reference-app'),
        CONTRACT_TARGET: target.name,
        CONTRACT_PORT: String(5180 + i),
        CONTRACT_FOLIO: target.folio ? 'on' : 'off',
        CONTRACT_FOLIO_PORT: String(8190 + i),
        CONTRACT_FOLIO_DIR: folioDir,
        FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
        ...target.env,
      },
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (status) => {
      console.log(`\n── The reference app built from ${label(target)} ──\n${output}`);
      resolve({ name: label(target), ok: status === 0 });
    });
  });
const results = [];
let next = 0;
await Promise.all(
  Array.from({ length: atOnce }, async () => {
    while (next < targets.length) {
      const i = next++;
      results[i] = await run(targets[i], i);
    }
  }),
);
const failed = results.filter((r) => !r.ok).map((r) => r.name);
if (failed.length) {
  console.error(`\n✗ The shell broke the reference app built from: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\nThe shell keeps its promise in all ${targets.length} runs of the reference app, with Folio on and off.`);
