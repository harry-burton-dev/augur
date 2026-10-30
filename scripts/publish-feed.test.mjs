// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APP_RELEASES_KEPT, asListed, buildFeed, chooseReleases, DEV_BUILDS_KEPT } from './publish-feed.mjs';

const release = (tag, more = {}) => ({ tag_name: tag, draft: false, prerelease: false, html_url: `https://github.com/o/r/releases/tag/${tag}`, assets: [{ name: tag.startsWith('augur@') ? 'augur-release.json' : 'app-release.json', url: `asset:${tag}` }], ...more });

test('the feed holds each app’s newest few releases and each pull request’s newest preview', () => {
  const notes = Array.from({ length: APP_RELEASES_KEPT + 2 }, (_, i) => release(`app/notes@1.${i}.0`));
  const previews = [release('app/notes@1.9.0-pr.12.1'), release('app/notes@1.9.0-pr.12.2'), release('app/notes@1.9.0-pr.13.1')];
  const { apps, augur } = chooseReleases([...notes, ...previews, release('augur@0.4.0'), release('augur@0.5.0', { draft: true })]);
  assert.deepEqual(augur.map((a) => a.version), ['0.4.0']);
  assert.deepEqual(apps.filter((a) => !a.pr).map((a) => a.version), ['1.5.0', '1.4.0', '1.3.0', '1.2.0']);
  assert.deepEqual(apps.filter((a) => a.pr).map((a) => a.version), ['1.9.0-pr.13.1', '1.9.0-pr.12.2']);
});

test('dev builds are kept apart, so they never push an app’s releases out', () => {
  const notes = Array.from({ length: APP_RELEASES_KEPT }, (_, i) => release(`app/notes@1.${i}.0`));
  const devs = [release('app/notes@1.3.1-dev.7'), release('app/notes@1.3.1-dev.8'), release('app/notes@1.3.1-dev.9')];
  const { apps } = chooseReleases([...notes, ...devs]);
  assert.deepEqual(apps.filter((a) => a.dev).map((a) => a.version), ['1.3.1-dev.9', '1.3.1-dev.8'].slice(0, DEV_BUILDS_KEPT));
  assert.equal(apps.filter((a) => !a.dev && !a.pr).length, APP_RELEASES_KEPT);
  assert.equal(asListed({ version: '1.3.1-dev.9' }, { prerelease: true }).channel, 'dev');
});

test('each release file takes its channel from GitHub as it is now, and one that doesn’t match its tag is left out', async () => {
  const files = {
    'asset:augur@0.4.0': { version: '0.4.0', channel: 'beta', parts: {} },
    'asset:augur@0.5.0': { version: '0.5.1', channel: 'beta', parts: {} },
    'asset:app/notes@1.2.0': { schema: 'augur.app-release/v1', id: 'notes', version: '1.2.0', channel: 'beta' },
  };
  const feed = await buildFeed([release('augur@0.4.0'), release('augur@0.5.0', { prerelease: true }), release('app/notes@1.2.0', { published_at: '2026-10-27T00:00:00Z' })], async (url) => files[url]);
  assert.deepEqual(feed.releases.map((m) => `${m.version} ${m.channel}`), ['0.4.0 stable']);
  assert.equal(feed.releases[0].notesUrl, 'https://github.com/o/r/releases/tag/augur@0.4.0');
  assert.deepEqual(feed.apps.map((a) => `${a.id} ${a.version} ${a.channel} ${a.releasedAt}`), ['notes 1.2.0 stable 2026-10-27T00:00:00Z']);
});
