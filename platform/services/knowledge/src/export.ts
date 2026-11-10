// A floor's export (dev plan, PR 3c): the beliefs held in sight from a floor as RDF with PROV-O provenance, for
// a reasoner or a triple store beside the service (ADR 0079 keeps the store Postgres; this is the door out).
// Read as the person on the floor like every other read: what row security hides is not exported, and evidence
// on floors out of sight is a count, never a node. Turtle gives one graph; TriG puts the beliefs in a named
// graph for the floor, with the entities, observations and sources they rest on in the default graph.
import { DataFactory, Writer, type Quad_Graph, type Quad_Object, type Quad_Predicate, type Quad_Subject } from 'n3';
import type pg from 'pg';
import { entityId } from './ids.ts';
import { LIVE, type Modality, type Value } from './objects.ts';

const { namedNode, literal, quad, defaultGraph } = DataFactory;

/** The namespace of the shipped base profile, as the shapes use it. */
export const KG = 'urn:augur:kg:';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const PROV = 'http://www.w3.org/ns/prov#';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
export const PREFIXES = { kg: KG, rdf: RDF, rdfs: RDFS, xsd: XSD, prov: PROV, skos: SKOS };

export type ExportFormat = 'turtle' | 'trig';
export const EXPORT_TYPES: Record<ExportFormat, string> = { turtle: 'text/turtle', trig: 'application/trig' };

const term = (iri: string) => namedNode(iri.startsWith('kg:') ? KG + iri.slice(3) : iri);
const k = (local: string) => namedNode(KG + local);
const ent = (uuid: string) => namedNode(`${KG}entity:${entityId(uuid)}`);
const obs = (uuid: string) => namedNode(`${KG}obs:${uuid}`);
const src = (uuid: string) => namedNode(`${KG}source:${uuid}`);
const at = (d: Date) => literal(d.toISOString(), namedNode(XSD + 'dateTime'));
const typed = (v: unknown) =>
  typeof v === 'boolean'
    ? literal(String(v), namedNode(XSD + 'boolean'))
    : typeof v === 'number'
      ? literal(String(v), namedNode(XSD + (Number.isInteger(v) ? 'integer' : 'decimal')))
      : literal(String(v));
const TYPE = namedNode(RDF + 'type');

/** The graph a floor's beliefs go in, in TriG. */
export const floorGraph = (floor: string) => namedNode(`${KG}floor:${encodeURIComponent(floor)}`);

interface BeliefOut {
  id: string;
  home_floor: string;
  subject: string;
  predicate: string;
  value: Value | null;
  object: string | null;
  modality: Modality;
  valid_from: Date | null;
  valid_to: Date | null;
  recorded_at: Date;
  reach: string[];
  seen: string[];
  unseen: string;
}

/** The floor's export as Turtle or TriG text. */
export const exportFloor = async (db: pg.PoolClient, floor: string, format: ExportFormat) => {
  const beliefs = (
    await db.query<BeliefOut>(
      `select b.id, b.home_floor, b.subject, b.predicate, b.value, b.object, b.modality, lower(b.valid) as valid_from, upper(b.valid) as valid_to, b.recorded_at,
              array(select r.floor from kg.belief_reach r where r.belief = b.id order by r.raised_at) as reach,
              array(select e.observation::text from kg.belief_evidence e where e.belief = b.id order by 1) as seen,
              kg.evidence_unseen(b.id) as unseen
       from kg.beliefs b where ${LIVE} order by b.recorded_at, b.id`,
    )
  ).rows;
  const seen = [...new Set(beliefs.flatMap((b) => b.seen))];
  const observations = (
    await db.query<{
      id: string;
      floor: string;
      source: string;
      subject: string;
      predicate: string;
      value: Value | null;
      object: string | null;
      modality: Modality;
      valid_from: Date | null;
      valid_to: Date | null;
      valid_precision: string;
      recorded_at: Date;
      extractor: string;
      ontology_version: number;
      quote: string;
      flagged: boolean;
      retracted: boolean;
    }>(
      `select id, floor, source, subject, predicate, value, object, modality, lower(valid) as valid_from, upper(valid) as valid_to, valid_precision,
              recorded_at, extractor, ontology_version, quote, flagged, retracted_at is not null as retracted
       from kg.observations where id = any($1::uuid[]) and forgotten_at is null order by id`,
      [seen],
    )
  ).rows;
  const sources = (
    await db.query<{ id: string; app: string; ref: string; version: number; floor: string; title: string; written_at: Date | null }>(
      'select id, app, ref, version, floor, title, written_at from kg.sources where id = any($1::uuid[]) order by id',
      [[...new Set(observations.map((o) => o.source))]],
    )
  ).rows;
  const named = [...new Set([...beliefs.flatMap((b) => [b.subject, b.object]), ...observations.flatMap((o) => [o.subject, o.object])].filter((x): x is string => !!x))];
  const entities = (
    await db.query<{ id: string; class: string; state: string; label: string | null }>(
      `select e.id, e.class, e.state,
              (select n.name from kg.entity_names n where n.entity = e.id order by array_position((select kg.my_sight())::text[], n.floor), n.is_label desc, n.name limit 1) as label
       from kg.entities e where e.id = any($1::uuid[]) order by e.id`,
      [named],
    )
  ).rows;
  const used = [...new Set([...beliefs.map((b) => b.predicate), ...observations.map((o) => o.predicate)])];
  const predicates = (
    await db.query<{ iri: string; label: string; kind: string; domain: string | null; range: string | null; datatype: string | null; single_valued: boolean; status: string }>(
      'select iri, label, kind, domain, range, datatype, single_valued, status from kg.predicates where iri = any($1::text[]) order by iri',
      [used],
    )
  ).rows;
  const classes = (
    await db.query<{ iri: string; label: string; parent: string | null; kind: string; status: string; pack_term: string | null }>(
      // The classes the entities have, and every class above them.
      `with recursive up(iri) as (select distinct class from kg.entities where id = any($1::uuid[])
         union select c.parent from kg.classes c join up on c.iri = up.iri where c.parent is not null)
       select c.iri, c.label, c.parent, c.kind, c.status, c.pack_term from kg.classes c join up on up.iri = c.iri order by c.iri`,
      [entities.map((e) => e.id)],
    )
  ).rows;

  const writer = new Writer({ format: format === 'trig' ? 'application/trig' : 'text/turtle', prefixes: PREFIXES });
  const held: Quad_Graph = format === 'trig' ? floorGraph(floor) : defaultGraph();
  const add = (s: Quad_Subject, p: Quad_Predicate, o: Quad_Object, g: Quad_Graph = defaultGraph()) => writer.addQuad(quad(s, p, o, g));

  for (const c of classes) {
    add(term(c.iri), TYPE, namedNode(RDFS + 'Class'));
    add(term(c.iri), namedNode(RDFS + 'label'), literal(c.label));
    add(term(c.iri), k('status'), literal(c.status));
    add(term(c.iri), k('kind'), literal(c.kind));
    if (c.parent) add(term(c.iri), namedNode(RDFS + 'subClassOf'), term(c.parent));
    if (c.pack_term) add(term(c.iri), namedNode(SKOS + 'exactMatch'), namedNode(c.pack_term));
  }
  for (const p of predicates) {
    add(term(p.iri), TYPE, k('Predicate'));
    add(term(p.iri), namedNode(RDFS + 'label'), literal(p.label));
    add(term(p.iri), k('predicateKind'), literal(p.kind));
    add(term(p.iri), k('status'), literal(p.status));
    if (p.domain) add(term(p.iri), k('domain'), term(p.domain));
    if (p.range) add(term(p.iri), k('range'), term(p.range));
    if (p.datatype) add(term(p.iri), k('datatype'), literal(p.datatype));
    add(term(p.iri), k('singleValued'), typed(p.single_valued));
  }
  const inSight = new Set(entities.map((e) => e.id));
  for (const e of entities) {
    add(ent(e.id), TYPE, k('Entity'));
    add(ent(e.id), TYPE, term(e.class));
    add(ent(e.id), k('class'), term(e.class));
    add(ent(e.id), k('state'), literal(e.state));
    if (e.label) add(ent(e.id), namedNode(RDFS + 'label'), literal(e.label));
  }
  // A belief in sight can link to an entity no floor in sight names: it is said to be an entity, and no more.
  for (const id of named.filter((n) => !inSight.has(n))) {
    add(ent(id), TYPE, k('Entity'));
    add(ent(id), k('unseen'), typed(true));
  }
  for (const s of sources) {
    add(src(s.id), TYPE, k('Source'));
    add(src(s.id), TYPE, namedNode(PROV + 'Entity'));
    add(src(s.id), k('app'), literal(s.app));
    add(src(s.id), k('ref'), literal(s.ref));
    add(src(s.id), k('version'), typed(s.version));
    add(src(s.id), k('floor'), literal(s.floor));
    add(src(s.id), namedNode(RDFS + 'label'), literal(s.title));
    if (s.written_at) add(src(s.id), namedNode(PROV + 'generatedAtTime'), at(s.written_at));
  }
  const kept = new Set(observations.map((o) => o.id));
  for (const o of observations) {
    const n = obs(o.id);
    add(n, TYPE, k('Observation'));
    add(n, TYPE, namedNode(PROV + 'Entity'));
    add(n, k('floor'), literal(o.floor));
    add(n, namedNode(PROV + 'wasDerivedFrom'), src(o.source));
    add(n, k('subject'), ent(o.subject));
    add(n, k('predicate'), term(o.predicate));
    add(n, k('modality'), literal(o.modality));
    add(n, k('validPrecision'), literal(o.valid_precision));
    add(n, k('recordedAt'), at(o.recorded_at));
    add(n, k('extractor'), literal(o.extractor));
    add(n, k('ontologyVersion'), typed(o.ontology_version));
    add(n, k('quote'), literal(o.quote));
    add(n, k('flagged'), typed(o.flagged));
    add(n, k('retracted'), typed(o.retracted));
    if (o.valid_from) add(n, k('validFrom'), at(o.valid_from));
    if (o.valid_to) add(n, k('validTo'), at(o.valid_to));
    if (o.object) add(n, k('object'), ent(o.object));
    else if (o.value) {
      add(n, k('value'), typed(o.value.v));
      if (o.value.unit) add(n, k('unit'), literal(o.value.unit));
    }
  }
  for (const b of beliefs) {
    const n = namedNode(`${KG}belief:${b.id}`);
    add(n, TYPE, k('Belief'), held);
    add(n, TYPE, namedNode(PROV + 'Entity'), held);
    add(n, k('homeFloor'), literal(b.home_floor), held);
    add(n, k('subject'), ent(b.subject), held);
    add(n, k('predicate'), term(b.predicate), held);
    add(n, k('modality'), literal(b.modality), held);
    add(n, k('recordedAt'), at(b.recorded_at), held);
    add(n, namedNode(PROV + 'generatedAtTime'), at(b.recorded_at), held);
    if (b.valid_from) add(n, k('validFrom'), at(b.valid_from), held);
    if (b.valid_to) add(n, k('validTo'), at(b.valid_to), held);
    if (b.object) add(n, k('object'), ent(b.object), held);
    else if (b.value) {
      add(n, k('value'), typed(b.value.v), held);
      if (b.value.unit) add(n, k('unit'), literal(b.value.unit), held);
    }
    for (const r of b.reach) add(n, k('heldOn'), literal(r), held);
    for (const e of b.seen.filter((x) => kept.has(x))) {
      add(n, k('evidence'), obs(e), held);
      add(n, namedNode(PROV + 'wasDerivedFrom'), obs(e), held);
    }
    // Evidence on floors out of sight is a count: the kind of floor it is on would say more than the belief does.
    if (Number(b.unseen)) add(n, k('evidenceUnseen'), typed(Number(b.unseen)), held);
  }
  return new Promise<string>((resolve, reject) => writer.end((err, text) => (err ? reject(err) : resolve(text ?? ''))));
};

const OWL = 'http://www.w3.org/2002/07/owl#';
/** The ontology itself, and each of its versions, as OWL names them. */
export const ONTOLOGY_IRI = `${KG}ontology`;
/** What a property's values are, as XSD names them. */
const XSD_OF: Record<string, string> = { text: 'string', boolean: 'boolean', date: 'dateTime', quantity: 'decimal' };

/**
 * The deployment's ontology now as OWL, in Turtle (draft 4, section 5): the base profile and every term adopted
 * since, never a candidate. Each class and predicate keeps its status and, where it has one, its pack term as
 * skos:exactMatch; a predicate keeps the other names extraction asks for it by as skos:hiddenLabel. The ontology
 * belongs to no floor, so nothing here is fenced.
 */
export const exportOntology = async (db: pg.Pool | pg.PoolClient, base: string) => {
  const [version, classes, predicates] = await Promise.all([
    db.query<{ v: number }>('select max(version)::int as v from kg.ontology_versions'),
    db.query<{ iri: string; label: string; parent: string | null; kind: string; status: string; pack_term: string | null; since_version: number | null }>(
      `select iri, label, parent, kind, status, pack_term, since_version from kg.classes where status in ('base', 'accepted') order by iri`,
    ),
    db.query<{ iri: string; label: string; kind: string; domain: string | null; range: string | null; datatype: string | null; unit: string | null; single_valued: boolean; status: string; pack_term: string | null; since_version: number | null; asked_as: string[] }>(
      `select p.iri, p.label, p.kind, p.domain, p.range, p.datatype, p.unit, p.single_valued, p.status, p.pack_term, p.since_version,
              array(select t.term from kg.predicate_terms t where t.predicate = p.iri order by t.term) as asked_as
       from kg.predicates p where p.status in ('base', 'accepted') order by p.iri`,
    ),
  ]);
  const v = version.rows[0]?.v ?? 1;
  const writer = new Writer({ format: 'text/turtle', prefixes: { ...PREFIXES, owl: OWL } });
  const add = (s: Quad_Subject, p: Quad_Predicate, o: Quad_Object) => writer.addQuad(quad(s, p, o));
  const label = namedNode(RDFS + 'label');
  const ontology = namedNode(ONTOLOGY_IRI);
  add(ontology, TYPE, namedNode(OWL + 'Ontology'));
  add(ontology, label, literal(base));
  add(ontology, namedNode(OWL + 'versionIRI'), namedNode(`${ONTOLOGY_IRI}:v${v}`));
  add(ontology, namedNode(OWL + 'versionInfo'), literal(String(v)));
  const since = (n: Quad_Subject, at: number | null) => {
    if (at !== null) add(n, k('sinceVersion'), typed(at));
  };
  for (const c of classes.rows) {
    const n = term(c.iri);
    add(n, TYPE, namedNode(OWL + 'Class'));
    add(n, label, literal(c.label));
    add(n, k('status'), literal(c.status));
    add(n, k('kind'), literal(c.kind));
    add(n, namedNode(RDFS + 'isDefinedBy'), ontology);
    if (c.parent) add(n, namedNode(RDFS + 'subClassOf'), term(c.parent));
    if (c.pack_term) add(n, namedNode(SKOS + 'exactMatch'), namedNode(c.pack_term));
    since(n, c.since_version);
  }
  for (const p of predicates.rows) {
    const n = term(p.iri);
    add(n, TYPE, namedNode(OWL + (p.kind === 'link' ? 'ObjectProperty' : 'DatatypeProperty')));
    if (p.single_valued) add(n, TYPE, namedNode(OWL + 'FunctionalProperty'));
    add(n, label, literal(p.label));
    add(n, k('status'), literal(p.status));
    add(n, namedNode(RDFS + 'isDefinedBy'), ontology);
    if (p.domain) add(n, namedNode(RDFS + 'domain'), term(p.domain));
    if (p.range) add(n, namedNode(RDFS + 'range'), term(p.range));
    else if (p.datatype) {
      add(n, namedNode(RDFS + 'range'), namedNode(XSD + (XSD_OF[p.datatype] ?? 'string')));
      add(n, k('datatype'), literal(p.datatype));
    }
    if (p.unit) add(n, k('unit'), literal(p.unit));
    if (p.pack_term) add(n, namedNode(SKOS + 'exactMatch'), namedNode(p.pack_term));
    for (const t of p.asked_as) add(n, namedNode(SKOS + 'hiddenLabel'), literal(t));
    since(n, p.since_version);
  }
  return new Promise<string>((resolve, reject) => writer.end((err, text) => (err ? reject(err) : resolve(text ?? ''))));
};
