import { afterEach, describe, expect, it } from 'vitest';
import { callerHeaders, FloorsUnavailable, GrantsUnavailable, serviceHeaders, type FloorPlace } from '@augur/service-kit';
import type { buildApp } from './app.ts';
import { DATABASE_URL, eventsDb } from './db.testing.ts';

const db = eventsDb();

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

describe.runIf(DATABASE_URL)('events', () => {
  it('reports healthy', async () => {
    const app = await db.app();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.json()).toMatchObject({ status: 'ok', service: 'events', version: expect.stringMatching(/^\d+\.\d+\.\d+/), api: 'v1' });
  });

  it('lets a service notify people, who each see only their own', async () => {
    const app = await db.app({ verifyService });
    const sent = await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: review });
    expect([sent.statusCode, sent.json()]).toEqual([202, { sent: 2 }]);
    const mine = (await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json();
    expect(mine).toMatchObject([{ app: 'library', level: 'needs', title: 'Review the budget paper', link: '/doc/7' }]);
    expect(mine[0].recipient).toBeUndefined();
  });

  it('turns away notifications from anyone but a service, and ones it cannot use', async () => {
    const app = await db.app({ verifyService });
    const post = (headers: Record<string, string>, payload: object) => app.inject({ method: 'POST', url: '/v1/notifications', headers, payload });
    expect((await post(alex, review)).statusCode).toBe(403);
    expect((await post(platform, { ...review, level: 'urgent' })).statusCode).toBe(400);
    expect((await post(platform, { ...review, recipients: [] })).statusCode).toBe(400);
    expect((await post(platform, { ...review, link: 'https://elsewhere.example' })).statusCode).toBe(400);
  });

  it('takes urgent news only from AUGUR’s own services, and says it is urgent', async () => {
    const app = await db.app({ verifyService, grants: async () => ['notifications:send'] });
    const urgent = { ...review, urgent: true };
    expect((await app.inject({ method: 'POST', url: '/v1/notifications', headers: { authorization: 'Bearer app-library' }, payload: urgent })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: urgent })).statusCode).toBe(202);
    const mine = (await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json();
    expect(mine).toMatchObject([{ title: 'Review the budget paper', urgent: true }]);
  });

  it('lets a platform service tell an audience, such as everyone holding a role, worked out as it sends', async () => {
    let holders = ['u-1'];
    const app = await db.app({ verifyService, audience: async (principals) => (principals.includes('role:deployment-admin') ? holders : []) });
    const upgraded = { app: 'upgrades', recipients: [], audience: ['role:deployment-admin'], level: 'done', title: 'AUGUR 0.15.0 is installed', link: '/augur' };
    expect((await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: upgraded })).json()).toEqual({ sent: 1 });
    holders = ['u-1', 'u-2'];
    expect((await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: { ...upgraded, title: 'Folio 1.4.0 is installed' } })).json()).toEqual({ sent: 2 });
    // One of recipients, team or audience; and an app names the people it means.
    expect((await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: { ...upgraded, recipients: ['u-2'] } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: { ...upgraded, audience: ['admins'] } })).statusCode).toBe(400);
    const asApp = { authorization: 'Bearer app-upgrades' };
    const app2 = await db.app({ verifyService, grants: async () => ['notifications:send'], audience: async () => ['u-1'] });
    expect((await app2.inject({ method: 'POST', url: '/v1/notifications', headers: asApp, payload: upgraded })).statusCode).toBe(403);
    // Identity out of reach: nobody is told, and the sender hears why.
    const app3 = await db.app({ verifyService });
    expect((await app3.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: upgraded })).statusCode).toBe(503);
    await Promise.all([app2.close(), app3.close()]);
  });

  it('tells each person a keyed piece of news once, even after they read it', async () => {
    const app = await db.app({ verifyService });
    const available = { ...review, app: 'upgrades', level: 'info', title: 'AUGUR 0.15.0 is ready', key: 'available:augur:0.15.0' };
    const send = (payload: object) => app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload });
    expect((await send({ ...available, recipients: ['u-1'] })).json()).toEqual({ sent: 1 });
    const [mine] = (await app.inject({ method: 'GET', url: '/v1/notifications', headers: alex })).json();
    expect(mine.key).toBeUndefined();
    await app.inject({ method: 'POST', url: `/v1/notifications/${mine.id}/read`, headers: alex });
    // Alex already had it; Sam is told for the first time.
    expect((await send(available)).json()).toEqual({ sent: 1 });
    expect((await send({ ...available, key: 'available:augur:0.15.1' })).json()).toEqual({ sent: 2 });
  });

  it('keeps the kind of a notification, refusing one the app doesn’t declare', async () => {
    const declared: Record<string, string[] | undefined> = { library: ['comment'] };
    const app = await db.app({ verifyService, notificationKinds: async (id) => declared[id] });
    const post = (payload: object) => app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload });
    expect((await post({ ...review, kind: 'comment' })).statusCode).toBe(202);
    const [n] = (await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json();
    expect(n.kind).toBe('comment');
    const refused = await post({ ...review, kind: 'gossip' });
    expect([refused.statusCode, refused.json().message]).toEqual([400, expect.stringContaining('notifications.kinds')]);
    expect((await post({ ...review, kind: 'Not A Kind' })).statusCode).toBe(400);
    // A registry too old to say lets any kind through.
    declared.library = undefined;
    expect((await post({ ...review, kind: 'gossip' })).statusCode).toBe(202);
  });

  it('gives identity, and only identity, what it keeps about one person', async () => {
    const app = await db.app({ verifyService });
    await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: review });
    await app.inject({ method: 'POST', url: '/v1/audit', headers: platform, payload: { actor: { id: 'u-2', kind: 'user' }, app: 'identity', action: 'account.updated' } });
    const res = await app.inject({ method: 'GET', url: '/v1/people/u-2/data', headers: platform });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.notifications).toMatchObject([{ title: 'Review the budget paper' }]);
    expect(data.notifications[0].recipient).toBeUndefined();
    expect(data.audit).toMatchObject([{ action: 'account.updated' }]);
    expect(data.inbox).toEqual([]);
    const registry = await serviceHeaders({ name: 'registry', getToken: async () => 'platform-registry' });
    expect((await app.inject({ method: 'GET', url: '/v1/people/u-2/data', headers: registry })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/v1/people/u-2/data', headers: sam })).statusCode).toBe(403);
  });

  it('carries up to two actions, each an intent with a small payload', async () => {
    const app = await db.app({ verifyService });
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
    const app = await db.app({ verifyService });
    await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: review });
    const [n] = (await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json();
    expect((await app.inject({ method: 'POST', url: `/v1/notifications/${n.id}/read`, headers: sam })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json()).toEqual([]);
    expect((await app.inject({ method: 'DELETE', url: `/v1/notifications/${n.id}/read`, headers: sam })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json()).toHaveLength(1);
  });

  it('never lets someone touch another person’s notification', async () => {
    const app = await db.app({ verifyService });
    await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: { ...review, recipients: ['u-1'] } });
    const [n] = (await app.inject({ method: 'GET', url: '/v1/notifications', headers: alex })).json();
    expect((await app.inject({ method: 'POST', url: `/v1/notifications/${n.id}/read`, headers: sam })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/v1/notifications' })).statusCode).toBe(401);
  });

  it('streams each new notification to its recipient as it happens', async () => {
    const app = (open = await db.app({ verifyService, heartbeatMs: 50 }));
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
    const app = await db.app({ verifyService });
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

  it('filters Activity by target, person and kind', async () => {
    const app = (open = await db.app({ verifyService }));
    const write = (payload: object) => app.inject({ method: 'POST', url: '/v1/audit', headers: platform, payload });
    await write({ actor: { id: 'u-2', kind: 'user' }, app: 'library', action: 'document.published', target: 'doc-7' });
    await write({ actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.disabled', target: 'u-2' });
    await write({ actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'team.member-added', target: 'w-finance', detail: { person: 'u-2' } });
    await write({ actor: { id: 'u-3', kind: 'user' }, app: 'identity', action: 'sign-in.succeeded', detail: { kind: 'sign-in', ip: '10.0.0.1' } });
    const actions = async (query: string) => (await app.inject({ method: 'GET', url: `/v1/audit?${query}`, headers: alex })).json().map((e: { action: string }) => e.action);
    expect(await actions('target=doc-7')).toEqual(['document.published']);
    expect(await actions('person=u-2')).toEqual(['team.member-added', 'person.disabled', 'document.published']);
    expect(await actions('kind=sign-in')).toEqual(['sign-in.succeeded']);
    expect(await actions('kind=change&person=u-1')).toEqual(['team.member-added', 'person.disabled']);
    expect((await app.inject({ method: 'GET', url: '/v1/audit?kind=other', headers: alex })).statusCode).toBe(400);
  });

  it('lets an admin download Activity as CSV or JSON lines, and records the download', async () => {
    const app = (open = await db.app({ verifyService }));
    await app.inject({ method: 'POST', url: '/v1/audit', headers: platform, payload: { actor: { id: 'u-2', kind: 'user' }, app: 'library', action: 'document.published', target: '=HYPERLINK("x")', detail: { title: 'Q3' } } });
    expect((await app.inject({ method: 'GET', url: '/v1/audit/export', headers: sam })).statusCode).toBe(403);
    const csv = await app.inject({ method: 'GET', url: '/v1/audit/export?app=library&since=2026-01-01T00:00:00Z&until=2026-12-31T00:00:00Z', headers: alex });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-disposition']).toBe('attachment; filename="activity-2026-01-01-2026-12-31.csv"');
    const [head, row, ...rest] = csv.body.trimEnd().split('\n');
    expect(head).toBe('at,actor,actorKind,app,action,target,floor,detail');
    // A cell a spreadsheet would run as a formula is kept as text; quotes inside are doubled.
    expect(row).toMatch(/,"u-2","user","library","document\.published","'=HYPERLINK\(""x""\)","","\{""title"":""Q3""\}"$/);
    expect(rest).toEqual([]);
    const jsonl = await app.inject({ method: 'GET', url: '/v1/audit/export?format=jsonl&app=library', headers: alex });
    expect(jsonl.body.trimEnd().split('\n').map((l) => JSON.parse(l).action)).toEqual(['document.published']);
    const tooLong = await app.inject({ method: 'GET', url: '/v1/audit/export?since=2024-01-01T00:00:00Z&until=2026-01-01T00:00:00Z', headers: alex });
    expect([tooLong.statusCode, tooLong.json().error]).toEqual([400, 'range_too_long']);
    const recorded = (await app.inject({ method: 'GET', url: '/v1/audit?app=events', headers: alex })).json();
    expect(recorded).toMatchObject([
      { action: 'audit.exported', actor: { id: 'u-1', kind: 'user' }, detail: { app: 'library', format: 'jsonl' } },
      { action: 'audit.exported', detail: { app: 'library', format: 'csv', since: '2026-01-01T00:00:00.000Z' } },
    ]);
  });

  it('lets identity, and only identity, remove a deleted person’s details', async () => {
    const app = (open = await db.app({ verifyService }));
    await app.inject({ method: 'POST', url: '/v1/notifications', headers: platform, payload: review });
    const write = (payload: object) => app.inject({ method: 'POST', url: '/v1/audit', headers: platform, payload });
    await write({ actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.updated', target: 'u-2', detail: { email: { from: 'sam@old.example', to: 'sam@new.example' }, roles: ['editor'] } });
    await write({ actor: { id: 'u-2', kind: 'user' }, app: 'identity', action: 'sign-in.succeeded', detail: { kind: 'sign-in', ip: '10.0.0.2', username: 'sam' } });
    await write({ actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.updated', target: 'u-3', detail: { email: 'kim@example.org' } });
    const registry = await serviceHeaders({ name: 'registry', getToken: async () => 'platform-registry' });
    for (const headers of [registry, alex]) expect((await app.inject({ method: 'POST', url: '/v1/audit/redact', headers, payload: { person: 'u-2' } })).statusCode).toBe(403);
    const res = await app.inject({ method: 'POST', url: '/v1/audit/redact', headers: platform, payload: { person: 'u-2' } });
    expect(res.json()).toEqual({ entries: 2, notifications: 1 });
    const log = (await app.inject({ method: 'GET', url: '/v1/audit', headers: alex })).json();
    expect(log[0]).toMatchObject({ action: 'audit.redacted', app: 'events', detail: { person: 'u-2', entries: 2 } });
    expect(log[1].detail).toEqual({ email: 'kim@example.org' });
    expect(log[2].detail).toEqual({ kind: 'sign-in', ip: '[removed]', username: '[removed]' });
    expect(log[3].detail).toEqual({ email: { from: '[removed]', to: '[removed]' }, roles: ['editor'] });
    expect((await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json()).toEqual([]);
    expect((await app.inject({ method: 'GET', url: '/v1/notifications', headers: alex })).json()).toHaveLength(1);
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
      const app = await db.app({ verifyService, grants, floors });
      const post = (headers: Record<string, string>, payload: object) => app.inject({ method: 'POST', url: '/v1/notifications', headers, payload });
      expect((await post(as('library', 'w-me'), review)).statusCode).toBe(202);
      expect(asked.at(-1)).toEqual(['library', 'w-me']);
      const posing = await post(as('board'), review);
      expect([posing.statusCode, posing.json().message]).toEqual([403, 'board can only send for itself, not for "library".']);
      const ungranted = await post(as('board'), { ...review, app: 'board' });
      expect([ungranted.statusCode, ungranted.json().message]).toEqual([403, 'board isn’t granted notifications:send.']);
    });

    it('checks the scope on the floor the call names', async () => {
      const app = await db.app({ verifyService, grants, floors });
      const entry = { actor: { id: 'u-1', kind: 'user' }, app: 'library', action: 'document.published', target: 'doc-7' };
      expect((await app.inject({ method: 'POST', url: '/v1/audit', headers: as('library', 'w-finance'), payload: entry })).statusCode).toBe(201);
      const elsewhere = await app.inject({ method: 'POST', url: '/v1/audit', headers: as('library', 'w-legal'), payload: entry });
      expect([elsewhere.statusCode, elsewhere.json().message]).toEqual([403, 'library isn’t granted audit:write on that floor.']);
    });

    it('records which service wrote an entry, whoever it names as the actor', async () => {
      const app = await db.app({ verifyService, grants, floors });
      const entry = { actor: { id: 'admin-1', kind: 'user' }, app: 'library', action: 'document.deleted', target: 'doc-7' };
      const written = await app.inject({ method: 'POST', url: '/v1/audit', headers: as('library', 'w-finance'), payload: entry });
      expect(written.json()).toMatchObject({ actor: { id: 'admin-1' }, recordedBy: 'library' });
      const byPlatform = await app.inject({ method: 'POST', url: '/v1/audit', headers: platform, payload: { ...entry, app: 'identity' } });
      expect(byPlatform.json().recordedBy).toBe('identity');
    });

    it('refuses for now when what an app may do can’t be checked', async () => {
      const app = await db.app({ verifyService, grants: async () => Promise.reject(new GrantsUnavailable('down')) });
      expect((await app.inject({ method: 'POST', url: '/v1/notifications', headers: as('library'), payload: review })).statusCode).toBe(503);
      const unchecked = await db.app({ verifyService });
      expect((await unchecked.inject({ method: 'POST', url: '/v1/notifications', headers: as('library'), payload: review })).statusCode).toBe(503);
    });
  });

  describe('floor by floor', () => {
    const on = (workspace: string, role: 'member' | 'lead' = 'member', roles: string[] = []) =>
      callerHeaders({ id: 'u-3', name: 'Jo', departments: [], roles, workspace: { id: workspace, kind: places[workspace].kind, role } });
    const onFloor = (workspace: string) => ({ ...platform, 'x-workspace-id': workspace });
    const entry = (action: string) => ({ actor: { id: 'u-1', kind: 'user' }, app: 'library', action, target: 'doc-7' });

    it('records the floor and its path on notifications and audit entries', async () => {
      const app = await db.app({ verifyService, floors });
      await app.inject({ method: 'POST', url: '/v1/notifications', headers: onFloor('w-payroll'), payload: review });
      const [n] = (await app.inject({ method: 'GET', url: '/v1/notifications', headers: sam })).json();
      expect(n.workspace).toEqual({ id: 'w-payroll', path: ['w-org', 'w-finance', 'w-payroll'] });
      const audited = await app.inject({ method: 'POST', url: '/v1/audit', headers: onFloor('w-legal'), payload: entry('document.published') });
      expect(audited.json().workspace).toEqual({ id: 'w-legal', path: ['w-org', 'w-legal'] });
      expect((await app.inject({ method: 'POST', url: '/v1/audit', headers: onFloor('w-gone'), payload: entry('document.published') })).statusCode).toBe(400);
      // A floor id that won't URI-decode is an unknown floor, not a crash.
      expect((await app.inject({ method: 'POST', url: '/v1/audit', headers: onFloor('w-%E0%A4%A'), payload: entry('document.published') })).statusCode).toBe(400);
      const down = await db.app({ verifyService, floors: async () => Promise.reject(new FloorsUnavailable('down')) });
      expect((await down.inject({ method: 'POST', url: '/v1/audit', headers: onFloor('w-legal'), payload: entry('document.published') })).statusCode).toBe(503);
    });

    it('filters the audit log to a floor and the floors below it', async () => {
      const app = await db.app({ verifyService, floors });
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
      const app = await db.app({ verifyService, floors, members: async () => team });
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
      const app = (open = await db.app({ verifyService, grants, floors }));
      const publish = (headers: Record<string, string>, events: object[]) => app.inject({ method: 'POST', url: '/v1/domain-events', headers, payload: { events } });
      expect((await publish(as('folio'), [published('d1', 'w-finance'), published('d2')])).json()).toEqual({ added: 2, repeated: 0 });
      expect((await publish(as('folio'), [published('d1', 'w-finance')])).json()).toEqual({ added: 0, repeated: 1 });
      await publish(as('folio'), [{ topic: 'folio.document.withdrawn', id: 'w1', payload: { document: 'd1' } }]);

      const read = (query: string) => app.inject({ method: 'GET', url: `/v1/domain-events?${query}`, headers: as('notes') });
      // Followers see an event once every earlier transaction on the database has settled.
      await expect.poll(async () => (await read('topics=folio.*')).json().events.length).toBe(3);
      const first = (await read('topics=folio.document.published&limit=1')).json();
      expect(first.events).toMatchObject([{ topic: 'folio.document.published', id: 'd1', publisher: 'folio', payload: { document: 'd1' }, workspace: { id: 'w-finance', path: ['w-org', 'w-finance'] } }]);
      const rest = (await read(`topics=folio.*&after=${first.next}`)).json();
      expect(rest.events.map((e: { id: string }) => e.id)).toEqual(['d2', 'w1']);
      expect((await read(`topics=folio.*&after=${rest.next}`)).json()).toEqual({ events: [], next: rest.next });
    });

    it('keeps each publisher to its own topics and scope', async () => {
      const app = (open = await db.app({ verifyService, grants, floors }));
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
      const app = (open = await db.app({ verifyService, grants, floors }));
      const registry = await serviceHeaders({ name: 'registry', getToken: async () => 'platform-registry' });
      const audit = (headers: Record<string, string>, entry: object, workspace?: string) =>
        app.inject({ method: 'POST', url: '/v1/audit', headers: { ...headers, ...(workspace ? { 'x-workspace-id': workspace } : {}) }, payload: entry });
      await audit(platform, { actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.disabled', target: 'u-9' });
      await audit(platform, { actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'department.member-added', target: 'w-legal', detail: { person: 'u-2' } }, 'w-legal');
      await audit(platform, { actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.updated', target: 'u-9', detail: { username: 'jo', firstName: { from: 'Jo', to: 'Joanne' }, lastName: { from: 'S', to: 'T' }, departments: { from: [], to: ['w-legal'] } } });
      await audit(platform, { actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.password-reset', target: 'u-9' });
      // A leaver, handed over and not: who takes on their things, never the admin's note.
      await audit(platform, { actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.left', target: 'u-9', detail: { username: 'jo', asked: true, handOverTo: 'u-2', note: 'Agreed' } });
      await audit(platform, { actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'person.left', target: 'u-8', detail: { username: 'al', asked: false } });
      await audit(registry, { actor: { id: 'u-1', kind: 'user' }, app: 'registry', action: 'app.disabled', target: 'notes' });
      await audit(registry, { actor: { id: 'u-1', kind: 'user' }, app: 'registry', action: 'app.blocked', target: 'notes' }, 'w-legal');
      // Followers see an event once every earlier transaction on the database has settled.
      await expect.poll(async () => (await app.inject({ method: 'GET', url: '/v1/domain-events?topics=platform.*', headers: as('notes') })).json().events).toMatchObject([
        { topic: 'platform.person.disabled', publisher: 'identity', payload: { person: 'u-9' } },
        { topic: 'platform.team.member-added', payload: { team: 'w-legal', person: 'u-2' }, workspace: { id: 'w-legal' } },
        // What changed, never the values: a follower asks identity for those.
        { topic: 'platform.person.changed', publisher: 'identity', payload: { person: 'u-9', changed: ['name', 'teams'] } },
        { topic: 'platform.person.left', publisher: 'identity', payload: { person: 'u-9', handOverTo: 'u-2' } },
        { topic: 'platform.person.left', publisher: 'identity', payload: { person: 'u-8' } },
        { topic: 'platform.app.turned-off', publisher: 'registry', payload: { app: 'notes' } },
        { topic: 'platform.app.blocked', payload: { app: 'notes' }, workspace: { id: 'w-legal' } },
      ]);
    });

    it('streams the events on the person’s floor and topics to their browser, as they’re published', async () => {
      const app = (open = await db.app({ verifyService, grants, floors, heartbeatMs: 50 }));
      const url = await app.listen({ port: 0, host: '127.0.0.1' });
      const onFinance = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'], workspace: { id: 'w-finance', kind: 'team', role: 'member' } });
      const controller = new AbortController();
      const res = await fetch(`${url}/v1/domain-events/stream?topics=folio.document.*,platform.team.renamed`, { headers: onFinance, signal: controller.signal });
      expect(res.headers.get('content-type')).toBe('text/event-stream');
      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      expect((await reader.read()).value).toContain(': connected');

      const publish = (events: object[]) => app.inject({ method: 'POST', url: '/v1/domain-events', headers: as('folio'), payload: { events } });
      // Another floor, no floor, a topic not asked for: none of them reach Sam.
      await publish([published('legal', 'w-legal'), published('nowhere'), published('payroll', 'w-payroll')]);
      await publish([{ topic: 'folio.library.renamed', id: 'l1', payload: {}, workspace: 'w-finance' }]);
      await publish([published('d7', 'w-finance')]);
      let text = '';
      while (!text.includes('event: domain-event')) text += (await reader.read()).value;
      const data = text.split('\n').find((l) => l.startsWith('data: '))!;
      expect(JSON.parse(data.slice(6))).toMatchObject({ topic: 'folio.document.published', id: 'd7', publisher: 'folio', payload: { document: 'd7' }, workspace: { id: 'w-finance' } });
      expect(text).not.toMatch(/legal|nowhere|payroll|l1/);
      controller.abort();
    });

    it('opens a browser stream only for someone signed in, on a floor, following real topics', async () => {
      const app = (open = await db.app({ verifyService, grants, floors }));
      const onFinance = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'], workspace: { id: 'w-finance', kind: 'team', role: 'member' } });
      const stream = (headers: Record<string, string>, topics: string) => app.inject({ method: 'GET', url: `/v1/domain-events/stream?topics=${encodeURIComponent(topics)}`, headers });
      expect((await stream({}, 'folio.*')).statusCode).toBe(401);
      expect((await stream(sam, 'folio.*')).json().message).toContain('X-Workspace-Id');
      expect((await stream(onFinance, 'folio.*,FOLIO')).statusCode).toBe(400);
      expect((await stream(onFinance, Array.from({ length: 101 }, (_, i) => `a${i}.x`).join(','))).statusCode).toBe(400);
    });
  });
});
