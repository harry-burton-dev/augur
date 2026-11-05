import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isEmptyChangeset, setAsideIfAllEmpty } from './empty-changesets.mjs';

test('a changeset naming no package is empty; one naming a package is not', () => {
  assert.equal(isEmptyChangeset('---\n---\n\nTooling only.\n'), true);
  assert.equal(isEmptyChangeset('---\r\n\r\n---\r\n'), true);
  assert.equal(isEmptyChangeset("---\n'@augur/registry': patch\n---\n\nFix.\n"), false);
  assert.equal(isEmptyChangeset('No front matter at all.\n'), false);
  assert.equal(isEmptyChangeset('---\nunclosed\n'), false);
});

const folder = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'changesets-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
};

test('when only empty changesets wait, they are set aside and the README stays', () => {
  const dir = folder({ 'README.md': '# Changesets\n', 'config.json': '{}', 'a.md': '---\n---\n\nA.\n', 'b.md': '---\n---\n\nB.\n' });
  assert.deepEqual(setAsideIfAllEmpty(dir), ['a.md', 'b.md']);
  assert.equal(existsSync(join(dir, 'a.md')), false);
  assert.equal(existsSync(join(dir, 'README.md')), true);
});

test('when any waiting changeset bumps a package, every one stays for the Version packages PR', () => {
  const dir = folder({ 'a.md': '---\n---\n\nA.\n', 'b.md': "---\n'augur': minor\n---\n\nB.\n" });
  assert.deepEqual(setAsideIfAllEmpty(dir), []);
  assert.equal(existsSync(join(dir, 'a.md')), true);
  assert.deepEqual(setAsideIfAllEmpty(folder({})), []);
});
