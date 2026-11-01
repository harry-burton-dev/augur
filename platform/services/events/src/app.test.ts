import { afterEach, describe, expect, it } from 'vitest';
import { callerHeaders, FloorsUnavailable, GrantsUnavailable, serviceHeaders, type FloorPlace } from '@augur/service-kit';
import { buildApp } from './app.ts';

const alex = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
const sam = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });
// Stands in for Keycloak: "Bearer app-<id>" is that app's token, "Bearer platform-<name>" a platform service's.
const verifyService = async (headers: Record<string, string | string[] | undefined>) => {
  const m = /^Bearer (app|platform)-(\S+)$/.exec(String(headers.authorization ?? ''));
  return m ? (m[1] === 'app' ? { kind: 'app' as const, app: m[2] } : { kind: 'platform' as const, name: m[2] }) : undefined;
};
const platform = await serviceHeaders({ name: 'identity', getToken: async () => 'platform-identity' });
const review = { app: 'library', recipients: ['u-1', 'u-2'], level: 'needs', title: 'Review the budget paper', link: '/doc/7' };

// The org, Finance with Payroll below it, Legal, and someone's own floor.
const places: Record<string, FloorPlace> = {
  'w-org': { id: 'w-org', kind: 'org', path: ['w-org'], org: 'w-org' },
  'w-finance': { id: 'w-finance', kind: 'team', path: ['w-org', 'w-finance'], org: 'w-org' },
  'w-payroll': { id: 'w-payroll', kind: 'team', path: ['w-org', 'w-finance', 'w-payroll'], org: 'w-org' },
  'w-legal': { id: 'w-legal', kind: 'team', path: ['w-org', 'w-legal'], org: 'w-org' },
  'w-me': { id: 'w-me', kind: 'personal', path: ['w-me'], org: 'w-org' },
};
const floors = async (id: string) => places[id];

type App = Awaited<ReturnType<typeof buildApp>>;
let open: App | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

describe('events', () => {
  it('reports healthy', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.json()).toMatchObject({ status: 'ok', service: 'events', version: expect.stringMatching(/^\d+\.\d+\.\d+/), api: 'v1' });
  });

  it('lets a service notify people, who each see only their own', async () => {
    const app = await buildApp({ verifyService });
    const sent = await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: review });
    expect([sent.statusCode, sent.json()]).toEqual([202, { sent: 2 }]);
    const mine = (await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json();
    expect(mine).toMatchObject([{ app: 'library', level: 'needs', title: 'Review the budget paper', link: '/doc/7' }]);
    expect(mine[0].recipient).toBeUndefined();
  });

  it('turns away notifications from anyone but a service, and ones it cannot use', async () => {
    const app = await buildApp({ verifyService });
    const post = (headers: Record<string, string>, payload: object) => app.inject({ method: 'POST', url: '/v1/notifications', headers, payload });
    expect((await post(alex, review)).statusCode).toBe(403);
    expect((await post(platform, { ...review, level: 'urgent' })).statusCode).toBe(400);
    expect((await post(platform, { ...review, recipients: [] })).statusCode).toBe(400);
    expect((await post(platform, { ...review, link: 'https://elsewhere.example' })).statusCode).toBe(400);
  });

  it('carries up to two actions, each an intent with a small payload', async () => {
    const app = await buildApp({ verifyService });
    const post = (payload: object) => app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload });
    const approve = { label: 'Approve', intent: { type: 'document.approve', payload: { id: 'd7' } } };
    expect((await post({ ...review, actions: [approve, { label: 'Open', intent: { type: 'document.open' } }] })).statusCode).toBe(202);
    const [n] = (await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json();
    expect(n.actions).toEqual([approve, { label: 'Open', intent: { type: 'document.open' } }]);
    expect((await post({ ...review, actions: [approve, approve, approve] })).statusCode).toBe(400);
    expect((await post({ ...review, actions: [{ label: 'Go', intent: { type: 'Not A Type' } }] })).statusCode).toBe(400);
    expect((await post({ ...review, actions: [{ label: 'A label far too long to fit on a button', intent: { type: 'document.open' } }] })).statusCode).toBe(400);
    const big = await post({ ...review, actions: [{ label: 'Open', intent: { type: 'document.open', payload: { text: 'x'.repeat(2000) } } }] });
    expect([big.statusCode, big.json().message]).toEqual([400, expect.stringContaining('over 1024 bytes')]);
  });

  it('marks a notification read, and unread again', async () => {
    const app = await buildApp({ verifyService });
    await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: review });
    const [n] = (await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json();
    expect((await app.inject({ method: 'POST', url: `/v1/notifications/${n.id}/read`, headers: sam })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json()).toEqual([]);
    expect((await app.inject({ method: 'DELETE', url: `/v1/notifications/${n.id}/read`, headers: sam })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json()).toHaveLength(1);
  });

  it('never lets someone touch another person’s notification', async () => {
    const app = await buildApp({ verifyService });
    await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: { ...review, recipients: ['u-1'] } });
    const [n] = (await app.inject({ method: 'GET', url: '/v1/notifications', headers: alex })).json();
    expect((await app.inject({ method: 'POST', url: `/v1/notifications/${n.id}/read`, headers: sam })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/v1/notifications' })).statusCode).toBe(401);
  });

  it('streams each new notification to its recipient as it happens', async () => {
    const app = (open = await buildApp({ verifyService, heartbeatMs: 50 }));
    const url = await app.listen({ port: 0, host: '127.0.0.1' });
    const controller = new AbortController();
    const res = await fetch(`${url}/v1/notifications/stream`, { headers: sam, signal: controller.signal });
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    expect((await reader.read()).value).toContain(': connected');

    await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: { ...review, recipients: ['u-1'] } });
    await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: { ...review, recipients: ['u-2'], title: 'For Sam' } });
    let text = '';
    while (!text.includes('event: notification')) text += (await reader.read()).value;
    expect(text).toContain('"title":"For Sam"');
    expect(text).not.toContain('Review the budget paper');
    controller.abort();
  });

  it('keeps an audit log that services write and only admins read', async () => {
    const app = await buildApp({ verifyService });
    const entry = { actor: { id: 'u-2', kind: 'user' }, app: 'library', action: 'document.published', target: 'doc-7' };
    expect((await app.inject({ method: 'POST', url: '/v1/audit', headers: platform, payload: entry })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/v1/audit', headers: alex, payload: entry })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/v1/audit', headers: platform, payload: { ...entry, action: 'Published!' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/v1/audit', headers: sam })).statusCode).toBe(403);
    const log = (await app.inject({ method: 'GET', url: '/v1/audit?app=library', headers: alex })).json();
    expect(log).toMatchObject([entry]);
    const page = await app.inject({ method: 'GET', url: `/v1/audit?since=2000-01-01T00:00:00Z&before=${log[0].id}&limit=50`, headers: alex });
    expect([page.statusCode, page.json()]).toEqual([200, []]);
    expect((await app.inject({ method: 'GET', url: '/v1/audit?since=yesterday', headers: alex })).statusCode).toBe(400);
  });

  describe('apps signed in as themselves', () => {
    const as = (app: string, workspace?: string) => ({ authorization: `Bearer app-${app}`, ...(workspace ? { 'x-workspace-id': workspace } : {}) });
    const asked: [string, string | undefined][] = [];
    // Library may notify on every floor but write the audit log only on w-finance; Board is granted nothing.
    const grants = async (app: string, workspace?: string) => {
      asked.push([app, workspace]);
      if (app !== 'library') return [];
      return workspace === 'w-finance' ? (['notifications:send', 'audit:write'] as const) : (['notifications:send'] as const);
    };

    it('lets an app notify with the scope, only for itself', async () => {
      const app = await buildApp({ verifyService, grants, floors });
      const post = (headers: Record<string, string>, payload: object) => app.inject({ method: 'POST', url: '/v1/notifications', headers, payload });
      expect((await post(as('library', 'w-me'), review)).statusCode).toBe(202);
      expect(asked.at(-1)).toEqual(['library', 'w-me']);
      const posing = await post(as('board'), review);
      expect([posing.statusCode, posing.json().message]).toEqual([403, 'board can only send for itself, not for "library".']);
      const ungranted = await post(as('board'), { ...review, app: 'board' });
      expect([ungranted.statusCode, ungranted.json().message]).toEqual([403, 'board isn’t granted notifications:send.']);
    });

    it('checks the scope on the floor the call names', async () => {
      const app = await buildApp({ verifyService, grants, floors });
      const entry = { actor: { id: 'u-1', kind: 'user' }, app: 'library', action: 'document.published', target: 'doc-7' };
      expect((await app.inject({ method: 'POST', url: '/v1/audit', headers: as('library', 'w-finance'), payload: entry })).statusCode).toBe(201);
      const elsewhere = await app.inject({ method: 'POST', url: '/v1/audit', headers: as('library', 'w-legal'), payload: entry });
      expect([elsewhere.statusCode, elsewhere.json().message]).toEqual([403, 'library isn’t granted audit:write on that floor.']);
    });

    it('records which service wrote an entry, whoever it names as the actor', async () => {
      const app = await buildApp({ verifyService, grants, floors });
      const entry = { actor: { id: 'admin-1', kind: 'user' }, app: 'library', action: 'document.deleted', target: 'doc-7' };
      const written = await app.inject({ method: 'POST', url: '/v1/audit', headers: as('library', 'w-finance'), payload: entry });
      expect(written.json()).toMatchObject({ actor: { id: 'admin-1' }, recordedBy: 'library' });
      const byPlatform = await app.inject({ method: 'POST', url: '/v1/audit', headers: platform, payload: { ...entry, app: 'identity' } });
      expect(byPlatform.json().recordedBy).toBe('identity');
    });

    it('refuses for now when what an app may do can’t be checked', async () => {
      const app = await buildApp({ verifyService, grants: async () => Promise.reject(new GrantsUnavailable('down')) });
      expect((await app.inject({ method: 'POST', url: '/v1/notifications', headers: as('library'), payload: review })).statusCode).toBe(503);
      const unchecked = await buildApp({ verifyService });
      expect((await unchecked.inject({ method: 'POST', url: '/v1/notifications', headers: as('library'), payload: review })).statusCode).toBe(503);
    });
  });

  describe('floor by floor', () => {
    const on = (workspace: string, role: 'member' | 'lead' = 'member', roles: string[] = []) =>
      callerHeaders({ id: 'u-3', name: 'Jo', departments: [], roles, workspace: { id: workspace, kind: places[workspace].kind, role } });
    const onFloor = (workspace: string) => ({ ...platform, 'x-workspace-id': workspace });
    const entry = (action: string) => ({ actor: { id: 'u-1', kind: 'user' }, app: 'library', action, target: 'doc-7' });

    it('records the floor and its path on notifications and audit entries', async () => {
      const app = await buildApp({ verifyService, floors });
      await app.inject({ method: 'POST', url: '/v1/notifications', headers: onFloor('w-payroll'), payload: review });
      const [n] = (await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json();
      expect(n.workspace).toEqual({ id: 'w-payroll', path: ['w-org', 'w-finance', 'w-payroll'] });
      const audited = await app.inject({ method: 'POST', url: '/v1/audit', headers: onFloor('w-legal'), payload: entry('document.published') });
      expect(audited.json().workspace).toEqual({ id: 'w-legal', path: ['w-org', 'w-legal'] });
      expect((await app.inject({ method: 'POST', url: '/v1/audit', headers: onFloor('w-gone'), payload: entry('document.published') })).statusCode).toBe(400);
      // A floor id that won't URI-decode is an unknown floor, not a crash.
      expect((await app.inject({ method: 'POST', url: '/v1/audit', headers: onFloor('w-%E0%A4%A'), payload: entry('document.published') })).statusCode).toBe(400);
      const down = await buildApp({ verifyService, floors: async () => Promise.reject(new FloorsUnavailable('down')) });
      expect((await down.inject({ method: 'POST', url: '/v1/audit', headers: onFloor('w-legal'), payload: entry('document.published') })).statusCode).toBe(503);
    });

    it('filters the audit log to a floor and the floors below it', async () => {
      const app = await buildApp({ verifyService, floors });
      for (const [w, action] of [['w-finance', 'a.finance'], ['w-payroll', 'a.payroll'], ['w-legal', 'a.legal']]) {
        await app.inject({ method: 'POST', url: '/v1/audit', headers: onFloor(w), payload: entry(action) });
      }
      await app.inject({ method: 'POST', url: '/v1/audit', headers: platform, payload: entry('a.nowhere') });
      const actions = async (query: string, headers = alex) => (await app.inject({ method: 'GET', url: `/v1/audit${query}`, headers })).json().map((e: { action: string }) => e.action);
      expect(await actions('?workspace=w-finance')).toEqual(['a.payroll', 'a.finance']);
      expect(await actions('?workspace=w-org')).toEqual(['a.legal', 'a.payroll', 'a.finance']);
      expect(await actions('')).toEqual(['a.nowhere', 'a.legal', 'a.payroll', 'a.finance']);
      // A lead reads their own floor's log, and nothing wider.
      expect(await actions('?workspace=w-finance', on('w-finance', 'lead'))).toEqual(['a.payroll', 'a.finance']);
      expect((await app.inject({ method: 'GET', url: '/v1/audit?workspace=w-finance', headers: on('w-finance') })).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: '/v1/audit?workspace=w-org', headers: on('w-finance', 'lead') })).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: '/v1/audit', headers: on('w-finance', 'lead') })).statusCode).toBe(403);
    });

    it('sends team notices only to a team that turned them on, to who is on it now', async () => {
      let team = ['u-1', 'u-2'];
      const app = await buildApp({ verifyService, floors, members: async () => team });
      const notice = { ...review, recipients: [], toTeam: true };
      const send = (workspace: string) => app.inject({ method: 'POST', url: '/v1/notifications', headers: onFloor(workspace), payload: notice });
      expect((await send('w-finance')).statusCode).toBe(403);
      expect((await app.inject({ method: 'PUT', url: '/v1/team-notices/w-finance', headers: on('w-finance'), payload: { on: true } })).statusCode).toBe(403);
      expect((await app.inject({ method: 'PUT', url: '/v1/team-notices/w-finance', headers: on('w-finance', 'lead'), payload: { on: true } })).json()).toEqual({ workspace: 'w-finance', on: true });
      expect((await send('w-finance')).json()).toEqual({ sent: 2 });
      team = ['u-2'];
      expect((await send('w-finance')).json()).toEqual({ sent: 1 });
      expect((await send('w-org')).statusCode).toBe(400);
      expect((await app.inject({ method: 'POST', url: '/v1/notifications', headers: onFloor('w-finance'), payload: { ...notice, recipients: ['u-1'] } })).statusCode).toBe(400);
      expect((await app.inject({ method: 'GET', url: '/v1/team-notices/w-finance', headers: alex })).json().on).toBe(true);
      const log = (await app.inject({ method: 'GET', url: '/v1/audit?workspace=w-finance', headers: alex })).json();
      expect(log[0]).toMatchObject({ action: 'team-notices.on', actor: { id: 'u-3' }, workspace: { id: 'w-finance' } });
    });
  });

  describe('domain events', () => {
    const as = (app: string) => ({ authorization: `Bearer app-${app}` });
    // Folio may publish and follow; Notes may only follow; Board may do neither.
    const grants = async (app: string) =>
      app === 'folio' ? (['events:publish', 'events:subscribe'] as const) : app === 'notes' ? (['events:subscribe'] as const) : ([] as const);
    const published = (id: string, workspace?: string) => ({ topic: 'folio.document.published', id, payload: { document: id }, ...(workspace ? { workspace } : {}) });

    it('lets an app publish on its own topics, once per id, and others follow in order', async () => {
      const app = (open = await buildApp({ verifyService, grants, floors }));
      const publish = (headers: Record<string, string>, events: object[]) => app.inject({ method: 'POST', url: '/v1/domain-events', headers, payload: { events } });
      expect((await publish(as('folio'), [published('d1', 'w-finance'), published('d2')])).json()).toEqual({ added: 2, repeated: 0 });
      expect((await publish(as('folio'), [published('d1', 'w-finance')])).json()).toEqual({ added: 0, repeated: 1 });
      await publish(as('folio'), [{ topic: 'folio.document.withdrawn', id: 'w1', payload: { document: 'd1' } }]);

      const read = (query: string) => app.inject({ method: 'GET', url: `/v1/domain-events?${query}`, headers: as('notes') });
      const first = (await read('topics=folio.document.published&limit=1')).json();
      expect(first.events).toMatchObject([{ topic: 'folio.document.published', id: 'd1', publisher: 'folio', payload: { document: 'd1' }, workspace: { id: 'w-finance', path: ['w-org', 'w-finance'] } }]);
      const rest = (await read(`topics=folio.*&after=${first.next}`)).json();
      expect(rest.events.map((e: { id: string }) => e.id)).toEqual(['d2', 'w1']);
      expect((await read(`topics=folio.*&after=${rest.next}`)).json()).toEqual({ events: [], next: rest.next });
    });

    it('keeps each publisher to its own topics and scope', async () => {
      const app = (open = await buildApp({ verifyService, grants, floors }));
      const publish = (headers: Record<string, string>, events: object[]) => app.inject({ method: 'POST', url: '/v1/domain-events', headers, payload: { events } });
      const posing = await publish(as('notes'), [published('d1')]);
      expect([posing.statusCode, posing.json().message]).toEqual([403, 'notes can only send for itself, not for "folio".']);
      expect((await publish(as('board'), [{ topic: 'board.card.moved', id: 'c1', payload: {} }])).statusCode).toBe(403);
      expect((await publish(as('folio'), [{ topic: 'platform.person.disabled', id: 'p1', payload: {} }])).statusCode).toBe(403);
      expect((await publish(platform, [published('d1')])).statusCode).toBe(403);
      expect((await publish(as('folio'), [published('d1'), { topic: 'notes.x.y', id: 'n', payload: {} }])).statusCode).toBe(400);
      expect((await publish(as('folio'), [published('d1', 'w-nowhere')])).statusCode).toBe(400);
      expect((await publish(as('folio'), [{ ...published('d1'), payload: { text: 'x'.repeat(17_000) } }])).statusCode).toBe(400);
      expect((await publish(alex, [published('d1')])).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: '/v1/domain-events?topics=folio.*', headers: as('board') })).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: '/v1/domain-events?topics=folio.*', headers: alex })).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: '/v1/domain-events?topics=FOLIO', headers: as('notes') })).statusCode).toBe(400);
    });

    it('tells followers what identity and the registry change, as they record it', async () => {
      const app = (open = await buildApp({ verifyService, grants, floors }));
      const registry = await serviceHeaders({ name: 'registry', getToken: async () => 'platform-registry' });
      const audit = (headers: Record<string, string>, entry: object, workspace?: string) =>
        app.inject({ method: 'POST', url: '/v1/audit', headers: { ...headers, ...(workspace ? { 'x-workspace-id': workspace } : {}) }, payload: entry });
      await audit(platform, { actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.disabled', target: 'u-9' });
      await audit(platform, { actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'department.member-added', target: 'w-legal', detail: { person: 'u-2' } }, 'w-legal');
      await audit(platform, { actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.updated', target: 'u-9' });
      await audit(registry, { actor: { id: 'u-1', kind: 'user' }, app: 'registry', action: 'app.disabled', target: 'notes' });
      await audit(registry, { actor: { id: 'u-1', kind: 'user' }, app: 'registry', action: 'app.blocked', target: 'notes' }, 'w-legal');
      const { events } = (await app.inject({ method: 'GET', url: '/v1/domain-events?topics=platform.*', headers: as('notes') })).json();
      expect(events).toMatchObject([
        { topic: 'platform.person.disabled', publisher: 'identity', payload: { person: 'u-9' } },
        { topic: 'platform.team.member-added', payload: { team: 'w-legal', person: 'u-2' }, workspace: { id: 'w-legal' } },
        { topic: 'platform.app.turned-off', publisher: 'registry', payload: { app: 'notes' } },
        { topic: 'platform.app.blocked', payload: { app: 'notes' }, workspace: { id: 'w-legal' } },
      ]);
    });
  });
});
