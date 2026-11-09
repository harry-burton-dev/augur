// Scale (draft 4's perf.sql): 200,000 observations over 2,000 personal floors and 200 teams, read as kg_app.
// The fence computes sight once per statement (an init plan), never once per row. Main only (KG_PERF=1):
// the budget is a floor for the plan's shape, not a benchmark of the runner.
import { describe, expect, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const BUDGET_MS = 5;

describe.skipIf(!DATABASE_URL || !process.env.KG_PERF)('the fence at 200,000 observations', () => {
  it(`counts what a team floor sees in under ${BUDGET_MS} ms, with sight computed once`, async () => {
    await db.admin.query(`
      insert into kg.floors (id, kind) values ('org', 'org');
      insert into kg.floors (id, kind, parent) select 'pteam' || i, 'team', 'org' from generate_series(1, 200) i;
      insert into kg.floors (id, kind, owner) select 'pyou' || i, 'personal', 'p' || i from generate_series(1, 2000) i;
      insert into kg.floor_members select 'pteam' || (1 + i % 200), 'p' || i from generate_series(1, 2000) i;
      insert into kg.sources (floor, app, ref, version, content_sha256, title, author)
        select case when g % 3 = 0 then 'pteam' || (1 + g % 200) else 'pyou' || (1 + g % 2000) end, 'perf', 'perf' || g, 1, 'x', 'perf ' || g, 'p' || (1 + g % 2000) from generate_series(1, 20000) g;
      insert into kg.entities (class, created_on) select 'kg:Ship', 'org' from generate_series(1, 2000);
      insert into kg.observations (floor, source, subject, predicate, value, modality, valid, valid_precision, extractor, ontology_version, quote)
        select s.floor, s.id, e.id, 'kg:cargo', jsonb_build_object('v', g % 500, 'unit', 'TEU'), 'reported',
               tstzrange('2026-01-01'::timestamptz + (g % 300) * interval '1 day', '2026-01-01'::timestamptz + (g % 300 + 1) * interval '1 day'), 'day', 'perf', 1, 'q'
        from generate_series(1, 200000) g
        join kg.sources s on s.ref = 'perf' || (1 + g % 20000)
        join lateral (select id from kg.entities order by id offset (g % 2000) limit 1) e on true;
      analyze kg.observations; analyze kg.sources; analyze kg.floors; analyze kg.floor_members;`);
    const viewer = { person: 'p7', floor: 'pteam8' };
    await db.peek(viewer, 'select count(*) from kg.observations');
    const [{ 'QUERY PLAN': plan }] = await db.peek<{ 'QUERY PLAN': [{ Plan: object; 'Execution Time': number }] }>(viewer, 'explain (analyze, format json) select count(*) from kg.observations');
    const text = JSON.stringify(plan[0].Plan);
    expect(text).toMatch(/"Subplan Name":"InitPlan/);
    expect(text).not.toMatch(/"Subplan Name":"SubPlan/);
    console.log(`fenced count over 200,000 observations: ${plan[0]['Execution Time']} ms`);
    expect(plan[0]['Execution Time']).toBeLessThan(BUDGET_MS);
    const [{ n }] = await db.peek<{ n: number }>(viewer, `select count(*)::int as n from kg.observations where floor like 'pyou%'`);
    expect(n).toBe(0);
  }, 300_000);
});
