import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readSummaries, table } from './coverage-summary.mjs';

const totals = (covered, total) => ({
  lines: { covered, total },
  statements: { covered, total },
  functions: { covered, total },
  branches: { covered, total },
});

test('reads each package that wrote a summary, and adds them up', () => {
  const base = mkdtempSync(join(tmpdir(), 'coverage-'));
  for (const [name, covered] of [['gateway', 3], ['events', 1]]) {
    mkdirSync(join(base, 'services', name, 'coverage'), { recursive: true });
    writeFileSync(join(base, 'services', name, 'coverage', 'coverage-summary.json'), JSON.stringify({ total: totals(covered, 4) }));
  }
  mkdirSync(join(base, 'services', 'untested'));

  const found = readSummaries(base, ['services', 'missing']);
  assert.deepEqual(found.map((s) => s.path), ['services/events', 'services/gateway']);
  const out = table(found);
  assert.match(out, /\| services\/events \| 25\.0% \| 25\.0% \| 25\.0% \| 25\.0% \|/);
  assert.match(out, /\| \*\*All\*\* \| \*\*50\.0%\*\*/);
});

test('says so when nothing wrote a summary, and shows a dash for nothing to cover', () => {
  assert.match(table([]), /No package wrote a coverage summary/);
  assert.match(table([{ path: 'p', total: totals(0, 0) }]), /\| p \| – \| – \| – \| – \|/);
});
