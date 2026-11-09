// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appCopies, appReleasesToMirror, asMirrored, augurHaltOf, destinations, mirroredAppRelease, withAppReleases, withHalt, withRelease } from './mirror-release.mjs';

const manifest = (version, more = {}) => ({ version, channel: 'beta', parts: {}, ...more });

test('a mirrored release file takes its channel and notes from GitHub as they are now', () => {
  const promoted = asMirrored(manifest('0.3.0'), { prerelease: false, html_url: 'https://github.com/o/r/releases/tag/augur@0.3.0' });
  assert.equal(promoted.channel, 'stable');
  assert.equal(promoted.notesUrl, 'https://github.com/o/r/releases/tag/augur@0.3.0');
  assert.equal(asMirrored(manifest('0.4.0'), { prerelease: true }).channel, 'beta');
  assert.equal(asMirrored(manifest('0.4.1-dev.12'), { prerelease: true }).channel, 'dev');
});

test('the feed keeps one copy of each release, newest first', () => {
  const feed = withRelease(withRelease(undefined, manifest('0.2.0')), manifest('0.10.0'));
  assert.deepEqual(feed.releases.map((m) => m.version), ['0.10.0', '0.2.0']);
  const again = withRelease(feed, manifest('0.2.0', { channel: 'stable' }));
  assert.deepEqual(again.releases.map((m) => `${m.version} ${m.channel}`), ['0.10.0 beta', '0.2.0 stable']);
});

test('each image goes where compose.yml looks with PLATFORM_IMAGES set to the mirror', () => {
  assert.deepEqual(destinations({ web: 'ghcr.io/o/r/web@sha256:aa' }, 'registry.example.org/augur/', '0.3.0'), [
    { part: 'web', from: 'ghcr.io/o/r/web@sha256:aa', to: 'registry.example.org/augur/web:0.3.0', digest: 'sha256:aa' },
  ]);
});

test('apps are mirrored a few releases each, never previews or drafts', () => {
  const gh = (tag, more = {}) => ({ tag_name: tag, draft: false, prerelease: false, ...more });
  const chosen = appReleasesToMirror([
    gh('augur@0.5.0'),
    gh('app/notes@1.0.0'),
    gh('app/notes@1.1.0'),
    gh('app/notes@1.2.0-beta.1', { prerelease: true }),
    gh('app/notes@1.3.0', { draft: true }),
    gh('app/notes@0.9.0'),
    gh('app/notes@1.2.0-pr.4.1', { prerelease: true }),
    gh('app/tasks@2.0.0'),
  ]);
  assert.deepEqual(chosen.map((c) => `${c.app} ${c.version}`), ['notes 1.2.0-beta.1', 'notes 1.1.0', 'notes 1.0.0', 'tasks 2.0.0']);
  assert.deepEqual(appReleasesToMirror([gh('app/notes@1.0.0'), gh('app/tasks@2.0.0')], ['tasks']).map((c) => c.app), ['tasks']);
});

test('a contract 3 release has each part’s image named in the mirror, by the same digest', () => {
  const d = (c) => `sha256:${c.repeat(64)}`;
  const part = (name, c) => ({ apiVersion: 'score.dev/v1b1', metadata: { name }, containers: { main: { image: `ghcr.io/o/r/apps/notes-${name}@${d(c)}` } } });
  const file = { schema: 'augur.app-release/v2', id: 'notes', version: '1.0.0', parts: [part('api', 'a'), part('worker', 'b')], frontend: { artifact: `ghcr.io/o/r/apps/notes-frontend@${d('c')}`, digest: d('e') } };
  const mirrored = mirroredAppRelease(file, 'registry.example.org/augur');
  assert.deepEqual(mirrored.parts.map((p) => p.containers.main.image), [`registry.example.org/augur/apps/notes-api@${d('a')}`, `registry.example.org/augur/apps/notes-worker@${d('b')}`]);
  assert.equal(mirrored.service, undefined);
  assert.equal(mirrored.parts[0].metadata.name, 'api');
  assert.deepEqual(appCopies(file, mirrored).map(([from]) => from), [file.parts[0].containers.main.image, file.parts[1].containers.main.image, file.frontend.artifact]);
});

test('a mirrored app release names its parts in the mirror, by the same digest', () => {
  const d = (c) => `sha256:${c.repeat(64)}`;
  const file = { id: 'notes', version: '1.0.0', service: { image: `ghcr.io/o/r/apps/notes@${d('a')}` }, frontend: { artifact: `ghcr.io/o/r/apps/notes-frontend@${d('b')}`, digest: d('c'), mediaType: 'x' } };
  const mirrored = mirroredAppRelease(file, 'registry.example.org/augur/');
  assert.equal(mirrored.service.image, `registry.example.org/augur/apps/notes@${d('a')}`);
  assert.equal(mirrored.frontend.artifact, `registry.example.org/augur/apps/notes-frontend@${d('b')}`);
  assert.equal(mirrored.frontend.digest, d('c'));
  assert.equal(mirroredAppRelease({ ...file, service: null }, 'r').service, null);
  const feed = withAppReleases({ apps: [{ id: 'notes', version: '1.0.0', old: true }, { id: 'notes', version: '0.9.0' }] }, [{ id: 'notes', version: '1.0.0' }, { id: 'auth', version: '1.0.0' }]);
  assert.deepEqual(feed.apps.map((f) => `${f.id} ${f.version}${f.old ? ' old' : ''}`), ['auth 1.0.0', 'notes 1.0.0', 'notes 0.9.0']);
});

test('a mirrored release keeps its publisher’s halt mark, and mirroring it again after a resume drops it', () => {
  const halted = { reason: 'Breaks sign-in.', at: '2026-11-01T20:00:00Z' };
  const feed = withRelease(undefined, withHalt(manifest('0.3.0'), halted));
  assert.deepEqual(feed.releases[0].halted, halted);
  assert.equal(withRelease(feed, withHalt(manifest('0.3.0'), undefined)).releases[0].halted, undefined);
});

test('a mirrored AUGUR beta whose deploy test hasn’t passed is halted, as the feed lists it', async () => {
  const beta = (assets) => ({ prerelease: true, assets: assets.map((name) => ({ name, url: `u:${name}` })) });
  const read = (files) => async (url) => {
    if (url in files) return files[url];
    throw new Error('502');
  };
  const failed = await augurHaltOf(beta(['deploy-test.json']), '0.5.0', read({ 'u:deploy-test.json': { version: '0.5.0', passed: false, run: '42' } }));
  assert.match(failed.reason, /deploy test failed \(run 42\)/);
  const pending = await augurHaltOf(beta(['deploy-test.json']), '0.5.0', read({ 'u:deploy-test.json': { version: '0.5.0', passed: null } }));
  assert.match(pending.reason, /hasn’t passed yet/);
  assert.equal(await augurHaltOf(beta(['deploy-test.json']), '0.5.0', read({ 'u:deploy-test.json': { version: '0.5.0', passed: true } })), undefined);
  // From before the check: no result at all, so nothing changes.
  assert.equal(await augurHaltOf(beta([]), '0.5.0', read({})), undefined);
  // A result that can't be read is no pass; the publisher's halt still wins.
  assert.match((await augurHaltOf(beta(['deploy-test.json']), '0.5.0', read({}))).reason, /hasn’t passed yet/);
  assert.equal((await augurHaltOf(beta(['halted.json', 'deploy-test.json']), '0.5.0', read({ 'u:halted.json': { reason: 'Breaks sign-in.' } }))).reason, 'Breaks sign-in.');
  assert.equal((await augurHaltOf(beta(['halted.json']), '0.5.0', read({}))).reason, 'Halted by the publisher.');
});
