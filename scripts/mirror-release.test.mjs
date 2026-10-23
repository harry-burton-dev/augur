// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asMirrored, destinations, withRelease } from './mirror-release.mjs';

const manifest = (version, more = {}) => ({ version, channel: 'beta', parts: {}, ...more });

test('a mirrored release file takes its channel and notes from GitHub as they are now', () => {
  const promoted = asMirrored(manifest('0.3.0'), { prerelease: false, html_url: 'https://github.com/o/r/releases/tag/augur@0.3.0' });
  assert.equal(promoted.channel, 'stable');
  assert.equal(promoted.notesUrl, 'https://github.com/o/r/releases/tag/augur@0.3.0');
  assert.equal(asMirrored(manifest('0.4.0'), { prerelease: true }).channel, 'beta');
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
