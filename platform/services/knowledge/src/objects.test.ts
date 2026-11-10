// The seam's object reads over HTTP (dev plan, PR 3): each object as the floors in sight know it, and for what
// can't be opened from here, an Unseen that names the kind of floor and never a label.
import type { FastifyInstance } from 'fastify';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';
import { as, client, type Client, ORG, own, people, report } from './http.testing.ts';
import { instant } from './objects.ts';
import { BASE_CLASSES } from './profile.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const { reset, standing } = people();

let app: FastifyInstance;
let act: Client['act'];
let get: Client['get'];

/** A report of a ship arriving: the arrival is an occurrence with the ship as its participant. */
const arrival = (ref: string) => ({
  ...report(ref, `MV Kestrel ${ref}`),
  entities: [...report(ref, `MV Kestrel ${ref}`).entities, { ref: 'arr', label: `Arrival ${ref}`, class: 'kg:Arrival' }],
  observations: [
    ...report(ref, `MV Kestrel ${ref}`).observations,
    { subject: 'arr', predicate: 'kg:hasParticipant', kind: 'link', object: 'ship', quote: 'the ship arrived', modality: 'reported' },
  ],
});

describe.skipIf(!DATABASE_URL)('the object reads over HTTP', () => {
  beforeAll(async () => {
    ({ app, act, get } = await client({ store: db.app, standing, pageLimit: 3 }));
  });
  beforeEach(async () => {
    reset();
    await db.empty();
  });

  it('reads an observation back with its source, and a source with what was read from it', async () => {
    const { effects } = (await act('alice', 'team-a', 'retain', report('O1'))).json();
    const obs = await get('alice', `/v1/floors/team-a/observations/${effects.observations[0]}`, 'team-a');
    expect(obs.statusCode, obs.body).toBe(200);
    expect(obs.json()).toMatchObject({
      id: effects.observations[0],
      floor: 'team-a',
      source: { id: effects.sources[0], app: 'notes', ref: 'O1', version: '1', title: 'Report O1', floor: 'team-a', author: 'alice' },
      subject: effects.entities[0],
      predicate: 'kg:capacity',
      kind: 'property',
      value: { v: 1200, unit: 'TEU' },
      quote: 'capacity 1200 TEU',
      modality: 'reported',
      validPrecision: 'unknown',
      // On a team floor that holds by role, a retained claim waits to be confirmed.
      state: 'proposed',
      extractor: 'test',
      // The base profile and the first adopt pass's seven predicates.
      ontologyVersion: '8',
    });
    const source = await get('alice', `/v1/floors/team-a/sources/${effects.sources[0]}`, 'team-a');
    expect(source.json()).toMatchObject({ id: effects.sources[0], title: 'Report O1', extraction: { observations: 1, flagged: 0 } });
  });

  it('says a team’s observation and source exist to a team beside it without what they say (XF-03)', async () => {
    const { effects } = (await act('alice', 'team-a', 'retain', report('O2', 'MV Hidden Name'))).json();
    for (const [kind, id] of [['observations', effects.observations[0]], ['sources', effects.sources[0]]]) {
      const res = await get('bob', `/v1/floors/team-b/${kind}/${id}`, 'team-b');
      expect(res.json()).toEqual({ kind: kind.slice(0, -1), id, unseen: { reason: 'elsewhere', floorKind: 'team', message: expect.any(String) } });
      expect(res.body).not.toMatch(/Hidden|O2|capacity/);
    }
    // What is on a personal floor isn't even said to exist (XF-01).
    const mine = (await act('alice', own.alice, 'retain', report('O3'))).json().effects;
    expect((await get('bob', `/v1/floors/team-b/observations/${mine.observations[0]}`, 'team-b')).statusCode).toBe(404);
    expect((await get('alice', `/v1/floors/team-a/sources/${mine.sources[0]}`, 'team-a')).statusCode).toBe(404);
    expect((await get('alice', '/v1/floors/team-a/observations/not-a-uuid', 'team-a')).statusCode).toBe(404);
  });

  it('reads one belief whatever became of it, and an observation once forgotten says only that', async () => {
    const { effects } = (await act('alice', own.alice, 'retain', report('O4'))).json();
    const belief = await get('alice', `/v1/floors/${own.alice}/beliefs/${effects.beliefs[0]}`, own.alice);
    expect(belief.json()).toMatchObject({ id: effects.beliefs[0], subject: effects.entities[0], state: 'memory', disputes: [], evidence: { observations: 1 } });
    // Forgetting comes with its action in a later release; here the store does it as that action will.
    await db.admin.query(`update kg.observations set forgotten_at = now(), value = null, quote = '' where id = $1`, [effects.observations[0]]);
    expect((await get('alice', `/v1/floors/${own.alice}/beliefs/${effects.beliefs[0]}`, own.alice)).json()).toMatchObject({ state: 'fallen' });
    expect((await get('alice', `/v1/floors/${own.alice}/observations/${effects.observations[0]}`, own.alice)).json()).toEqual({
      kind: 'observation',
      id: effects.observations[0],
      unseen: { reason: 'forgotten', floorKind: 'personal', message: expect.any(String) },
    });
    // A team never reads its members' own beliefs.
    expect((await get('alice', `/v1/floors/team-a/beliefs/${effects.beliefs[0]}`, 'team-a')).statusCode).toBe(404);
  });

  it('pages through the entities in sight, by class, kind and text, within the deployment’s ceiling', async () => {
    for (const ref of ['P1', 'P2', 'P3', 'P4']) await act('alice', 'team-a', 'retain', arrival(ref));
    const ships = await get('alice', '/v1/floors/team-a/entities?class=kg:Vehicle&limit=2', 'team-a');
    expect(ships.statusCode, ships.body).toBe(200);
    const first = ships.json();
    expect(first.entities).toHaveLength(2);
    expect(first.entities.every((e: { class: string }) => e.class === 'kg:Ship')).toBe(true);
    const rest = (await get('alice', `/v1/floors/team-a/entities?class=Vehicle&cursor=${first.next}`, 'team-a')).json();
    expect(rest.entities.map((e: { id: string }) => e.id)).not.toContain(first.entities[0].id);
    expect(rest.next).toBeUndefined();
    // One word of the four ships' names finds them all, and the ceiling (3 here) cuts the page.
    const named = (await get('alice', '/v1/floors/team-a/entities?text=kestrel&limit=50', 'team-a')).json();
    expect(named).toMatchObject({ limitApplied: 3, next: expect.any(String) });
    expect(named.entities).toHaveLength(3);
    const events = (await get('alice', '/v1/floors/team-a/entities?kind=occurrent', 'team-a')).json();
    expect(events.entities.every((e: { kind: string }) => e.kind === 'occurrent')).toBe(true);
    // Bob's team sees none of them.
    expect((await get('bob', '/v1/floors/team-b/entities', 'team-b')).json().entities).toEqual([]);
    expect((await get('alice', '/v1/floors/team-a/entities?cursor=nonsense', 'team-a')).statusCode).toBe(422);
  });

  it('lists the occurrences an entity took part in', async () => {
    const { effects } = (await act('alice', own.alice, 'retain', arrival('E1'))).json();
    const [ship, arr] = effects.entities;
    const res = await get('alice', `/v1/floors/${own.alice}/entities/${ship}/events`, own.alice);
    expect(res.json().entities).toEqual([expect.objectContaining({ id: arr, class: 'kg:Arrival', kind: 'occurrent', label: 'Arrival E1' })]);
    expect(ship).not.toBe(arr);
  });

  it('gives your own action records, and nobody else’s', async () => {
    const { actionId, effects } = (await act('alice', own.alice, 'retain', report('A1'))).json();
    const run = await get('alice', `/v1/actions/runs/${actionId}`, own.alice);
    expect(run.json()).toEqual({ actionId, action: 'retain', by: 'alice', at: expect.any(String), effects, undone: false });
    expect((await get('bob', `/v1/actions/runs/${actionId}`, own.bob)).statusCode).toBe(404);
    expect((await app.inject({ url: '/v1/actions/hold' })).json()).toMatchObject({ name: 'hold', scope: 'knowledge:act' });
    expect((await app.inject({ url: '/v1/actions/teleport' })).json()).toMatchObject({ status: 404, reason: 'unknown_action' });
  });

  it('serves the ontology, its classes and shapes to anyone signed in, and candidates from sources in sight', async () => {
    const onto = await app.inject({ url: '/v1/ontology', headers: as('alice') });
    expect(onto.json()).toMatchObject({ version: '8', classes: expect.arrayContaining([expect.objectContaining({ iri: 'kg:Arrival', kind: 'occurrent', status: 'base', parent: 'kg:Act' })]) });
    expect(onto.json().predicates).toEqual(expect.arrayContaining([expect.objectContaining({ iri: 'kg:capacity', kind: 'property', datatype: 'quantity', singleValued: true })]));
    // The contract's BaseClass, which the client types, is the base profile as the store has it.
    expect(onto.json().classes.filter((c: { status: string }) => c.status === 'base').map((c: { iri: string }) => c.iri).sort()).toEqual([...BASE_CLASSES].sort());
    expect((await app.inject({ url: '/v1/ontology/classes/kg:Ship', headers: as('alice') })).json()).toMatchObject({ iri: 'kg:Ship', label: 'Ship' });
    expect((await app.inject({ url: '/v1/ontology/classes/ship', headers: as('alice') })).json()).toMatchObject({ iri: 'kg:Ship' });
    expect((await app.inject({ url: '/v1/ontology/classes/kg:Starship', headers: as('alice') })).statusCode).toBe(404);
    const shapes = await app.inject({ url: '/v1/ontology/shapes', headers: as('alice') });
    expect(shapes.headers['content-type']).toMatch(/text\/turtle/);
    expect(shapes.body).toContain('sh:NodeShape');
    expect((await app.inject({ url: '/v1/ontology' })).statusCode).toBe(401);

    const { effects } = (await act('alice', 'team-a', 'retain', report('C1'))).json();
    await db.admin.query(`insert into kg.candidates (term, kind, why, asked_by, first_source) values ('Tug', 'class', 'a kind of ship', 2, $1)`, [effects.sources[0]]);
    expect((await get('alice', '/v1/ontology/candidates', 'team-a')).json()).toEqual({ candidates: [{ term: 'Tug', kind: 'class', why: 'a kind of ship', askedBy: 2, status: 'proposed' }] });
    expect((await get('bob', '/v1/ontology/candidates', 'team-b')).json()).toEqual({ candidates: [] });
    expect((await get('alice', '/v1/ontology/candidates', ORG)).json()).toEqual({ candidates: [] });
  });
});

describe('a clock’s moment', () => {
  it('reaches Postgres in UTC, and before year 1 as the start of time', () => {
    expect(instant('0359-02-20T16:48:07.4688+19:49')).toBe('0359-02-19T20:59:07.468Z');
    expect(instant('2026-11-09T12:00:00+01:00')).toBe('2026-11-09T11:00:00.000Z');
    expect(instant('0000-06-01T00:00:00Z')).toBe('-infinity');
  });
});
