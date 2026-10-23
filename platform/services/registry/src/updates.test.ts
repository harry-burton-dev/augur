import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { buildApp } from './app.ts';
import type { AppRecord } from './store.ts';
import { FeedProblem, releaseFeed, UpdateChecker, updatesView, type FeedRelease, type ReleaseManifest } from './updates.ts';

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
const release = (version: string, channel: 'beta' | 'stable' = 'beta', more: Partial<ReleaseManifest> = {}): FeedRelease => ({
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

describe('the release feed', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('reads AUGUR releases from GitHub, with the release files of the running and newer ones', async () => {
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
    const releases = await releaseFeed({ url: 'https://api.github.com/repos/o/r/releases?per_page=100', token: 't0ken', fetchImpl })('0.2.1');
    expect(releases.map((r) => [r.version, r.channel, Boolean(r.manifest)])).toEqual([
      ['0.3.0', 'beta', true],
      ['0.2.1', 'stable', true],
      ['0.1.0', 'stable', false],
    ]);
    // Not the draft, not a package's own release, and not the old release's file.
    expect(asked.map((a) => a.url)).not.toContain('https://api.github.com/assets/augur@0.1.0');
    expect(asked.every((a) => a.auth === 'Bearer t0ken')).toBe(true);
  });

  it('reads a mirror’s list of release files', async () => {
    const fetchImpl = (async () => json({ releases: [manifest('0.3.0', { channel: 'stable' }), manifest('0.2.0')] })) as unknown as typeof fetch;
    const releases = await releaseFeed({ url: 'https://mirror.example.org/augur/releases.json', fetchImpl })('0.2.0');
    expect(releases.map((r) => [r.version, r.channel])).toEqual([
      ['0.3.0', 'stable'],
      ['0.2.0', 'beta'],
    ]);
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
      release('0.4.0', 'beta', { settings: settings(['OBJECT_STORE_URL', 'ORG_LOGO'], ['OBJECT_STORE_URL']), parts: { '@augur/registry': { version: '0.4.0' }, '@augur/mfe-sdk': { version: '2.0.0' } }, breaking: ['@augur/mfe-sdk 1.1.0 → 2.0.0'], upgradeFrom: '>=0.2.0' }),
      release('0.3.0', 'beta', { settings: settings(['MODEL_API_URL']) }),
      release('0.2.0'),
    ];
    const view = updatesView({ checker: await checked(releases), apps: [app('library', '^1.0.0'), app('notes', '^2.0.0'), app('old', '^1.0.0', false)] });
    expect(view.available).toMatchObject({ version: '0.4.0', parts: [{ name: '@augur/registry', from: '0.2.0', to: '0.4.0' }, { name: '@augur/mfe-sdk', from: '1.1.0', to: '2.0.0' }] });
    expect(view.newer.map((r) => r.version)).toEqual(['0.4.0', '0.3.0']);
    expect(view.next).toBe('0.4.0');
    expect(view.needsYou.map((n) => [n.kind, n.message])).toEqual([
      ['breaking', '0.4.0: @augur/mfe-sdk 1.1.0 → 2.0.0'],
      ['setting', 'Set OBJECT_STORE_URL in .env: 0.4.0 won’t start without it.'],
      ['setting', 'ORG_LOGO is a new, optional setting.'],
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
