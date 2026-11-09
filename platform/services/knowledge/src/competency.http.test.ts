// The 24 competency questions again (draft 4, PER-351), this time asked as an app asks them: over HTTP, through
// the client @augur/clients generates from contracts/knowledge.openapi.yaml, as a person standing on a floor.
// competency.test.ts asks the same of the store in SQL. Each answer here is the one the corpus README gives;
// a question the seam can't answer would fail here first, which is the point of asking it twice.
import { knowledgeClient } from '@augur/clients';
import { callerHeaders } from '@augur/service-kit';
import type { FastifyInstance } from 'fastify';
import { DataFactory, Parser, Store } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { knowledgeDb, loadCorpus } from './db.testing.ts';
import { KG } from './export.ts';
import { SHAPES } from './shapes.ts';
import type { Standing } from './standing.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);

/** Where the corpus's people stand, as identity would say: all on the team and so the org, each with a floor of their own. */
const standing = async (): Promise<Standing> => ({ floors: [{ id: 'org', kind: 'org' }, { id: 'team', kind: 'team', parent: 'org' }], memberOf: ['org', 'team'] });
const kindOf = (floor: string) => (floor === 'org' ? 'org' : floor.startsWith('you-') ? 'personal' : 'team') as 'org' | 'team' | 'personal';

type Value = { v: number | string | boolean; unit?: string };
type Belief = {
  id: string;
  homeFloor: string;
  reach: string[];
  subject: string;
  predicate: string;
  value?: Value;
  object?: string;
  modality: string;
  state: string;
  evidence: { observations: number; sources: number; unseen: number; byFloor: unknown[]; seen?: string[] };
};
type Entity = { id: string; class: string; kind: string; label: string; aliases: string[] };

describe.skipIf(!DATABASE_URL)('competency questions over HTTP (draft 4, 24 of 24)', () => {
  let app: FastifyInstance;
  /** The generated client, as one person on one floor, calling the service in process. */
  let as: (person: string, floor: string) => ReturnType<typeof knowledgeClient>;
  const ent: Record<string, string> = {};

  beforeAll(async () => {
    await loadCorpus(db);
    app = await buildApp({ store: db.app, standing, pageLimit: 500 });
    as = (person, floor) =>
      knowledgeClient({
        baseUrl: 'http://knowledge/v1',
        headers: callerHeaders({ id: person, name: person, departments: [], roles: [], workspace: { id: floor, kind: kindOf(floor), role: 'member' } }),
        fetch: async (request: Request) => {
          const url = new URL(request.url);
          const body = request.method === 'GET' ? undefined : await request.text();
          const res = await app.inject({ method: request.method as 'GET', url: `${url.pathname}${url.search}`, headers: Object.fromEntries(request.headers), payload: body || undefined });
          return new Response(res.statusCode === 204 ? null : new Uint8Array(res.rawPayload), { status: res.statusCode, headers: res.headers as Record<string, string> });
        },
      });
    const labels = {
      heron: 'MV Saltmarsh Heron', tern: 'MV Tern Bay', brannock: 'Brannock Lines', gantry: 'Project Gantry', depotD: 'Lowmere depot at Dunmore',
      depotA: 'Ardmor depot', marta: 'Marta Kowal', tug: 'Osprey (harbour tug)', ospreyL: 'Osprey Logistics',
    };
    for (const [key, label] of Object.entries(labels)) {
      const { data } = await as('alex', 'team').GET('/floors/{floor}/entities', { params: { path: { floor: 'team' }, query: { text: label } } });
      const found = (data!.entities as Entity[]).filter((e) => e.label === label || e.aliases.includes(label));
      expect(found, label).toHaveLength(1);
      ent[key] = found[0]!.id;
    }
  });
  afterAll(async () => app?.close());

  const alex = () => as('alex', 'team');
  const beliefs = async (id: string, { floor = 'team', person = 'alex', includeSuperseded = false } = {}) => {
    const { data, error } = await as(person, floor).GET('/floors/{floor}/entities/{id}/beliefs', { params: { path: { floor, id }, query: { includeSuperseded } } });
    expect(error).toBeUndefined();
    return data!.beliefs as Belief[];
  };
  const label = async (id: string) => ((await alex().GET('/floors/{floor}/entities/{id}', { params: { path: { floor: 'team', id } } })).data as Entity).label;
  const events = async (id: string, cls: string) =>
    ((await alex().GET('/floors/{floor}/entities/{id}/events', { params: { path: { floor: 'team', id } } })).data!.entities as Entity[]).filter((e) => e.class === cls);
  const conflicts = async () => (await alex().GET('/floors/{floor}/conflicts', { params: { path: { floor: 'team' } } })).data!;
  const belief = async (id: string) => (await alex().GET('/floors/{floor}/beliefs/{id}', { params: { path: { floor: 'team', id } } })).data as Belief;
  /** The sources behind a belief, as `ref vN`, through its observations in sight. */
  const sourcesOf = async (b: Belief) => {
    const out: { ref: string; version: string; writtenAt?: string }[] = [];
    for (const o of b.evidence.seen ?? []) {
      const { data } = await alex().GET('/floors/{floor}/observations/{id}', { params: { path: { floor: 'team', id: o } } });
      out.push((data as { source: { ref: string; version: string; writtenAt?: string } }).source);
    }
    return out;
  };
  const arrivalDates = async (includeSuperseded: boolean) => {
    const out: Belief[] = [];
    for (const a of await events(ent.heron!, 'kg:Arrival')) out.push(...(await beliefs(a.id, { includeSuperseded })).filter((b) => b.predicate === 'kg:occursOn' && b.homeFloor === 'team'));
    return out;
  };

  it('CQ01 Who operates the MV Saltmarsh Heron? Brannock Lines, reported, more than one source', async () => {
    const r = (await beliefs(ent.heron!)).filter((b) => b.predicate === 'kg:operatedBy');
    expect(r).toHaveLength(1);
    expect(await label(r[0]!.object!)).toBe('Brannock Lines');
    expect(r[0]!.evidence.sources).toBeGreaterThanOrEqual(2);
  });
  it('CQ02 The Heron arrived 6 Nov (reported); the 4 Nov forecast is kept, superseded', async () => {
    const r = (await arrivalDates(true)).filter((b) => String(b.value?.v) < '2026-11-15');
    expect(r.some((b) => b.value?.v === '2026-11-06' && b.modality === 'reported' && b.state !== 'superseded')).toBe(true);
    expect(r.some((b) => b.value?.v === '2026-11-04' && b.modality === 'expected' && b.state === 'superseded')).toBe(true);
  });
  it('CQ03 Two separate arrivals of the Heron (occurrences are Event entities, X4)', async () => {
    expect(await events(ent.heron!, 'kg:Arrival')).toHaveLength(2);
  });
  it('CQ04 The next call is 24 Nov, expected, and no conflict with 6 Nov', async () => {
    const r = (await arrivalDates(false)).filter((b) => String(b.value?.v) > '2026-11-15');
    expect(r.map((b) => [b.value?.v, b.modality])).toEqual([['2026-11-24', 'expected']]);
  });
  it('CQ05 Containers discharged: 186 against 204, one conflict at the same valid time', async () => {
    const c = (await conflicts()).conflicts.filter((x) => x.subject === ent.heron && x.predicate === 'kg:dischargedContainers');
    expect(c).toHaveLength(1);
    expect(new Set(await Promise.all(c[0]!.beliefs.map(async (id) => String((await belief(id)).value?.v))))).toEqual(new Set(['186', '204']));
  });
  it('CQ06 Sent by road: 28 against 40', async () => {
    const c = (await conflicts()).conflicts.filter((x) => x.subject === ent.heron && x.predicate === 'kg:sentByRoad');
    expect(c).toHaveLength(1);
    expect(new Set(await Promise.all(c[0]!.beliefs.map(async (id) => String((await belief(id)).value?.v))))).toEqual(new Set(['28', '40']));
  });
  it('CQ07 The team floor shows three conflicts and no false alarms', async () => {
    const c = (await conflicts()).conflicts;
    expect(c).toHaveLength(3);
    expect(new Set(c.map((x) => x.predicate))).toEqual(new Set(['kg:dischargedContainers', 'kg:sentByRoad', 'kg:worksFor']));
  });
  it("CQ08 The Tern Bay's shaft was not damaged: a negative kept as a value", async () => {
    const r = (await beliefs(ent.tern!)).filter((b) => b.predicate === 'kg:damaged');
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r.every((b) => b.value?.v === false)).toBe(true);
  });
  it("CQ09 From Sam's floor: the team's denial (reported) and Sam's rumour (possible)", async () => {
    const r = (await beliefs(ent.depotA!, { person: 'sam', floor: 'you-sam' })).filter((b) => b.predicate === 'kg:forSale');
    expect(r.some((b) => b.value?.v === false && b.homeFloor === 'team')).toBe(true);
    expect(r.some((b) => b.modality === 'possible' && b.homeFloor === 'you-sam')).toBe(true);
  });
  it('CQ10 Dunmore received 1,410 tonnes (the revision), one distinct source', async () => {
    const r = (await beliefs(ent.depotD!)).filter((b) => b.predicate === 'kg:cargoReceived');
    expect(r.map((b) => [b.value?.v, b.value?.unit, b.evidence.sources])).toEqual([[1410, 'tonne', 1]]);
  });
  it('CQ11 A revision counts once as a source (X5)', async () => {
    const { data } = await alex().POST('/floors/{floor}/query', { params: { path: { floor: 'team' } }, body: {} });
    const revised: [Belief, string[]][] = [];
    for (const e of data!.entities as Entity[]) {
      for (const b of await beliefs(e.id)) {
        if (b.homeFloor !== 'team' || b.evidence.observations <= b.evidence.sources) continue;
        revised.push([b, (await sourcesOf(b)).map((s) => `${s.ref} v${s.version}`)]);
      }
    }
    expect(revised.length).toBeGreaterThanOrEqual(4);
    for (const [b, refs] of revised) expect(new Set(refs.map((v) => v.split(' v')[0])).size).toBe(b.evidence.sources);
    expect(revised.some(([, refs]) => refs.includes('R13 v2'))).toBe(true);
  });
  it('CQ12 Marta Kowal has two employers on a single-valued predicate: flagged as a possible duplicate', async () => {
    expect((await beliefs(ent.marta!)).filter((b) => b.predicate === 'kg:worksFor')).toHaveLength(2);
    expect((await conflicts()).possibleDuplicates).toContainEqual({ entity: ent.marta, predicate: 'kg:worksFor' });
  });
  it('CQ13 The tug Osprey and Osprey Logistics are two entities, with a differentFrom belief', async () => {
    expect((await beliefs(ent.ospreyL!)).filter((b) => b.predicate === 'kg:differentFrom' && b.object === ent.tug)).toHaveLength(1);
    expect(ent.tug).not.toBe(ent.ospreyL);
  });
  it("CQ14 Gantry's budget and spend, value and unit apart", async () => {
    const r = (await beliefs(ent.gantry!)).map((b) => [b.predicate, b.value?.v, b.value?.unit]);
    expect(r).toContainEqual(['kg:budget', 4200000, 'GBP']);
    expect(r).toContainEqual(['kg:spend', 2900000, 'GBP']);
  });
  it('CQ15 Commissioning forecast 11 Dec; the 30 Nov forecast kept as superseded', async () => {
    const { data } = await alex().POST('/floors/{floor}/query', { params: { path: { floor: 'team' } }, body: { class: 'kg:Commissioning' } });
    const r: Belief[] = [];
    for (const e of data!.entities as Entity[]) r.push(...(await beliefs(e.id, { includeSuperseded: true })).filter((b) => b.predicate === 'kg:occursOn' && b.homeFloor === 'team'));
    expect(r.some((b) => b.value?.v === '2026-12-11' && b.modality === 'expected' && b.state !== 'superseded')).toBe(true);
    expect(r.some((b) => b.value?.v === '2026-11-30' && b.state === 'superseded')).toBe(true);
  });
  it('CQ16 The org floor knows only what was raised, its evidence a count it cannot open', async () => {
    const r = await beliefs(ent.heron!, { person: 'jo', floor: 'org' });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ predicate: 'kg:operatedBy', reach: expect.arrayContaining(['org']), evidence: { byFloor: [], seen: [] } });
    expect(r[0]!.evidence.unseen).toBeGreaterThan(0);
  });
  it("CQ17 From the team, nothing of Harry's health, job offer or the Gantry overrun", async () => {
    // Everything the team's export holds, and every entity it can list, without a word from the personal floors.
    const { data: ttl } = await alex().GET('/floors/{floor}/export', { params: { path: { floor: 'team' } }, parseAs: 'text' });
    expect(ttl).not.toMatch(/"R10"|"R25"|68,000|MRI|600,000|you-/);
    const { data } = await alex().GET('/floors/{floor}/entities', { params: { path: { floor: 'team' } } });
    expect((data!.entities as (Entity & { labelFrom: string })[]).filter((e) => e.labelFrom.startsWith('you-'))).toEqual([]);
    const { data: recalled } = await alex().POST('/floors/{floor}/recall', { params: { path: { floor: 'team' } }, body: { text: 'MRI scan, the 68,000 job offer, the 600,000 overrun' } });
    expect(JSON.stringify(recalled)).not.toMatch(/68,000|MRI|600,000/);
  });
  it('CQ18 Text addressing the system (R11, R23) is flagged and changed nothing', async () => {
    // The flagged text is kept apart from what the team believes: nothing it said is held, no entity was made
    // from it, and no dispute or other change waits on anyone. That it was flagged at all is asked in SQL.
    const { data } = await alex().POST('/floors/{floor}/query', { params: { path: { floor: 'team' } }, body: { where: [{ predicate: 'kg:containsInstruction' }] } });
    expect(data!.entities).toEqual([]);
    expect((await alex().GET('/floors/{floor}/entities', { params: { path: { floor: 'team' }, query: { text: 'vantor' } } })).data!.entities).toEqual([]);
    const queue = (await as('jo', 'team').GET('/floors/{floor}/queue', { params: { path: { floor: 'team' } } })).data!;
    expect(queue.items.filter((i) => i.kind === 'to-settle')).toEqual([]);
  });
  it('CQ19 The recorded clock: by 2 Nov the Heron was due 4 Nov; by 5 Nov, 6 Nov', async () => {
    // The corpus was loaded at one moment, so as the corpus README does, what the team knew by a day is what its
    // sources had been written by then.
    const all = (await arrivalDates(true)).filter((b) => String(b.value?.v) < '2026-11-15');
    const written = new Map<string, string>();
    for (const b of all) written.set(b.id, (await sourcesOf(b)).map((s) => s.writtenAt!).sort()[0]!);
    // Known by a day: the latest of them written by then.
    const known = (by: string) => all.filter((b) => written.get(b.id)! <= by && !all.some((x) => written.get(x.id)! > written.get(b.id)! && written.get(x.id)! <= by)).map((b) => b.value?.v);
    expect(known('2026-11-02T23:59:00Z')).toContain('2026-11-04');
    expect(known('2026-11-05T23:59:00Z')).toContain('2026-11-06');
    expect(known('2026-11-05T23:59:00Z')).not.toContain('2026-11-04');
  });
  it("CQ20 The Heron's bunkering: 85 tonnes, density 0.845, kept around the injected text", async () => {
    const r = (await beliefs(ent.heron!)).map((b) => [b.predicate, b.value?.v, b.value?.unit]);
    expect(r).toContainEqual(['kg:fuelQuantity', 85, 'tonne']);
    expect(r.some((x) => x[0] === 'kg:fuelDensity' && x[1] === 0.845)).toBe(true);
  });
  it('CQ21 Project is a proposed class; Project Gantry is typed by its accepted parent meanwhile', async () => {
    const { data } = await alex().GET('/ontology/candidates');
    expect(data!.candidates.filter((c) => c.kind === 'class').map((c) => [c.term, c.status, c.askedBy])).toEqual([['Project', 'proposed', 1]]);
    expect(((await alex().GET('/floors/{floor}/entities/{id}', { params: { path: { floor: 'team', id: ent.gantry! } } })).data as Entity).class).toBe('kg:Act');
  });
  it('CQ22 Extraction asked for more than 50 predicates the base profile lacks', async () => {
    const { data } = await alex().GET('/ontology/candidates');
    expect(data!.candidates.filter((c) => c.kind === 'predicate' && c.status === 'proposed').length).toBeGreaterThan(50);
  });
  it('CQ23 Osprey Logistics is in Dunmore and Kofi Mensah works for it', async () => {
    const located = (await beliefs(ent.ospreyL!)).filter((b) => b.predicate === 'kg:locatedIn');
    expect(await Promise.all(located.map((b) => label(b.object!)))).toContain('Dunmore');
    const { data } = await alex().POST('/floors/{floor}/query', { params: { path: { floor: 'team' } }, body: { where: [{ predicate: 'kg:worksFor', object: ent.ospreyL! }] } });
    expect((data!.entities as Entity[]).length).toBeGreaterThanOrEqual(1);
  });
  it("CQ24 Brannock's berth agreement with the Port of Kessick ends 2028-10-31", async () => {
    const r = await beliefs(ent.brannock!);
    expect(r.filter((b) => b.predicate === 'kg:agreementEnds').map((b) => b.value?.v)).toContain('2028-10-31');
    expect(await Promise.all(r.filter((b) => b.predicate === 'kg:hasAgreementWith').map((b) => label(b.object!)))).toContain('Port of Kessick');
  });

  it('exports the team’s beliefs as TriG, their evidence and sources beside them, with no personal floor in it', async () => {
    const { data: trig, response } = await alex().GET('/floors/{floor}/export', { params: { path: { floor: 'team' }, query: { format: 'trig' } }, parseAs: 'text' });
    expect(response.headers.get('content-type')).toMatch(/application\/trig/);
    const store = new Store(new Parser({ format: 'application/trig' }).parse(trig!));
    const graph = `${KG}floor:team`;
    const held = store.getQuads(null, `http://www.w3.org/1999/02/22-rdf-syntax-ns#type`, `${KG}Belief`, graph);
    expect(held.length).toBeGreaterThan(50);
    expect(store.getQuads(null, 'http://www.w3.org/ns/prov#wasDerivedFrom', null, graph).length).toBeGreaterThan(0);
    expect(store.getQuads(null, `${KG}floor`, null, null).every((q) => !q.object.value.startsWith('you-'))).toBe(true);
  });

  it('exports Turtle that conforms to the Core shapes, as the whole store does', async () => {
    const { data: ttl } = await alex().GET('/floors/{floor}/export', { params: { path: { floor: 'team' } }, parseAs: 'text' });
    const shapes = new Store(new Parser().parse(SHAPES));
    shapes.removeQuads(shapes.getQuads(null, DataFactory.namedNode('http://www.w3.org/ns/shacl#sparql'), null, null));
    const report = await new SHACLValidator(shapes).validate(new Store(new Parser().parse(ttl!)));
    expect(report.results.map((r) => `${r.focusNode?.value} ${r.message.map((m) => m.value).join('; ')}`)).toEqual([]);
  });
});
