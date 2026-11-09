// The app's Backstage catalog entry, from its manifest and parts.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { appCatalog, catalogText, repoSlug } from './catalog.mjs';

const manifest = {
  id: 'notes',
  name: 'Notes',
  description: 'Notes kept for a floor',
  route: '/notes',
  version: '0.4.0',
  sdk: '^2.0.0',
  category: 'pillar',
  floors: ['org'],
  scopes: ['notifications:send'],
  handles: [{ intent: 'open', type: 'note' }],
  storage: { database: true, bucket: true },
};
const parts = {
  service: { name: '@acme/notes', version: '0.4.0', description: 'Notes service' },
  frontend: { name: '@acme/notes-frontend', version: '1.0.0' },
};

test('an app is a system with its parts, its intents and what it keeps, and says its kind', () => {
  const entities = appCatalog({ manifest, parts, repo: 'o/augur-notes' });
  assert.deepEqual(entities.map((e) => `${e.kind}:${e.metadata.name}`), ['System:notes', 'Component:acme-notes-frontend', 'Component:acme-notes', 'API:notes-intents', 'Resource:notes-db', 'Resource:notes-bucket']);
  const [system, frontend, service] = entities;
  assert.equal(system.metadata.annotations['augur.dev/category'], 'pillar');
  assert.equal(system.metadata.annotations['augur.dev/release-unit'], 'app/notes');
  assert.equal(system.metadata.annotations['backstage.io/source-location'], 'url:https://github.com/o/augur-notes/tree/main/');
  assert.equal(frontend.spec.lifecycle, 'production');
  assert.deepEqual(frontend.spec.providesApis, ['api:default/notes-intents']);
  assert.deepEqual(service.spec.consumesApis, ['api:default/events-api', 'api:default/registry-api']);
  assert.deepEqual(service.spec.dependsOn, ['resource:default/notes-bucket', 'resource:default/notes-db']);
});

test('an app with no kind says none, and the file is JSON documents Backstage reads as YAML', () => {
  const { category: _c, ...plain } = manifest;
  const text = catalogText(appCatalog({ manifest: plain, parts: {}, repo: 'o/r' }));
  assert.ok(!text.includes('augur.dev/category'));
  const docs = text.replace(/^#.*\n/, '').split('\n---\n').map((d) => JSON.parse(d));
  assert.equal(docs[0].kind, 'System');
});

test('the repository comes from GITHUB_REPOSITORY or a GitHub remote, and is required', () => {
  assert.equal(repoSlug({ env: { GITHUB_REPOSITORY: 'o/a' } }), 'o/a');
  assert.equal(repoSlug({ env: {}, remote: 'git@github.com:o/b.git\n' }), 'o/b');
  assert.equal(repoSlug({ env: {}, remote: 'https://github.com/o/c' }), 'o/c');
  assert.equal(repoSlug({ env: {}, remote: '' }), undefined);
  assert.throws(() => appCatalog({ manifest, parts, repo: undefined }), /Say which repository/);
});

test('augur-app catalog writes the file, and --check fails once the manifest moves on', () => {
  const dir = mkdtempSync(join(tmpdir(), 'app-catalog-'));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
  mkdirSync(join(dir, 'service'));
  writeFileSync(join(dir, 'service/package.json'), JSON.stringify(parts.service));
  const bin = new URL('../bin/augur-app.mjs', import.meta.url).pathname;
  const env = { ...process.env, GITHUB_REPOSITORY: 'o/augur-notes' };
  const cli = (...args) => execFileSync('node', [bin, ...args], { cwd: dir, env, encoding: 'utf8', stdio: 'pipe' });
  assert.match(cli('catalog'), /Wrote catalog-info.yaml/);
  assert.match(readFileSync(join(dir, 'catalog-info.yaml'), 'utf8'), /"augur.dev\/category": "pillar"/);
  assert.match(cli('catalog', '--check'), /up to date/);
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ ...manifest, version: '0.5.0' }));
  assert.throws(() => cli('catalog', '--check'), /out of date/);
});

test('an app on contract 3 is at /<id>, names its contract, and its intents come from what it contributes', () => {
  const m3 = { id: 'notes', name: 'Notes', version: '1.0.0', contract: 3, floors: ['org'], scopes: ['events:publish'], contributes: { intents: { handles: ['note.open'] } } };
  const entities = appCatalog({ manifest: m3, parts, repo: 'acme/notes' });
  const system = entities.find((e) => e.kind === 'System');
  assert.equal(system.metadata.annotations['augur.dev/route'], '/notes');
  assert.equal(system.metadata.annotations['augur.dev/contract'], '3');
  assert.equal('augur.dev/sdk-range' in system.metadata.annotations, false);
  const api = entities.find((e) => e.kind === 'API');
  assert.deepEqual(JSON.parse(api.spec.definition), { intents: ['note.open'] });
});
