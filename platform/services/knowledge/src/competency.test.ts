// The 24 competency questions from spec draft 4 (PER-351), asked of the loaded corpus as kg_app, standing on a
// floor as a person. Each expectation is the answer the corpus README says is right; none was tuned to the
// store. Ported from draft 4's competency.py without changing a question or an answer.
import { beforeAll, describe, expect, it } from 'vitest';
import { knowledgeDb, loadCorpus } from './db.testing.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
type Row = unknown[];
const alex = { person: 'alex', floor: 'team' };

describe.skipIf(!DATABASE_URL)('competency questions (draft 4, 24 of 24)', () => {
  const ent: Record<string, string> = {};
  beforeAll(async () => {
    await loadCorpus(db);
    const labels = {
      heron: 'MV Saltmarsh Heron', tern: 'MV Tern Bay', brannock: 'Brannock Lines', gantry: 'Project Gantry',
      depotD: 'Lowmere Dunmore depot', depotA: 'Lowmere Ardmor depot', marta: 'Marta Kowal', tug: 'Osprey (harbour tug)', ospreyL: 'Osprey Logistics',
    };
    for (const [k, label] of Object.entries(labels)) {
      const { rows } = await db.admin.query<{ entity: string }>('select distinct entity from kg.entity_names where name = $1', [label]);
      expect(rows, label).toHaveLength(1);
      ent[k] = rows[0]!.entity;
    }
  });
  const q = (acting: { person: string; floor: string }, sql: string, params: unknown[] = []) => db.peekRows(acting, sql, params) as Promise<Row[]>;
  const label = `(select name from kg.entity_names n where n.entity = b.object and n.is_label limit 1)`;
  const arrivalOf = `exists (select 1 from kg.beliefs p where p.subject = e.id and p.predicate = 'kg:hasParticipant' and p.object = $1)`;

  it('CQ01 Who operates the MV Saltmarsh Heron? Brannock Lines, reported, more than one source', async () => {
    const r = await q(alex, `select ${label}, b.modality, b.sources_behind::int from kg.live_beliefs b where b.subject = $1 and b.predicate = 'kg:operatedBy'`, [ent.heron]);
    expect(r).toHaveLength(1);
    expect(r[0]![0]).toBe('Brannock Lines');
    expect(r[0]![2]).toBeGreaterThanOrEqual(2);
  });
  it('CQ02 The Heron arrived 6 Nov (reported); the 4 Nov forecast is kept, superseded', async () => {
    const r = await q(alex, `select b.value->>'v', b.modality, b.superseded_at is not null from kg.beliefs b join kg.entities e on e.id = b.subject
      where e.class = 'kg:Arrival' and b.predicate = 'kg:occursOn' and ${arrivalOf} and (b.value->>'v') < '2026-11-15' and b.home_floor = 'team' order by b.recorded_at`, [ent.heron]);
    expect(r.some((x) => x[0] === '2026-11-06' && x[1] === 'reported' && !x[2])).toBe(true);
    expect(r.some((x) => x[0] === '2026-11-04' && x[1] === 'expected' && x[2])).toBe(true);
  });
  it('CQ03 Two separate arrivals of the Heron (occurrences are Event entities, X4)', async () => {
    const r = await q(alex, `select count(distinct e.id)::int from kg.entities e join kg.live_beliefs p on p.subject = e.id and p.predicate = 'kg:hasParticipant' and p.object = $1 where e.class = 'kg:Arrival'`, [ent.heron]);
    expect(r[0]![0]).toBe(2);
  });
  it('CQ04 The next call is 24 Nov, expected, and no conflict with 6 Nov', async () => {
    const r = await q(alex, `select b.value->>'v', b.modality from kg.live_beliefs b join kg.entities e on e.id = b.subject where e.class = 'kg:Arrival' and b.predicate = 'kg:occursOn'
      and exists (select 1 from kg.live_beliefs p where p.subject = e.id and p.predicate = 'kg:hasParticipant' and p.object = $1) and (b.value->>'v') > '2026-11-15'`, [ent.heron]);
    expect(r).toEqual([['2026-11-24', 'expected']]);
  });
  it('CQ05 Containers discharged: 186 against 204, one conflict at the same valid time', async () => {
    const r = await q(alex, `select c.a_value->>'v', c.b_value->>'v' from kg.conflicts c where c.subject = $1 and c.predicate = 'kg:dischargedContainers'`, [ent.heron]);
    expect(r).toHaveLength(1);
    expect(new Set(r[0])).toEqual(new Set(['186', '204']));
  });
  it('CQ06 Sent by road: 28 against 40', async () => {
    const r = await q(alex, `select c.a_value->>'v', c.b_value->>'v' from kg.conflicts c where c.subject = $1 and c.predicate = 'kg:sentByRoad'`, [ent.heron]);
    expect(r).toHaveLength(1);
    expect(new Set(r[0])).toEqual(new Set(['28', '40']));
  });
  it('CQ07 The team floor shows three conflicts and no false alarms', async () => {
    const r = await q(alex, `select c.predicate from kg.conflicts c order by 1`);
    expect(r).toHaveLength(3);
    expect(new Set(r.map((x) => x[0]))).toEqual(new Set(['kg:dischargedContainers', 'kg:sentByRoad', 'kg:worksFor']));
  });
  it("CQ08 The Tern Bay's shaft was not damaged: a negative kept as a value", async () => {
    const r = await q(alex, `select b.value->>'v' from kg.live_beliefs b where b.subject = $1 and b.predicate = 'kg:damaged'`, [ent.tern]);
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r.every((x) => x[0] === 'false')).toBe(true);
  });
  it("CQ09 From Sam's floor: the team's denial (reported) and Sam's rumour (possible)", async () => {
    const r = await q({ person: 'sam', floor: 'you-sam' }, `select b.value->>'v', b.modality, b.home_floor from kg.live_beliefs b where b.subject = $1 and b.predicate = 'kg:forSale' order by b.home_floor`, [ent.depotA]);
    expect(r.some((x) => x[0] === 'false' && x[2] === 'team')).toBe(true);
    expect(r.some((x) => x[1] === 'possible' && x[2] === 'you-sam')).toBe(true);
  });
  it('CQ10 Dunmore received 1,410 tonnes (the revision), one distinct source', async () => {
    const r = await q(alex, `select b.value->>'v', b.value->>'unit', b.sources_behind::int from kg.live_beliefs b where b.subject = $1 and b.predicate = 'kg:cargoReceived'`, [ent.depotD]);
    expect(r).toEqual([['1410', 'tonne', 1]]);
  });
  it('CQ11 A revision counts once as a source (X5)', async () => {
    const r = await q(alex, `select b.predicate, b.sources_behind::int,
        (select array_agg(distinct s.ref || ' v' || s.version order by s.ref || ' v' || s.version) from kg.belief_evidence e join kg.observations o on o.id = e.observation join kg.sources s on s.id = o.source where e.belief = b.id)
      from kg.live_beliefs b where b.home_floor = 'team' and (select count(*) from kg.belief_evidence e where e.belief = b.id) > b.sources_behind order by 1`);
    expect(r.length).toBeGreaterThanOrEqual(4);
    for (const x of r) expect(new Set((x[2] as string[]).map((v) => v.split(' v')[0])).size).toBe(x[1]);
    expect(r.some((x) => (x[2] as string[]).includes('R13 v2'))).toBe(true);
  });
  it('CQ12 Marta Kowal has two employers on a single-valued predicate: flagged as a possible duplicate', async () => {
    const r = await q(alex, `select ${label}, exists (select 1 from kg.possible_duplicates d where d.entity = b.subject) from kg.live_beliefs b where b.subject = $1 and b.predicate = 'kg:worksFor'`, [ent.marta]);
    expect(r).toHaveLength(2);
    expect(r.every((x) => x[1] === true)).toBe(true);
  });
  it('CQ13 The tug Osprey and Osprey Logistics are two entities, with a differentFrom belief', async () => {
    const r = await q(alex, `select count(*)::int from kg.live_beliefs b where b.subject = $1 and b.predicate = 'kg:differentFrom' and b.object = $2`, [ent.ospreyL, ent.tug]);
    expect(r[0]![0]).toBe(1);
    expect(ent.tug).not.toBe(ent.ospreyL);
  });
  it("CQ14 Gantry's budget and spend, value and unit apart", async () => {
    const r = await q(alex, `select b.predicate, b.value->>'v', b.value->>'unit' from kg.live_beliefs b where b.subject = $1 and b.predicate in ('kg:budget','kg:spend') order by 1`, [ent.gantry]);
    expect(r).toContainEqual(['kg:budget', '4200000', 'GBP']);
    expect(r).toContainEqual(['kg:spend', '2900000', 'GBP']);
  });
  it('CQ15 Commissioning forecast 11 Dec; the 30 Nov forecast kept as superseded', async () => {
    const r = await q(alex, `select b.value->>'v', b.modality, b.superseded_at is not null from kg.beliefs b join kg.entities e on e.id = b.subject where e.class = 'kg:Commissioning' and b.predicate = 'kg:occursOn' and b.home_floor = 'team' order by b.recorded_at`);
    expect(r.some((x) => x[0] === '2026-12-11' && x[1] === 'expected' && !x[2])).toBe(true);
    expect(r.some((x) => x[0] === '2026-11-30' && x[2])).toBe(true);
  });
  it('CQ16 The org floor knows only what was raised, its evidence a count it cannot open', async () => {
    const r = await q({ person: 'jo', floor: 'org' }, `select b.predicate, b.reach, b.evidence_unseen::int, (select count(*) from kg.belief_evidence e where e.belief = b.id)::int from kg.live_beliefs b where b.subject = $1`, [ent.heron]);
    expect(r).toHaveLength(1);
    expect(r[0]![0]).toBe('kg:operatedBy');
    expect(r[0]![1]).toContain('org');
    expect(r[0]![2]).toBeGreaterThan(0);
    // Migration 3 (T2): the evidence's ids are fenced too, so org sees none of the rows behind the count.
    expect(r[0]![3]).toBe(0);
  });
  it("CQ17 From the team, nothing of Harry's health, job offer or the Gantry overrun", async () => {
    const r = await q(alex, `select count(*)::int from kg.observations o join kg.sources s on s.id = o.source where s.ref in ('R10','R25')
      union all select count(*)::int from kg.entity_names n where n.floor like 'you-%'
      union all select count(*)::int from kg.observations o where o.quote ilike '%68,000%' or o.quote ilike '%MRI%' or o.quote ilike '%600,000%'`);
    expect(r.map((x) => x[0])).toEqual([0, 0, 0]);
  });
  it('CQ18 Text addressing the system (R11, R23) is flagged and changed nothing', async () => {
    const r = await q(alex, `select (select s.ref from kg.sources s where s.id = o.source), (select count(*) from kg.live_beliefs b where b.id in (select e.belief from kg.belief_evidence e where e.observation = o.id))::int
      from kg.observations o where o.predicate = 'kg:containsInstruction'
      union all select 'vantor-entities', (select count(*) from kg.entity_names where name ilike '%vantor%')::int
      union all select 'disputes-changed', (select count(*) from kg.disputes)::int`);
    expect(r.map((x) => x[0])).toEqual(expect.arrayContaining(['R11', 'R23']));
    expect(r.every((x) => x[1] === 0)).toBe(true);
  });
  it('CQ19 The recorded clock: by 2 Nov the Heron was due 4 Nov; by 5 Nov, 6 Nov', async () => {
    const r = await q(alex, `select k::date::text, b.value->>'v' from (values ('2026-11-02 23:59Z'::timestamptz), ('2026-11-05 23:59Z'::timestamptz)) t(k)
      join kg.beliefs b on b.recorded_at <= '2100-01-01' join kg.entities e on e.id = b.subject join kg.sources s on s.id = (select o.source from kg.belief_evidence ev join kg.observations o on o.id = ev.observation where ev.belief = b.id limit 1)
      where e.class = 'kg:Arrival' and b.predicate = 'kg:occursOn' and b.home_floor = 'team' and s.written_at <= t.k and (b.superseded_at is null or (select s2.written_at from kg.beliefs b2 join kg.belief_evidence ev2 on ev2.belief = b2.id join kg.observations o2 on o2.id = ev2.observation join kg.sources s2 on s2.id = o2.source where b2.id = b.superseded_by limit 1) > t.k)
      and ${arrivalOf} and (b.value->>'v') < '2026-11-15' order by 1`, [ent.heron]);
    expect(r).toContainEqual(['2026-11-02', '2026-11-04']);
    expect(r).toContainEqual(['2026-11-05', '2026-11-06']);
  });
  it("CQ20 The Heron's bunkering: 85 tonnes, density 0.845, kept around the injected text", async () => {
    const r = await q(alex, `select b.predicate, b.value->>'v', b.value->>'unit' from kg.live_beliefs b where b.subject = $1 and b.predicate in ('kg:fuelQuantity','kg:fuelDensity') order by 1`, [ent.heron]);
    expect(r).toContainEqual(['kg:fuelQuantity', '85', 'tonne']);
    expect(r.some((x) => x[0] === 'kg:fuelDensity' && x[1] === '0.845')).toBe(true);
  });
  it('CQ21 Project is a proposed class; Project Gantry is typed by its accepted parent meanwhile', async () => {
    const r = await q(alex, `select c.term, c.status, c.asked_by, (select e.class from kg.entities e where e.id = $1) from kg.candidates c where c.kind = 'class'`, [ent.gantry]);
    expect(r).toEqual([['Project', 'proposed', 1, 'kg:Act']]);
  });
  it('CQ22 Extraction asked for more than 50 predicates the base profile lacks', async () => {
    const r = await q(alex, `select count(*)::int from kg.candidates where kind = 'predicate' and status = 'proposed'`);
    expect(r[0]![0]).toBeGreaterThan(50);
  });
  it('CQ23 Osprey Logistics is in Dunmore and Kofi Mensah works for it', async () => {
    const r = await q(alex, `select b.predicate, ${label} from kg.live_beliefs b where (b.subject = $1 and b.predicate = 'kg:locatedIn') or (b.object = $1 and b.predicate = 'kg:worksFor') order by 1`, [ent.ospreyL]);
    expect(r).toContainEqual(['kg:locatedIn', 'Dunmore']);
    expect(r.some((x) => x[0] === 'kg:worksFor')).toBe(true);
  });
  it("CQ24 Brannock's berth agreement with the Port of Kessick ends 2028-10-31", async () => {
    const r = await q(alex, `select b.predicate, coalesce(b.value->>'v', ${label}) from kg.live_beliefs b where b.subject = $1 and b.predicate in ('kg:agreementEnds','kg:hasAgreementWith') order by 1`, [ent.brannock]);
    expect(r).toContainEqual(['kg:agreementEnds', '2028-10-31']);
    expect(r).toContainEqual(['kg:hasAgreementWith', 'Port of Kessick']);
  });
});
