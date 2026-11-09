// The floor fence, treated as a security boundary (PDR-022, ADR 0079). Threat model, information disclosure
// first: every way a row from a floor outside a person's sight could reach them, and what stops it. Each line
// names its test, or says why it can't happen and who keeps it so.
//
//  T1  Security definer functions run as their owner. Draft 4's ran as whoever migrated: on a deployment the
//      platform login, a superuser. Migration 3 gives everything to kg_owner (no login, no superuser, no
//      BYPASSRLS) and every definer function fixes search_path to "kg, pg_temp". Catalog check below.
//  T2  Tables kg_app could read in full though their rows are a floor's: floors, entities (created_on),
//      disputes and merges (their reasons), faithful checks, candidates, the ids behind a belief's evidence,
//      the forget ledger. Fenced or not granted (migration 3). Catalog check, oracle property, CQ16, XF-13.
//  T3  A key looked up outside sight gave the entity's id. Now only "known, on a <kind> floor". XF-03, oracle.
//  T4  Counts and aggregates: they run over the fenced rows, so they count only what is in sight. The one
//      count of unseen rows on purpose is a belief's evidence_unseen (the Unseen answer, draft 4). Oracle.
//  T5  Ordering, limits and pagination: same rows, same fence. Nothing sorts by an unseen column.
//  T6  Who is acting comes from kg.person and kg.floor, set per transaction by the service from the gateway's
//      signed caller. Any statement as kg_app can set them, so the database fence guards against a wrong
//      query, not a compromised service. The service never runs SQL it didn't write (PR 2's route tests).
//  T7  Error messages as an existence oracle: act_retain answered "no such source" for a missing id and
//      something else for one out of sight. One message now (below). Other actions read no row first or
//      refuse in the same words either way.
//  T8  Ids: a ULID carries its time. The seam's ids (N2, PR 2) are only ever given for rows in sight, so a
//      time is learned only for what may be seen. Inside the store, uuids are random.
//  T9  Timing: a fenced read's time depends on how much is in sight, not on what is outside it (the policy's
//      init plan computes sight once; perf.test.ts keeps the plan shape). Not exploitable for content.
//  T10 Unseen carrying more than the kind of floor: lookup_key, evidence_unseen and is_disputed answer kind,
//      count and yes/no only. Oracle (lookups), XF-03, XF-13.
//  T11 The table owner skips row security unless it is forced. kg_app owns nothing and isn't a member of
//      kg_owner. Catalog check. Row security isn't forced, because the actions need to read across floors.
//  T12 kg_app could call any function: kg.sight('<someone's floor>') listed their memberships, kg.can_stand
//      answered for anyone, and the internal helpers wrote the audit and the outbox. Now only the actions and
//      fenced reads (APP_FUNCTIONS). Catalog check and below.
//  T13 Text in a report that addresses the system: flagged on retain and never held on a shared floor
//      (X3). XF-11, CQ18. The model-facing defences come with retain (PR 5).
//  T14 A superuser or BYPASSRLS login: the shared platform login sees across every floor, which is why the
//      service has its own (N1). Below.
import { describe, expect, it } from 'vitest';
import { knowledgeDb, loadCorpus } from './db.testing.ts';
import { fenceFindings } from './fence.testing.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);

describe.skipIf(!DATABASE_URL)('the floor fence', () => {
  it('holds in the catalog: owners, logins, policies, grants, search paths (T1, T2, T11, T12)', async () => {
    expect(await fenceFindings(db.admin)).toEqual([]);
  });

  it('T14 (N1): the shared platform login sees every floor, and kg_app does not', async () => {
    await loadCorpus(db);
    const personal = `select count(*)::int as n from kg.observations where floor like 'you-%'`;
    const { rows } = await db.admin.query(personal);
    expect(rows[0].n).toBeGreaterThan(0);
    expect((await db.peek<{ n: number }>({ person: 'alex', floor: 'team' }, personal))[0]!.n).toBe(0);
    // Standing nowhere sees nothing, not even the floors.
    expect((await db.peek<{ n: number }>({ person: 'nobody', floor: 'team' }, `select count(*)::int as n from kg.floors`))[0]!.n).toBe(0);
  });

  it('T12: kg_app cannot ask whose floors are whose', async () => {
    await expect(db.peek({ person: 'alex', floor: 'team' }, `select kg.sight('you-harry')`)).rejects.toThrow(/permission denied/);
    await expect(db.peek({ person: 'alex', floor: 'team' }, `select kg.can_stand('harry', 'team')`)).rejects.toThrow(/permission denied/);
    await expect(db.peek({ person: 'alex', floor: 'team' }, `select kg.record('x', 'team', '{}')`)).rejects.toThrow(/permission denied/);
  });

  it('T7: a missing source and one out of sight are refused in the same words', async () => {
    const { rows } = await db.admin.query(`select id from kg.sources where floor = 'you-harry' limit 1`);
    const retain = `select kg.act_retain($1, null, 'kg:note', '{"v":1}', null, 'q', null, null, 'unknown', 'reported', null, 'x', 'x', 1)`;
    const outOfSight = await db.peek({ person: 'alex', floor: 'team' }, retain, [rows[0].id]).catch((e: Error) => e.message);
    const missing = await db.peek({ person: 'alex', floor: 'team' }, retain, ['00000000-0000-4000-8000-000000000000']).catch((e: Error) => e.message);
    expect(outOfSight).toBe(missing);
  });

  it('T2: kg_app cannot read the forget ledger, even on its own floor', async () => {
    await expect(db.peek({ person: 'harry', floor: 'you-harry' }, `select count(*) from kg.forget_ledger`)).rejects.toThrow(/permission denied/);
  });
});
