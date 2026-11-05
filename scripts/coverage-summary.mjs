#!/usr/bin/env node
// Gathers the coverage each package's tests wrote (Vitest's v8 coverage, json-summary reporter, ADR 0069)
// into one Markdown table: one row per package, lines, statements, functions and branches covered.
// CI writes it to the run's summary on a push to main; nothing fails on a number (CI/CD in the AUGUR handbook, 03 Architecture/Engineering).
//
//   node scripts/coverage-summary.mjs            print the table
//   node scripts/coverage-summary.mjs >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The folders whose packages run tests. */
const PARTS = ['platform/services', 'platform/packages', 'platform/frontends'];
const MEASURES = ['lines', 'statements', 'functions', 'branches'];

/** Each package under `parts` that has a coverage/coverage-summary.json, with its totals. */
export function readSummaries(base = root, parts = PARTS) {
  const found = [];
  for (const part of parts) {
    const dir = join(base, part);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      const file = join(dir, name, 'coverage', 'coverage-summary.json');
      if (!existsSync(file)) continue;
      const { total } = JSON.parse(readFileSync(file, 'utf8'));
      found.push({ path: relative(base, join(dir, name)), total });
    }
  }
  return found;
}

const percent = (covered, total) => (total === 0 ? '–' : `${((covered / total) * 100).toFixed(1)}%`);

/** The Markdown table for `summaries`, with a row for all of them together. */
export function table(summaries) {
  if (summaries.length === 0) return '### Test coverage\n\nNo package wrote a coverage summary.\n';
  const all = Object.fromEntries(MEASURES.map((m) => [m, { covered: 0, total: 0 }]));
  const rows = summaries.map(({ path, total }) => {
    for (const m of MEASURES) {
      all[m].covered += total[m]?.covered ?? 0;
      all[m].total += total[m]?.total ?? 0;
    }
    return `| ${path} | ${MEASURES.map((m) => percent(total[m]?.covered ?? 0, total[m]?.total ?? 0)).join(' | ')} |`;
  });
  return [
    '### Test coverage',
    '',
    `| Package | ${MEASURES.map((m) => m[0].toUpperCase() + m.slice(1)).join(' | ')} |`,
    `| --- | ${MEASURES.map(() => '---:').join(' | ')} |`,
    ...rows,
    `| **All** | ${MEASURES.map((m) => `**${percent(all[m].covered, all[m].total)}**`).join(' | ')} |`,
    '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(table(readSummaries()));
}
