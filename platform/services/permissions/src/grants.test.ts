import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import Fastify from 'fastify';
import { callerHeaders, problemDetails, type NewAuditEntry } from '@augur/service-kit';
import { cascade, grantRoutes, keyOf, MemoryGrantStore, PgGrantStore, type GrantEngine } from './grants.ts';
import type { CheckKey } from './openfga.ts';

/**
 * OpenFGA as the routes see it: the rights each subject holds (`user relation object`), and every write. A
 * right can be taken away mid-test, as identity's copy would when someone leaves a floor.
 */
const fakeEngine = (rights: string[]) => {
  const held = new Set(rights);
  const written: CheckKey[] = [];
  const deleted: CheckKey[] = [];
  const engine: GrantEngine = {
    check: async (k) => held.has(`${k.user} ${k.relation} ${k.object}`),
    write: async (w, d) => {
      written.push(...w);
      deleted.push(...d);
    },
  };
  return { engine, held, written, deleted };
};

const at = new Date('2026-11-20T09:00:00Z');
const now = () => at;
const person = (id: string, persona?: string) => callerHeaders({ id, name: id, departments: [], roles: [], ...(persona ? { persona } : {}) });

const start = async (rights: string[]) => {
  const fake = fakeEngine(rights);
  const grants = new MemoryGrantStore();
  const audited: NewAuditEntry[] = [];
  const app = Fastify();
  await app.register(problemDetails());
  await app.register(grantRoutes({ grants, engine: fake.engine, org: () => 'o-1', audit: async (e) => void audited.push(e), now }));
  return { app, grants, audited, ...fake };
};

describe('roles made in AUGUR', () => {
  it('lets a floor’s manager make a role for it, and nobody else', async () => {
    const { app, written, audited } = await start(['person:amara can_create_role floor:operations', 'person:amara can_see floor:operations']);
    const made = await app.inject({ method: 'POST', url: '/v1/roles', headers: person('amara'), payload: { name: 'Duty planner', scope: { type: 'floor', id: 'operations' } } });
    expect(made.statusCode).toBe(201);
    const role = made.json();
    expect(role).toMatchObject({ name: 'Duty planner', scope: 'floor:operations', madeBy: 'amara' });
    expect(written).toEqual([{ user: 'floor:operations', relation: 'scope', object: `role:${role.id}` }]);
    expect(audited[0]).toMatchObject({ action: 'role.created', target: `role:${role.id}` });
    const refused = await app.inject({ method: 'POST', url: '/v1/roles', headers: person('priya'), payload: { name: 'Mine', scope: { type: 'floor', id: 'operations' } } });
    expect(refused.statusCode).toBe(403);
    const listed = await app.inject({ method: 'GET', url: '/v1/roles?scope=floor:operations', headers: person('amara') });
    expect(listed.json().roles.map((r: { name: string }) => r.name)).toEqual(['Duty planner']);
  });

  it('makes an org role only as an org admin persona, never as the person', async () => {
    const { app } = await start(['persona:admin.sofia can_create_role org:o-1']);
    const body = { name: 'Records officer', scope: { type: 'org', id: 'this' } };
    expect((await app.inject({ method: 'POST', url: '/v1/roles', headers: person('sofia'), payload: body })).statusCode).toBe(403);
    const asPersona = await app.inject({ method: 'POST', url: '/v1/roles', headers: person('sofia', 'admin.sofia'), payload: body });
    expect(asPersona.statusCode).toBe(201);
    expect(asPersona.json()).toMatchObject({ scope: 'org:o-1', madeBy: 'sofia', madeAs: 'admin.sofia' });
  });
});

describe('giving a role', () => {
  const made = async (rights: string[]) => {
    const s = await start(['person:amara can_create_role floor:operations', 'person:amara can_see floor:operations', ...rights]);
    const role = (await s.app.inject({ method: 'POST', url: '/v1/roles', headers: person('amara'), payload: { name: 'Duty planner', scope: { type: 'floor', id: 'operations' } } })).json() as { id: string };
    s.held.add(`person:amara can_assign role:${role.id}`);
    s.written.length = 0;
    return { ...s, role };
  };

  it('puts a person or a position in it, until a time if given, with the reason in the ledger', async () => {
    const { app, role, written, grants } = await made([]);
    const until = await app.inject({ method: 'POST', url: `/v1/roles/${role.id}/holders`, headers: person('amara'), payload: { to: { type: 'person', id: 'priya' }, reason: 'Covering nights', expiresAt: '2026-12-01T00:00:00Z' } });
    expect(until.statusCode).toBe(201);
    expect(until.json()).toMatchObject({ subject: 'person:priya', relation: 'assignee', object: `role:${role.id}`, reason: 'Covering nights', expiresAt: '2026-12-01T00:00:00.000Z' });
    const position = await app.inject({ method: 'POST', url: `/v1/roles/${role.id}/holders`, headers: person('amara'), payload: { to: { type: 'position', id: 'berth-planner' }, reason: 'The job needs it' } });
    expect(position.statusCode).toBe(201);
    expect(written).toEqual([
      { user: 'person:priya', relation: 'assignee', object: `role:${role.id}`, condition: { name: 'not_expired', context: { grant_expires: '2026-12-01T00:00:00.000Z' } } },
      { user: 'persona:berth-planner#holder', relation: 'assignee', object: `role:${role.id}` },
    ]);
    expect((await grants.live(at)).map((g) => g.needs)).toEqual([`can_assign role:${role.id}`, `can_assign role:${role.id}`]);
    const shown = (await app.inject({ method: 'GET', url: `/v1/roles/${role.id}`, headers: person('amara') })).json();
    expect(shown.holders.map((h: { subject: string }) => h.subject)).toEqual(['person:priya', 'persona:berth-planner#holder']);
  });

  it('refuses someone who can’t give it, a time already past, and an end on a whole floor', async () => {
    const { app, role } = await made([]);
    const post = (headers: Record<string, string>, payload: Record<string, unknown>) => app.inject({ method: 'POST', url: `/v1/roles/${role.id}/holders`, headers, payload });
    expect((await post(person('tomas'), { to: { type: 'person', id: 'tomas' }, reason: 'Please' })).statusCode).toBe(403);
    expect((await post(person('amara'), { to: { type: 'person', id: 'priya' }, reason: 'Late', expiresAt: '2026-11-01T00:00:00Z' })).statusCode).toBe(400);
    expect((await post(person('amara'), { to: { type: 'floor', id: 'fleet' }, reason: 'All of them', expiresAt: '2026-12-01T00:00:00Z' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/v1/roles/nope/holders', headers: person('amara'), payload: { to: { type: 'person', id: 'priya' }, reason: 'Gone' } })).statusCode).toBe(404);
  });

  it('gives the role’s holders only what the giver could give, where they manage it, and never admin', async () => {
    const { app, role, written } = await made(['person:amara can_manage_members floor:operations']);
    const settles = await app.inject({ method: 'POST', url: `/v1/roles/${role.id}/gives`, headers: person('amara'), payload: { relation: 'settler', on: { type: 'floor', id: 'operations' }, reason: 'Night disputes' } });
    expect(settles.statusCode).toBe(201);
    expect(written).toEqual([{ user: `role:${role.id}#assignee`, relation: 'settler', object: 'floor:operations' }]);
    const elsewhere = await app.inject({ method: 'POST', url: `/v1/roles/${role.id}/gives`, headers: person('amara'), payload: { relation: 'settler', on: { type: 'floor', id: 'fleet' }, reason: 'Fleet too' } });
    expect(elsewhere.statusCode).toBe(403);
    const admin = await app.inject({ method: 'POST', url: `/v1/roles/${role.id}/gives`, headers: person('amara'), payload: { relation: 'admin', on: { type: 'org', id: 'this' }, reason: 'Backdoor' } });
    expect(admin.statusCode).toBe(400);
  });
});

describe('taking a grant back', () => {
  it('lets the giver, or anyone who could give it now, take it back, and refuses everyone else', async () => {
    const { app, grants, deleted, audited } = await start([]);
    const g = await grants.addGrant({ giver: 'amara', subject: 'person:priya', relation: 'assignee', object: 'role:r-1', needs: 'can_assign role:r-1', reason: 'Nights', madeAt: at.toISOString() });
    const url = `/v1/grants/${g.id}`;
    expect((await app.inject({ method: 'DELETE', url, headers: person('tomas') })).statusCode).toBe(403);
    // Amara can no longer give it, but it was hers: she may still take it back.
    const back = await app.inject({ method: 'DELETE', url: `${url}?reason=${encodeURIComponent('Nights are covered')}`, headers: person('amara') });
    expect(back.statusCode).toBe(204);
    expect(deleted).toEqual([keyOf(g)]);
    expect(await grants.live(at)).toEqual([]);
    expect(audited.map((a) => a.action)).toEqual(['grant.revoked']);
    expect((await app.inject({ method: 'DELETE', url, headers: person('amara') })).statusCode).toBe(404);
  });
});

describe('the cascade', () => {
  it('takes back what someone gave once they can no longer give it, and only that', async () => {
    const { grants, engine, held, deleted } = await start(['person:amara can_assign role:r-1', 'persona:admin.sofia can_assign role:r-2']);
    const kept = await grants.addGrant({ giver: 'sofia', giverAs: 'admin.sofia', subject: 'person:mei', relation: 'assignee', object: 'role:r-2', needs: 'can_assign role:r-2', reason: 'Audit', madeAt: at.toISOString() });
    const gone = await grants.addGrant({ giver: 'amara', subject: 'person:priya', relation: 'assignee', object: 'role:r-1', needs: 'can_assign role:r-1', reason: 'Nights', madeAt: at.toISOString() });
    const audited: NewAuditEntry[] = [];
    expect(await cascade({ grants, engine, audit: async (e) => void audited.push(e), now })).toEqual([]);
    // Amara leaves Operations: identity's copy takes away what let her give the role.
    held.delete('person:amara can_assign role:r-1');
    const revoked = await cascade({ grants, engine, audit: async (e) => void audited.push(e), now });
    expect(revoked.map((g) => g.id)).toEqual([gone.id]);
    expect(deleted).toEqual([keyOf(gone)]);
    expect((await grants.live(at)).map((g) => g.id)).toEqual([kept.id]);
    expect(audited[0]).toMatchObject({ action: 'grant.revoked', detail: { cascade: true, grant: gone.id } });
  });
});

const DATABASE_URL = process.env.DATABASE_URL;

describe.runIf(DATABASE_URL)('PgGrantStore', () => {
  let admin: pg.Pool;
  let store: PgGrantStore;
  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: DATABASE_URL });
    await admin.query('drop table if exists permissions.persona_sessions, permissions.roles, permissions.grants, permissions.migrations');
    store = await PgGrantStore.connect(DATABASE_URL!);
  });
  afterAll(async () => {
    await admin.end();
  });

  it('keeps roles by scope, and grants until they end or are taken back', async () => {
    const role = await store.addRole({ name: 'Duty planner', scope: 'floor:operations', madeBy: 'amara', madeAt: at.toISOString() });
    expect(await store.role(role.id)).toEqual(role);
    expect((await store.roles('floor:operations')).map((r) => r.name)).toEqual(['Duty planner']);
    const object = `role:${role.id}`;
    const until = await store.addGrant({ giver: 'amara', subject: 'person:priya', relation: 'assignee', object, needs: `can_assign ${object}`, reason: 'Nights', madeAt: at.toISOString(), expiresAt: '2026-12-01T00:00:00.000Z' });
    const kept = await store.addGrant({ giver: 'sofia', giverAs: 'admin.sofia', subject: 'persona:berth-planner#holder', relation: 'assignee', object, needs: `can_assign ${object}`, reason: 'The job', madeAt: at.toISOString() });
    expect((await store.live(at, object)).map((g) => g.id)).toEqual([until.id, kept.id]);
    expect((await store.live(new Date('2026-12-02T00:00:00Z'))).map((g) => g.id)).toEqual([kept.id]);
    expect(await store.revoke(kept.id, 'amara', 'Covered', at)).toMatchObject({ revokedBy: 'amara', revokeReason: 'Covered', giverAs: 'admin.sofia' });
    expect(await store.revoke(kept.id, 'amara', 'Again', at)).toBeUndefined();
    expect((await store.live(at)).map((g) => g.id)).toEqual([until.id]);
  });
});
