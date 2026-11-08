// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appRelease, appTag, APP_RELEASE_SCHEMA, asksOf, changedApps, channelOf, devAppOf, devVersion, FRONTEND_MEDIA_TYPE, oldDevBuilds, previewPrOf, previewVersion } from './app-release.mjs';

const digest = (c) => `sha256:${c.repeat(64)}`;
const manifest = { id: 'notes', name: 'Notes', version: '1.2.0', sdk: '^1.3.0', route: '/notes', entry: '/apps/notes/entry.js', scopes: ['people:read'] };
const app = { id: 'notes', manifest };
const signer = { repository: 'harry-burton-dev/im-platform', workflow: '.github/workflows/release.yml' };
const bundle = { service: `ghcr.io/x/apps/notes@${digest('a')}`, frontend: { artifact: `ghcr.io/x/apps/notes-frontend@${digest('b')}`, digest: digest('c') } };

test('a version with a prerelease part is beta, a pull request’s build preview, any other stable', () => {
  assert.equal(channelOf('1.2.0'), 'stable');
  assert.equal(channelOf('1.2.0-beta.1'), 'beta');
  assert.equal(channelOf('1.2.0-pr.12.3'), 'preview');
  assert.equal(channelOf('1.2.1-dev.40'), 'dev');
});

test('a dev build sorts above the release it follows and below the next', () => {
  assert.equal(devVersion('1.2.0', 40), '1.2.1-dev.40');
  assert.equal(devVersion('1.3.0-beta.2', '41'), '1.3.0-dev.41');
  assert.throws(() => devVersion('1.2.0', 'x'), /number/);
  assert.equal(devAppOf('app/notes@1.2.1-dev.40'), 'notes');
  assert.equal(devAppOf('app/notes@1.2.1'), undefined);
  assert.equal(devAppOf('app/notes@1.2.1-pr.3.4'), undefined);
});

test('only each app’s newest few dev builds are kept', () => {
  const tags = ['app/notes@1.2.1-dev.9', 'app/notes@1.2.1-dev.10', 'app/notes@1.2.1-dev.8', 'app/notes@1.2.1-dev.7', 'app/notes@1.2.0', 'app/other@0.1.1-dev.1'];
  assert.deepEqual(oldDevBuilds(tags, 'notes'), ['app/notes@1.2.1-dev.7']);
  assert.deepEqual(oldDevBuilds(tags, 'notes', [], 1), ['app/notes@1.2.1-dev.9', 'app/notes@1.2.1-dev.8', 'app/notes@1.2.1-dev.7']);
  assert.deepEqual(oldDevBuilds(tags, 'notes', ['app/notes@1.2.1-dev.7'], 1), ['app/notes@1.2.1-dev.9', 'app/notes@1.2.1-dev.8']);
});

test('a pull request’s build gets a version of its own, which says where it’s from', () => {
  assert.equal(previewVersion('1.2.0', 12, 3), '1.2.0-pr.12.3');
  assert.equal(previewVersion('1.3.0-beta.2', '7', '41'), '1.3.0-pr.7.41');
  assert.throws(() => previewVersion('1.2.0', 'x', 1), /numbers/);
  assert.equal(previewPrOf('app/notes@1.2.0-pr.12.3'), 12);
  assert.equal(previewPrOf('app/notes@1.2.0'), undefined);
  assert.equal(previewPrOf('augur@0.5.0'), undefined);
  const apps = [{ id: 'notes', path: 'apps/notes' }, { id: 'notes-2', path: 'apps/notes-2' }];
  assert.deepEqual(changedApps(apps, ['apps/notes/service/src/app.ts', 'platform/x.ts']).map((a) => a.id), ['notes']);
});

test('a preview names its pull request', () => {
  const release = appRelease({ app: { id: 'notes', manifest: { ...manifest, version: '1.2.0-pr.4.1' } }, bundle: { ...bundle, channel: 'preview' }, signer, preview: { pr: 4, title: 'Tags' } });
  assert.equal(release.channel, 'preview');
  assert.deepEqual(release.preview, { pr: 4, title: 'Tags' });
});

test('an app release is tagged beside AUGUR’s', () => {
  assert.equal(appTag('notes', '1.2.0'), 'app/notes@1.2.0');
});

test('the release names every part by digest, with what it asks for', () => {
  const release = appRelease({ app, bundle, signer, notes: 'Fixes.', releasedAt: '2026-10-27T00:00:00.000Z' });
  assert.equal(release.schema, APP_RELEASE_SCHEMA);
  assert.equal(release.channel, 'stable');
  assert.deepEqual(release.service, { image: bundle.service });
  assert.deepEqual(release.frontend, { ...bundle.frontend, mediaType: FRONTEND_MEDIA_TYPE });
  assert.deepEqual(release.asks.scopes, ['people:read']);
  assert.deepEqual(release.asks.floors, ['personal', 'team', 'org']);
  assert.equal(release.signer, signer);
});

test('a part named by tag, not digest, is refused', () => {
  assert.throws(() => appRelease({ app, bundle: { ...bundle, service: 'ghcr.io/x/apps/notes:1.2.0' }, signer }), /by digest/);
  assert.throws(() => appRelease({ app, bundle: { ...bundle, frontend: { artifact: 'ghcr.io/x/apps/notes-frontend:1.2.0', digest: digest('c') } }, signer }), /by digest/);
  assert.throws(() => appRelease({ app, bundle: { service: null, frontend: null }, signer }), /neither/);
});

test('an app with only a frontend is released without a service', () => {
  const release = appRelease({ app, bundle: { service: null, frontend: bundle.frontend, channel: 'preview' }, signer });
  assert.equal(release.service, null);
  assert.equal(release.channel, 'preview');
});

test('asks default to what any app gets', () => {
  assert.deepEqual(asksOf({}), { scopes: [], storage: {}, floors: ['personal', 'team', 'org'], maxUpload: 10, settings: [] });
});

