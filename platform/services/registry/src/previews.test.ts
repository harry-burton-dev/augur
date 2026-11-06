import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { tailnetOf } from './live.ts';
import { appFeed, AppUpdateChecker, newestOn, previewsIn, type AppFeedRelease } from './app-updates.ts';
import { type AppRelease } from './store.ts';
import { UpdateChecker } from './updates.ts';
import { DATABASE_URL, registryDb } from './db.testing.ts';

const db = registryDb();

const digest = (c: string) => `sha256:${c.repeat(64)}`;
const release = (version: string, more: Partial<AppRelease> = {}): AppRelease => ({
  schema: 'augur.app-release/v1',
  id: 'notes',
  version,
  channel: version.includes('-pr.') ? 'preview' : 'stable',
  manifest: { id: 'notes', name: 'Notes', route: '/notes', entry: '/apps/notes/entry.js', version, sdk: '^1.0.0' },
  service: { image: `ghcr.io/o/r/apps/notes@${digest('a')}` },
  frontend: null,
  signer: { repository: 'o/r', workflow: '.github/workflows/release.yml' },
  ...more,
});
const feedOf = (...releases: AppRelease[]): AppFeedRelease[] =>
  releases.map((r) => {
    const pr = /-pr\.(\d+)\./.exec(r.version)?.[1];
    return { app: r.id, version: r.version, channel: pr ? 'preview' : 'stable', ...(pr ? { pr: Number(pr) } : {}), release: r };
  });
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const admin = () => callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin', 'deployment-admin'], signedInAt: new Date().toISOString() });
const person = (id: string) => callerHeaders({ id, name: id, departments: [], roles: [] });
const verifyService = async (headers: Record<string, string | string[] | undefined>) =>
  headers.authorization === 'Bearer platform-updater' ? { kind: 'platform' as const, name: 'updater' } : undefined;
const runner = { authorization: 'Bearer platform-updater' };

const setup = async (ring?: 'dev' | 'preview', tailnet: string | null = 'tail1234') => {
  let feed = feedOf(release('1.0.0'));
  let minutes = 0;
  const now = () => new Date(Date.UTC(2026, 9, 27, 12, minutes++));
  const checker = new AppUpdateChecker(async () => feed, now);
  const store = db.store;
  const entries: { action: string; detail?: Record<string, unknown> }[] = [];
  const server = await db.app({ store, verifyService, appUpdates: checker, audit: async (e) => void entries.push(e), tailnet: tailnet ?? undefined, ...(ring ? { updates: new UpdateChecker({ running: { version: '0.12.0', channel: 'beta' }, ring }) } : {}) });
  await checker.check();
  const next = () => server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: runner });
  /** Plays the runner: takes the next job and says it went as `outcome`, a preview answering at `upstream`. */
  const runNext = async (outcome: 'done' | 'failed' = 'done', upstream?: string) => {
    const job = (await next()).json();
    await server.inject({ method: 'POST', url: `/v1/app-runner/jobs/${job.id}/progress`, headers: runner, payload: { step: 'switch', state: 'done', outcome, ...(upstream ? { upstream } : {}) } });
    return job;
  };
  const check = async (...releases: AppRelease[]) => {
    feed = feedOf(...releases);
    return (await server.inject({ method: 'POST', url: '/v1/app-runner/check', headers: admin() })).json();
  };
  const developers = (people: string[]) => server.inject({ method: 'PUT', url: '/v1/app-runner/apps/notes/developers', headers: admin(), payload: { people } });
  // Notes 1.0.0 installed by the runner, registered and reachable.
  await server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: admin(), payload: { action: 'install', app: 'notes', version: '1.0.0' } });
  await runNext();
  await store.put(release('1.0.0').manifest, 'notes');
  await store.setUpstream('notes', 'http://app-notes-blue:8080');
  return { server, store, entries, next, runNext, check, developers };
};

describe.runIf(DATABASE_URL)('pull requests’ previews', () => {
  it('reads pull requests’ builds from the feed as previews, which no channel follows', async () => {
    const gh = (tag: string) => ({ tag_name: tag, prerelease: true, draft: false, assets: [{ name: 'app-release.json', url: `https://api/assets/${tag}` }] });
    const fetchImpl = (async (url: string) => {
      if (url === 'https://api/releases') return json([gh('app/notes@1.1.0-pr.12.2'), gh('app/notes@1.1.0-pr.12.1'), gh('app/notes@1.1.0-pr.9.1'), gh('app/notes@1.1.0-beta.1')]);
      const version = url.split('@')[1];
      return json(release(version));
    }) as typeof fetch;
    const read = await appFeed({ url: 'https://api/releases', fetchImpl })();
    const found = Array.isArray(read) ? read : read.releases;
    expect(found.map((r) => `${r.version} ${r.channel} ${r.pr ?? '-'} ${r.release ? 'file' : 'no file'}`)).toEqual([
      '1.1.0-pr.12.2 preview 12 file',
      '1.1.0-pr.12.1 preview 12 no file', // only each pull request's newest build is read
      '1.1.0-pr.9.1 preview 9 file',
      '1.1.0-beta.1 beta - file',
    ]);
    expect(newestOn(found, 'notes', 'beta')?.version).toBe('1.1.0-beta.1');
    expect(previewsIn(found, 'notes').map((r) => r.version)).toEqual(['1.1.0-pr.12.2', '1.1.0-pr.9.1']);
  });

  it('runs a pull request’s build for the app’s developers, who choose it for themselves', async () => {
    const t = await setup();
    const build = release('1.1.0-pr.12.1', { preview: { pr: 12, title: 'Tags on notes', url: 'https://github.com/o/r/pull/12' } });
    // No developers yet, so nothing runs.
    await t.check(release('1.0.0'), build);
    expect((await t.next()).statusCode).toBe(204);
    expect((await t.developers(['u-2'])).json().installed[0].developers).toEqual(['u-2']);
    const job = await t.runNext('done', 'http://app-notes-pr12:8080');
    expect(job).toMatchObject({ action: 'preview', pr: 12, requestedBy: 'automatic', release: { version: '1.1.0-pr.12.1' } });

    const mine = (await t.server.inject({ method: 'GET', url: '/v1/previews', headers: person('u-2') })).json();
    expect(mine.apps).toEqual([
      expect.objectContaining({ app: 'notes', version: '1.0.0', previews: [expect.objectContaining({ pr: 12, version: '1.1.0-pr.12.1', title: 'Tags on notes', url: 'https://github.com/o/r/pull/12' })] }),
    ]);
    expect((await t.server.inject({ method: 'GET', url: '/v1/previews', headers: person('u-3') })).json().apps).toEqual([]);
    const choose = (id: string, pr: number | null) => t.server.inject({ method: 'PUT', url: '/v1/previews/notes', headers: person(id), payload: { pr } });
    expect((await choose('u-3', 12)).statusCode).toBe(403);
    expect((await choose('u-2', 7)).statusCode).toBe(404);
    expect((await choose('u-2', 12)).statusCode).toBe(204);

    // The chooser alone is given its build and sent to its service.
    const version = async (id: string) => (await t.server.inject({ method: 'GET', url: '/v1/manifest', headers: person(id) })).json().find((a: { id: string }) => a.id === 'notes').version;
    expect(await version('u-2')).toBe('1.1.0-pr.12.1');
    expect(await version('u-3')).toBe('1.0.0');
    const upstreams = (await t.server.inject({ method: 'GET', url: '/v1/upstreams', headers: admin() })).json();
    expect(upstreams).toEqual({ apps: { notes: 'http://app-notes-blue:8080' }, previews: { notes: { 'u-2': 'http://app-notes-pr12:8080' } } });

    // Closing the pull request takes its preview away, and everyone is back on the app.
    await t.check(release('1.0.0'));
    expect(await t.runNext()).toMatchObject({ action: 'preview-remove', pr: 12 });
    expect(await version('u-2')).toBe('1.0.0');
    expect((await t.server.inject({ method: 'GET', url: '/v1/previews', headers: person('u-2') })).json().apps[0].previews).toEqual([]);
    expect(t.entries.map((e) => e.action)).toEqual(
      expect.arrayContaining(['app.developers-set', 'app.preview-requested', 'app.preview-started', 'app.preview-remove-requested', 'app.preview-removed']),
    );
  });

  it('runs three at most, tries each build once, and never installs one as the app', async () => {
    const t = await setup();
    await t.developers(['u-2']);
    await t.check(release('1.0.0'), ...[1, 2, 3, 4].map((pr) => release(`1.1.0-pr.${pr}.1`)));
    const prs = [];
    for (let i = 0; i < 4; i++) {
      const res = await t.next();
      if (res.statusCode === 204) break;
      prs.push((await t.runNext('failed')).pr);
    }
    expect(prs).toEqual([4, 3, 2]);
    // They failed: the same builds aren't tried again, and the fourth pull request now has room.
    await t.check(release('1.0.0'), ...[1, 2, 3, 4].map((pr) => release(`1.1.0-pr.${pr}.1`)));
    expect((await t.runNext('done', 'http://app-notes-pr1:8080')).pr).toBe(1);
    expect((await t.next()).statusCode).toBe(204);
    // A build from somewhere else isn't run with the app's sign-in.
    await t.check(release('1.0.0'), release('1.1.0-pr.5.1', { signer: { repository: 'someone/else', workflow: '.github/workflows/release.yml' } }));
    expect((await t.next()).json().action).toBe('preview-remove');

    const install = await t.server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: admin(), payload: { action: 'install', release: release('1.1.0-pr.4.1') } });
    expect(install.json().message).toMatch(/pull request’s build/);
  });
});

describe.runIf(DATABASE_URL)('live on the workbench', () => {
  const entry = 'https://laptop.tail1234.ts.net/@fs/home/me/augur/apps/notes/frontend/src/entry.tsx';
  const live = (t: Awaited<ReturnType<typeof setup>>, id: string, url: string | null) => t.server.inject({ method: 'PUT', url: '/v1/previews/notes/live', headers: person(id), payload: { url } });
  const catalogue = async (t: Awaited<ReturnType<typeof setup>>, id: string) => (await t.server.inject({ method: 'GET', url: '/v1/manifest', headers: person(id) })).json();

  it('loads an app from its developer’s own machine, for them alone, only on the workbench', async () => {
    const t = await setup('dev');
    await t.developers(['u-2']);
    expect((await live(t, 'u-3', entry)).statusCode).toBe(403);
    expect((await live(t, 'u-2', 'http://laptop.tail1234.ts.net/entry.ts')).statusCode).toBe(400);
    expect((await live(t, 'u-2', 'https://evil.example/entry.ts')).statusCode).toBe(400);
    // Every Tailscale user's machines are on *.ts.net: only this workbench's own tailnet is let in.
    const elsewhere = await live(t, 'u-2', 'https://laptop.tail9999.ts.net/entry.ts');
    expect(elsewhere.statusCode).toBe(400);
    expect(elsewhere.json().message).toContain('tail1234.ts.net');
    // An entry with no JSX in it is still taken.
    expect((await live(t, 'u-2', entry.replace(/\.tsx$/, '.ts'))).statusCode).toBe(204);
    expect((await live(t, 'u-2', entry)).statusCode).toBe(204);
    expect((await t.server.inject({ method: 'GET', url: '/v1/previews', headers: person('u-2') })).json().apps[0]).toMatchObject({ app: 'notes', live: entry });
    expect((await catalogue(t, 'u-2')).find((a: { id: string }) => a.id === 'notes')).toMatchObject({ entry });
    // Nobody else is touched.
    expect((await catalogue(t, 'u-3')).find((a: { id: string }) => a.id === 'notes')?.entry).not.toBe(entry);
    expect((await live(t, 'u-2', null)).statusCode).toBe(204);
    expect((await catalogue(t, 'u-2')).find((a: { id: string }) => a.id === 'notes')?.entry).not.toBe(entry);
  });

  it('says why not on any other server', async () => {
    const t = await setup('preview');
    await t.developers(['u-2']);
    expect((await live(t, 'u-2', entry)).json().message).toContain('Only the workbench');
    expect((await t.server.inject({ method: 'GET', url: '/v1/previews', headers: person('u-2') })).json().apps[0].liveProblem).toContain('SERVER_RING=dev');
  });

  it('says why not on a workbench that isn’t at a Tailscale address', async () => {
    const t = await setup('dev', null);
    await t.developers(['u-2']);
    expect((await live(t, 'u-2', entry)).statusCode).toBe(409);
    expect((await t.server.inject({ method: 'GET', url: '/v1/previews', headers: person('u-2') })).json().apps[0].liveProblem).toContain('PLATFORM_URL');
  });

  it('finds the tailnet in PLATFORM_URL', () => {
    expect(tailnetOf('https://augur.tail1234.ts.net')).toBe('tail1234');
    expect(tailnetOf('https://Augur.Tail1234.ts.net:443/')).toBe('tail1234');
    expect(tailnetOf('https://augur.example.org')).toBeUndefined();
    expect(tailnetOf('https://tail1234.ts.net')).toBeUndefined();
    expect(tailnetOf(undefined)).toBeUndefined();
  });
});
