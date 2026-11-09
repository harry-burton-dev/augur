// The release file an app on contract 3 attaches, from its checkout and what the build pushed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readCheckout, releaseOf2 } from './release2.mjs';

const fixture = fileURLToPath(new URL('../fixtures/notes/', import.meta.url));
const fs = { readdirSync, existsSync, join };
const digest = (c) => `sha256:${c.repeat(64)}`;
const bundle = { service: null, frontend: { artifact: `ghcr.io/o/notes-frontend@${digest('b')}`, digest: digest('c') }, channel: 'beta' };
const signer = { repository: 'o/notes', workflow: '.github/workflows/release.yml' };

test('reads a checkout with its jobs first, and pins every part built here to the image the build pushed', () => {
  const checkout = readCheckout(fixture, fs);
  assert.deepEqual(checkout.parts.map((p) => p.metadata.name), ['migrate', 'web', 'worker']);
  const release = releaseOf2({ ...checkout, bundle, signer });
  assert.equal(release.schema, 'augur.app-release/v2');
  assert.equal(release.channel, 'beta');
  assert.equal(release.frontend.artifact, bundle.frontend.artifact);
  assert.deepEqual(release.asks.scopes, checkout.manifest.scopes);
  for (const part of release.parts) for (const c of Object.values(part.containers)) assert.match(c.image, /@sha256:/);
});

test('a preview carries its pull request, and a bundle without the image its parts need is refused', () => {
  const checkout = readCheckout(fixture, fs);
  const preview = releaseOf2({ ...checkout, manifest: { ...checkout.manifest, version: '1.0.0-pr.12.3' }, bundle: { ...bundle, channel: 'preview' }, signer, env: { PR_NUMBER: '12', PR_TITLE: 'A change' } });
  assert.deepEqual(preview.preview, { pr: 12, title: 'A change' });
  assert.throws(() => releaseOf2({ ...checkout, bundle: { ...bundle, channel: 'preview' }, signer, env: {} }), /PR_NUMBER/);
  const built = { ...checkout, parts: checkout.parts.map((p) => ({ ...p, containers: Object.fromEntries(Object.entries(p.containers).map(([k, c]) => [k, { ...c, image: '.' }])) })) };
  assert.throws(() => releaseOf2({ ...built, bundle: { ...bundle, service: null }, signer }), /built from this repository's image/);
  const pinned = releaseOf2({ ...built, bundle: { ...bundle, service: `ghcr.io/o/notes@${digest('a')}` }, signer });
  for (const part of pinned.parts) for (const c of Object.values(part.containers)) assert.equal(c.image, `ghcr.io/o/notes@${digest('a')}`);
  // An image nothing runs is a mistake to say, not to drop.
  assert.throws(() => releaseOf2({ ...checkout, bundle: { ...bundle, service: `ghcr.io/o/notes@${digest('a')}` }, signer }), /no part's Score file says/);
});

test('augur-app describe writes release v2 for an app on contract 3, and release describe says the same', () => {
  const dir = mkdtempSync(join(tmpdir(), 'app3-repo-'));
  cpSync(fixture, dir, { recursive: true });
  const env = { ...process.env, GITHUB_REPOSITORY: 'o/notes', GITHUB_WORKFLOW_REF: 'o/notes/.github/workflows/release.yml@refs/heads/main' };
  const bin = fileURLToPath(new URL('../bin/augur-app.mjs', import.meta.url));
  const described = JSON.parse(execFileSync('node', [bin, 'describe'], { cwd: dir, env, encoding: 'utf8' }));
  assert.equal(described.schema, 'augur.app-release/v2');
  assert.equal(described.parts.length, 3);
  assert.match(described.frontend.artifact, /notes-frontend@sha256:0{64}$/);
  const spelt = JSON.parse(execFileSync('node', [bin, 'release', 'describe'], { cwd: dir, env, encoding: 'utf8' }));
  assert.deepEqual(spelt.parts, described.parts);
});

test('augur-app describe with no bundle stands in for the image of a part built here, named where the build would push it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'app3-repo-'));
  cpSync(fixture, dir, { recursive: true });
  // The part built from this repository, as an app's checkout has it (and as the template does).
  const web = join(dir, 'score', 'web.score.yaml');
  writeFileSync(web, readFileSync(web, 'utf8').replace(/image: ghcr\.io\/[^\n]+/, 'image: .'));
  const bin = fileURLToPath(new URL('../bin/augur-app.mjs', import.meta.url));
  const describe = (env) => JSON.parse(execFileSync('node', [bin, 'describe'], { cwd: dir, env: { ...process.env, ...env }, encoding: 'utf8' }));
  const named = describe({ GITHUB_REPOSITORY: 'o/notes', GITHUB_WORKFLOW_REF: 'o/notes/.github/workflows/release.yml@refs/heads/main' });
  const image = (release, part) => Object.values(release.parts.find((p) => p.metadata.name === part).containers)[0].image;
  assert.equal(image(named, 'web'), `ghcr.io/o/notes/notes@${'sha256:' + '0'.repeat(64)}`);
  // The other parts keep the images their Score files name.
  assert.match(image(named, 'worker'), /^ghcr\.io\/example-org\/augur-notes-worker@sha256:/);
});
