// The shared release steps; scripts/app-release.test.mjs covers the rest through the platform repository's script.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { changelogSection, releaseNotes, signerOf } from './release.mjs';

const changelog = '# notes-frontend\n\n## 1.3.0\n\n### Minor Changes\n\n- Tags.\n\n## 1.2.0\n\n- Older.\n';

test('the notes for a version come from its own changelog section', () => {
  assert.equal(changelogSection(changelog, '1.3.0'), '#### Minor Changes\n\n- Tags.');
  assert.equal(changelogSection(changelog, '1.2.0'), '- Older.');
  assert.equal(changelogSection(changelog, '9.9.9'), '');
});

test('a release, a preview and a dev build each say what they are', () => {
  const manifest = { name: 'Notes' };
  assert.match(releaseNotes({ manifest, version: '1.3.0', channel: 'stable', notes: '' }), /^Notes 1.3.0\.\n\n_No changelog entry._/);
  assert.match(releaseNotes({ manifest, version: '1.3.0-pr.4.1', channel: 'preview', preview: { pr: 4, title: 'Tags' } }), /pull request #4, Tags\./);
  assert.match(releaseNotes({ manifest, version: '1.3.1-dev.9', channel: 'dev' }, { target: 'abc123' }), /from abc123\./);
});

test('the signer is the repository and workflow that ran it', () => {
  assert.deepEqual(signerOf({ GITHUB_REPOSITORY: 'o/notes', GITHUB_WORKFLOW_REF: 'o/notes/.github/workflows/release.yml@refs/heads/main' }), { repository: 'o/notes', workflow: '.github/workflows/release.yml' });
});

test('augur-app gives an app repository’s checkout a dev build version, and describes its release', () => {
  const dir = mkdtempSync(join(tmpdir(), 'app-repo-'));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ id: 'notes', name: 'Notes', version: '1.2.0', sdk: '^1.3.0', route: '/notes' }));
  mkdirSync(join(dir, 'frontend'));
  writeFileSync(join(dir, 'frontend', 'package.json'), JSON.stringify({ name: 'notes-frontend', version: '1.2.0' }));
  const cli = (...args) => execFileSync(process.execPath, [new URL('../bin/augur-app.mjs', import.meta.url).pathname, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_REPOSITORY: 'o/notes', GITHUB_WORKFLOW_REF: 'o/notes/.github/workflows/app-dev.yml@refs/heads/main' } }).trim();
  assert.equal(cli('dev', '7'), '1.2.1-dev.7');
  assert.equal(JSON.parse(readFileSync(join(dir, 'frontend', 'package.json'), 'utf8')).version, '1.2.1-dev.7');
  const described = JSON.parse(cli('describe'));
  assert.equal(described.version, '1.2.1-dev.7');
  assert.equal(described.channel, 'dev');
  assert.equal(described.service, null);
  assert.deepEqual(described.signer, { repository: 'o/notes', workflow: '.github/workflows/app-dev.yml' });
});
