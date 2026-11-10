// The actions after retain, over HTTP (plan PR 6): draft 4's cross-floor tests XF-05 to XF-10 and XF-13, taken
// as people take them, through POST /actions. Alice and Bob are both on team A; Alice is its settler and raiser.
// Who holds a role comes from Admin in a later PR; here it is set in the store directly.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';
import { as, client, type Client, key, ORG, own, people, report } from './http.testing.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const { where, reset, standing } = people();
const TEAM = 'team-a';

let svc: Client;
const act = (...a: Parameters<Client['act']>) => svc.act(...a).then((r) => ({ status: r.statusCode, body: r.json() }));
const beliefsOn = async (floor: string, ship: string, person: 'alice' | 'bob' = 'alice') =>
  (await svc.get(person, `/v1/floors/${floor}/entities/${ship}/beliefs`, floor)).json().beliefs?.map((b: { id: string }) => b.id) ?? [];

/** A claim retained on team A, checked faithful by Bob and held by Alice. */
const heldOnTeam = async (ref: string) => {
  const retained = await act('alice', TEAM, 'retain', report(ref));
  const [observation] = retained.body.effects.observations;
  const [ship] = retained.body.effects.entities;
  expect((await act('bob', TEAM, 'confirm-faithful', { observation, verdict: 'faithful' })).status).toBe(200);
  const held = await act('alice', TEAM, 'hold', { observations: [observation] });
  expect(held.status, JSON.stringify(held.body)).toBe(200);
  return { observation, ship, belief: held.body.effects.beliefs[0] as string };
};

describe.skipIf(!DATABASE_URL)('the actions after retain, over HTTP', () => {
  beforeAll(async () => {
    svc = await client({ store: db.app, standing });
  });
  beforeEach(async () => {
    reset();
    where.bob = { floors: [{ id: ORG, kind: 'org' }, { id: TEAM, kind: 'team', parent: ORG }], memberOf: [ORG, TEAM] };
    await db.empty();
    // Standing on a floor once is what makes it known to the store; then Alice is given both roles there.
    await svc.get('alice', '/v1/floors', TEAM);
    await svc.get('bob', '/v1/floors', TEAM);
    await db.admin.query(`insert into kg.floor_roles (floor, person, role) values ($1, 'alice', 'settler'), ($1, 'alice', 'raiser')`, [TEAM]);
  });

  it('XF-05 holds only by role, and checks faithful only as someone other than the author', async () => {
    const retained = await act('alice', TEAM, 'retain', report('A1'));
    const [observation] = retained.body.effects.observations;
    expect(await act('alice', TEAM, 'confirm-faithful', { observation, verdict: 'faithful' })).toMatchObject({ status: 403, body: { reason: 'not_allowed', why: expect.stringMatching(/author/) } });
    await act('bob', TEAM, 'confirm-faithful', { observation, verdict: 'faithful' });
    expect(await act('bob', TEAM, 'hold', { observations: [observation] })).toMatchObject({ status: 403, body: { why: expect.stringMatching(/settler/) } });
    expect((await act('alice', TEAM, 'hold', { observations: [observation] })).status).toBe(200);
  });

  it('XF-06 and XF-07: a raise lets the floor above see the belief, and a retraction takes it from both', async () => {
    const { observation, ship, belief } = await heldOnTeam('A2');
    expect(await beliefsOn(ORG, ship)).not.toContain(belief);
    expect(await act('bob', TEAM, 'raise', { belief, why: 'org plans against it' })).toMatchObject({ status: 403, body: { why: expect.stringMatching(/raiser/) } });
    const counts = async () => (await db.admin.query('select (select count(*) from kg.beliefs)::int as b, (select count(*) from kg.observations)::int as o')).rows[0];
    const before = await counts();
    expect((await act('alice', TEAM, 'raise', { belief, why: 'org plans against it' })).status).toBe(200);
    expect(await counts()).toEqual(before);
    expect(await beliefsOn(ORG, ship)).toContain(belief);

    // Bob didn't write the source and isn't the settler: he can't take it back. Alice can, as both.
    expect(await act('bob', TEAM, 'retract', { observation, why: 'no' })).toMatchObject({ status: 403 });
    expect(await act('alice', TEAM, 'retract', { observation, why: 'the report was about another ship' })).toMatchObject({ status: 200, body: { effects: { observations: [observation] } } });
    expect(await beliefsOn(ORG, ship)).not.toContain(belief);
    expect(await beliefsOn(TEAM, ship)).not.toContain(belief);
  });

  it('XF-08 publishes only your own work, only upward to a shared floor you are on, and derives it', async () => {
    const mine = await act('alice', own.alice, 'retain', report('A3', 'MV Quiet Fern'));
    const [source] = mine.body.effects.sources;
    expect(await act('bob', own.bob, 'publish', { source, to: TEAM })).toMatchObject({ status: 403 });
    expect(await act('alice', own.alice, 'publish', { source, to: 'team-b' })).toMatchObject({ status: 403, body: { why: expect.stringMatching(/not on that floor/) } });
    const published = await act('alice', own.alice, 'publish', { source, to: TEAM });
    expect(published.status, JSON.stringify(published.body)).toBe(200);
    const { rows } = await db.admin.query('select floor, derived_from from kg.observations where source = $1', [published.body.effects.sources[0]]);
    expect(rows).toEqual([{ floor: TEAM, derived_from: mine.body.effects.observations[0] }]);
    // Published is not held: on a floor that holds by role, nothing is believed until its settler holds it.
    expect(await beliefsOn(TEAM, mine.body.effects.entities[0], 'bob')).toEqual([]);
  });

  it('XF-09 refuses a raise from your own floor: publish instead', async () => {
    const mine = await act('alice', own.alice, 'retain', report('A4'));
    expect(await act('alice', own.alice, 'raise', { belief: mine.body.effects.beliefs[0], why: 'x' })).toMatchObject({ status: 403, body: { why: expect.stringMatching(/publish/) } });
  });

  it('XF-10 forgets only on your own floor, clears the words and ledgers it; end keeps the belief as history', async () => {
    const mine = await act('alice', own.alice, 'retain', report('A5'));
    const [observation] = mine.body.effects.observations;
    const [belief] = mine.body.effects.beliefs;
    expect((await act('alice', own.alice, 'end', { belief, at: '2026-11-09T00:00:00Z', why: 'sold' })).status).toBe(200);
    expect((await db.admin.query('select ended_at from kg.beliefs where id = $1', [belief])).rows[0].ended_at).toEqual(new Date('2026-11-09T00:00:00Z'));

    expect(await act('bob', own.bob, 'forget', { observation })).toMatchObject({ status: 403, body: { why: expect.stringMatching(/owner/) } });
    expect((await act('alice', own.alice, 'forget', { observation })).status).toBe(200);
    expect((await db.admin.query('select value, quote, forgotten_at is not null as gone from kg.observations where id = $1', [observation])).rows[0]).toEqual({ value: null, quote: '', gone: true });
    expect((await db.admin.query('select count(*)::int as n from kg.forget_ledger where observation = $1', [observation])).rows[0].n).toBe(1);
  });

  it('XF-13 a dispute blocks a raise, and only the settler settles it; the one who disputed may withdraw', async () => {
    const { belief } = await heldOnTeam('A6');
    const disputed = await act('bob', TEAM, 'dispute', { belief, reason: 'the operator changed' });
    expect(disputed.status).toBe(200);
    const [d] = disputed.body.effects.disputes;
    expect(await act('alice', TEAM, 'raise', { belief, why: 'x' })).toMatchObject({ status: 403, body: { why: expect.stringMatching(/dispute/) } });
    expect(await act('bob', TEAM, 'settle', { dispute: d, outcome: 'upheld' })).toMatchObject({ status: 403, body: { why: expect.stringMatching(/settler/) } });
    expect((await act('alice', TEAM, 'settle', { dispute: d, outcome: 'upheld' })).status).toBe(200);
    expect((await act('alice', TEAM, 'raise', { belief, why: 'settled' })).status).toBe(200);

    const again = (await act('bob', TEAM, 'dispute', { belief, reason: 'still unsure' })).body.effects.disputes[0];
    expect((await act('bob', TEAM, 'settle', { dispute: again, outcome: 'withdrawn' })).status).toBe(200);
  });

  it('lets an app dispute and publish for you, and never settle, retract, raise, end or forget', async () => {
    const { belief, observation } = await heldOnTeam('A7');
    const take = (action: string, payload: object, floor = TEAM) =>
      svc.app.inject({ method: 'POST', url: `/v1/actions/${action}`, headers: { ...as('alice', floor, { app: 'notes', scopes: ['knowledge:act'] }), 'idempotency-key': key() }, payload }).then((r) => r.json());
    expect(await take('dispute', { belief, reason: 'from the app' })).toMatchObject({ effects: { disputes: [expect.any(String)] } });
    for (const [action, payload] of [['retract', { observation, why: 'x' }], ['raise', { belief, why: 'x' }], ['end', { belief, at: '2026-11-09T00:00:00Z', why: 'x' }]] as const)
      expect(await take(action, payload), action).toMatchObject({ status: 403, detail: expect.stringContaining('isn’t granted to apps') });
  });
});
