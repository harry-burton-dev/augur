import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { callerHeaders, GATEWAY_CALLER, type NewAuditEntry } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { loadModel, OpenFga } from './openfga.ts';
import { MemorySessionStore, migrations, PgSessionStore } from './sessions.ts';

const model = loadModel();

/**
 * OpenFGA holding: Amara holds admin.amara (a deployment and org admin) and duty-planner (no admin); Sofia
 * holds admin.sofia, an org admin only.
 */
const held: Record<string, string[]> = { 'person:amara': ['persona:admin.amara', 'persona:duty-planner'], 'person:sofia': ['persona:admin.sofia'] };
const admins = new Set(['persona:admin.amara admin deployment:this', 'persona:admin.amara admin org:o-1', 'persona:admin.sofia admin org:o-1']);
const engine = new OpenFga({
  url: 'http://openfga:8080',
  fetchImpl: (async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const body = JSON.parse(String(init?.body ?? '{}')) as { user?: string; checks?: { tuple_key: { user: string; relation: string; object: string }; correlation_id: string }[] };
    if (path.endsWith('/list-objects')) return Response.json({ objects: held[body.user!] ?? [] });
    const result = Object.fromEntries((body.checks ?? []).map((c) => [c.correlation_id, { allowed: admins.has(`${c.tuple_key.user} ${c.tuple_key.relation} ${c.tuple_key.object}`) }]));
    return Response.json({ result });
  }) as typeof fetch,
});

let clock = new Date('2026-11-20T09:00:00Z');
const now = () => clock;
const minutesAgo = (n: number) => new Date(clock.getTime() - n * 60_000).toISOString();
const person = (id: string, signedInMinutesAgo = 1) => callerHeaders({ id, name: id, departments: [], roles: [], signedInAt: minutesAgo(signedInMinutesAgo) });

const start = async () => {
  const audited: NewAuditEntry[] = [];
  const sessions = new MemorySessionStore();
  const app = await buildApp({ engine, store: 'S', modelId: 'M', model, org: () => 'o-1', sessions, audit: async (e) => void audited.push(e), now });
  return { app, audited, sessions };
};

describe('persona sessions', () => {
  it('lists the personas someone holds, saying which need “Act as” and for how long at most', async () => {
    clock = new Date('2026-11-20T09:00:00Z');
    const { app } = await start();
    const res = await app.inject({ method: 'GET', url: '/v1/personas', headers: person('amara') });
    expect(res.json()).toEqual({
      personas: [
        { id: 'admin.amara', actAs: true, longestMinutes: 60 },
        { id: 'duty-planner', actAs: false },
      ],
    });
    expect((await app.inject({ method: 'GET', url: '/v1/personas', headers: person('sofia') })).json().personas).toEqual([{ id: 'admin.sofia', actAs: true, longestMinutes: 480 }]);
  });

  it('starts a session after a fresh sign-in, with a reason, up to the limit, and records it', async () => {
    clock = new Date('2026-11-20T09:00:00Z');
    const { app, audited } = await start();
    const res = await app.inject({ method: 'POST', url: '/v1/personas/admin.amara/sessions', headers: person('amara'), payload: { reason: 'Upgrade to 0.25', minutes: 600 } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ persona: 'admin.amara', reason: 'Upgrade to 0.25', startedAt: '2026-11-20T09:00:00.000Z', endsAt: '2026-11-20T10:00:00.000Z' });
    expect(audited).toEqual([
      {
        actor: { id: 'amara', kind: 'user' },
        app: 'permissions',
        action: 'persona.session-started',
        target: 'admin.amara',
        detail: { session: res.json().id, reason: 'Upgrade to 0.25', endsAt: '2026-11-20T10:00:00.000Z' },
      },
    ]);
    expect((await app.inject({ method: 'GET', url: '/v1/personas', headers: person('amara') })).json().session).toMatchObject({ persona: 'admin.amara' });
  });

  it('refuses a persona not held, one that needs no “Act as”, an old sign-in, and an app acting for the person', async () => {
    clock = new Date('2026-11-20T09:00:00Z');
    const { app, sessions } = await start();
    const post = (persona: string, headers: Record<string, string>) => app.inject({ method: 'POST', url: `/v1/personas/${persona}/sessions`, headers, payload: { reason: 'Checking' } });
    expect((await post('admin.sofia', person('amara'))).statusCode).toBe(403);
    expect((await post('duty-planner', person('amara'))).json()).toMatchObject({ error: 'not_admin' });
    const old = await post('admin.amara', person('amara', 20));
    expect(old.statusCode).toBe(403);
    expect(old.json()).toMatchObject({ error: 'sign_in_again' });
    const viaApp = callerHeaders({ id: 'amara', name: 'amara', departments: [], roles: [], signedInAt: minutesAgo(1), app: 'artifacts', scopes: [] });
    expect((await post('admin.amara', viaApp)).statusCode).toBe(403);
    expect(sessions.sessions).toEqual([]);
  });

  it('answers the gateway while a session is live, and not after it ends, is stopped, or another starts', async () => {
    clock = new Date('2026-11-20T09:00:00Z');
    const { app, audited } = await start();
    const live = (persona: string) => app.inject({ method: 'POST', url: '/access/v1/persona-session', headers: callerHeaders(GATEWAY_CALLER), payload: { person: 'amara', persona } }).then((r) => r.json());
    await app.inject({ method: 'POST', url: '/v1/personas/admin.amara/sessions', headers: person('amara'), payload: { reason: 'Upgrade', minutes: 30 } });
    expect(await live('admin.amara')).toEqual({ live: true, endsAt: '2026-11-20T09:30:00.000Z' });
    expect(await live('duty-planner')).toEqual({ live: false });
    clock = new Date('2026-11-20T09:31:00Z');
    expect(await live('admin.amara')).toEqual({ live: false });

    await app.inject({ method: 'POST', url: '/v1/personas/admin.amara/sessions', headers: person('amara'), payload: { reason: 'Again' } });
    expect((await app.inject({ method: 'DELETE', url: '/v1/personas/sessions/current', headers: person('amara') })).statusCode).toBe(204);
    expect(await live('admin.amara')).toEqual({ live: false });
    expect(audited.map((a) => a.action)).toEqual(['persona.session-started', 'persona.session-started', 'persona.session-ended']);
  });

  it('answers only the gateway and AUGUR’s services whether someone is acting as a persona', async () => {
    const { app } = await start();
    const res = await app.inject({ method: 'POST', url: '/access/v1/persona-session', headers: person('tomas'), payload: { person: 'amara', persona: 'admin.amara' } });
    expect(res.statusCode).toBe(403);
  });
});

const DATABASE_URL = process.env.DATABASE_URL;

describe.runIf(DATABASE_URL)('PgSessionStore', () => {
  let admin: pg.Pool;
  let store: PgSessionStore;
  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: DATABASE_URL });
    await admin.query('drop table if exists permissions.persona_sessions, permissions.roles, permissions.grants, permissions.migrations');
    store = await PgSessionStore.connect(DATABASE_URL!);
  });
  afterAll(async () => {
    await admin.end();
  });

  it('keeps one live session per person, ending the last when another starts', async () => {
    const at = new Date('2026-11-20T09:00:00Z');
    const first = await store.start({ person: 'amara', persona: 'admin.amara', reason: 'One', startedAt: at.toISOString(), endsAt: '2026-11-20T10:00:00.000Z' });
    expect(first.ended).toBeUndefined();
    const second = await store.start({ person: 'amara', persona: 'admin.amara', reason: 'Two', startedAt: '2026-11-20T09:10:00.000Z', endsAt: '2026-11-20T10:10:00.000Z' });
    expect(second.ended).toMatchObject({ id: first.started.id, endedAt: '2026-11-20T09:10:00.000Z' });
    expect(await store.live('amara', new Date('2026-11-20T09:20:00Z'))).toMatchObject({ id: second.started.id, reason: 'Two' });
    expect(await store.live('amara', new Date('2026-11-20T10:11:00Z'))).toBeUndefined();
    expect(await store.end('amara', new Date('2026-11-20T09:30:00Z'))).toMatchObject({ id: second.started.id });
    expect(await store.live('amara', new Date('2026-11-20T09:31:00Z'))).toBeUndefined();
    expect(migrations.map((m) => m.id)).toEqual(['001-persona-sessions', '002-roles-and-grants']);
  });
});
