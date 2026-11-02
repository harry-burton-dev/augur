import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { buildApp } from './app.ts';
import type { AppRecord } from './store.ts';
import { feedSigner, repoOfFeed } from './feed-trust.ts';
import { automaticDevUpgrade, FeedProblem, follows, goBackTargets, historyEntry, releaseFeed, UpdateChecker, updatesView, type FeedRead, type FeedRelease, type ReleaseManifest } from './updates.ts';

const listOf = (read: FeedRelease[] | FeedRead) => (Array.isArray(read) ? read : read.releases);
const trustOf = (read: FeedRelease[] | FeedRead) => (Array.isArray(read) ? undefined : read.trust);

const admin = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });

const settings = (added: string[] = [], required: string[] = []) => ({ all: ['PLATFORM_URL', ...added], required: ['PLATFORM_URL', ...required], added, removed: [] });
const manifest = (version: string, more: Partial<ReleaseManifest> = {}): ReleaseManifest => ({
  version,
  channel: 'beta',
  upgradeFrom: '>=0.1.0',
  changed: ['@augur/registry'],
  breaking: [],
  settings: settings(),
  parts: { '@augur/registry': { version }, '@augur/mfe-sdk': { version: '1.1.0' } },
  ...more,
});
const release = (version: string, channel: 'beta' | 'stable' | 'dev' = 'beta', more: Partial<ReleaseManifest> = {}): FeedRelease => ({
  version,
  channel,
  notesUrl: `https://github.com/o/r/releases/tag/augur@${version}`,
  manifest: manifest(version, more),
});
const checked = async (releases: FeedRelease[], channel: 'beta' | 'stable' = 'beta', running = '0.2.0') => {
  const checker = new UpdateChecker({ feed: async () => releases, running: { version: running, channel: 'beta' }, channel });
  await checker.check();
  return checker;
};
const app = (id: string, sdk: string, enabled = true): AppRecord => ({
  entry: { id, name: id[0].toUpperCase() + id.slice(1), route: `/${id}`, entry: `/apps/${id}/entry.js`, version: '1.0.0', sdk },
  enabled,
  registeredBy: id,
  registeredAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  grantedScopes: [],
});

describe('going back', () => {
  it('offers earlier releases on the channel, straight back only while nothing between is breaking', async () => {
    const images = { registry: 'ghcr.io/o/r/registry@sha256:aa' };
    const checker = await checked(
      [release('0.5.0', 'beta', { images }), release('0.4.0', 'beta', { images }), release('0.3.0', 'beta', { images, breaking: ['@augur/identity 0.3.0 → 1.0.0'] }), release('0.2.0', 'beta', { images }), release('0.4.5', 'beta', { images: {} })],
      'beta',
      '0.5.0',
    );
    expect(goBackTargets(checker).map((t) => [t.version, t.problem === undefined, t.breakingAfter])).toEqual([
      ['0.4.5', false, undefined],
      ['0.4.0', true, undefined],
      ['0.3.0', true, undefined],
      ['0.2.0', false, '0.3.0'],
    ]);
    expect(goBackTargets(checker).find((t) => t.version === '0.2.0')?.problem).toContain('restore the backup taken before upgrading to 0.3.0');
    expect(updatesView({ checker, apps: [] }).goBack).toHaveLength(4);
  });
});

describe('the history of upgrades', () => {
  it('names the backup each one took', () => {
    const at = '2026-10-29T00:00:00Z';
    expect(historyEntry({ id: 'u', from: '0.8.0', version: '0.9.0', images: {}, requestedBy: 'u-1', requestedAt: at, state: 'done', steps: [{ step: 'backup', state: 'done', message: 'platform-2026-10-29T0000.sql.gz, restored and checked', at }] })).toEqual({
      id: 'u', from: '0.8.0', version: '0.9.0', requestedBy: 'u-1', requestedAt: at, state: 'done', backup: 'platform-2026-10-29T0000.sql.gz',
    });
  });

  it('gives each newer release its changes, from the changelogs its release file carries', async () => {
    const view = updatesView({ checker: await checked([release('0.3.0', 'beta', { changelogs: { '@augur/registry': '### Minor Changes\n\n- abcdef1: Shows history.' } })]), apps: [] });
    expect(view.available?.changes).toEqual([{ id: 'abcdef1', kind: 'minor', text: 'Shows history.', parts: ['@augur/registry'] }]);
  });
});

describe('the server’s ring', () => {
  it('a preview server follows beta by itself, a production server only ever stable', async () => {
    const releases = [release('0.3.0', 'stable'), release('0.4.0')];
    const preview = new UpdateChecker({ feed: async () => releases, running: { version: '0.2.0', channel: 'beta' }, ring: 'preview' });
    await preview.check();
    expect(updatesView({ checker: preview, apps: [] })).toMatchObject({ ring: 'preview', channel: 'beta', available: { version: '0.4.0' } });

    const production = new UpdateChecker({ feed: async () => releases, running: { version: '0.2.0', channel: 'beta' }, ring: 'production', channel: 'beta' });
    await production.check();
    const view = updatesView({ checker: production, apps: [] });
    expect(view).toMatchObject({ ring: 'production', channel: 'stable', available: { version: '0.3.0' }, channelNote: expect.stringContaining('RELEASE_CHANNEL=beta is ignored') });
    // A production server can't follow beta, so it isn't told of one.
    expect(view.beta).toBeUndefined();
  });

  it('the workbench follows AUGUR’s dev builds by itself; no other server takes them', async () => {
    const releases = [release('0.3.0', 'stable'), release('0.4.0'), release('0.4.1-dev.48', 'dev')];
    const make = (ring: 'dev' | 'preview' | 'production', channel?: 'dev') => new UpdateChecker({ feed: async () => releases, running: { version: '0.2.0', channel: 'beta' }, ring, channel });
    const workbench = make('dev');
    await workbench.check();
    expect(updatesView({ checker: workbench, apps: [] })).toMatchObject({ ring: 'dev', channel: 'dev', available: { version: '0.4.1-dev.48' }, newer: [{ version: '0.4.1-dev.48' }, { version: '0.4.0' }, { version: '0.3.0' }] });

    const preview = make('preview', 'dev');
    await preview.check();
    expect(updatesView({ checker: preview, apps: [] })).toMatchObject({ channel: 'beta', available: { version: '0.4.0' }, channelNote: expect.stringContaining('Only the workbench') });
    const production = make('production', 'dev');
    await production.check();
    expect(updatesView({ checker: production, apps: [] })).toMatchObject({ channel: 'stable', available: { version: '0.3.0' }, channelNote: expect.stringContaining('RELEASE_CHANNEL=dev is ignored') });
  });

  it('dev takes every release, beta all but dev builds, stable only stable', () => {
    expect([follows('dev', 'dev'), follows('dev', 'beta'), follows('dev', 'stable')]).toEqual([true, true, true]);
    expect([follows('beta', 'dev'), follows('beta', 'beta'), follows('beta', 'stable')]).toEqual([false, true, true]);
    expect([follows('stable', 'dev'), follows('stable', 'beta'), follows('stable', 'stable')]).toEqual([false, false, true]);
  });

  it('the workbench upgrades to a dev build by itself only when nothing needs a person, and only once', async () => {
    const workbench = async (releases: FeedRelease[], ring: 'dev' | 'preview' = 'dev') => {
      const checker = new UpdateChecker({ feed: async () => releases, running: { version: '0.4.0', channel: 'beta' }, ring, ...(ring === 'preview' ? { channel: 'beta' as const } : {}) });
      await checker.check();
      return updatesView({ checker, apps: [] });
    };
    const dev = release('0.4.1-dev.48', 'dev');
    expect(automaticDevUpgrade(await workbench([dev]), [])).toBe('0.4.1-dev.48');
    expect(automaticDevUpgrade(await workbench([dev]), [{ version: '0.4.1-dev.48', state: 'rolled-back' }])).toBeUndefined();
    expect(automaticDevUpgrade(await workbench([dev], 'preview'), [])).toBeUndefined();
    // A release, rather than a dev build, waits for an admin even on the workbench.
    expect(automaticDevUpgrade(await workbench([release('0.5.0')]), [])).toBeUndefined();
    expect(automaticDevUpgrade(await workbench([release('0.4.1-dev.49', 'dev', { breaking: ['@augur/mfe-sdk: SDK 2.'] })]), [])).toBeUndefined();
    expect(automaticDevUpgrade(await workbench([release('0.4.1-dev.50', 'dev', { settings: settings(['MODELS_URL'], ['MODELS_URL']) })]), [])).toBeUndefined();
    // One the updater makes up itself doesn't need a person.
    expect(automaticDevUpgrade(await workbench([release('0.4.1-dev.51', 'dev', { settings: settings(['MODELS_CLIENT_SECRET'], ['MODELS_CLIENT_SECRET']) })]), [])).toBe('0.4.1-dev.51');
  });
});

describe('the release feed', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('reads AUGUR releases from GitHub, with the release files of the running, newer and a few older ones', async () => {
    const asked: { url: string; auth?: string }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      asked.push({ url, auth: (init.headers as Record<string, string>).authorization });
      if (url.startsWith('https://api.github.com/repos/o/r/releases?')) {
        const gh = (tag: string, prerelease: boolean, draft = false) => ({
          tag_name: tag,
          prerelease,
          draft,
          published_at: '2026-10-30T00:00:00Z',
          html_url: `https://github.com/o/r/releases/tag/${tag}`,
          assets: [{ name: 'augur-release.json', url: `https://api.github.com/assets/${tag}` }],
        });
        return json([gh('augur@0.3.0', true), gh('augur@0.2.1', false), gh('augur@0.4.0', true, true), gh('augur@0.1.0', false), gh('@augur/shell@0.4.0', false)]);
      }
      const version = url.split('augur@')[1];
      return json(manifest(version));
    }) as typeof fetch;
    const read = await releaseFeed({ url: 'https://api.github.com/repos/o/r/releases?per_page=100', token: 't0ken', fetchImpl })('0.2.1');
    const releases = listOf(read);
    expect(trustOf(read)?.state).toBe('unchecked');
    expect(releases.map((r) => [r.version, r.channel, Boolean(r.manifest)])).toEqual([
      ['0.3.0', 'beta', true],
      ['0.2.1', 'stable', true],
      ['0.1.0', 'stable', true],
    ]);
    // Not the draft and not a package's own release; an older release's file, to go back to.
    expect(asked.map((a) => a.url)).not.toContain('https://api.github.com/assets/augur@0.4.0');
    expect(asked.map((a) => a.url)).toContain('https://api.github.com/assets/augur@0.1.0');
    expect(asked.every((a) => a.auth === 'Bearer t0ken')).toBe(true);
  });

  it('reads a mirror’s list of release files', async () => {
    const fetchImpl = (async () => json({ releases: [manifest('0.3.0', { channel: 'stable' }), manifest('0.2.0')] })) as unknown as typeof fetch;
    const read = await releaseFeed({ url: 'https://mirror.example.org/augur/releases.json', fetchImpl })('0.2.0');
    const releases = listOf(read);
    expect(trustOf(read)?.state).toBe('mirror');
    expect(releases.map((r) => [r.version, r.channel])).toEqual([
      ['0.3.0', 'stable'],
      ['0.2.0', 'beta'],
    ]);
  });

  it('reads a mirror’s feed from a file on the server, with each release’s notes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'feed-'));
    writeFileSync(join(dir, 'releases.json'), JSON.stringify({ releases: [manifest('0.3.0', { notesUrl: 'https://github.com/o/r/releases/tag/augur@0.3.0' })] }));
    const releases = listOf(await releaseFeed({ url: pathToFileURL(join(dir, 'releases.json')).href })('0.2.0'));
    expect(releases).toMatchObject([{ version: '0.3.0', notesUrl: 'https://github.com/o/r/releases/tag/augur@0.3.0' }]);
    await expect(releaseFeed({ url: pathToFileURL(join(dir, 'missing.json')).href })('0.2.0')).rejects.toThrow(/can’t be read/);
  });

  it('says what to do when a private feed refuses it', async () => {
    const fetchImpl = (async () => json({ message: 'Not Found' }, 404)) as unknown as typeof fetch;
    const read = releaseFeed({ url: 'https://api.github.com/repos/o/r/releases', fetchImpl })('0.2.0');
    await expect(read).rejects.toThrow(FeedProblem);
    await expect(read).rejects.toThrow(/needs a read-only token/);
  });

  it('keeps the last releases it found when a check fails', async () => {
    let fail = false;
    let now = Date.parse('2026-10-30T00:00:00Z');
    const checker = new UpdateChecker({
      feed: async () => {
        if (fail) throw new FeedProblem('The release feed answered 502. Try again later.');
        return [release('0.3.0')];
      },
      running: { version: '0.2.0', channel: 'beta' },
      now: () => new Date(now),
    });
    await checker.check();
    fail = true;
    now += 60_000;
    const after = await checker.check();
    expect(after.problem).toMatch(/502/);
    expect(after.releases.map((r) => r.version)).toEqual(['0.3.0']);
  });
});

describe('the Updates page', () => {
  it('says the deployment is up to date when nothing newer is out', async () => {
    const view = updatesView({ checker: await checked([release('0.2.0'), release('0.1.0')]), apps: [] });
    expect(view).toMatchObject({ running: { version: '0.2.0' }, feed: 'on', newer: [], needsYou: [] });
    expect(view.available).toBeUndefined();
  });

  it('shows the newest release, what changes, and what to do first', async () => {
    const releases = [
      release('0.4.0', 'beta', { settings: settings(['OBJECT_STORE_URL', 'ORG_LOGO', 'SEARCH_CLIENT_SECRET'], ['OBJECT_STORE_URL', 'SEARCH_CLIENT_SECRET']), parts: { '@augur/registry': { version: '0.4.0' }, '@augur/mfe-sdk': { version: '2.0.0' } }, breaking: ['@augur/mfe-sdk 1.1.0 → 2.0.0'], upgradeFrom: '>=0.2.0' }),
      release('0.3.0', 'beta', { settings: settings(['MODEL_API_URL']) }),
      release('0.2.0'),
    ];
    const view = updatesView({ checker: await checked(releases), apps: [app('library', '^1.0.0'), app('notes', '^2.0.0'), app('old', '^1.0.0', false)] });
    expect(view.available).toMatchObject({ version: '0.4.0', parts: [{ name: '@augur/registry', from: '0.2.0', to: '0.4.0' }, { name: '@augur/mfe-sdk', from: '1.1.0', to: '2.0.0' }] });
    expect(view.newer.map((r) => r.version)).toEqual(['0.4.0', '0.3.0']);
    expect(view.next).toBe('0.4.0');
    expect(view.needsYou.map((n) => [n.kind, n.message])).toEqual([
      ['breaking', '0.4.0: @augur/mfe-sdk 1.1.0 → 2.0.0'],
      ['setting', 'Set OBJECT_STORE_URL: 0.4.0 won’t start without it. Enter it when you upgrade, or put it in .env.'],
      ['setting', 'ORG_LOGO is a new, optional setting.'],
      ['setting', 'SEARCH_CLIENT_SECRET is new. Upgrading from here makes one up; upgrading by hand, set it in .env (openssl rand -hex 32).'],
      ['app', 'Library needs SDK ^1.0.0, and 0.4.0 has 2.0.0: it won’t open until it’s rebuilt.'],
    ]);
  });

  it('names the release to go through when the newest can’t be reached straight', async () => {
    const releases = [release('0.5.0', 'beta', { upgradeFrom: '>=0.4.0' }), release('0.4.0', 'beta', { upgradeFrom: '>=0.1.0' }), release('0.3.0'), release('0.2.0')];
    const view = updatesView({ checker: await checked(releases), apps: [] });
    expect(view.next).toBe('0.4.0');
    expect(view.needsYou[0]).toEqual({ kind: 'path', version: '0.4.0', message: 'Upgrade to 0.4.0 first: 0.5.0 upgrades only from 0.4.0 or later.' });
  });

  it('on stable, leaves betas out but mentions a newer one', async () => {
    const releases = [release('0.4.0', 'beta'), release('0.3.0', 'stable'), release('0.2.0', 'stable')];
    const view = updatesView({ checker: await checked(releases, 'stable'), apps: [] });
    expect(view.available?.version).toBe('0.3.0');
    expect(view.newer.map((r) => r.version)).toEqual(['0.3.0']);
    expect(view.beta?.version).toBe('0.4.0');
  });

  it('is for admins, and a check now is audited', async () => {
    const entries: { action: string; detail?: unknown }[] = [];
    const server = await buildApp({ updates: await checked([release('0.3.0'), release('0.2.0')]), audit: async (e) => void entries.push(e) });
    expect((await server.inject({ method: 'GET', url: '/v1/platform/updates', headers: editor })).statusCode).toBe(403);
    expect((await server.inject({ method: 'POST', url: '/v1/platform/updates/check', headers: editor })).statusCode).toBe(403);
    expect((await server.inject({ method: 'GET', url: '/v1/platform/updates', headers: admin })).json()).toMatchObject({ available: { version: '0.3.0' } });
    expect((await server.inject({ method: 'POST', url: '/v1/platform/updates/check', headers: admin })).statusCode).toBe(200);
    expect(entries).toEqual([expect.objectContaining({ action: 'platform.updates-checked', target: '0.2.0', detail: { available: '0.3.0' } })]);
  });

  it('says the feed is off when the deployment turned it off', async () => {
    const server = await buildApp();
    expect((await server.inject({ method: 'GET', url: '/v1/platform/updates', headers: admin })).json()).toMatchObject({ feed: 'off', newer: [] });
  });
});

describe('upgrading', () => {
  const images = { registry: 'ghcr.io/o/r/registry@sha256:aa', web: 'ghcr.io/o/r/web@sha256:bb' };
  const fresh = (at = new Date()) => callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin', 'deployment-admin'], signedInAt: at.toISOString() });
  // An admin who runs the organisation but not the server (ADR 0022).
  const orgAdmin = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['admin'], signedInAt: new Date().toISOString() });
  const deployer = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin', 'deployment-admin'] });
  const verifyService = async (headers: Record<string, string | string[] | undefined>) => {
    const m = /^Bearer platform-(\S+)$/.exec(String(headers.authorization ?? ''));
    return m ? { kind: 'platform' as const, name: m[1] } : undefined;
  };
  const updater = { authorization: 'Bearer platform-updater' };
  const setup = async () => {
    const entries: { action: string; target?: string; actor: { id: string } }[] = [];
    const server = await buildApp({ verifyService, updates: await checked([release('0.3.0', 'beta', { images, deploy: { 'compose.yml': 'cc' } }), release('0.2.0')]), audit: async (e) => void entries.push(e) });
    return { server, entries };
  };

  it('goes back to an earlier release the same way, for an admin who has just entered their password', async () => {
    const entries: { action: string; target?: string; actor: { id: string } }[] = [];
    const server = await buildApp({
      verifyService,
      updates: await checked([release('0.4.0', 'beta', { images }), release('0.3.0', 'beta', { images }), release('0.2.0', 'beta', { images, breaking: ['x'] }), release('0.1.0', 'beta', { images })], 'beta', '0.4.0'),
      audit: async (e) => void entries.push(e),
    });
    const ask = (headers: Record<string, string>, version: string) => server.inject({ method: 'PUT', url: '/v1/platform/go-back', headers, payload: { version } });
    const page = (await server.inject({ method: 'GET', url: '/v1/platform/updates', headers: admin })).json();
    expect(page.goBack.map((t: { version: string; problem?: string }) => [t.version, !t.problem])).toEqual([['0.3.0', true], ['0.2.0', true], ['0.1.0', false]]);
    expect((await ask(deployer, '0.3.0')).json()).toMatchObject({ error: 'sign_in_again' });
    expect((await ask(fresh(), '0.1.0')).json().message).toContain('restore the backup taken before upgrading to 0.2.0');
    expect((await ask(fresh(), '0.9.0')).statusCode).toBe(409);
    expect((await ask(orgAdmin, '0.3.0')).statusCode).toBe(403);
    expect((await ask(fresh(), '0.3.0')).statusCode).toBe(202);
    const target = (await server.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: updater })).json();
    expect(target).toMatchObject({ from: '0.4.0', version: '0.3.0', images });
    // Going back isn't watched: a problem there would only send it forward again.
    expect(target.watch).toBeUndefined();
    await server.inject({ method: 'POST', url: '/v1/platform/upgrade/progress', headers: updater, payload: { id: target.id, step: 'verify', state: 'done', outcome: 'done' } });
    expect(entries.map((e) => `${e.action} ${e.target}`)).toEqual(['platform.go-back-requested 0.3.0', 'platform.went-back 0.3.0']);
  });

  it('needs an admin who has just entered their password, and only the next release', async () => {
    const { server } = await setup();
    const ask = (headers: Record<string, string>, version = '0.3.0') => server.inject({ method: 'PUT', url: '/v1/platform/upgrade', headers, payload: { version } });
    expect((await ask(editor)).statusCode).toBe(403);
    expect((await ask(orgAdmin)).json()).toMatchObject({ error: 'forbidden', requiredRole: 'deployment-admin' });
    expect((await ask(deployer)).json()).toMatchObject({ error: 'sign_in_again' });
    expect((await ask(fresh(new Date(Date.now() - 11 * 60_000)))).statusCode).toBe(401);
    expect((await ask(fresh(), '0.9.0')).json().message).toBe('Upgrade to 0.3.0 next, not 0.9.0.');
    const asked = await ask(fresh());
    expect(asked.statusCode).toBe(202);
    expect(asked.json().upgrade).toMatchObject({ from: '0.2.0', version: '0.3.0', state: 'requested', requestedBy: 'u-1' });
    expect((await ask(fresh())).json().message).toBe('An upgrade is already waiting or under way.');
  });

  it('gives the updater, and only the updater, the images to run, and records how it went', async () => {
    const { server, entries } = await setup();
    expect((await server.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: updater })).statusCode).toBe(204);
    await server.inject({ method: 'PUT', url: '/v1/platform/upgrade', headers: fresh(), payload: { version: '0.3.0' } });
    expect((await server.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: { authorization: 'Bearer platform-gateway' } })).statusCode).toBe(403);
    expect((await server.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: admin })).statusCode).toBe(403);
    const target = (await server.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: updater })).json();
    expect(target).toMatchObject({ version: '0.3.0', from: '0.2.0', images, state: 'requested', parts: { '@augur/registry': '0.3.0', '@augur/mfe-sdk': '1.1.0' }, deploy: { 'compose.yml': 'cc' } });
    expect(target.required).toEqual(expect.any(Array));
    // Moving forward is watched for 10 minutes first (ADR 0020).
    expect(target.watch).toEqual({});

    const report = (payload: Record<string, unknown>) => server.inject({ method: 'POST', url: '/v1/platform/upgrade/progress', headers: updater, payload: { id: target.id, ...payload } });
    expect((await report({ step: 'preflight', state: 'done' })).json()).toMatchObject({ state: 'running' });
    expect((await server.inject({ method: 'DELETE', url: '/v1/platform/upgrade', headers: deployer })).statusCode).toBe(409);
    await report({ step: 'roll-forward', state: 'failed', message: 'identity didn’t get ready in 120 s' });
    const ended = (await report({ step: 'roll-back', state: 'done', outcome: 'rolled-back', message: 'Back on 0.2.0: identity didn’t get ready in 120 s' })).json();
    expect(ended).toMatchObject({ state: 'rolled-back', message: 'Back on 0.2.0: identity didn’t get ready in 120 s' });
    expect(ended.steps.map((s: { step: string; state: string }) => `${s.step} ${s.state}`)).toEqual(['preflight done', 'roll-forward failed', 'roll-back done']);
    expect((await report({ step: 'verify', state: 'done' })).statusCode).toBe(404);

    const page = (await server.inject({ method: 'GET', url: '/v1/platform/updates', headers: admin })).json();
    expect(page.upgrade.state).toBe('rolled-back');
    expect(page.updaterSeenAt).toBeDefined();
    // The history keeps it, with who asked by name, without the images.
    expect(page.history).toEqual([expect.objectContaining({ from: '0.2.0', version: '0.3.0', requestedBy: 'u-1', requestedByName: 'Alex', state: 'rolled-back' })]);
    expect(page.history[0].images).toBeUndefined();
    expect(entries.map((e) => `${e.action} ${e.target} by ${e.actor.id}`)).toEqual(['platform.upgrade-requested 0.3.0 by u-1', 'platform.upgrade-rolled-back 0.3.0 by updater']);
  });

  it('passes settings entered with the ask to the updater alone, until the upgrade ends', async () => {
    const entries: { action: string; detail?: unknown }[] = [];
    const server = await buildApp({ verifyService, updates: await checked([release('0.3.0', 'beta', { images, settings: settings(['OBJECT_STORE_URL'], ['OBJECT_STORE_URL']) }), release('0.2.0')]), audit: async (e) => void entries.push(e) });
    const ask = (s: Record<string, string>) => server.inject({ method: 'PUT', url: '/v1/platform/upgrade', headers: fresh(), payload: { version: '0.3.0', settings: s } });
    expect((await ask({ NOT_A_SETTING: 'x' })).json().message).toBe('AUGUR 0.3.0 has no setting NOT_A_SETTING.');
    expect((await ask({ OBJECT_STORE_URL: 'a\nB=c' })).statusCode).toBe(400);
    expect((await ask({ OBJECT_STORE_URL: 'https://s3.example.org' })).statusCode).toBe(202);
    expect(JSON.stringify(entries)).not.toContain('s3.example.org');
    expect(entries.at(-1)?.detail).toEqual({ from: '0.2.0', settings: ['OBJECT_STORE_URL'] });
    expect((await server.inject({ method: 'GET', url: '/v1/platform/updates', headers: admin })).body).not.toContain('s3.example.org');
    const target = (await server.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: updater })).json();
    expect(target.settings).toEqual({ OBJECT_STORE_URL: 'https://s3.example.org' });
    await server.inject({ method: 'POST', url: '/v1/platform/upgrade/progress', headers: updater, payload: { id: target.id, step: 'preflight', state: 'failed', outcome: 'rolled-back' } });
    await ask({});
    expect((await server.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: updater })).json().settings).toBeUndefined();
  });

  it('on the workbench, asks the updater for a new dev build by itself, and audits it', async () => {
    const entries: { action: string; target?: string; actor: { id: string } }[] = [];
    const updates = new UpdateChecker({ feed: async () => [release('0.2.1-dev.48', 'dev', { images }), release('0.2.0')], running: { version: '0.2.0', channel: 'beta' }, ring: 'dev' });
    await updates.check();
    const server = await buildApp({ verifyService, updates, audit: async (e) => void entries.push(e) });
    const target = (await server.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: updater })).json();
    expect(target).toMatchObject({ version: '0.2.1-dev.48', from: '0.2.0', images, state: 'requested' });
    expect(entries.map((e) => `${e.action} ${e.target} by ${e.actor.id}`)).toEqual(['platform.upgrade-requested 0.2.1-dev.48 by registry']);
    const page = (await server.inject({ method: 'GET', url: '/v1/platform/updates', headers: admin })).json();
    expect(page.history[0]).toMatchObject({ requestedBy: 'automatic', version: '0.2.1-dev.48' });
    // Taken back by an admin, it isn't asked for again.
    expect((await server.inject({ method: 'DELETE', url: '/v1/platform/upgrade', headers: deployer })).statusCode).toBe(200);
    expect((await server.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: updater })).statusCode).toBe(204);
  });

  it('lets an admin take back an upgrade nothing has started', async () => {
    const { server, entries } = await setup();
    expect((await server.inject({ method: 'DELETE', url: '/v1/platform/upgrade', headers: deployer })).statusCode).toBe(404);
    await server.inject({ method: 'PUT', url: '/v1/platform/upgrade', headers: fresh(), payload: { version: '0.3.0' } });
    expect((await server.inject({ method: 'DELETE', url: '/v1/platform/upgrade', headers: deployer })).json().upgrade.state).toBe('cancelled');
    expect((await server.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: updater })).statusCode).toBe(204);
    expect(entries.map((e) => e.action)).toEqual(['platform.upgrade-requested', 'platform.upgrade-cancelled']);
  });

  it('won’t upgrade to a release whose file names no images', async () => {
    const server = await buildApp({ updates: await checked([release('0.3.0'), release('0.2.0')]) });
    const res = await server.inject({ method: 'PUT', url: '/v1/platform/upgrade', headers: fresh(), payload: { version: '0.3.0' } });
    expect(res.json().message).toBe('AUGUR 0.3.0’s release file names no images, so it can’t be applied.');
  });
});

describe('the signed feed (ADR 0017)', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const NOW = new Date('2026-11-01T12:00:00Z');
  const BUNDLE = 'application/vnd.dev.sigstore.bundle.v0.3+json';
  const feedText = (expires = '2026-11-15T00:00:00Z', more: Record<string, unknown> = {}) =>
    JSON.stringify({ schema: 'augur.feed/v1', issued: '2026-11-01T00:00:00Z', expires, releases: [manifest('0.3.0'), { ...manifest('0.2.5'), halted: { reason: 'Sign-in fails after it', at: '2026-11-01T10:00:00Z' } }], apps: [], ...more });
  // A container registry holding the feed and, when signed, its bundle.
  const registry = (text: string, bundle?: string) =>
    (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/token?')) return json({ token: 'pull' });
      if (url.includes('/manifests/')) return json({ layers: [{ digest: 'sha256:feed', mediaType: 'application/vnd.augur.feed.v1+json' }, ...(bundle ? [{ digest: 'sha256:sig', mediaType: BUNDLE }] : [])] });
      if (url.endsWith('/blobs/sha256:feed')) return new Response(text);
      if (url.endsWith('/blobs/sha256:sig')) return new Response(bundle);
      return json({}, 404);
    }) as typeof fetch;
  const url = 'oci://ghcr.io/o/r/feed:latest';
  const signedBy = (ok: boolean) => async (feed: string, bundle: string) => {
    expect(bundle).toBe('the-bundle');
    expect(JSON.parse(feed).schema).toBe('augur.feed/v1');
    if (!ok) throw new Error('none of the expected identities matched what was in the certificate.');
  };

  it('takes a signed feed in date, and lists a halted release as halted', async () => {
    const read = await releaseFeed({ url, fetchImpl: registry(feedText(), 'the-bundle'), check: signedBy(true), signer: 'feed.yml', now: () => NOW })('0.2.0');
    expect(trustOf(read)).toEqual({ state: 'verified', expires: '2026-11-15T00:00:00Z', signer: 'feed.yml' });
    expect(listOf(read).find((r) => r.version === '0.2.5')?.halted).toEqual({ reason: 'Sign-in fails after it', at: '2026-11-01T10:00:00Z' });
  });

  it('refuses a feed that isn’t signed, is signed by someone else, or has expired', async () => {
    const read = (text: string, bundle: string | undefined, ok = true) => releaseFeed({ url, fetchImpl: registry(text, bundle), check: signedBy(ok), now: () => NOW })('0.2.0');
    await expect(read(feedText(), undefined)).rejects.toThrow(/isn’t signed/);
    await expect(read(feedText(), 'the-bundle', false)).rejects.toThrow(/signature didn’t check out, so nothing new is offered: none of the expected identities/);
    await expect(read(feedText('2026-10-31T00:00:00Z'), 'the-bundle')).rejects.toThrow(/expired on 2026-10-31/);
    await expect(read(feedText('soon'), 'the-bundle')).rejects.toThrow(/doesn’t say when it expires/);
  });

  it('expects the Release feed workflow of the feed’s own repository', () => {
    expect(repoOfFeed('oci://ghcr.io/harry-burton-dev/im-platform/feed:latest')).toBe('harry-burton-dev/im-platform');
    const signer = new RegExp(feedSigner('o/r'));
    expect(signer.test('https://github.com/o/r/.github/workflows/feed.yml@refs/heads/main')).toBe(true);
    expect(signer.test('https://github.com/o/r/.github/workflows/feed.yml@refs/heads/release/augur-0.14')).toBe(true);
    expect(signer.test('https://github.com/o/r/.github/workflows/feed.yml@refs/pull/12/merge')).toBe(false);
    expect(signer.test('https://github.com/o/r/.github/workflows/release.yml@refs/heads/main')).toBe(false);
  });

  it('never offers a halted release, and tells a server running one where to go', async () => {
    const halted = { ...release('0.4.0'), halted: { reason: 'Data loss on upgrade' } };
    const offered = updatesView({ checker: await checked([release('0.2.0'), release('0.3.0'), halted]), apps: [] });
    expect(offered.available?.version).toBe('0.3.0');
    expect(offered.newer.map((r) => [r.version, r.halted?.reason])).toEqual([
      ['0.4.0', 'Data loss on upgrade'],
      ['0.3.0', undefined],
    ]);

    const running = { ...release('0.3.0'), halted: { reason: 'Sign-in fails' } };
    const stuck = updatesView({ checker: await checked([release('0.2.0', 'beta', { images: { registry: 'ghcr.io/o/r/registry@sha256:1' } }), running], 'beta', '0.3.0'), apps: [] });
    expect(stuck.needsYou).toEqual([{ kind: 'halted', version: '0.3.0', message: 'AUGUR 0.3.0, which this server runs, was halted by its publisher: Sign-in fails. Go back to 0.2.0, or wait for a fixed release.' }]);
    const moving = updatesView({ checker: await checked([running, release('0.3.1')], 'beta', '0.3.0'), apps: [] });
    expect(moving.needsYou[0]).toMatchObject({ kind: 'halted', message: expect.stringMatching(/Upgrade to 0\.3\.1\.$/) });
  });

  it('never goes back to a halted release', async () => {
    const targets = goBackTargets(await checked([{ ...release('0.1.0'), halted: { reason: 'Broken' } }, release('0.2.0')]));
    expect(targets[0]).toMatchObject({ version: '0.1.0', problem: 'AUGUR 0.1.0 was halted by its publisher: Broken' });
  });
});
