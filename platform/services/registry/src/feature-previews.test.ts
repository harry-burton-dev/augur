import { describe, expect, it } from 'vitest';
import { callerHeaders, FloorsUnavailable, type FloorPlace } from '@augur/service-kit';
import { AUGUR_RELEASE } from './augur-version.ts';
import { ended } from './feature-previews.ts';
import { UpdateChecker } from './updates.ts';
import { DATABASE_URL, registryDb } from './db.testing.ts';

const db = registryDb();

const board = { id: 'board', name: 'Board view', detail: 'Tasks as columns.' };
const old = { id: 'old', name: 'Old idea', until: '2020-01-01' };
const notes = { id: 'notes', name: 'Notes', route: '/notes', entry: '/apps/notes/entry.js', version: '1.0.0', sdk: '^1.7.0', previews: [board, old] };
const admin = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
const sam = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: [] });
const verifyService = async (headers: Record<string, string | string[] | undefined>) => {
  const m = /^Bearer app-(\S+)$/.exec(String(headers.authorization ?? ''));
  return m ? { kind: 'app' as const, app: m[1] } : undefined;
};
const service = { authorization: 'Bearer app-notes' };

const setup = async (ring: 'preview' | 'production') => {
  const entries: { action: string; detail?: Record<string, unknown> }[] = [];
  const app = await db.app({ verifyService, updates: new UpdateChecker({ running: AUGUR_RELEASE, ring }), audit: async (e) => void entries.push(e) });
  expect((await app.inject({ method: 'PUT', url: '/v1/apps/notes', headers: service, payload: notes })).statusCode).toBeLessThan(300);
  const mine = async (headers = sam) => (await app.inject({ method: 'GET', url: '/v1/feature-previews', headers })).json().apps.filter((a: { app: string }) => a.app === 'notes');
  const choose = (on: boolean, preview = 'board', headers = sam) => app.inject({ method: 'PUT', url: `/v1/feature-previews/notes/${preview}`, headers, payload: { on } });
  const set = (mode: string | null, preview = 'board', headers = admin) => app.inject({ method: 'PUT', url: `/v1/apps/notes/feature-previews/${preview}`, headers, payload: { mode } });
  const catalogue = async (headers = sam) => (await app.inject({ method: 'GET', url: '/v1/manifest', headers })).json().find((a: { id: string }) => a.id === 'notes');
  return { app, entries, mine, choose, set, catalogue };
};

describe.runIf(DATABASE_URL)('feature previews', () => {
  it('turns away a manifest that offers one preview twice', async () => {
    const app = await db.app({ verifyService });
    const res = await app.inject({ method: 'PUT', url: '/v1/apps/notes', headers: service, payload: { ...notes, previews: [board, board] } });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/offers the preview "board" twice/);
  });

  it('on a preview server, is opt-in by default: a person turns one on for themselves, and the catalogue says so', async () => {
    const t = await setup('preview');
    expect((await t.mine())[0].previews).toEqual([
      { ...board, mode: 'opt-in', on: false },
      { ...old, mode: 'opt-in', ended: true, on: false },
    ]);
    expect((await t.catalogue()).previewsOn).toBeUndefined();
    expect((await t.choose(true)).statusCode).toBe(204);
    expect((await t.mine())[0].previews[0].on).toBe(true);
    expect((await t.catalogue()).previewsOn).toEqual(['board']);
    // Only for them.
    expect((await t.catalogue(admin)).previewsOn).toBeUndefined();
    // One whose last day is past can't be turned on.
    expect((await t.choose(true, 'old')).json().error).toBe('ended');
    expect((await t.choose(false)).statusCode).toBe(204);
    expect((await t.catalogue()).previewsOn).toBeUndefined();
  });

  it('on a production server, is off until an admin says who gets it; audited', async () => {
    const t = await setup('production');
    expect((await t.mine())[0].previews[0]).toMatchObject({ mode: 'off', on: false });
    expect((await t.choose(true)).json()).toMatchObject({ error: 'not_opt_in', message: expect.stringContaining('off') });
    expect((await t.set('everyone', 'board', sam)).statusCode).toBe(403);
    const view = (await t.set('everyone')).json();
    expect(view).toMatchObject({ defaultMode: 'off', ring: 'production' });
    expect(view.previews[0]).toMatchObject({ id: 'board', mode: 'everyone', chosen: true, setBy: 'u-1', optedIn: 0 });
    expect(t.entries.at(-1)).toMatchObject({ action: 'app.preview-set', target: 'notes', detail: { preview: 'board', mode: 'everyone' } });
    expect((await t.catalogue()).previewsOn).toEqual(['board']);

    await t.set('opt-in');
    await t.choose(true);
    expect((await t.app.inject({ method: 'GET', url: '/v1/apps/notes/feature-previews', headers: admin })).json().previews[0].optedIn).toBe(1);
    // Back to the server's default: off again, whoever turned it on.
    expect((await t.set(null)).json().previews[0]).toMatchObject({ mode: 'off', chosen: false });
    expect((await t.catalogue()).previewsOn).toBeUndefined();
    expect((await t.set('everyone', 'nothing')).statusCode).toBe(404);
  });

  it('tells the app’s own service whose previews are on, and no other app', async () => {
    const t = await setup('preview');
    await t.choose(true);
    const ask = (authorization: string) => t.app.inject({ method: 'GET', url: '/v1/apps/notes/feature-previews/people/u-2', headers: { authorization } });
    expect((await ask('Bearer app-notes')).json()).toEqual({ on: ['board'] });
    expect((await ask('Bearer app-other')).statusCode).toBe(403);
  });

  it('turns a preview on for chosen floors and the floors beneath them, and nowhere else; audited', async () => {
    // The org, Finance with Payroll below it, Legal, and someone's own floor.
    const places: Record<string, FloorPlace> = {
      o: { id: 'o', kind: 'org', path: ['o'], org: 'o' },
      f: { id: 'f', kind: 'team', path: ['o', 'f'], org: 'o' },
      p: { id: 'p', kind: 'team', path: ['o', 'f', 'p'], org: 'o' },
      l: { id: 'l', kind: 'team', path: ['o', 'l'], org: 'o' },
      m: { id: 'm', kind: 'personal', path: ['m'], org: 'o' },
    };
    const entries: { action: string; detail?: Record<string, unknown> }[] = [];
    let down = false;
    const floors = async (id: string) => {
      if (down) throw new FloorsUnavailable('identity is down');
      return id === 'org' ? places.o : places[id];
    };
    const app = await db.app({ verifyService, floors, updates: new UpdateChecker({ running: AUGUR_RELEASE, ring: 'production' }), audit: async (e) => void entries.push(e) });
    await app.inject({ method: 'PUT', url: '/v1/apps/notes', headers: service, payload: { ...notes, floors: ['personal', 'team', 'org'] } });
    const on = (id: string) => callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: [], workspace: { id, kind: places[id].kind, role: 'member' } });
    const set = (payload: Record<string, unknown>) => app.inject({ method: 'PUT', url: '/v1/apps/notes/feature-previews/board', headers: admin, payload });
    const catalogue = async (id: string) => (await app.inject({ method: 'GET', url: `/v1/manifest?workspace=${id}`, headers: on(id) })).json().find((a: { id: string }) => a.id === 'notes');

    expect((await set({ mode: 'floors' })).json().error).toBe('bad_floors');
    expect((await set({ mode: 'everyone', floors: ['f'] })).json().error).toBe('bad_floors');
    expect((await set({ mode: 'floors', floors: ['nowhere'] })).json()).toMatchObject({ error: 'bad_floors', message: expect.stringContaining('"nowhere"') });
    down = true;
    expect((await set({ mode: 'floors', floors: ['f'] })).statusCode).toBe(503);
    down = false;

    const view = (await set({ mode: 'floors', floors: ['f'] })).json();
    expect(view.previews[0]).toMatchObject({ id: 'board', mode: 'floors', floors: ['f'], chosen: true });
    expect(entries.at(-1)).toMatchObject({ action: 'app.preview-set', detail: { preview: 'board', mode: 'floors', floors: ['f'] } });
    // On for Finance and Payroll beneath it; not for Legal, the org above, or someone's own floor.
    expect((await catalogue('f')).previewsOn).toEqual(['board']);
    expect((await catalogue('p')).previewsOn).toEqual(['board']);
    expect((await catalogue('l')).previewsOn).toBeUndefined();
    expect((await catalogue('o')).previewsOn).toBeUndefined();
    expect((await catalogue('m')).previewsOn).toBeUndefined();
    // Nobody turns it on for themselves, and the Previews list says whether it's on where they stand.
    expect((await app.inject({ method: 'PUT', url: '/v1/feature-previews/notes/board', headers: on('l'), payload: { on: true } })).json()).toMatchObject({ error: 'not_opt_in', message: expect.stringContaining('chosen floors') });
    const listed = async (id: string) => (await app.inject({ method: 'GET', url: '/v1/feature-previews', headers: on(id) })).json().apps.find((a: { app: string }) => a.app === 'notes').previews[0];
    expect(await listed('p')).toMatchObject({ mode: 'floors', on: true });
    expect(await listed('l')).toMatchObject({ mode: 'floors', on: false });
    expect((await listed('p')).floors).toBeUndefined();
    // The app's own service asks with the floor the person stands on.
    const ask = async (workspace?: string) => (await app.inject({ method: 'GET', url: `/v1/apps/notes/feature-previews/people/u-2${workspace ? `?workspace=${workspace}` : ''}`, headers: service })).json().on;
    expect(await ask('p')).toEqual(['board']);
    expect(await ask('l')).toEqual([]);
    expect(await ask()).toEqual([]);
    // The org turns it on for everyone beneath it, personal floors included.
    await set({ mode: 'floors', floors: ['o'] });
    expect((await catalogue('m')).previewsOn).toEqual(['board']);
    // Another mode drops the floors.
    expect((await set({ mode: 'everyone' })).json().previews[0].floors).toBeUndefined();
  });

  it('ends a preview after its last day', () => {
    expect(ended({ until: '2026-10-29' }, new Date('2026-10-30T09:00:00Z'))).toBe(true);
    expect(ended({ until: '2026-10-30' }, new Date('2026-10-30T23:00:00Z'))).toBe(false);
    expect(ended({}, new Date())).toBe(false);
  });
});

describe.runIf(DATABASE_URL)("AUGUR's own apps' feature previews", () => {
  it('are at the server default, opt-in on a preview server: a person turns one on and the catalogue says so; Admin cannot change them', async () => {
    const app = await db.app({ verifyService, updates: new UpdateChecker({ running: AUGUR_RELEASE, ring: 'preview' }) });
    const homeOf = async () => (await app.inject({ method: 'GET', url: '/v1/feature-previews', headers: sam })).json().apps.find((a: { app: string }) => a.app === 'home');
    const home = await homeOf();
    expect(home.previews.map((p: { id: string; mode: string; on: boolean }) => [p.id, p.mode, p.on])).toEqual([
      ['focal-planes', 'opt-in', false],
      ['radial-menu', 'opt-in', false],
    ]);
    expect((await app.inject({ method: 'PUT', url: '/v1/feature-previews/home/focal-planes', headers: sam, payload: { on: true } })).statusCode).toBe(204);
    const listed = (await app.inject({ method: 'GET', url: '/v1/manifest', headers: sam })).json().find((a: { id: string }) => a.id === 'home');
    expect(listed.previewsOn).toEqual(['focal-planes']);
    const set = await app.inject({ method: 'PUT', url: '/v1/apps/home/feature-previews/focal-planes', headers: admin, payload: { mode: 'everyone' } });
    expect(set.statusCode).toBe(409);
    expect(set.json()).toMatchObject({ error: 'platform_app', message: expect.stringContaining('chooses for themselves') });
  });
});
