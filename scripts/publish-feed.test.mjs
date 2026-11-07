// node --test scripts/*.test.mjs (pnpm test:scripts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APP_RELEASES_KEPT, appRepos, asListed, AUGUR_RELEASES_KEPT, BUNDLE_MEDIA_TYPE, buildFeed, chooseReleases, deployTestHaltOf, DEV_BUILDS_KEPT, FEED_MEDIA_TYPE, FEED_VALID_DAYS, haltedOf, ownReleases, pushCommand } from './publish-feed.mjs';

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

test('AUGUR’s dev builds are kept apart too, so they never push its releases out', () => {
  const releases = Array.from({ length: AUGUR_RELEASES_KEPT }, (_, i) => release(`augur@0.${i}.0`, { prerelease: true }));
  const devs = [release('augur@0.19.1-dev.40', { prerelease: true }), release('augur@0.19.1-dev.41', { prerelease: true }), release('augur@0.19.1-dev.42', { prerelease: true })];
  const { augur } = chooseReleases([...releases, ...devs]);
  assert.deepEqual(augur.filter((a) => /-dev\./.test(a.version)).map((a) => a.version), ['0.19.1-dev.42', '0.19.1-dev.41'].slice(0, DEV_BUILDS_KEPT));
  assert.equal(augur.filter((a) => !/-dev\./.test(a.version)).length, AUGUR_RELEASES_KEPT);
  assert.equal(augur[0].version, '0.19.1-dev.42');
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

test('the feed says when it expires, and lists a halted release with why', async () => {
  const files = {
    'asset:augur@0.4.0': { version: '0.4.0', channel: 'beta', parts: {} },
    'halt:augur@0.4.0': { reason: 'Sign-in fails after the upgrade', at: '2026-11-01T20:00:00Z', by: 'harry' },
    'asset:app/notes@1.2.0': { schema: 'augur.app-release/v1', id: 'notes', version: '1.2.0', channel: 'stable' },
  };
  const halted = release('augur@0.4.0');
  halted.assets.push({ name: 'halted.json', url: 'halt:augur@0.4.0' });
  const now = new Date('2026-11-01T00:00:00Z');
  const feed = await buildFeed([halted, release('app/notes@1.2.0')], async (url) => files[url], now);
  assert.equal(feed.issued, now.toISOString());
  assert.equal(Date.parse(feed.expires) - now.getTime(), FEED_VALID_DAYS * 86_400_000);
  assert.deepEqual(feed.releases[0].halted, { reason: 'Sign-in fails after the upgrade', at: '2026-11-01T20:00:00Z', by: 'harry' });
  assert.equal(feed.apps[0].halted, undefined);
  assert.equal(haltedOf({ reason: '  ' }), undefined);
});

test('a release file that is there but can’t be read fails the feed, rather than listing it wrongly', async () => {
  const files = {
    'asset:augur@0.4.0': { version: '0.4.0', channel: 'beta', parts: {} },
    'asset:app/notes@1.2.0': { schema: 'augur.app-release/v1', id: 'notes', version: '1.2.0', channel: 'stable' },
  };
  const download = async (url) => {
    if (url in files) return files[url];
    throw new Error(`GitHub answered 502 for ${url}.`);
  };
  // A halt that can't be read would otherwise publish a halted release as not halted, in a signed feed.
  const halted = release('augur@0.4.0');
  halted.assets.push({ name: 'halted.json', url: 'halt:augur@0.4.0' });
  await assert.rejects(buildFeed([halted], download), /halted\.json.*augur@0\.4\.0.*502/);
  // A release file that can't be read would otherwise drop the release without a word.
  await assert.rejects(buildFeed([release('app/notes@1.3.0')], download), /app-release\.json.*app\/notes@1\.3\.0/);
  // A release without the asset at all is still just left out.
  const feed = await buildFeed([release('augur@0.4.0'), release('app/notes@1.2.0', { assets: [] })], download);
  assert.deepEqual(feed.releases.map((m) => m.version), ['0.4.0']);
  assert.deepEqual(feed.apps, []);
});

test('an AUGUR release whose deploy test failed is listed halted, so no deployment is offered it', async () => {
  const files = {
    'asset:augur@0.4.0': { version: '0.4.0', channel: 'beta', parts: {} },
    'asset:augur@0.5.0': { version: '0.5.0', channel: 'beta', parts: {} },
    'asset:augur@0.6.0': { version: '0.6.0', channel: 'beta', parts: {} },
    'test:augur@0.4.0': { schema: 'augur.deploy-test/v1', version: '0.4.0', passed: true, run: '1', at: '2026-11-01T00:00:00Z' },
    'test:augur@0.5.0': { schema: 'augur.deploy-test/v1', version: '0.5.0', passed: false, run: '42', at: '2026-11-02T00:00:00Z' },
    'halt:augur@0.5.0': { reason: 'Sign-in fails after the upgrade', at: '2026-11-03T00:00:00Z', by: 'harry' },
  };
  const withTest = (tag) => {
    const r = release(tag, { prerelease: true });
    r.assets.push({ name: 'deploy-test.json', url: `test:${tag}` });
    return r;
  };
  const passed = withTest('augur@0.4.0');
  const failed = withTest('augur@0.5.0');
  // A release from before the check has no result, and is listed as it was.
  const feed = await buildFeed([passed, failed, release('augur@0.6.0', { prerelease: true })], async (url) => files[url]);
  const of = (v) => feed.releases.find((m) => m.version === v);
  assert.equal(of('0.4.0').halted, undefined);
  assert.equal(of('0.6.0').halted, undefined);
  assert.match(of('0.5.0').halted.reason, /deploy test failed/);
  assert.match(of('0.5.0').halted.reason, /42/);
  assert.equal(of('0.5.0').halted.at, '2026-11-02T00:00:00Z');
  // The owner's own halt says more, so it wins.
  failed.assets.push({ name: 'halted.json', url: 'halt:augur@0.5.0' });
  const both = await buildFeed([failed], async (url) => files[url]);
  assert.equal(both.releases[0].halted.reason, 'Sign-in fails after the upgrade');
  // A result for another version isn't a pass of this one.
  const stale = await buildFeed([withTest('augur@0.6.0')], async (url) => (url === 'test:augur@0.6.0' ? files['test:augur@0.4.0'] : files[url]));
  assert.match(stale.releases[0].halted.reason, /hasn’t passed yet/);
  // A stable release passed its deploy test to be promoted: a later failed run doesn't halt it by itself.
  const stable = await buildFeed([{ ...withTest('augur@0.5.0'), prerelease: false }], async (url) => files[url]);
  assert.equal(stable.releases[0].halted, undefined);
});

test('an AUGUR beta whose deploy test is still running is listed halted until it passes', async () => {
  const pending = release('augur@0.7.0', { prerelease: true });
  pending.assets.push({ name: 'deploy-test.json', url: 'test:augur@0.7.0' });
  const files = {
    'asset:augur@0.7.0': { version: '0.7.0', channel: 'beta', parts: {} },
    'test:augur@0.7.0': { schema: 'augur.deploy-test/v1', version: '0.7.0', passed: null, run: '9', at: '2026-11-06T10:00:00Z' },
  };
  const feed = await buildFeed([pending], async (url) => files[url]);
  assert.match(feed.releases[0].halted.reason, /deploy test hasn’t passed yet/);
  assert.equal(feed.releases[0].halted.at, '2026-11-06T10:00:00Z');
  // The test's own result replaces the pending one; a pass lists it as usual.
  files['test:augur@0.7.0'] = { ...files['test:augur@0.7.0'], passed: true };
  assert.equal((await buildFeed([pending], async (url) => files[url])).releases[0].halted, undefined);
  assert.equal(deployTestHaltOf(undefined, '0.7.0', { prerelease: true }), undefined);
  assert.equal(deployTestHaltOf({ version: '0.7.0', passed: null }, '0.7.0', { prerelease: false }), undefined);
});

test('an app in its own repository is listed only from there, and only as signed there', async () => {
  const signed = (repository) => ({ schema: 'augur.app-release/v1', id: 'notes', version: '1.3.0', channel: 'stable', signer: { repository, workflow: '.github/workflows/release.yml' } });
  const files = { 'asset:app/notes@1.3.0': signed('o/notes'), 'asset:app/other@1.0.0': { id: 'other', version: '1.0.0', signer: { repository: 'o/notes' } } };
  // Its repository's other apps' releases are left out before the feed is built.
  const theirs = ownReleases([release('app/notes@1.3.0'), release('app/other@1.0.0')], 'notes', 'o/notes');
  assert.deepEqual(theirs.map((r) => `${r.tag_name} ${r.repository}`), ['app/notes@1.3.0 o/notes']);
  const own = { notes: 'o/notes' };
  const feed = await buildFeed(theirs, async (url) => files[url], new Date(), own);
  assert.deepEqual(feed.apps.map((a) => `${a.id} ${a.version}`), ['notes 1.3.0']);
  // A release file that names another signer isn't listed, nor one that didn't come from its repository.
  const forged = await buildFeed(theirs, async () => signed('o/r'), new Date(), own);
  assert.deepEqual(forged.apps, []);
  const here = await buildFeed([release('app/notes@1.3.0')], async (url) => files[url], new Date(), own);
  assert.deepEqual(here.apps, []);
});

test('the app repositories file maps app ids to owner/repo and nothing else', () => {
  assert.deepEqual(appRepos({ apps: { notes: 'o/notes', Bad: 'o/x', odd: 'nope' } }), { notes: 'o/notes' });
  assert.deepEqual(appRepos(undefined), {});
});

test('a feed already signed and checked is pushed as it is, with its signature, and never without one', () => {
  const push = pushCommand({ out: '/tmp/run/feed.json', images: 'ghcr.io/o/r', repo: 'o/r', signed: true });
  assert.equal(push.ref, 'ghcr.io/o/r/feed:latest');
  assert.equal(push.cwd, '/tmp/run');
  assert.deepEqual(push.args.slice(-2), [`feed.json:${FEED_MEDIA_TYPE}`, `feed.json.sigstore.json:${BUNDLE_MEDIA_TYPE}`]);
  assert.ok(push.args.includes('org.opencontainers.image.source=https://github.com/o/r'));
  assert.throws(() => pushCommand({ out: '/tmp/run/feed.json', images: 'ghcr.io/o/r', repo: 'o/r', signed: false, requireSigned: true }), /sign/);
});
