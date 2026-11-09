// The seam's query reads over HTTP (dev plan, PR 3b): what is known by a key, what an extractor may be told,
// what links to an entity, what contradicts, what waits on you, summaries, a structured query, recall, and the
// two clocks. Each as the floors in sight know it, and what can't be opened from here never named.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';
import { as, client, type Client, ORG, own, people, report } from './http.testing.ts';
import { entityUuid } from './ids.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const { where, reset, standing } = people();

let act: Client['act'];
let get: Client['get'];
let post: (person: 'alice' | 'bob', url: string, floor: string, body: unknown) => ReturnType<Client['get']>;

/** A report of a ship arriving: the arrival is an occurrence with the ship as its participant. */
const arrival = (ref: string, label = `MV Kestrel ${ref}`) => {
  const r = report(ref, label);
  return {
    ...r,
    entities: [...r.entities, { ref: 'arr', label: `Arrival ${ref}`, class: 'kg:Arrival' }],
    observations: [...r.observations, { subject: 'arr', predicate: 'kg:hasParticipant', kind: 'link', object: 'ship', quote: 'the ship arrived', modality: 'reported' }],
  };
};
/** The same ship by its key and name, read again in another source with another capacity. */
const again = (ref: string, key: string, label: string, capacity: number, valid?: { validFrom: string; validTo: string }) => {
  const r = report(ref, label, capacity);
  return {
    ...r,
    entities: [{ ...r.entities[0]!, identityKeys: [{ scheme: 'imo', value: key }] }],
    observations: [{ ...r.observations[0]!, ...(valid ? { ...valid, validPrecision: 'day' } : {}) }],
  };
};

describe.skipIf(!DATABASE_URL)('the query reads over HTTP', () => {
  beforeAll(async () => {
    const c = await client({ store: db.app, standing, pageLimit: 3 });
    ({ act, get } = c);
    post = (person, url, floor, body) => c.app.inject({ method: 'POST', url, headers: { ...as(person, floor) }, payload: body as object });
  });
  beforeEach(async () => {
    reset();
    await db.empty();
  });

  it('looks a thing up by its key: in sight the entity, beside it only the kind of floor, and a personal floor’s not at all', async () => {
    const ship = (await act('alice', 'team-a', 'retain', report('L1', 'MV Lookup Secret'))).json().effects.entities[0];
    expect((await get('alice', '/v1/floors/team-a/lookup?scheme=imo&value=IMO-L1', 'team-a')).json()).toMatchObject({ id: ship, label: 'MV Lookup Secret' });
    const beside = await get('bob', '/v1/floors/team-b/lookup?scheme=imo&value=IMO-L1', 'team-b');
    expect(beside.json()).toEqual({ kind: 'entity', id: 'imo:IMO-L1', unseen: { reason: 'elsewhere', floorKind: 'team', message: expect.any(String) } });
    expect(beside.body).not.toMatch(/Secret|ent_/);
    await act('alice', own.alice, 'retain', report('L2'));
    expect((await get('bob', '/v1/floors/team-b/lookup?scheme=imo&value=IMO-L2', 'team-b')).statusCode).toBe(404);
    expect((await get('bob', '/v1/floors/team-b/lookup?scheme=imo&value=nothing', 'team-b')).statusCode).toBe(404);
  });

  it('tells an extractor what a text may be about, from the floors in sight only', async () => {
    for (const ref of ['K1', 'K2', 'K3', 'K4']) await act('alice', 'team-a', 'retain', report(ref, `MV Known ${ref}`));
    await act('alice', own.alice, 'retain', report('K5', 'MV Kestrel Private'));
    const text = 'The MV Known K2 berthed at noon. IMO-K3 is due tomorrow.';
    const found = (await get('alice', `/v1/floors/team-a/known-entities?text=${encodeURIComponent(text)}`, 'team-a')).json();
    // The key in the text first, then the name in it.
    expect(found.entities.map((e: { label: string }) => e.label).slice(0, 2)).toEqual(['MV Known K3', 'MV Known K2']);
    expect(found.entities.map((e: { label: string }) => e.label)).not.toContain('MV Kestrel Private');
    // Without a text, all of them, cut at the deployment's ceiling (3 here).
    expect((await get('alice', '/v1/floors/team-a/known-entities?limit=10', 'team-a')).json()).toMatchObject({ limitApplied: 3, entities: expect.any(Array) });
    expect((await get('bob', `/v1/floors/team-b/known-entities?text=${encodeURIComponent(text)}`, 'team-b')).json()).toEqual({ entities: [] });
  });

  it('gives what links to an entity, to the depth the deployment allows', async () => {
    const { effects } = (await act('alice', own.alice, 'retain', arrival('G1'))).json();
    const [ship, arr] = effects.entities;
    const g = (await get('alice', `/v1/floors/${own.alice}/entities/${ship}/subgraph`, own.alice)).json();
    expect(g.nodes.map((n: { id: string }) => n.id).sort()).toEqual([ship, arr].sort());
    expect(g.edges).toEqual([expect.objectContaining({ subject: arr, predicate: 'kg:hasParticipant', object: ship, kind: 'link' })]);
    expect(g.depthApplied).toBeUndefined();
    expect((await get('alice', `/v1/floors/${own.alice}/entities/${ship}/subgraph?depth=9`, own.alice)).json()).toMatchObject({ depthApplied: 3 });
    const none = (await get('alice', `/v1/floors/${own.alice}/entities/${ship}/subgraph?predicate=kg:locatedIn`, own.alice)).json();
    expect(none).toMatchObject({ nodes: [expect.objectContaining({ id: ship })], edges: [] });
    expect((await get('bob', `/v1/floors/${own.bob}/entities/${ship}/subgraph`, own.bob)).statusCode).toBe(404);
  });

  it('finds beliefs that contradict each other, and not across floors that can’t see each other', async () => {
    await act('alice', own.alice, 'retain', again('C1', 'IMO-C', 'MV Conflict', 1200));
    await act('alice', own.alice, 'retain', again('C2', 'IMO-C', 'MV Conflict', 1300));
    const list = (await get('alice', `/v1/floors/${own.alice}/conflicts`, own.alice)).json();
    expect(list).toMatchObject({ floor: own.alice, conflicts: [{ predicate: 'kg:capacity', beliefs: [expect.any(String), expect.any(String)] }], possibleDuplicates: [] });
    expect((await get('alice', '/v1/floors/team-a/conflicts', 'team-a')).json()).toEqual({ floor: 'team-a', conflicts: [], possibleDuplicates: [] });
  });

  it('says what waits on a floor for each person, what they can do, and why not', async () => {
    const { effects } = (await act('alice', 'team-a', 'retain', report('Q1'))).json();
    const obs = effects.observations[0];
    // The author can't confirm what was read from their own source; someone else on the floor can.
    expect((await get('alice', '/v1/floors/team-a/queue', 'team-a')).json()).toEqual({
      floor: 'team-a',
      items: [{ kind: 'to-confirm', id: obs, can: { confirm: false, why: expect.any(String), whoCanChange: expect.any(String) } }],
    });
    where.bob = { floors: [{ id: ORG, kind: 'org' }, { id: 'team-a', kind: 'team', parent: ORG }], memberOf: [ORG, 'team-a'] };
    expect((await get('bob', '/v1/floors/team-a/queue', 'team-a')).json().items).toEqual([{ kind: 'to-confirm', id: obs, can: { confirm: true } }]);
    expect((await act('bob', 'team-a', 'confirm-faithful', { observation: obs, verdict: 'faithful' })).statusCode).toBe(200);
    // Once faithful, it waits to be held, which needs the floor's settler.
    expect((await get('alice', '/v1/floors/team-a/queue', 'team-a')).json().items).toEqual([{ kind: 'to-hold', id: obs, can: { hold: false, why: expect.any(String), whoCanChange: expect.any(String) } }]);
    await db.admin.query(`insert into kg.floor_roles (floor, person, role) values ('team-a', 'alice', 'settler')`);
    expect((await get('alice', '/v1/floors/team-a/queue', 'team-a')).json().items).toEqual([{ kind: 'to-hold', id: obs, can: { hold: true } }]);
    const belief = (await act('alice', 'team-a', 'hold', { observations: [obs] })).json().effects.beliefs[0];
    // Bob disputes it (the dispute action comes in a later release; here the store does it as that will).
    const dispute = (await db.admin.query<{ id: string }>(`insert into kg.disputes (belief, floor, by_person, reason) values ($1, 'team-a', 'bob', 'wrong ship') returning id`, [belief])).rows[0]!.id;
    expect((await get('alice', '/v1/floors/team-a/queue', 'team-a')).json().items).toEqual([{ kind: 'to-settle', id: dispute, can: { settle: true, withdraw: false } }]);
    expect((await get('bob', '/v1/floors/team-a/queue', 'team-a')).json().items).toEqual([{ kind: 'to-settle', id: dispute, can: { settle: false, withdraw: true } }]);
    expect((await get('bob', '/v1/floors/team-a/queue', 'team-a')).body).not.toContain('wrong ship');

    // On your own floor, text that addressed the system waits for you to keep it.
    const mine = (await act('alice', own.alice, 'retain', report('Q2'))).json().effects.observations[0];
    await db.admin.query(`update kg.observations set flagged = true, flag_reason = 'addressed the system' where id = $1`, [mine]);
    expect((await get('alice', `/v1/floors/${own.alice}/queue`, own.alice)).json()).toMatchObject({ items: [{ kind: 'to-keep', id: mine, can: { keep: true } }] });
  });

  it('stacks the summaries in sight, says when one is older than its beliefs, and when there is none', async () => {
    const ship = (await act('alice', 'team-a', 'retain', again('S1', 'IMO-S', 'MV Summed', 1200))).json().effects.entities[0];
    // Read again on Alice's own floor, where it is memory: a belief the summaries can be older than.
    expect((await act('alice', own.alice, 'retain', again('S2', 'IMO-S', 'MV Summed', 1200))).json().effects.entities).toEqual([ship]);
    const url = `/v1/floors/${own.alice}/entities/${ship}/summary`;
    expect((await get('alice', url, own.alice)).json()).toEqual({ floor: own.alice, summaries: [{ entity: ship, floor: own.alice, state: 'none', why: expect.any(String) }] });
    const uuid = entityUuid(ship);
    await db.admin.query(`insert into kg.summaries (entity, floor, text, beliefs_as_of) values ($1, 'team-a', 'A container ship.', now()), ($1, 'org-1', 'A ship.', '2000-01-01')`, [uuid]);
    const { summaries } = (await get('alice', url, own.alice)).json();
    expect(summaries).toEqual([
      expect.objectContaining({ floor: 'team-a', state: 'current', text: 'A container ship.' }),
      expect.objectContaining({ floor: ORG, state: 'older-than-beliefs', why: expect.any(String) }),
    ]);
    // Bob's team sees only the org's.
    expect((await get('bob', `/v1/floors/team-b/entities/${ship}/summary`, 'team-b')).statusCode).toBe(404);
  });

  it('answers a structured query on two clocks, with the beliefs that made each entity fit', async () => {
    const before = new Date().toISOString();
    const { effects } = (await act('alice', own.alice, 'retain', again('Y1', 'IMO-Y1', 'MV Query One', 1200, { validFrom: '2026-01-01T00:00:00Z', validTo: '2026-06-01T00:00:00Z' }))).json();
    await act('alice', own.alice, 'retain', again('Y2', 'IMO-Y2', 'MV Query Two', 900));
    const q = (body: unknown) => post('alice', `/v1/floors/${own.alice}/query`, own.alice, body);
    const fits = (await q({ class: 'Vehicle', where: [{ predicate: 'kg:capacity', equals: { v: 1200, unit: 'TEU' } }] })).json();
    expect(fits.entities.map((e: { id: string }) => e.id)).toEqual([effects.entities[0]]);
    expect(fits.beliefs).toEqual([expect.objectContaining({ subject: effects.entities[0], value: { v: 1200, unit: 'TEU' } })]);
    // On the valid clock: so in March, not in August.
    expect((await q({ where: [{ predicate: 'kg:capacity', equals: { v: 1200 } }], at: '2026-03-01T00:00:00Z' })).json().entities).toHaveLength(1);
    expect((await q({ where: [{ predicate: 'kg:capacity', equals: { v: 1200 } }], at: '2026-08-01T00:00:00Z' })).json().entities).toHaveLength(0);
    // On the recorded clock: before it was retained, nobody knew.
    expect((await q({ where: [{ predicate: 'kg:capacity' }], known: before })).json().entities).toHaveLength(0);
    expect((await q({ text: 'query' })).json().entities).toHaveLength(2);
    expect((await q({ class: 'kg:Starship' })).statusCode).toBe(422);
    expect((await q({ where: [{ predicate: 'kg:hasParticipant', object: 'not-an-id' }] })).statusCode).toBe(422);
    expect((await q({ limit: 50 })).json()).toMatchObject({ limitApplied: 3 });
  });

  it('reads an entity’s beliefs as known at a moment and as so at a moment', async () => {
    const before = new Date().toISOString();
    const { effects } = (await act('alice', own.alice, 'retain', again('T1', 'IMO-T1', 'MV Clock', 1200, { validFrom: '2026-01-01T00:00:00Z', validTo: '2026-06-01T00:00:00Z' }))).json();
    const url = `/v1/floors/${own.alice}/entities/${effects.entities[0]}/beliefs`;
    expect((await get('alice', url, own.alice)).json().beliefs).toHaveLength(1);
    expect((await get('alice', `${url}?known=${before}`, own.alice)).json()).toMatchObject({ known: before, beliefs: [] });
    expect((await get('alice', `${url}?at=2026-03-01T00:00:00Z`, own.alice)).json().beliefs).toHaveLength(1);
    expect((await get('alice', `${url}?at=2026-07-01T00:00:00Z`, own.alice)).json().beliefs).toHaveLength(0);
  });

  it('recalls what a text is about and what links to it, says why each hit matched and what it ran without', async () => {
    const { effects } = (await act('alice', own.alice, 'retain', arrival('R1', 'MV Recall Dawn'))).json();
    const r = (body: unknown) => post('alice', `/v1/floors/${own.alice}/recall`, own.alice, body);
    const res = (await r({ text: 'When did MV Recall Dawn arrive?' })).json();
    expect(res.ranWithout).toEqual(['semantic']);
    expect(res.hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ belief: expect.objectContaining({ subject: effects.entities[0], predicate: 'kg:capacity' }), why: ['text'] }),
        expect.objectContaining({ belief: expect.objectContaining({ subject: effects.entities[1], object: effects.entities[0] }), why: ['link'] }),
      ]),
    );
    const cut = (await r({ text: 'MV Recall Dawn', tokenBudget: 10 })).json();
    expect(cut).toMatchObject({ hits: [], cutAt: 0 });
    expect((await post('bob', `/v1/floors/${own.bob}/recall`, own.bob, { text: 'MV Recall Dawn' })).json().hits).toEqual([]);
  });
});
