import { afterEach, describe, expect, it } from 'vitest';
import { callerHeaders, serviceHeaders, type FloorPlace, type Scope } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { MemoryEventStore } from './store.ts';

// Stands in for Keycloak: "Bearer app-<id>" is that app's token.
const verifyService = async (headers: Record<string, string | string[] | undefined>) => {
  const m = /^Bearer (app|platform)-(\S+)$/.exec(String(headers.authorization ?? ''));
  return m ? (m[1] === 'app' ? { kind: 'app' as const, app: m[2] } : { kind: 'platform' as const, name: m[2] }) : undefined;
};
const as = (app: string, workspace = 'w-finance') => ({ authorization: `Bearer app-${app}`, 'x-workspace-id': workspace });
const places: Record<string, FloorPlace> = {
  'w-org': { id: 'w-org', kind: 'org', path: ['w-org'], org: 'w-org' },
  'w-finance': { id: 'w-finance', kind: 'team', path: ['w-org', 'w-finance'], org: 'w-org' },
  'w-old': { id: 'w-old', kind: 'team', path: ['w-org', 'w-old'], org: 'w-org', archivedAt: '2026-01-01T00:00:00Z' },
};
// Nora and Sam are on Finance; Kit isn't. Gone can't sign in.
const teams: Record<string, string[]> = { 'u-nora': ['w-finance'], 'u-sam': ['w-finance'], 'u-kit': [] };
const person = (id: string, workspace?: { id: string; kind: 'team'; role: 'member' | 'lead' }) =>
  callerHeaders({ id, name: id.slice(2), departments: [], roles: ['editor'], ...(workspace ? { workspace } : {}) });
const nora = person('u-nora');
const sam = person('u-sam');
const kit = person('u-kit');
const leadNora = person('u-nora', { id: 'w-finance', kind: 'team', role: 'lead' });

const assignment = { kind: 'assignment', owner: { kind: 'person', id: 'u-nora' }, title: 'Plan the move', subject: { kind: 'ref', app: 'mandate', id: 'i-1', label: 'Office move' }, open: { type: 'intent.open', payload: { id: 'i-1' } } };
const forFinance = { ...assignment, owner: { kind: 'team', id: 'w-finance' }, title: 'Review the budget' };

let open: Awaited<ReturnType<typeof buildApp>> | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

const setUp = async (granted: Scope[] = ['inbox:write'], heartbeatMs?: number) => {
  const store = new MemoryEventStore();
  const app = await buildApp({
    store,
    verifyService,
    grants: async () => granted,
    floors: async (id) => places[id],
    directory: async ({ ids }) => ({ people: (ids ?? []).filter((id) => id in teams).map((id) => ({ id, name: id })), teams: [] }),
    principals: async (id) => [`person:${id}`, ...(teams[id] ?? []).map((t) => `team:${t}`)],
    inboxKinds: async (app) => (app === 'mandate' ? ['assignment', 'back-brief'] : undefined),
    ...(heartbeatMs ? { heartbeatMs } : {}),
  });
  const put = (key: string, payload: object, headers: Record<string, string> = as('mandate')) =>
    app.inject({ method: 'PUT', url: `/v1/inbox/items/mandate/${encodeURIComponent(key)}`, headers, payload });
  const act = (id: string, verb: string, headers: Record<string, string>, payload?: object) => app.inject({ method: 'POST', url: `/v1/inbox/${id}/${verb}`, headers, ...(payload ? { payload } : {}) });
  const list = async (headers: Record<string, string>, tab = 'you') => (await app.inject({ method: 'GET', url: `/v1/inbox?tab=${tab}`, headers })).json();
  return { app, store, put, act, list };
};

describe('the inbox', () => {
  it('lets an app put an item in a person’s inbox, once per key, and change it in place', async () => {
    const { put, list, store } = await setUp();
    const first = await put('intent/1', assignment);
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ app: 'mandate', key: 'intent/1', state: 'open', owner: { kind: 'person', id: 'u-nora' }, workspace: { id: 'w-finance' }, allow: { decline: true, handOn: true, selfComplete: false } });
    const again = await put('intent/1', { ...assignment, title: 'Plan the office move' });
    expect([again.statusCode, again.json().id]).toEqual([200, first.json().id]);
    expect((await list(nora)).map((i: { title: string }) => i.title)).toEqual(['Plan the office move']);
    expect(await list(sam)).toEqual([]);
    expect((await store.audit({ limit: 10 })).map((e) => [e.action, e.actor.kind, e.detail])).toEqual([['inbox.created', 'service', { app: 'mandate', key: 'intent/1', kind: 'assignment' }]]);
  });

  it('turns away an app without the scope, writing for another app, or with what it can’t use', async () => {
    const { put } = await setUp();
    expect((await put('k', assignment, as('folio'))).statusCode).toBe(403);
    expect((await put('k', { ...assignment, kind: 'chore' })).json().message).toContain('inbox.kinds');
    expect((await put('k', { ...assignment, owner: { kind: 'person', id: 'u-gone' } })).json().message).toContain('sign-in is turned off');
    expect((await put('k', { ...assignment, owner: { kind: 'team', id: 'w-old' } })).json().message).toContain('archived');
    expect((await put('k', { ...assignment, owner: { kind: 'team', id: 'w-nowhere' } })).statusCode).toBe(400);
    expect((await put('k', { ...assignment, owner: { kind: 'person', id: 'u-nora', role: 'lead' } })).statusCode).toBe(400);
    expect((await put('k', { ...assignment, open: { type: 'intent.open', payload: { big: 'x'.repeat(1100) } } })).statusCode).toBe(400);
    expect((await put('k', { ...assignment, due: '2026-13-45' })).statusCode).toBe(400);
    const { put: ungranted } = await setUp(['notifications:send']);
    expect((await ungranted('k', assignment)).json().message).toContain('inbox:write');
  });

  it('keeps a closed item closed unless the app reopens it, and lets the app read the notes', async () => {
    const { app, put, act } = await setUp();
    const { id } = (await put('k', assignment)).json();
    expect((await act(id, 'decline', nora, { note: '  ' })).statusCode).toBe(400);
    expect((await act(id, 'decline', nora, { note: 'Not this quarter' })).json()).toMatchObject({ state: 'declined', closedBy: 'u-nora', closeNote: 'Not this quarter' });
    expect((await put('k', assignment)).statusCode).toBe(409);
    const read = await app.inject({ method: 'GET', url: '/v1/inbox/items/mandate/k', headers: as('mandate') });
    expect(read.json().history.map((h: { action: string; note?: string }) => [h.action, h.note])).toEqual([['created', undefined], ['declined', 'Not this quarter']]);
    expect((await put('k', { ...assignment, reopen: true })).json()).toMatchObject({ state: 'open' });
    const done = await app.inject({ method: 'PATCH', url: '/v1/inbox/items/mandate/k', headers: as('mandate'), payload: { state: 'done' } });
    expect(done.json().state).toBe('done');
    expect((await app.inject({ method: 'PATCH', url: '/v1/inbox/items/mandate/k', headers: as('mandate'), payload: { title: 'Late' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'PATCH', url: '/v1/inbox/items/mandate/nope', headers: as('mandate'), payload: {} })).statusCode).toBe(404);
  });

  it('shows a team item to everyone on the team until one of them takes it; the next taker hears who', async () => {
    const { store, put, act, list } = await setUp();
    const { id } = (await put('t', forFinance)).json();
    expect((await list(sam, 'teams')).map((i: { id: string }) => i.id)).toEqual([id]);
    expect(await list(kit, 'teams')).toEqual([]);
    expect((await act(id, 'take', kit)).statusCode).toBe(404);
    expect((await act(id, 'take', sam)).json()).toMatchObject({ takenBy: 'u-sam' });
    const second = await act(id, 'take', nora);
    expect([second.statusCode, second.json().takenBy]).toEqual([409, 'u-sam']);
    expect(await list(nora, 'teams')).toEqual([]);
    expect((await list(sam)).map((i: { id: string }) => i.id)).toEqual([id]);
    expect((await act(id, 'decline', nora, { note: 'No' })).json().message).toContain('Someone else on the team took this');
    expect((await act(id, 'release', nora)).statusCode).toBe(403);
    expect((await act(id, 'release', sam)).json().takenBy).toBeUndefined();
    const events = await store.readEvents({ topics: ['platform.inbox.*'], limit: 10 });
    expect(events.map((e) => [e.topic, e.publisher, e.payload, e.workspace?.id])).toEqual([
      ['platform.inbox.taken', 'events', { item: id, app: 'mandate', key: 't', by: 'u-sam' }, 'w-finance'],
      ['platform.inbox.released', 'events', { item: id, app: 'mandate', key: 't', by: 'u-sam' }, 'w-finance'],
    ]);
  });

  it('shows a leads-only item whole to a lead on the team, and only that it’s there to other members', async () => {
    const { put, act, list, app } = await setUp();
    const { id } = (await put('lead', { ...forFinance, owner: { kind: 'team', id: 'w-finance', role: 'lead' } })).json();
    const [hidden] = await list(sam, 'teams');
    expect(hidden).toMatchObject({ id, redacted: true, owner: { role: 'lead' } });
    expect(hidden.title).toBeUndefined();
    expect(hidden.subject).toBeUndefined();
    expect((await list(leadNora, 'teams'))[0]).toMatchObject({ title: 'Review the budget', subject: { label: 'Office move' } });
    expect((await act(id, 'take', sam)).json().message).toContain('leads');
    expect((await app.inject({ method: 'GET', url: '/v1/inbox/counts', headers: sam })).json()).toEqual({ you: 0, teams: 0, overdue: 0 });
    expect((await app.inject({ method: 'GET', url: '/v1/inbox/counts', headers: leadNora })).json()).toEqual({ you: 0, teams: 1, overdue: 0 });
    expect((await act(id, 'take', leadNora)).json().takenBy).toBe('u-nora');
  });

  it('hands an item on to someone else, and marks it done only where the app allows', async () => {
    const { store, put, act, list, app } = await setUp();
    const { id } = (await put('h', { ...assignment, due: '2000-01-01' })).json();
    expect((await list(nora))[0]).toMatchObject({ overdue: true, due: '2000-01-01T00:00:00.000Z' });
    expect((await app.inject({ method: 'GET', url: '/v1/inbox/counts', headers: nora })).json()).toEqual({ you: 1, teams: 0, overdue: 1 });
    expect((await act(id, 'hand-on', nora, { to: 'person:u-gone' })).statusCode).toBe(400);
    expect((await act(id, 'hand-on', nora, { to: 'person:u-nora' })).statusCode).toBe(400);
    expect((await act(id, 'hand-on', sam, { to: 'person:u-sam' })).statusCode).toBe(404);
    expect((await act(id, 'hand-on', nora, { to: 'person:u-sam', note: 'You know this one' })).json()).toMatchObject({ owner: { kind: 'person', id: 'u-sam' }, state: 'open' });
    expect(await list(nora)).toEqual([]);
    expect((await act(id, 'done', sam)).json().message).toContain('closes it itself');
    const item = await app.inject({ method: 'GET', url: `/v1/inbox/${id}`, headers: nora });
    expect(item.json().history.map((h: { action: string; to?: string }) => [h.action, h.to])).toEqual([['created', 'person:u-nora'], ['handed-on', 'person:u-sam']]);
    expect((await app.inject({ method: 'GET', url: `/v1/inbox/${id}`, headers: kit })).statusCode).toBe(404);
    const { id: own } = (await put('own', { ...assignment, owner: { kind: 'person', id: 'u-sam' }, allow: { selfComplete: true, handOn: false } })).json();
    expect((await act(own, 'hand-on', sam, { to: 'team:w-finance' })).json().message).toContain('handed on');
    expect((await act(own, 'done', sam)).json().state).toBe('done');
    expect((await list(sam, 'done')).map((i: { key: string }) => i.key)).toEqual(['own']);
    const events = await store.readEvents({ topics: ['platform.inbox.*'], limit: 10 });
    expect(events.map((e) => [e.topic, (e.payload as { to?: string }).to])).toEqual([['platform.inbox.handed-on', 'person:u-sam'], ['platform.inbox.done', undefined]]);
    expect((await store.audit({ limit: 10 })).map((e) => e.action).reverse()).toEqual(['inbox.created', 'inbox.handed-on', 'inbox.created', 'inbox.done']);
  });

  it('tells each open stream when an item it can see changes, and no one else', async () => {
    const { app, put, act } = await setUp(['inbox:write'], 50);
    open = app;
    const url = await app.listen({ port: 0, host: '127.0.0.1' });
    const listen = async (headers: Record<string, string>) => {
      const controller = new AbortController();
      const res = await fetch(`${url}/v1/notifications/stream`, { headers, signal: controller.signal });
      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      await reader.read();
      let text = '';
      return {
        until: async (seen: string) => {
          while (!text.includes(seen)) text += (await reader.read()).value;
          return text;
        },
        text: () => text,
        stop: () => controller.abort(),
      };
    };
    const samStream = await listen(sam);
    const kitStream = await listen(kit);
    const { id } = (await put('t', forFinance)).json();
    await act(id, 'take', nora);
    const heard = await samStream.until('"change":"changed"');
    expect(heard).toContain(`event: inbox\ndata: {"id":"${id}","change":"added"}`);
    await put('other', { ...assignment, owner: { kind: 'person', id: 'u-kit' } });
    expect(await kitStream.until('event: inbox')).toContain('"change":"added"');
    expect(kitStream.text()).not.toContain(id);
    samStream.stop();
    kitStream.stop();
  });

  it('gives the team work someone took back to the team when they leave it, or can no longer sign in', async () => {
    const { app, store, put, act, list } = await setUp();
    const identity = await serviceHeaders({ name: 'identity', getToken: async () => 'platform-identity' });
    const audit = (entry: object) => app.inject({ method: 'POST', url: '/v1/audit', headers: identity, payload: entry });
    const budget = (await put('budget', forFinance)).json();
    const rota = (await put('rota', { ...forFinance, title: 'Draw up the rota' })).json();
    const own = (await put('own', assignment)).json();
    await act(budget.id, 'take', nora);
    await act(rota.id, 'take', sam);
    // Nora leaves Finance: what she took goes back; her own item stays hers.
    expect((await audit({ actor: { id: 'u-admin', kind: 'user' }, app: 'identity', action: 'department.member-removed', target: 'w-finance', detail: { person: 'u-nora' } })).statusCode).toBe(201);
    expect((await store.inbox.get(budget.id))?.takenBy).toBeUndefined();
    expect((await store.inbox.get(own.id))?.owner).toEqual({ kind: 'person', id: 'u-nora' });
    expect((await list(sam, 'teams')).map((i: { id: string }) => i.id)).toContain(budget.id);
    // Sam's sign-in is turned off: his goes back too.
    await audit({ actor: { id: 'u-admin', kind: 'user' }, app: 'identity', action: 'person.disabled', target: 'u-sam' });
    expect((await store.inbox.get(rota.id))?.takenBy).toBeUndefined();
    const events = await store.readEvents({ topics: ['platform.inbox.released'], limit: 10 });
    expect(events.map((e) => e.payload)).toEqual([
      expect.objectContaining({ item: budget.id, by: 'u-nora', left: true }),
      expect.objectContaining({ item: rota.id, by: 'u-sam', left: true }),
    ]);
  });
});
