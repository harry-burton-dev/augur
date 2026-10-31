import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { AUGUR_RELEASE } from './augur-version.ts';
import { ended } from './feature-previews.ts';
import { UpdateChecker } from './updates.ts';

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
  const app = await buildApp({ verifyService, updates: new UpdateChecker({ running: AUGUR_RELEASE, ring }), audit: async (e) => void entries.push(e) });
  expect((await app.inject({ method: 'PUT', url: '/v1/apps/notes', headers: service, payload: notes })).statusCode).toBeLessThan(300);
  const mine = async (headers = sam) => (await app.inject({ method: 'GET', url: '/v1/feature-previews', headers })).json().apps;
  const choose = (on: boolean, preview = 'board', headers = sam) => app.inject({ method: 'PUT', url: `/v1/feature-previews/notes/${preview}`, headers, payload: { on } });
  const set = (mode: string | null, preview = 'board', headers = admin) => app.inject({ method: 'PUT', url: `/v1/apps/notes/feature-previews/${preview}`, headers, payload: { mode } });
  const catalogue = async (headers = sam) => (await app.inject({ method: 'GET', url: '/v1/manifest', headers })).json().find((a: { id: string }) => a.id === 'notes');
  return { app, entries, mine, choose, set, catalogue };
};

describe('feature previews', () => {
  it('turns away a manifest that offers one preview twice', async () => {
    const app = await buildApp({ verifyService });
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

  it('ends a preview after its last day', () => {
    expect(ended({ until: '2026-10-29' }, new Date('2026-10-30T09:00:00Z'))).toBe(true);
    expect(ended({ until: '2026-10-30' }, new Date('2026-10-30T23:00:00Z'))).toBe(false);
    expect(ended({}, new Date())).toBe(false);
  });
});
