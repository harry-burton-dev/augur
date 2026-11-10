// Reflect on real Postgres (plan PR 7): the service writes a floor's summary once its beliefs are quiet, within
// its budgets, from that floor's beliefs only; a later change marks it older than its beliefs until it is
// written again. The model is a stand-in that says what it was asked.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';
import { client, type Client, own, people, report } from './http.testing.ts';
import { type AskFloor, type ReflectBudgets, reflectRound } from './reflect.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const { reset, standing } = people();

let svc: Client;
let asked: { floor: string; user: string }[] = [];
let answer: (user: string) => string = (user) => `Summary of ${/about (.+):/.exec(user)![1]}.`;
const ask: AskFloor = async (messages, floor) => {
  asked.push({ floor, user: messages[1]!.content });
  return { content: answer(messages[1]!.content), model: 'stand-in' };
};
const now = (budgets: Partial<ReflectBudgets> = {}, resting = new Set<string>()) =>
  reflectRound({ pool: db.app, ask, budgets: { debounceSeconds: 0, daily: 10, perFloor: 10, ...budgets }, resting });
const summary = async (ship: string, floor = own.alice) => (await svc.get('alice', `/v1/floors/${floor}/entities/${ship}/summary`, floor)).json().summaries[0];

describe.skipIf(!DATABASE_URL)('reflect, as the service', () => {
  beforeAll(async () => {
    svc = await client({ store: db.app, standing });
  });
  beforeEach(async () => {
    reset();
    asked = [];
    answer = (user) => `Summary of ${/about (.+):/.exec(user)![1]}.`;
    await db.empty();
  });

  it('writes a summary once the beliefs are quiet, marks it older when they change, and writes it again', async () => {
    const [ship] = (await svc.act('alice', own.alice, 'retain', report('R1', 'MV Lonely Gull'))).json().effects.entities;
    expect(await summary(ship)).toMatchObject({ state: 'none' });

    // Within the debounce nothing is asked.
    expect((await now({ debounceSeconds: 600 })).written).toEqual([]);
    expect(asked).toEqual([]);

    expect((await now()).written).toHaveLength(1);
    expect(asked[0]).toMatchObject({ floor: own.alice });
    expect(asked[0]!.user).toContain('MV Lonely Gull');
    expect(asked[0]!.user).toContain('kg:capacity');
    expect(await summary(ship)).toMatchObject({ state: 'current', text: 'Summary of MV Lonely Gull.' });
    // Current summaries aren't asked for again.
    expect((await now()).written).toEqual([]);

    await svc.act('alice', own.alice, 'retain', report('R2', 'MV Lonely Gull', 1300));
    expect(await summary(ship)).toMatchObject({ state: 'older-than-beliefs', why: expect.stringContaining('Reflect') });
    expect((await now()).written).toHaveLength(1);
    expect(await summary(ship)).toMatchObject({ state: 'current' });
    // It counts in the audit, which the budgets read.
    expect((await db.admin.query(`select count(*)::int as n from kg.actions where kind = 'reflect'`)).rows[0].n).toBe(2);
  });

  it('keeps to its budgets, leaves a refused floor alone, and stops at the daily limit', async () => {
    await svc.act('alice', own.alice, 'retain', report('R3', 'MV Lonely Gull'));
    await svc.act('alice', own.alice, 'retain', report('R4', 'MV Quiet Tern'));
    await svc.act('alice', own.alice, 'retain', report('R5', 'MV Grey Petrel'));

    expect((await now({ perFloor: 1 })).written).toHaveLength(1);
    // The floor has had its one today; the rest wait, and say so.
    expect((await now({ perFloor: 1 })).written).toEqual([]);
    expect((await now({ daily: 2 })).written).toHaveLength(1);

    const resting = new Set<string>();
    answer = () => {
      throw new Error('Could not ask the model: it answered 403: models are not allowed on this floor.');
    };
    expect((await now({}, resting)).written).toEqual([]);
    expect(resting.has(own.alice)).toBe(true);
    expect(asked).toHaveLength(3);
    // Resting, the floor isn't asked again today.
    await now({}, resting);
    expect(asked).toHaveLength(3);

    answer = () => {
      throw new Error('Could not ask the model: it answered 429: knowledge has used its 500 model calls for today.');
    };
    expect(await now()).toMatchObject({ written: [], stopped: 'daily limit' });
  });

  it('asks with one floor’s beliefs only, and rests an entity whose reply was unusable', async () => {
    await svc.act('alice', own.alice, 'retain', report('R6', 'MV Lonely Gull', 900));
    await svc.act('bob', own.bob, 'retain', report('R7', 'MV Lonely Gull', 1500));
    await now();
    const mine = asked.find((a) => a.floor === own.alice)!;
    expect(mine.user).toContain('900');
    expect(mine.user).not.toContain('1500');

    asked = [];
    await svc.act('alice', own.alice, 'retain', report('R8', 'MV Quiet Tern'));
    answer = () => '   ';
    const resting = new Set<string>();
    await now({}, resting);
    await now({}, resting);
    expect(asked.filter((a) => a.user.includes('Quiet Tern'))).toHaveLength(1);
  });
});
