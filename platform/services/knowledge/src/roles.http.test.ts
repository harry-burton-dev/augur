// Floor roles from the permissions service, over HTTP (plan PR 6c-2): what it says on each request is what
// the store checks, a role taken away there is gone on the next request, and when it can't answer nobody
// settles, saying who can change that.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';
import { client, type Client, ORG, people, report } from './http.testing.ts';
import { type FloorRole, RolesUnavailable } from './permissions.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const { where, reset, standing } = people();
const TEAM = 'team-a';

/** What the permissions service says now: who holds which role where, or that it can't answer. */
let granted: { person: string; floor: string; role: FloorRole }[] = [];
let down = false;
const unavailable: string[] = [];

describe.skipIf(!DATABASE_URL)('floor roles from the permissions service', () => {
  let svc: Client;
  const act = (...a: Parameters<Client['act']>) => svc.act(...a).then((r) => ({ status: r.statusCode, body: r.json() }));

  beforeAll(async () => {
    svc = await client({
      store: db.app,
      standing,
      roles: async (person, floors) => {
        if (down) throw new RolesUnavailable('Could not ask the permissions service: it answered 503.');
        return granted.filter((g) => g.person === person && floors.some((f) => f.id === g.floor)).map(({ floor, role }) => ({ floor, role }));
      },
      onRolesUnavailable: (err) => unavailable.push(err.message),
    });
  });
  beforeEach(async () => {
    reset();
    where.bob = { floors: [{ id: ORG, kind: 'org' }, { id: TEAM, kind: 'team', parent: ORG }], memberOf: [ORG, TEAM] };
    granted = [{ person: 'alice', floor: TEAM, role: 'settler' }];
    down = false;
    unavailable.length = 0;
    await db.empty();
  });

  /** A claim on team A, retained by Alice and checked faithful by Bob. */
  const faithful = async (ref: string) => {
    const [observation] = (await act('alice', TEAM, 'retain', report(ref))).body.effects.observations;
    await act('bob', TEAM, 'confirm-faithful', { observation, verdict: 'faithful' });
    return observation as string;
  };

  it('lets whoever it names settle, and nobody else', async () => {
    const observation = await faithful('P1');
    expect(await act('bob', TEAM, 'hold', { observations: [observation] })).toMatchObject({ status: 403, body: { why: expect.stringMatching(/settler/), whoCanChange: expect.stringMatching(/Admin/) } });
    expect((await act('alice', TEAM, 'hold', { observations: [observation] })).status).toBe(200);
  });

  it('takes a role away on the next request once it is taken away there', async () => {
    const observation = await faithful('P2');
    granted = [{ person: 'bob', floor: TEAM, role: 'settler' }];
    expect((await act('alice', TEAM, 'hold', { observations: [observation] })).status).toBe(403);
    expect((await act('bob', TEAM, 'hold', { observations: [observation] })).status).toBe(200);
    // Each request writes what the service says before anything is checked; a refused one keeps nothing, so the next read does.
    await svc.get('alice', '/v1/floors', TEAM);
    expect((await db.admin.query(`select person from kg.floor_roles where floor = $1 and role = 'settler' order by person`, [TEAM])).rows).toEqual([{ person: 'bob' }]);
  });

  it('gives nobody a role while it can’t answer', async () => {
    const observation = await faithful('P3');
    down = true;
    expect(await act('alice', TEAM, 'hold', { observations: [observation] })).toMatchObject({ status: 403, body: { why: expect.stringMatching(/settler/) } });
    expect(unavailable.length).toBeGreaterThan(0);
    down = false;
    expect((await act('alice', TEAM, 'hold', { observations: [observation] })).status).toBe(200);
  });
});
