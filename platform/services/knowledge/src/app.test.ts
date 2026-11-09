// The walking skeleton over HTTP (PR 2 of the dev plan): a person signed in through the gateway retains a
// source on their floor and reads the belief back, and the fence holds at the seam as it does in the store.
// Each person's standing comes from a stand-in for identity. The service's pool is kg_app, signed in with
// its own password, as on a deployment.
import type { FastifyInstance } from 'fastify';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';
import { as, client, type Client, key, ORG, own, people, report } from './http.testing.ts';
import { entityId } from './ids.ts';
import { outboxRelay } from './outbox.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const { where, state, reset, standing } = people();

let app: FastifyInstance;
let act: Client['act'];
let get: Client['get'];

describe.skipIf(!DATABASE_URL)('the knowledge service over HTTP', () => {
  beforeAll(async () => {
    ({ app, act, get } = await client({ store: db.app, standing }));
  });
  beforeEach(async () => {
    reset();
    await db.empty();
  });

  it('retains a report on your own floor and reads the belief back, as memory', async () => {
    const res = await act('alice', own.alice, 'retain', report('R1'));
    expect(res.statusCode, res.body).toBe(200);
    const { effects, actionId } = res.json();
    expect(actionId).toMatch(/^run_[0-9A-Z]{26}$/);
    expect(effects).toMatchObject({ sources: [expect.any(String)], entities: [expect.stringMatching(/^ent_[0-9A-Z]{26}$/)], observations: [expect.any(String)], beliefs: [expect.any(String)] });
    const ship = effects.entities[0];

    const entity = await get('alice', `/v1/floors/${own.alice}/entities/${ship}`, own.alice);
    expect(entity.json()).toEqual({ id: ship, class: 'kg:Ship', kind: 'continuant', state: 'active', label: 'MV Kestrel Dawn', labelFrom: own.alice, aliases: [] });

    const beliefs = await get('alice', `/v1/floors/${own.alice}/entities/${ship}/beliefs`, own.alice);
    expect(beliefs.statusCode).toBe(200);
    expect(beliefs.json().beliefs).toEqual([
      expect.objectContaining({
        id: effects.beliefs[0],
        homeFloor: own.alice,
        reach: [own.alice],
        subject: ship,
        predicate: 'kg:capacity',
        kind: 'property',
        value: { v: 1200, unit: 'TEU' },
        state: 'memory',
        evidence: { observations: 1, sources: 1, unseen: 0, byFloor: [{ floor: own.alice, floorKind: 'personal', observations: 1 }] },
      }),
    ]);
  });

  it('answers a repeat with the first answer, and refuses the same key for another body', async () => {
    const k = key();
    const first = await act('alice', own.alice, 'retain', report('R2'), { k });
    const again = await act('alice', own.alice, 'retain', report('R2'), { k });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual({ ...first.json(), replayed: true });
    const { rows } = await db.admin.query('select count(*)::int as n from kg.sources');
    expect(rows[0].n).toBe(1);

    const other = await act('alice', own.alice, 'retain', report('R3'), { k });
    expect(other.statusCode).toBe(409);
    expect(other.json()).toMatchObject({ reason: 'idempotency_key_reused', status: 409 });
    expect(other.headers['content-type']).toMatch(/application\/problem\+json/);
    // A key is the person's own: someone else may use the same one.
    expect((await act('bob', own.bob, 'retain', report('R3'), { k })).statusCode).toBe(200);
  });

  it('says what is wrong: no key, no such action, an input that does not fit', async () => {
    const noKey = await app.inject({ method: 'POST', url: '/v1/actions/retain', headers: as('alice', own.alice), payload: report('R4') });
    expect(noKey.json()).toMatchObject({ status: 400, reason: 'idempotency_key_required' });
    const unknown = await act('alice', own.alice, 'teleport', {});
    expect(unknown.json()).toMatchObject({ status: 404, reason: 'unknown_action', problems: ['retain', 'hold', 'keep', 'confirm-faithful'] });
    const bad = await act('alice', own.alice, 'retain', { ...report('R4'), confidence: 0.9 });
    expect(bad.json()).toMatchObject({ status: 422, reason: 'invalid_input', problems: expect.arrayContaining([expect.stringMatching(/additional properties/)]) });
    const dangling = await act('alice', own.alice, 'retain', { ...report('R4'), observations: [{ ...report('R4').observations[0], subject: 'nobody' }] });
    expect(dangling.json()).toMatchObject({ status: 422, problems: [expect.stringContaining('"nobody"')] });
    const unseenClass = await act('alice', own.alice, 'retain', { ...report('R4'), entities: [{ ...report('R4').entities[0], class: 'kg:Starship' }] });
    expect(unseenClass.json()).toMatchObject({ status: 403, reason: 'not_allowed', why: expect.stringMatching(/class is not accepted/) });
  });

  it('takes a dry run and keeps nothing, and says why one would be refused', async () => {
    const dry = await act('alice', own.alice, 'retain', report('R5'), { dryRun: true });
    expect(dry.json()).toMatchObject({ action: 'retain', dryRun: true, wouldSucceed: true, effects: { observations: [expect.any(String)] } });
    const { rows } = await db.admin.query('select (select count(*) from kg.sources)::int as sources, (select count(*) from kg.outbox)::int as events, (select count(*) from kg.action_answers)::int as answers');
    expect(rows[0]).toEqual({ sources: 0, events: 0, answers: 0 });

    // On a team floor that holds by role, a claim isn't held just because it was retained.
    const kept = await act('alice', 'team-a', 'retain', report('R6'));
    const refused = await act('alice', 'team-a', 'hold', { observations: kept.json().effects.observations }, { dryRun: true });
    expect(refused.json()).toMatchObject({ dryRun: true, wouldSucceed: false, why: expect.any(String) });
  });

  it('never shows one floor what is below or beside it (XF-01 over HTTP)', async () => {
    const mine = (await act('alice', own.alice, 'retain', report('R7', 'MV Private Note'))).json().effects.entities[0];
    // Bob can't stand on Alice's floor, and from his own the entity isn't there to know about.
    expect((await get('bob', `/v1/floors/${own.alice}/entities/${mine}`, own.bob)).json()).toMatchObject({ status: 403, reason: 'not_on_floor' });
    const fromBob = await get('bob', `/v1/floors/${own.bob}/entities/${mine}`, own.bob);
    expect(fromBob.statusCode).toBe(404);
    expect(fromBob.body).not.toContain('Private');
    // Nor from Alice's own team: a team never sees its members' own floors.
    expect((await get('alice', `/v1/floors/team-a/entities/${mine}`, 'team-a')).statusCode).toBe(404);
  });

  it('says a team’s entity exists without naming it to a team beside it, and names it to the team’s members (XF-03 over HTTP)', async () => {
    const ship = (await act('alice', 'team-a', 'retain', report('R8', 'MV Team Secret'))).json().effects.entities[0];
    const fromB = await get('bob', `/v1/floors/team-b/entities/${ship}`, 'team-b');
    expect(fromB.json()).toEqual({ kind: 'entity', id: ship, unseen: { reason: 'elsewhere', floorKind: 'team', message: expect.any(String) } });
    expect(fromB.body).not.toContain('Secret');
    // From the org (above both teams) it isn't seen either: a floor sees up, never down.
    expect((await get('alice', `/v1/floors/${ORG}/entities/${ship}`, ORG)).json()).toMatchObject({ unseen: { floorKind: 'team' } });
    // Alice's own floor sees the teams she is on.
    expect((await get('alice', `/v1/floors/${own.alice}/entities/${ship}`, own.alice)).json()).toMatchObject({ label: 'MV Team Secret', labelFrom: 'team-a' });
  });

  it('follows identity: off a team, off its floor', async () => {
    expect((await act('alice', 'team-a', 'retain', report('R9'))).statusCode).toBe(200);
    where.alice = { floors: [{ id: ORG, kind: 'org' }], memberOf: [ORG] };
    expect((await act('alice', 'team-a', 'retain', report('R10'))).json()).toMatchObject({ status: 403, reason: 'not_on_floor' });
    state.identityDown = true;
    expect((await act('alice', own.alice, 'retain', report('R10'))).json()).toMatchObject({ status: 503, reason: 'unavailable' });
  });

  it('lists the floors you can stand on, what each sees and how it holds', async () => {
    const res = await get('alice', '/v1/floors', own.alice);
    expect(res.json().floors).toEqual([
      { id: own.alice, kind: 'personal', parent: null, sight: expect.arrayContaining([own.alice, 'team-a', ORG]), trust: { hold: 'memory' } },
      { id: ORG, kind: 'org', parent: null, sight: [ORG], trust: { hold: 'role' } },
      { id: 'team-a', kind: 'team', parent: ORG, sight: expect.arrayContaining(['team-a', ORG]), trust: { hold: 'role' } },
    ]);
    // Before Alice has stood on her own floor, the service doesn't know which one it is.
    expect((await get('bob', '/v1/floors')).json().floors.map((f: { id: string }) => f.id)).toEqual([ORG, 'team-b']);
  });

  it('refuses an app for now, and anyone not signed in', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/actions/retain', headers: { ...as('alice', own.alice, { app: 'notes' }), 'idempotency-key': key() }, payload: report('R11') })).json()).toMatchObject({ status: 403, reason: 'not_allowed' });
    expect((await app.inject({ method: 'GET', url: '/v1/floors' })).statusCode).toBe(401);
  });

  it('serves its catalogue and versions', async () => {
    const catalogue = (await app.inject({ url: '/v1/actions' })).json();
    expect(catalogue.actions.map((a: { name: string }) => a.name)).toEqual(['retain', 'hold', 'keep', 'confirm-faithful']);
    expect(catalogue.actions[0].input).toMatchObject({ type: 'object', required: expect.arrayContaining(['source', 'entities', 'observations']) });
    expect((await app.inject({ url: '/v1/meta' })).json()).toMatchObject({ apiMajor: 1, ontology: { version: '1' }, speaks: { knowledge: [1] } });
  });

  it('sends what the outbox holds as AUGUR’s own events, ids only, and a personal floor’s with nothing but the floor', async () => {
    await act('alice', own.alice, 'retain', report('R12'));
    await act('alice', 'team-a', 'retain', report('R13'));
    const sent: { topic: string; id: string; payload: Record<string, unknown>; workspace?: string }[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent.push(...(JSON.parse(String(init.body)).events as typeof sent));
      return new Response(JSON.stringify({ accepted: 1 }), { status: 202, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const relay = outboxRelay({ pool: db.app, eventsUrl: 'http://events', credentials: { name: 'knowledge', getToken: async () => 't' }, fetchImpl });
    expect(await relay.flush()).toBeGreaterThan(0);
    expect(await relay.flush()).toBe(0);
    expect(new Set(sent.map((e) => e.topic))).toEqual(new Set(['platform.knowledge.entity.created', 'platform.knowledge.observation.retained']));
    for (const e of sent.filter((e) => e.workspace === own.alice)) expect(e.payload).toEqual({ floor: own.alice });
    expect(sent.filter((e) => e.workspace === 'team-a').every((e) => Object.keys(e.payload).every((k) => ['floor', 'entity', 'observation'].includes(k)))).toBe(true);
  });

  it('writes entity ids as ent_ and a ULID that maps back to the store’s uuid', () => {
    expect(entityId('01890a5d-ac96-774b-bcce-b302099a8057')).toMatch(/^ent_[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
