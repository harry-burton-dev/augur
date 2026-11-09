// The loaded corpus exported as RDF and checked against draft 4's SHACL shapes (draft 4's export_ttl.py).
// rdf-validate-shacl checks SHACL Core. It doesn't run SPARQL-based constraints (sh:sparql), so the five
// shapes written that way (quantity, domain, range, entity status, one reported time per event) are asked here
// of the same export as SQL, and the shapes file is checked to hold exactly those five.
import { readFileSync } from 'node:fs';
import { DataFactory, Parser, Store, type Quad, type Quad_Object, type Quad_Predicate, type Quad_Subject } from 'n3';
import type { QueryResultRow } from 'pg';
import SHACLValidator from 'rdf-validate-shacl';
import { beforeAll, describe, expect, it } from 'vitest';
import { knowledgeDb, loadCorpus } from './db.testing.ts';

const { namedNode, literal, quad } = DataFactory;
const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const KG = 'urn:augur:kg:';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const PROV = 'http://www.w3.org/ns/prov#';
const SH = 'http://www.w3.org/ns/shacl#';

const iri = (p: string) => namedNode(p.startsWith('kg:') ? KG + p.slice(3) : p);
const k = (local: string) => namedNode(KG + local);
const ent = (u: string) => namedNode(`${KG}entity:${u}`);
const dateTime = (d: Date | string) => literal(new Date(d).toISOString(), namedNode(XSD + 'dateTime'));
const typed = (v: unknown) =>
  typeof v === 'boolean' ? literal(String(v), namedNode(XSD + 'boolean'))
  : typeof v === 'number' ? literal(String(v), namedNode(XSD + (Number.isInteger(v) ? 'integer' : 'decimal')))
  : literal(String(v));

/** The store as RDF, the way draft 4 exported it: ontology, entities, sources, observations (not forgotten), beliefs. */
const exportStore = async (q: (sql: string) => Promise<QueryResultRow[]>) => {
  const out: Quad[] = [];
  const add = (s: Quad_Subject, p: Quad_Predicate, o: Quad_Object) => out.push(quad(s, p, o));
  const type = namedNode(RDF + 'type');
  for (const c of await q('select iri, parent, status, kind, pack_term from kg.classes')) {
    add(iri(c.iri), type, namedNode(RDFS + 'Class'));
    add(iri(c.iri), k('status'), literal(c.status));
    add(iri(c.iri), k('kind'), literal(c.kind));
    if (c.parent) add(iri(c.iri), namedNode(RDFS + 'subClassOf'), iri(c.parent));
    if (c.pack_term) add(iri(c.iri), namedNode('http://www.w3.org/2004/02/skos/core#exactMatch'), namedNode(c.pack_term));
  }
  for (const p of await q('select iri, kind, domain, range, datatype, single_valued, status from kg.predicates')) {
    add(iri(p.iri), type, k('Predicate'));
    add(iri(p.iri), k('predicateKind'), literal(p.kind));
    add(iri(p.iri), k('status'), literal(p.status));
    if (p.domain) add(iri(p.iri), k('domain'), iri(p.domain));
    if (p.range) add(iri(p.iri), k('range'), iri(p.range));
    if (p.datatype) add(iri(p.iri), k('datatype'), literal(p.datatype));
    add(iri(p.iri), k('singleValued'), typed(p.single_valued));
  }
  for (const e of await q('select id, class, state from kg.entities')) {
    add(ent(e.id), type, k('Entity'));
    add(ent(e.id), type, iri(e.class));
    add(ent(e.id), k('class'), iri(e.class));
    add(ent(e.id), k('state'), literal(e.state));
  }
  for (const s of await q('select id, app, ref, version, floor from kg.sources')) {
    const n = namedNode(`${KG}source:${s.id}`);
    add(n, type, k('Source'));
    add(n, type, namedNode(PROV + 'Entity'));
    add(n, k('app'), literal(s.app));
    add(n, k('ref'), literal(s.ref));
    add(n, k('version'), typed(s.version));
    add(n, k('floor'), literal(s.floor));
  }
  for (const o of await q(`select id, floor, source, subject, predicate, value, object, modality, lower(valid) as vf, upper(valid) as vt, valid_precision,
      recorded_at, extractor, ontology_version, quote, flagged, retracted_at is not null as retracted from kg.observations where forgotten_at is null`)) {
    const n = namedNode(`${KG}obs:${o.id}`);
    add(n, type, k('Observation'));
    add(n, k('floor'), literal(o.floor));
    add(n, namedNode(PROV + 'wasDerivedFrom'), namedNode(`${KG}source:${o.source}`));
    add(n, k('subject'), ent(o.subject));
    add(n, k('predicate'), iri(o.predicate));
    add(n, k('modality'), literal(o.modality));
    add(n, k('validPrecision'), literal(o.valid_precision));
    add(n, k('recordedAt'), dateTime(o.recorded_at));
    add(n, k('extractor'), literal(o.extractor));
    add(n, k('ontologyVersion'), typed(o.ontology_version));
    add(n, k('quote'), literal(o.quote));
    add(n, k('flagged'), typed(o.flagged));
    add(n, k('retracted'), typed(o.retracted));
    if (o.vf) add(n, k('validFrom'), dateTime(o.vf));
    if (o.vt) add(n, k('validTo'), dateTime(o.vt));
    if (o.object) add(n, k('object'), ent(o.object));
    else if (o.value) {
      add(n, k('value'), typed(o.value.v));
      if (o.value.unit) add(n, k('unit'), literal(o.value.unit));
    }
  }
  for (const b of await q(`select b.id, b.home_floor, b.subject, b.predicate, b.modality, b.recorded_at, lower(b.valid) as vf,
      b.superseded_at is null and b.ended_at is null as current,
      array(select r.floor from kg.belief_reach r where r.belief = b.id and r.withdrawn_at is null) as reach,
      array(select e.observation::text from kg.belief_evidence e where e.belief = b.id) as evidence from kg.beliefs b`)) {
    const n = namedNode(`${KG}belief:${b.id}`);
    add(n, type, k('Belief'));
    add(n, k('homeFloor'), literal(b.home_floor));
    add(n, k('subject'), ent(b.subject));
    add(n, k('predicate'), iri(b.predicate));
    add(n, k('modality'), literal(b.modality));
    add(n, k('recordedAt'), dateTime(b.recorded_at));
    add(n, k('current'), typed(b.current));
    if (b.vf) add(n, k('validFrom'), dateTime(b.vf));
    for (const r of b.reach) add(n, k('heldOn'), literal(r));
    for (const e of b.evidence) {
      add(n, k('evidence'), namedNode(`${KG}obs:${e}`));
      add(n, namedNode(PROV + 'wasDerivedFrom'), namedNode(`${KG}obs:${e}`));
    }
  }
  return out;
};

describe.skipIf(!DATABASE_URL)('SHACL on the loaded store', () => {
  let data: Store;
  const shapes = new Store(new Parser().parse(readFileSync(new URL('./fixtures/shapes.ttl', import.meta.url), 'utf8')));
  beforeAll(async () => {
    await loadCorpus(db);
    data = new Store(await exportStore(async (sql) => (await db.admin.query(sql)).rows));
  });

  it('exports the same graph draft 4 checked: 9,323 triples', () => {
    expect(data.size).toBe(9323);
  });

  it('conforms to the Core shapes, with no results', async () => {
    const core = new Store(shapes.getQuads(null, null, null, null));
    core.removeQuads(core.getQuads(null, namedNode(SH + 'sparql'), null, null));
    const report = await new SHACLValidator(core).validate(data);
    expect(report.results.map((r) => `${r.focusNode?.value} ${r.message.map((m) => m.value).join('; ')}`)).toEqual([]);
    expect(report.conforms).toBe(true);
  });

  it('is not vacuous: the same export without modalities fails', async () => {
    const core = new Store(shapes.getQuads(null, null, null, null));
    core.removeQuads(core.getQuads(null, namedNode(SH + 'sparql'), null, null));
    const broken = new Store(data.getQuads(null, null, null, null));
    broken.removeQuads(broken.getQuads(null, k('modality'), null, null));
    expect((await new SHACLValidator(core).validate(broken)).conforms).toBe(false);
  });

  it('holds exactly five SPARQL-based shapes, and the store passes each one as SQL', async () => {
    expect(shapes.getQuads(null, namedNode(SH + 'sparql'), null, null)).toHaveLength(5);
    const zero = async (what: string, sql: string) => expect((await db.admin.query(sql)).rows[0].n, what).toBe(0);
    await zero('a quantity has a numeric value and its unit apart', `select count(*)::int as n from kg.observations o join kg.predicates p on p.iri = o.predicate
      where p.datatype = 'quantity' and o.forgotten_at is null and o.value is not null and jsonb_typeof(o.value->'v') <> 'number'`);
    await zero("subject inside the predicate's domain", `select count(*)::int as n from kg.observations o join kg.predicates p on p.iri = o.predicate join kg.entities e on e.id = o.subject
      where p.domain is not null and not kg.subclass_of(e.class, p.domain)`);
    await zero("object inside the predicate's range", `select count(*)::int as n from kg.observations o join kg.predicates p on p.iri = o.predicate join kg.entities e on e.id = o.object
      where p.range is not null and not kg.subclass_of(e.class, p.range)`);
    await zero('entities typed only by base or accepted classes', `select count(*)::int as n from kg.entities e join kg.classes c on c.iri = e.class where c.status not in ('base', 'accepted')`);
    await zero('an event has at most one current reported time', `select count(*)::int as n from (select b.subject from kg.beliefs b join kg.entities e on e.id = b.subject
      where kg.is_occurrent(e.class) and b.predicate = 'kg:occursOn' and b.modality = 'reported' and b.superseded_at is null and b.ended_at is null
      group by b.subject having count(*) > 1) x`);
  });
});
