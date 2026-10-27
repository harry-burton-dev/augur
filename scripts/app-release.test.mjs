// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appRelease, appTag, APP_RELEASE_SCHEMA, asksOf, channelOf, FRONTEND_MEDIA_TYPE, readApps } from './app-release.mjs';

const digest = (c) => `sha256:${c.repeat(64)}`;
const manifest = { id: 'notes', name: 'Notes', version: '1.2.0', sdk: '^1.3.0', route: '/notes', entry: '/apps/notes/entry.js', scopes: ['people:read'] };
const app = { id: 'notes', manifest };
const signer = { repository: 'harry-burton-dev/im-platform', workflow: '.github/workflows/release.yml' };
const bundle = { service: `ghcr.io/x/apps/notes@${digest('a')}`, frontend: { artifact: `ghcr.io/x/apps/notes-frontend@${digest('b')}`, digest: digest('c') } };

test('a version with a prerelease part is beta, any other stable', () => {
  assert.equal(channelOf('1.2.0'), 'stable');
  assert.equal(channelOf('1.2.0-beta.1'), 'beta');
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

test('pillar apps go out with AUGUR, not on their own', () => {
  assert.ok(!readApps().some((a) => a.id === 'folio'));
});
