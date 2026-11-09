// Spec draft 4's 13 cross-floor tests (PER-351), on the loaded corpus, as kg_app signed in with its own
// password. Each runs in one transaction that is rolled back. Ported from draft 4's crossfloor.py; where
// migration 3 (the fence) changes an answer, the test says so.
import type pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { knowledgeDb, loadCorpus } from './db.testing.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);

interface Tx {
  /** Stand somewhere else as someone else, in the same transaction. */
  as: (person: string, floor: string) => Promise<void>;
  one: (sql: string, params?: unknown[]) => Promise<unknown>;
  all: (sql: string, params?: unknown[]) => Promise<unknown[][]>;
  /** The refusal's message, or undefined when the statement went through. */
  refused: (sql: string, params?: unknown[]) => Promise<string | undefined>;
}

const within = async (person: string, floor: string, work: (tx: Tx) => Promise<void>) => {
  const c: pg.PoolClient = await db.app.connect();
  try {
    await c.query('begin');
    const tx: Tx = {
      as: async (p, f) => void (await c.query(`select set_config('kg.person', $1, true), set_config('kg.floor', $2, true), set_config('kg.app', 'test', true)`, [p, f])),
      one: async (sql, params = []) => (await c.query({ text: sql, values: params, rowMode: 'array' })).rows[0]?.[0],
      all: async (sql, params = []) => (await c.query({ text: sql, values: params, rowMode: 'array' })).rows,
      refused: async (sql, params = []) => {
        await c.query('savepoint s');
        try {
          await c.query(sql, params);
          await c.query('release savepoint s');
          return undefined;
        } catch (err) {
          await c.query('rollback to savepoint s');
          return (err as Error).message;
        }
      },
    };
    await tx.as(person, floor);
    await work(tx);
  } finally {
    await c.query('rollback');
    c.release();
  }
};

describe.skipIf(!DATABASE_URL)('cross-floor tests (draft 4, 13 of 13)', () => {
  const id: Record<string, string> = {};
  beforeAll(async () => {
    await loadCorpus(db);
    const pick = async (key: string, sql: string, params: unknown[] = []) => {
      const { rows } = await db.admin.query({ text: sql, values: params, rowMode: 'array' });
      id[key] = rows[0][0];
    };
    await pick('brannock', `select distinct entity from kg.entity_names where name = 'Brannock Lines'`);
    await pick('heron', `select distinct entity from kg.entity_names where name = 'MV Saltmarsh Heron'`);
    await pick('health', `select o.id from kg.observations o join kg.sources s on s.id = o.source where s.ref = 'R10' and o.quote ilike '%MRI%' limit 1`);
    await pick('r03', `select id from kg.sources where ref = 'R03'`);
    await pick('r20', `select id from kg.sources where ref = 'R20'`);
    await pick('r20ends', `select o.id from kg.observations o join kg.sources s on s.id = o.source where s.ref = 'R20' and o.predicate = 'kg:agreementEnds'`);
    await pick('heronOp', `select b.id from kg.beliefs b where b.subject = $1 and b.predicate = 'kg:operatedBy' and b.home_floor = 'team' and b.superseded_at is null`, [id.heron]);
    await pick('instruction', `select o.id from kg.observations o where o.predicate = 'kg:containsInstruction' and o.floor = 'team' limit 1`);
  });

  it('XF-01 A floor never sees below it (D13): nothing from any personal floor', () =>
    within('alex', 'team', async (tx) => {
      expect(await tx.one(`select count(*)::int from kg.observations o join kg.sources s on s.id = o.source where s.ref in ('R10','R25','R03','R18')`)).toBe(0);
      expect(await tx.one(`select count(*)::int from kg.entity_names where floor like 'you-%'`)).toBe(0);
      expect(await tx.one(`select count(*)::int from kg.beliefs b where b.home_floor like 'you-%'`)).toBe(0);
    }));

  it('XF-02 The known-entities list is per floor: nothing named only in a personal note', () =>
    within('alex', 'team', async (tx) => {
      const names = new Set((await tx.all(`select label from kg.known_entities(500)`)).map((r) => r[0]));
      expect(names.size).toBeGreaterThan(0);
      expect(names.has('The board') || names.has('Legal and Compliance')).toBe(false);
    }));

  it('XF-03 An identity-key lookup outside sight shows only the kind of floor: no name, and (T3) no id', () =>
    within('alex', 'team', async (tx) => {
      expect(await tx.all(`select entity, in_sight, kept_on, name from kg.lookup_key('company-register','BL-0001')`)).toEqual([[null, false, 'personal', null]]);
      await tx.as('harry', 'you-harry');
      const [entity, inSight, , name] = (await tx.all(`select entity, in_sight, kept_on, name from kg.lookup_key('company-register','BL-0001')`))[0]!;
      expect([entity, inSight, name]).toEqual([id.brannock, true, 'Brannock Lines']);
    }));

  it('XF-04 The service login cannot write tables: only act_* functions write', () =>
    within('alex', 'team', async (tx) => {
      expect(await tx.refused(`insert into kg.observations (floor, source, subject, predicate, value, extractor, ontology_version) values ('team', $1, $2, 'kg:note', '{"v":1}', 'x', 1)`, [id.r03, id.heron])).toMatch(/permission denied/);
      expect(await tx.refused(`update kg.observations set retracted_at = now() where id = $1`, [id.health])).toMatch(/permission denied/);
      expect(await tx.refused(`delete from kg.actions where id = 1`)).toMatch(/permission denied/);
    }));

  it('XF-05 Roles and the non-author rule (D10, D11, X1, X2)', () =>
    within('alex', 'team', async (tx) => {
      expect(await tx.refused(`select kg.act_hold($1::uuid[])`, [[id.r20ends]])).toMatch(/settler/);
      expect(await tx.refused(`select kg.act_raise($1, 'x')`, [id.heronOp])).toMatch(/raiser/);
      await tx.as('jo', 'team');
      expect(await tx.refused(`select kg.act_check_faithful($1, 'faithful')`, [id.r20ends])).toMatch(/author/);
    }));

  it('XF-06 Raise extends reach and copies nothing (F2)', () =>
    within('jo', 'team', async (tx) => {
      const counts = `select (select count(*) from kg.beliefs)::int, (select count(*) from kg.observations)::int`;
      const before = await tx.all(counts);
      const b = await tx.one(`select b.id from kg.live_beliefs b where b.home_floor = 'team' and b.predicate = 'kg:agreementEnds'`);
      await tx.all(`select kg.act_raise($1, 'org plans against it', false)`, [b]);
      expect(await tx.all(counts)).toEqual(before);
      await tx.as('jo', 'org');
      expect(await tx.one(`select count(*)::int from kg.live_beliefs where id = $1`, [b])).toBe(1);
      expect(await tx.one(`select evidence_unseen::int from kg.live_beliefs where id = $1`, [b])).toBeGreaterThanOrEqual(1);
      expect(await tx.one(`select count(*)::int from kg.observations o where o.id in (select observation from kg.belief_evidence where belief = $1)`, [b])).toBe(0);
    }));

  it('XF-07 Retraction applies once, everywhere: the raised belief falls from team and org together', () =>
    within('jo', 'org', async (tx) => {
      expect(await tx.one(`select count(*)::int from kg.live_beliefs where id = $1`, [id.heronOp])).toBe(1);
      await tx.as('jo', 'team');
      const evidence = (await tx.all(`select observation from kg.belief_evidence where belief = $1`, [id.heronOp])).map((r) => r[0]);
      for (const e of evidence) await tx.all(`select kg.act_retract($1, 'test: retract everything behind it')`, [e]);
      await tx.as('jo', 'org');
      expect(await tx.one(`select count(*)::int from kg.live_beliefs where id = $1`, [id.heronOp])).toBe(0);
      await tx.as('alex', 'team');
      expect(await tx.one(`select count(*)::int from kg.live_beliefs where id = $1`, [id.heronOp])).toBe(0);
      expect(await tx.one(`select count(*)::int from kg.observations where id = any($1::uuid[]) and retracted_at is not null`, [evidence])).toBe(evidence.length);
    }));

  it('XF-08 Only publishing goes up, and it derives (D12, F8)', () =>
    within('sam', 'you-sam', async (tx) => {
      const before = Number(await tx.one(`select count(*) from kg.observations`));
      const published = await tx.one(`select kg.act_publish($1, 'team')`, [id.r03]);
      const added = Number(await tx.one(`select count(*) from kg.observations`)) - before;
      await tx.as('alex', 'team');
      expect(await tx.one(`select count(*)::int from kg.observations where source = $1 and derived_from is not null`, [published])).toBe(added);
      expect(added).toBeGreaterThan(0);
      expect(await tx.one(`select count(*)::int from kg.live_beliefs b where b.home_floor = 'team' and b.id in (select belief from kg.belief_evidence e join kg.observations o on o.id = e.observation where o.source = $1)`, [published])).toBe(0);
      expect(await tx.one(`select count(*)::int from kg.observations o join kg.sources s on s.id = o.source where s.ref <> 'R03' and s.floor like 'you-%'`)).toBe(0);
      expect(await tx.one(`select count(*)::int from kg.entity_names where floor = 'team' and name = 'Ruth Adeyemi'`)).toBeGreaterThanOrEqual(1);
    }));

  it('XF-09 A personal floor cannot raise: publish instead', () =>
    within('harry', 'you-harry', async (tx) => {
      expect(await tx.refused(`select kg.act_raise($1, 'x')`, [id.heronOp])).toMatch(/publish/);
    }));

  it('XF-10 Forget clears, is ledgered and cannot be edited', () =>
    within('alex', 'you-alex', async (tx) => {
      expect(await tx.refused(`select kg.act_forget($1)`, [id.health])).toMatch(/owner/);
      await tx.as('harry', 'you-harry');
      await tx.all(`select kg.act_forget($1)`, [id.health]);
      expect(await tx.one(`select value is null and quote = '' from kg.observations where id = $1`, [id.health])).toBe(true);
      expect(await tx.one(`select count(*)::int from kg.live_beliefs b where b.id in (select belief from kg.belief_evidence where observation = $1)`, [id.health])).toBe(0);
      // Migration 3 (T2): kg_app no longer reads the ledger at all; that it holds the id is checked as the
      // migrating login in fence.test.ts. Editing it is refused either way.
      expect(await tx.refused(`update kg.forget_ledger set at = now() where observation = $1`, [id.health])).toMatch(/permission denied/);
    }));

  it('XF-11 Flagged text is never held on a shared floor (X3)', () =>
    within('alex', 'team', async (tx) => {
      await tx.all(`select kg.act_check_faithful($1, 'faithful')`, [id.instruction]);
      await tx.as('jo', 'team');
      expect(await tx.refused(`select kg.act_hold($1::uuid[])`, [[id.instruction]])).toMatch(/flagged/);
    }));

  it('XF-12 Proposed classes and undeclared predicates are refused at write (F5)', () =>
    within('jo', 'team', async (tx) => {
      expect(await tx.refused(`select kg.act_new_entity('kg:Project', 'x')`)).toMatch(/accepted/);
      expect(await tx.refused(`select kg.act_retain($1, $2, 'kg:isOwnedByVantor', '{"v":1}', null, 'q', null, null, 'unknown', 'reported', null, 'x', 'x', 1)`, [id.r20, id.heron])).toMatch(/declared/);
    }));

  it('XF-13 Disputes attach to beliefs, block a raise and settle by role (D10, X2)', () =>
    within('alex', 'team', async (tx) => {
      const d = await tx.one(`select kg.act_dispute($1, 'the operator changed')`, [id.heronOp]);
      await tx.as('jo', 'team');
      expect(await tx.refused(`select kg.act_raise($1, 'x')`, [id.heronOp])).toMatch(/dispute/);
      expect(await tx.one(`select disputed from kg.live_beliefs where id = $1`, [id.heronOp])).toBe(true);
      // The belief is on org too: org sees that it is disputed, not why (T2).
      await tx.as('jo', 'org');
      expect(await tx.one(`select disputed from kg.live_beliefs where id = $1`, [id.heronOp])).toBe(true);
      expect(await tx.one(`select count(*)::int from kg.disputes where id = $1`, [d])).toBe(0);
      await tx.as('alex', 'team');
      expect(await tx.refused(`select kg.act_settle($1, 'upheld')`, [d])).toMatch(/settler/);
      await tx.as('jo', 'team');
      await tx.all(`select kg.act_settle($1, 'upheld')`, [d]);
      expect(await tx.one(`select not disputed from kg.live_beliefs where id = $1`, [id.heronOp])).toBe(true);
    }));
});
