// Runs the contract tests against each build of the reference app: its source
// (today's SDK), then every frozen build from an earlier SDK release
// (one folder for each set of SDK minors whose builds were byte-for-byte the same; freeze.mjs).
//   pnpm --filter @augur/contract-tests test:contract
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { availableParallelism, totalmem } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const frozen = join(here, 'frozen');
// Every frozen build, or with CONTRACT_FROZEN=edges only the oldest and the newest: CI's choice on an
// ordinary pull request, to keep its minutes down, while the Version packages pull request runs them
// all before anything is released (CI/CD in the AUGUR handbook, 03 Architecture/Engineering).
const releases = (existsSync(frozen) ? readdirSync(frozen) : []).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const chosen = process.env.CONTRACT_FROZEN === 'edges' && releases.length > 2 ? [releases[0], releases.at(-1)] : releases;
// Every build runs with the feature preview `turned-on` on for the stand-in person (SDK 1.7), since
// a frozen build from 1.7 on checks it too. Today's build runs every spec; the
// frozen builds run only the mount context's (tests/contract.spec.ts).
const source = { DEV_PREVIEWS: 'turned-on' };
const targets = [
  { name: 'source', env: source, specs: [] },
  // The reference app on the app contract (contract 3): its own app, in a worker, against its own spec.
  { name: 'contract-3', env: { ...source, DEV_APP: join(here, 'reference-app-3') }, specs: ['tests/contract3.spec.ts'] },
  ...chosen.map((release) => ({
    name: release,
    env: { ...source, DEV_APP_ENTRY: '/apps/reference/entry.js', APP_DIST: `reference=${join(frozen, release)}` },
    specs: ['tests/contract.spec.ts'],
  })),
];
const label = (target) => target.name;

// Side by side, each with its own shell on its own port, so three builds take
// about as long as one. Each build's output is printed whole once it finishes.
// Each run (a shell and two browsers) takes up to about 2.5 GB, so a
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
    const child = spawn('pnpm', ['exec', 'playwright', 'test', ...target.specs], {
      cwd: here,
      env: {
        ...process.env,
        DEV_APP: join(here, 'reference-app'),
        CONTRACT_TARGET: target.name,
        CONTRACT_PORT: String(5180 + i),
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
console.log(`\nThe shell keeps its promise in all ${targets.length} runs of the reference app.`);
