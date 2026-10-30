import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { appFeed, AppUpdateChecker, newestOn, updateNeeds, type AppFeedRelease } from './app-updates.ts';
import type { AppRelease } from './store.ts';
import { UpdateChecker } from './updates.ts';

const digest = (c: string) => `sha256:${c.repeat(64)}`;
const release = (version: string, more: Partial<AppRelease['manifest']> = {}, channel = 'stable'): AppRelease => ({
  schema: 'augur.app-release/v1',
  id: 'notes',
  version,
  channel,
  manifest: { id: 'notes', name: 'Notes', route: '/notes', entry: '/apps/notes/entry.js', version, sdk: '^1.0.0', ...more },
  service: { image: `ghcr.io/o/r/apps/notes@${digest('a')}` },
  frontend: null,
  signer: { repository: 'o/r', workflow: '.github/workflows/release.yml' },
});
const feedOf = (...releases: AppRelease[]): AppFeedRelease[] => releases.map((r) => ({ app: r.id, version: r.version, channel: r.channel === 'stable' ? 'stable' : 'beta', release: r }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('the app feed', () => {
  it('reads app releases from GitHub, leaving AUGUR’s and drafts alone', async () => {
    const gh = (tag: string, prerelease = false, draft = false) => ({ tag_name: tag, prerelease, draft, html_url: `https://github.com/o/r/releases/tag/${tag}`, assets: [{ name: tag.startsWith('app/') ? 'app-release.json' : 'augur-release.json', url: `https://api/assets/${tag}` }] });
    const fetchImpl = (async (url: string) => {
      if (url === 'https://api/releases') return json([gh('augur@0.5.0'), gh('app/notes@1.1.0-beta.1', true), gh('app/notes@1.0.0'), gh('app/notes@2.0.0', false, true)]);
      if (url === 'https://api/assets/app/notes@1.0.0') return json(release('1.0.0'));
      if (url === 'https://api/assets/app/notes@1.1.0-beta.1') return json(release('1.0.0'));
      return json({}, 404);
    }) as typeof fetch;
    const found = await appFeed({ url: 'https://api/releases', fetchImpl })();
    expect(found.map((r) => `${r.app} ${r.version} ${r.channel} ${r.release ? 'file' : 'no file'}`)).toEqual([
      'notes 1.1.0-beta.1 beta no file', // its file names another version
      'notes 1.0.0 stable file',
    ]);
  });

  it('reads a mirror’s list of release files', async () => {
    const fetchImpl = (async () => json({ apps: [release('1.0.0'), { nonsense: true }] })) as unknown as typeof fetch;
    expect((await appFeed({ url: 'https://mirror/apps.json', fetchImpl })()).map((r) => r.version)).toEqual(['1.0.0']);
  });

  it('finds the newest release on a channel', () => {
    const releases = feedOf(release('1.0.0'), release('1.2.0-beta.1', {}, 'beta'), release('1.1.0'));
    expect(newestOn(releases, 'notes', 'stable')?.version).toBe('1.1.0');
    expect(newestOn(releases, 'notes', 'beta')?.version).toBe('1.2.0-beta.1');
    expect(newestOn(releases, 'tasks', 'beta')).toBeUndefined();
  });
});

describe('what an update needs', () => {
  it('needs nothing for a minor version that asks for nothing new', () => {
    expect(updateNeeds(release('1.0.0', { scopes: ['audit:write'] }), release('1.1.0', { scopes: ['audit:write'] }), '1.3.0')).toEqual([]);
  });

  it('waits for an admin when it asks for more, is a major, or won’t open', () => {
    const needs = updateNeeds(release('1.0.0'), release('2.0.0', { scopes: ['people:read'], storage: { bucket: true }, floors: ['org'], maxUpload: 50, sdk: '^2.0.0' }), '1.3.0');
    expect(needs).toEqual([
      '2.0.0 is a major version: it may change how Notes works.',
      'It asks for more: people:read.',
      'It asks for storage it didn’t have.',
      'It asks for uploads up to 50 MB.',
      'It needs SDK ^2.0.0, and this AUGUR has 1.3.0.',
    ]);
    expect(updateNeeds(release('1.0.0', { floors: ['org'] }), release('1.0.1'), '1.3.0')).toEqual(['It asks to work on more kinds of floor.']);
  });
});

describe('installs and updates in Admin → Apps', () => {
  const fresh = () => callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'], signedInAt: new Date().toISOString() });
  const verifyService = async (headers: Record<string, string | string[] | undefined>) =>
    headers.authorization === 'Bearer platform-updater' ? { kind: 'platform' as const, name: 'updater' } : undefined;
  const runner = { authorization: 'Bearer platform-updater' };

  const setup = async (releases: AppFeedRelease[], ring?: 'preview' | 'production') => {
    let feed = releases;
    // Each check a minute after the last, so none is answered from the one before.
    let minutes = 0;
    const checker = new AppUpdateChecker(async () => feed, () => new Date(Date.UTC(2026, 9, 27, 12, minutes++)));
    const entries: { action: string; detail?: Record<string, unknown> }[] = [];
    const updates = new UpdateChecker({ running: { version: '0.9.0', channel: 'beta' }, ring });
    const server = await buildApp({ verifyService, appUpdates: checker, updates, allowPrPreviews: ring !== 'production', audit: async (e) => void entries.push(e) });
    await checker.check();
    /** Plays the runner: takes the next job and says it went as `outcome`. */
    const runNext = async (outcome: 'done' | 'failed' = 'done') => {
      const job = (await server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: runner })).json();
      await server.inject({ method: 'POST', url: `/v1/app-runner/jobs/${job.id}/progress`, headers: runner, payload: { step: 'retire', state: 'done', outcome } });
      return job;
    };
    const view = async () => (await server.inject({ method: 'GET', url: '/v1/app-runner/apps', headers: fresh() })).json();
    const check = async (next: AppFeedRelease[]) => {
      feed = next;
      return (await server.inject({ method: 'POST', url: '/v1/app-runner/check', headers: fresh() })).json();
    };
    return { server, entries, runNext, view, check, checker };
  };

  it('offers what the feed has, and installs it by version', async () => {
    const t = await setup(feedOf(release('1.0.0', { description: 'Jot things down', scopes: ['audit:write'] })));
    expect((await t.view()).available).toEqual([
      expect.objectContaining({ app: 'notes', name: 'Notes', description: 'Jot things down', version: '1.0.0', asks: { scopes: ['audit:write'], storage: {}, maxUpload: 10 } }),
    ]);
    const missing = await t.server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fresh(), payload: { action: 'install', app: 'notes', version: '9.9.9' } });
    expect(missing.statusCode).toBe(404);
    const asked = await t.server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fresh(), payload: { action: 'install', app: 'notes', version: '1.0.0' } });
    expect(asked.statusCode).toBe(202);
    await t.runNext();
    const view = await t.view();
    expect(view.available).toEqual([]);
    expect(view.installed).toEqual([expect.objectContaining({ app: 'notes', version: '1.0.0', channel: 'stable', policy: 'automatic' })]);
  });

  it('installs a newer version by itself when it asks for nothing new, once', async () => {
    const t = await setup(feedOf(release('1.0.0')));
    await t.server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fresh(), payload: { action: 'install', app: 'notes', version: '1.0.0' } });
    await t.runNext();
    await t.check(feedOf(release('1.0.0'), release('1.1.0')));
    const job = await t.runNext('failed');
    expect(job).toMatchObject({ requestedBy: 'automatic', release: { version: '1.1.0' } });
    expect(t.entries.find((e) => e.detail?.automatic)).toMatchObject({ action: 'app.install-requested', detail: { version: '1.1.0', from: '1.0.0' } });
    // It failed, so it isn't tried again by itself.
    await t.check(feedOf(release('1.0.0'), release('1.1.0')));
    expect((await t.server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: runner })).statusCode).toBe(204);
    expect((await t.view()).installed[0].update).toEqual({ version: '1.1.0', channel: 'stable', needs: [], changes: [] });
    // Its history: the install, then the update that failed, newest first.
    expect((await t.view()).installed[0].history.map((h: { version: string; state: string; requestedBy: string }) => [h.version, h.state, h.requestedBy])).toEqual([
      ['1.1.0', 'failed', 'automatic'],
      ['1.0.0', 'done', 'u-1'],
    ]);
  });

  it('goes back to an older version and holds it there, so Automatic doesn’t take it straight up again', async () => {
    const t = await setup(feedOf(release('1.0.0'), release('1.1.0')));
    await t.server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fresh(), payload: { action: 'install', app: 'notes', version: '1.1.0' } });
    await t.runNext();
    expect((await t.view()).installed[0].older).toEqual([{ version: '1.0.0', channel: 'stable' }]);
    await t.server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fresh(), payload: { action: 'install', app: 'notes', version: '1.0.0' } });
    await t.runNext();
    expect((await t.view()).installed[0]).toMatchObject({ version: '1.0.0', policy: 'hold' });
    await t.check(feedOf(release('1.0.0'), release('1.1.0')));
    expect((await t.server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: runner })).statusCode).toBe(204);
    expect(t.entries.find((e) => e.action === 'app.updates-set')?.detail).toMatchObject({ policy: 'hold', why: 'going back to 1.0.0' });
  });

  it('shows what changed in the version it runs and in the one waiting', async () => {
    const notes = (text: string) => `### Minor Changes\n\n- abcdef1: ${text}\n\n### Patch Changes\n\n- Updated dependencies [abcdef1]\n  - @augur/mfe-sdk@1.6.0`;
    const t = await setup(feedOf({ ...release('1.0.0'), notes: notes('Lists notes by date.') }));
    await t.server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fresh(), payload: { action: 'install', app: 'notes', version: '1.0.0' } });
    await t.runNext();
    await t.check(feedOf({ ...release('1.0.0'), notes: notes('Lists notes by date.') }, { ...release('2.0.0'), notes: notes('Tags notes.') }));
    const installed = (await t.view()).installed[0];
    expect(installed.changes).toEqual([{ id: 'abcdef1', kind: 'minor', text: 'Lists notes by date.', parts: ['notes'] }]);
    expect(installed.update.changes).toEqual([{ id: 'abcdef1', kind: 'minor', text: 'Tags notes.', parts: ['notes'] }]);
  });

  it('waits for an admin when a version asks for more, or the app is on Ask first or Hold', async () => {
    const t = await setup(feedOf(release('1.0.0')));
    await t.server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fresh(), payload: { action: 'install', app: 'notes', version: '1.0.0' } });
    await t.runNext();
    await t.check(feedOf(release('1.0.0'), release('1.1.0', { scopes: ['people:read'] })));
    expect((await t.server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: runner })).statusCode).toBe(204);
    expect((await t.view()).installed[0].update.needs).toEqual(['It asks for more: people:read.']);

    const follow = (payload: object) => t.server.inject({ method: 'PUT', url: '/v1/app-runner/apps/notes/follow', headers: fresh(), payload });
    expect((await follow({ channel: 'beta', policy: 'hold' })).json().installed[0]).toMatchObject({ channel: 'beta', policy: 'hold' });
    await t.check(feedOf(release('1.0.0'), release('1.0.1-beta.1', {}, 'beta')));
    expect((await t.server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: runner })).statusCode).toBe(204);
    // Back to Automatic: the beta it now follows installs.
    await follow({ channel: 'beta', policy: 'automatic' });
    expect((await t.runNext()).release.version).toBe('1.0.1-beta.1');
    expect((await t.server.inject({ method: 'PUT', url: '/v1/app-runner/apps/tasks/follow', headers: fresh(), payload: { channel: 'stable', policy: 'ask' } })).statusCode).toBe(404);
  });

  it('on a production server, follows stable releases only and offers no beta', async () => {
    const t = await setup(feedOf(release('1.0.0'), release('1.1.0-beta.1', {}, 'beta')), 'production');
    expect(await t.view()).toMatchObject({ ring: 'production', previewsAllowed: false, channelNote: expect.stringContaining('SERVER_RING=production') });
    await t.server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fresh(), payload: { action: 'install', app: 'notes', version: '1.0.0' } });
    await t.runNext();
    const follow = await t.server.inject({ method: 'PUT', url: '/v1/app-runner/apps/notes/follow', headers: fresh(), payload: { channel: 'beta', policy: 'automatic' } });
    expect(follow.statusCode).toBe(409);
    expect(follow.json().error).toBe('production_server');
    await t.check(feedOf(release('1.0.0'), release('1.1.0-beta.1', {}, 'beta')));
    expect((await t.server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: runner })).statusCode).toBe(204);
    expect((await t.view()).installed[0]).toMatchObject({ channel: 'stable' });
  });

  it('on a production server, offers an app first released on beta only once it is promoted', async () => {
    const t = await setup(feedOf(release('1.0.0-beta.1', {}, 'beta')), 'production');
    expect((await t.view()).available).toEqual([]);
    const preview = await setup(feedOf(release('1.0.0-beta.1', {}, 'beta')), 'preview');
    expect((await preview.view()).available).toEqual([expect.objectContaining({ app: 'notes', version: '1.0.0-beta.1' })]);
  });
});
