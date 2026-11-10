// The seam's object reads (dev plan, PR 3): entities, beliefs, observations, sources and your own action
// records, each read as the person on the floor they name. Row security decides what is there; these only
// shape it, and turn what may be known to exist but not opened into an Unseen that names no label.
import type pg from 'pg';
import { Problem } from '@augur/service-kit';
import { entityId, entityUuid, isUuid } from './ids.ts';

export type FloorKind = 'personal' | 'team' | 'org';
export type Modality = 'reported' | 'expected' | 'planned' | 'possible' | 'denied';
export type Value = { v: number | string | boolean; unit?: string; approx?: boolean; asked?: string };
export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);
/** Leaves out the keys whose value is undefined, so an optional field is absent rather than null. */
export const defined = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
const where = (kind: FloorKind) => (kind === 'org' ? 'the organisation’s floor' : 'a team’s floor');

export const notFound = (what: string) => new Problem(404, 'not_found', `There is no such ${what}, or none you may know exists.`);

/** The store's uuid for an entity id on the seam, or a 404. */
export const entityOr404 = (id: string) => {
  const uuid = entityUuid(id);
  if (!uuid) throw notFound('entity');
  return uuid;
};
/** The store's uuid for an observation, source or belief id, or a 404. */
export const uuidOr404 = (id: string, what: string) => {
  if (!isUuid(id)) throw notFound(what);
  return id.toLowerCase();
};

export const unseenElsewhere = (kind: 'entity' | 'observation' | 'source', id: string, floorKind: FloorKind) => ({
  kind,
  id,
  unseen: { reason: 'elsewhere' as const, floorKind, message: `This is known on ${where(floorKind)}, which you can’t see from here.` },
});

// ---- Entities

export interface EntityRow {
  id: string;
  class: string;
  state: 'active' | 'retired' | 'merged';
  merged_into: string | null;
  occurrent: boolean | null;
  names: { name: string; label: boolean; floor: string }[];
}
export const ENTITY_COLUMNS = `e.id, e.class, e.state, e.merged_into, kg.is_occurrent(e.class) as occurrent,
  coalesce((select jsonb_agg(jsonb_build_object('name', n.name, 'label', n.is_label, 'floor', n.floor)) from kg.entity_names n where n.entity = e.id), '[]') as names`;

/** An entity as the floors in sight know it: the label from the nearest floor that names it, the rest as aliases. */
export const toEntity = (e: EntityRow, sight: string[]) => {
  const near = (floor: string) => (sight.indexOf(floor) === -1 ? sight.length : sight.indexOf(floor));
  const byNearness = [...e.names].sort((a, b) => near(a.floor) - near(b.floor));
  const label = byNearness.find((n) => n.label) ?? byNearness[0]!;
  return defined({
    id: entityId(e.id),
    class: e.class,
    kind: e.occurrent ? ('occurrent' as const) : ('continuant' as const),
    state: e.state,
    mergedInto: e.merged_into ? entityId(e.merged_into) : undefined,
    label: label.name,
    labelFrom: label.floor,
    aliases: [...new Set(e.names.filter((n) => n.name !== label.name).map((n) => n.name))].sort(),
  });
};

export const readEntity = async (db: pg.PoolClient, sight: string[], uuid: string) => {
  const e = (await db.query<EntityRow>(`select ${ENTITY_COLUMNS} from kg.entities e where e.id = $1`, [uuid])).rows[0];
  return e ? toEntity(e, sight) : undefined;
};

export const likeText = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** A page of entities in sight, by id order, with what to pass for the next page. */
export const listEntities = async (
  db: pg.PoolClient,
  sight: string[],
  { class: cls, text, kind, cursor, limit }: { class?: string; text?: string; kind?: 'continuant' | 'occurrent'; cursor?: string; limit: number },
) => {
  const after = cursor === undefined ? null : entityUuid(cursor);
  if (cursor !== undefined && !after) throw new Problem(422, 'invalid_input', 'That cursor isn’t one a page of entities gave.');
  // A class named by label is the same as by IRI: subclasses come too.
  const { rows } = await db.query<EntityRow>(
    `with c as (select iri from kg.classes where $1::text is not null and (iri = $1 or lower(label) = lower($1)) limit 1)
     select ${ENTITY_COLUMNS} from kg.entities e
     where ($1::text is null or exists (select 1 from c where kg.subclass_of(e.class, c.iri)))
       and ($2::text is null or exists (select 1 from kg.entity_names n where n.entity = e.id and n.name ilike $2))
       and ($3::text is null or coalesce(kg.is_occurrent(e.class), false) = ($3 = 'occurrent'))
       and ($4::uuid is null or e.id > $4)
     order by e.id limit $5`,
    [cls ?? null, text === undefined ? null : likeText(text), kind ?? null, after, limit + 1],
  );
  const page = rows.slice(0, limit);
  return defined({ entities: page.map((e) => toEntity(e, sight)), next: rows.length > limit ? entityId(page.at(-1)!.id) : undefined });
};

/** The occurrences (events with their own time) a live belief in sight links to this entity. */
export const entityEvents = async (db: pg.PoolClient, sight: string[], uuid: string) => {
  const { rows } = await db.query<EntityRow>(
    `select ${ENTITY_COLUMNS} from kg.entities e
     where e.id in (select case when b.subject = $1 then b.object else b.subject end from kg.beliefs b
                    where (b.subject = $1 or b.object = $1) and b.object is not null
                      and b.superseded_at is null and b.ended_at is null and kg.stands(b.id))
       and coalesce(kg.is_occurrent(e.class), false)
     order by e.id`,
    [uuid],
  );
  return { entities: rows.map((e) => toEntity(e, sight)) };
};

// ---- Beliefs

export interface BeliefRow {
  id: string;
  home_floor: string;
  reach: string[];
  subject: string;
  predicate: string;
  value: Value | null;
  object: string | null;
  modality: Modality;
  valid_from: Date | null;
  valid_to: Date | null;
  recorded_at: Date;
  ended_at: Date | null;
  superseded_at: Date | null;
  superseded_by: string | null;
  held_by: string;
  disputed: boolean;
  stands: boolean;
  sources_behind: string;
  evidence_unseen: string;
  by_floor: { floor: string; floorKind: FloorKind; observations: number }[];
  seen: string[];
}
export const BELIEF_COLUMNS = `b.id, b.home_floor, array(select r.floor from kg.belief_reach r where r.belief = b.id order by r.raised_at) as reach,
  b.subject, b.predicate, b.value, b.object, b.modality, lower(b.valid) as valid_from, upper(b.valid) as valid_to,
  b.recorded_at, b.ended_at, b.superseded_at, b.superseded_by, b.held_by,
  exists (select 1 from kg.disputes d where d.belief = b.id and d.settled_at is null) as disputed,
  kg.stands(b.id) as stands, kg.sources_behind(b.id) as sources_behind, kg.evidence_unseen(b.id) as evidence_unseen,
  coalesce((select jsonb_agg(jsonb_build_object('floor', x.floor, 'floorKind', x.kind, 'observations', x.n) order by x.floor)
            from (select o.floor, f.kind, count(*)::int as n from kg.belief_evidence be join kg.observations o on o.id = be.observation
                  join kg.floors f on f.id = o.floor where be.belief = b.id group by o.floor, f.kind) x), '[]') as by_floor,
  array(select be.observation::text from kg.belief_evidence be where be.belief = b.id order by 1) as seen`;
/** Believed now: neither superseded nor ended, and still standing on some evidence. */
export const LIVE = 'b.superseded_at is null and b.ended_at is null and kg.stands(b.id)';

/** The two clocks a belief is read on: valid (`at`, so in the world then) and recorded (`known`, as the floors had it then). */
export interface Clocks {
  at?: string;
  known?: string;
  includeSuperseded?: boolean;
}
/**
 * The condition on beliefs (as b) for a read on two clocks, its values pushed onto params. With neither clock,
 * it is LIVE: what is believed now, whatever time it is about. `at` keeps what is so at that moment, and
 * `known` what had been recorded by then and stood on its evidence then (what was forgotten never stood).
 */
/**
 * A clock's moment as Postgres takes it: in UTC, since an RFC 3339 offset can be wider than Postgres allows,
 * and before year 1 (Postgres has no year 0) as the start of time, before anything was recorded.
 */
export const instant = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1 ? '-infinity' : d.toISOString();
};

export const onClocks = ({ at, known, includeSuperseded = false }: Clocks, params: unknown[]) => {
  const p = (v: string) => `$${params.push(instant(v))}::timestamptz`;
  const k = known === undefined ? undefined : p(known);
  const a = at === undefined ? undefined : p(at);
  return [
    k ? `b.recorded_at <= ${k}` : undefined,
    includeSuperseded ? undefined : k ? `(b.superseded_at is null or b.superseded_at > ${k})` : 'b.superseded_at is null',
    a ? `b.valid @> ${a} and (b.ended_at is null or b.ended_at > ${a})` : 'b.ended_at is null',
    k ? `kg.stood_at(b.id, ${k})` : 'kg.stands(b.id)',
  ]
    .filter(Boolean)
    .join(' and ');
};

export const toBelief = (b: BeliefRow, { at, known }: Clocks = {}) => {
  const seen = b.by_floor.reduce((n, f) => n + f.observations, 0);
  // Read as of a moment, what happened to it after that moment hadn't happened yet.
  const superseded = b.superseded_at && (known === undefined || b.superseded_at <= new Date(known));
  const ended = b.ended_at && b.ended_at <= (at === undefined ? new Date() : new Date(at));
  const state = superseded
    ? ('superseded' as const)
    : ended
      ? ('ended' as const)
      : !b.stands
        ? ('fallen' as const)
        : b.disputed
          ? ('disputed' as const)
          : b.held_by === 'memory'
            ? ('memory' as const)
            : ('held' as const);
  return defined({
    id: b.id,
    homeFloor: b.home_floor,
    reach: b.reach,
    subject: entityId(b.subject),
    predicate: b.predicate,
    kind: b.object ? ('link' as const) : ('property' as const),
    value: b.value ?? undefined,
    object: b.object ? entityId(b.object) : undefined,
    modality: b.modality,
    validFrom: iso(b.valid_from),
    validTo: iso(b.valid_to),
    recordedAt: b.recorded_at.toISOString(),
    endedAt: iso(b.ended_at),
    supersededAt: iso(b.superseded_at),
    supersededBy: b.superseded_by ?? undefined,
    state,
    heldBy: b.held_by,
    evidence: { observations: seen + Number(b.evidence_unseen), sources: Number(b.sources_behind), unseen: Number(b.evidence_unseen), byFloor: b.by_floor, seen: b.seen },
  });
};

/** What the floors in sight believe about an entity, now or on the clocks given. */
export const entityBeliefs = async (db: pg.PoolClient, uuid: string, clocks: Clocks = {}) => {
  const params: unknown[] = [uuid];
  const when = onClocks(clocks, params);
  const { rows } = await db.query<BeliefRow>(`select ${BELIEF_COLUMNS} from kg.beliefs b where b.subject = $1 and ${when} order by b.predicate, b.recorded_at`, params);
  return rows.map((b) => toBelief(b, clocks));
};

/** One belief in sight, whatever became of it, with its disputes. */
export const readBelief = async (db: pg.PoolClient, uuid: string) => {
  const b = (await db.query<BeliefRow>(`select ${BELIEF_COLUMNS} from kg.beliefs b where b.id = $1`, [uuid])).rows[0];
  if (!b) return undefined;
  const disputes = await db.query<{ id: string; floor: string; by_person: string; reason: string; at: Date; settled_by: string | null; outcome: 'upheld' | 'retracted' | 'withdrawn' | null }>(
    'select id, floor, by_person, reason, at, settled_by, outcome from kg.disputes where belief = $1 order by at',
    [uuid],
  );
  return {
    ...toBelief(b),
    disputes: disputes.rows.map((d) =>
      defined({ id: d.id, belief: uuid, floor: d.floor, by: d.by_person, reason: d.reason, at: d.at.toISOString(), state: d.outcome ?? ('open' as const), settledBy: d.settled_by ?? undefined }),
    ),
  };
};

// ---- Sources and observations

interface SourceRow {
  id: string;
  floor: string;
  app: string;
  ref: string;
  version: number;
  title: string;
  author: string;
  written_at: Date | null;
  published_from: string | null;
}
const toSource = (s: SourceRow) =>
  defined({
    id: s.id,
    app: s.app,
    ref: s.ref,
    version: String(s.version),
    title: s.title,
    floor: s.floor,
    author: s.author,
    writtenAt: iso(s.written_at),
    publishedFrom: s.published_from ?? undefined,
  });

/** A source in sight with what was read from it, or why it can't be seen from here. */
export const readSource = async (db: pg.PoolClient, uuid: string) => {
  const s = (
    await db.query<SourceRow & { observations: number; flagged: number }>(
      `select s.*, (select count(*)::int from kg.observations o where o.source = s.id) as observations,
              (select count(*)::int from kg.observations o where o.source = s.id and o.flagged) as flagged
       from kg.sources s where s.id = $1`,
      [uuid],
    )
  ).rows[0];
  if (s) return { ...toSource(s), extraction: { observations: s.observations, flagged: s.flagged } };
  const kind = (await db.query<{ kind: FloorKind | null }>('select kg.source_elsewhere($1) as kind', [uuid])).rows[0]!.kind;
  if (!kind) throw notFound('source');
  return unseenElsewhere('source', uuid, kind);
};

interface ObservationRow {
  id: string;
  floor: string;
  floor_kind: FloorKind;
  subject: string;
  predicate: string;
  value: Value | null;
  object: string | null;
  quote: string;
  anchor_from: number | null;
  anchor_to: number | null;
  modality: Modality;
  valid_from: Date | null;
  valid_to: Date | null;
  valid_precision: 'minute' | 'day' | 'month' | 'year' | 'unknown';
  attributed_to: string | null;
  flagged: boolean;
  flag_reason: string | null;
  kept_at: Date | null;
  derived_from: string | null;
  extractor: string;
  prompt_version: string;
  ontology_version: number;
  recorded_at: Date;
  retracted_at: Date | null;
  forgotten_at: Date | null;
  faithful_by: string[];
  held: boolean;
  in_memory: boolean;
  disputed: boolean;
  source: SourceRow;
}

/** One observation in sight, or why it can't be read from here: elsewhere, or forgotten. */
export const readObservation = async (db: pg.PoolClient, uuid: string) => {
  const o = (
    await db.query<ObservationRow>(
      `select o.id, o.floor, f.kind as floor_kind, o.subject, o.predicate, o.value, o.object, o.quote, lower(o.anchor) as anchor_from, upper(o.anchor) as anchor_to,
              o.modality, lower(o.valid) as valid_from, upper(o.valid) as valid_to, o.valid_precision, o.attributed_to, o.flagged, o.flag_reason, o.kept_at,
              o.derived_from, o.extractor, o.prompt_version, o.ontology_version, o.recorded_at, o.retracted_at, o.forgotten_at,
              array(select c.by_person from kg.faithful_checks c where c.observation = o.id and c.verdict = 'faithful' order by c.at) as faithful_by,
              exists (select 1 from kg.belief_evidence e join kg.beliefs b on b.id = e.belief where e.observation = o.id and b.held_by <> 'memory') as held,
              exists (select 1 from kg.belief_evidence e join kg.beliefs b on b.id = e.belief where e.observation = o.id and b.held_by = 'memory') as in_memory,
              exists (select 1 from kg.belief_evidence e join kg.disputes d on d.belief = e.belief where e.observation = o.id and d.settled_at is null) as disputed,
              to_jsonb(s) as source
       from kg.observations o join kg.sources s on s.id = o.source join kg.floors f on f.id = o.floor where o.id = $1`,
      [uuid],
    )
  ).rows[0];
  if (!o) {
    const kind = (await db.query<{ kind: FloorKind | null }>('select kg.observation_elsewhere($1) as kind', [uuid])).rows[0]!.kind;
    if (!kind) throw notFound('observation');
    return unseenElsewhere('observation', uuid, kind);
  }
  if (o.forgotten_at) return { kind: 'observation' as const, id: uuid, unseen: { reason: 'forgotten' as const, floorKind: o.floor_kind, message: 'This was forgotten: what it said is gone.' } };
  const state = o.retracted_at
    ? ('retracted' as const)
    : o.flagged && !o.kept_at
      ? ('flagged' as const)
      : o.disputed
        ? ('disputed' as const)
        : o.held
          ? ('held' as const)
          : o.in_memory
            ? ('memory' as const)
            : o.faithful_by.length
              ? ('faithful' as const)
              : ('proposed' as const);
  const source = o.source as unknown as SourceRow & { written_at: string | null };
  return defined({
    id: o.id,
    floor: o.floor,
    source: toSource({ ...source, written_at: source.written_at ? new Date(source.written_at) : null }),
    subject: entityId(o.subject),
    predicate: o.predicate,
    kind: o.object ? ('link' as const) : ('property' as const),
    value: o.value ?? undefined,
    object: o.object ? entityId(o.object) : undefined,
    quote: o.quote,
    anchor: o.anchor_from !== null && o.anchor_to !== null ? { start: o.anchor_from, end: o.anchor_to } : undefined,
    modality: o.modality,
    validFrom: iso(o.valid_from),
    validTo: iso(o.valid_to),
    validPrecision: o.valid_precision,
    attributedTo: o.attributed_to ?? undefined,
    flagged: o.flagged || undefined,
    flagReason: o.flag_reason ?? undefined,
    state,
    faithfulBy: o.faithful_by.length ? o.faithful_by : undefined,
    derivedFrom: o.derived_from ?? undefined,
    extractor: o.extractor,
    promptVersion: o.prompt_version || undefined,
    ontologyVersion: String(o.ontology_version),
    recordedAt: o.recorded_at.toISOString(),
  });
};

// ---- Your own action records

export const readRun = async (db: pg.PoolClient, person: string, actionId: string) => {
  const r = (await db.query<{ action: string; answer: { effects?: Record<string, string[]> }; at: Date }>('select * from kg.my_run($1)', [actionId])).rows[0];
  if (!r) throw new Problem(404, 'not_found', 'You took no action with that id.');
  const undone = (await db.query<{ t: Date | null }>('select kg.run_undone($1) as t', [actionId])).rows[0]?.t;
  return { actionId, action: r.action, by: person, at: r.at.toISOString(), effects: r.answer.effects ?? {}, undone: !!undone };
};

// ---- The ontology: the same for every floor

export const readOntology = async (db: pg.Pool | pg.PoolClient) => {
  const [classes, predicates, v] = await Promise.all([
    db.query<{ iri: string; label: string; parent: string | null; kind: 'continuant' | 'occurrent'; status: 'base' | 'accepted' | 'proposed' | 'dismissed'; pack_term: string | null; since_version: number | null }>(
      'select iri, label, parent, kind, status, pack_term, since_version from kg.classes order by iri',
    ),
    db.query<{ iri: string; label: string; kind: 'property' | 'link'; domain: string | null; range: string | null; datatype: string | null; unit: string | null; single_valued: boolean; status: 'base' | 'accepted' | 'proposed' | 'dismissed' }>(
      'select iri, label, kind, domain, range, datatype, unit, single_valued, status from kg.predicates order by iri',
    ),
    db.query<{ v: number | null }>('select max(version)::int as v from kg.ontology_versions'),
  ]);
  return {
    version: String(v.rows[0]?.v ?? 1),
    classes: classes.rows.map(toClass),
    predicates: predicates.rows.map((p) =>
      defined({ iri: p.iri, label: p.label, kind: p.kind, domain: p.domain ?? undefined, range: p.range ?? undefined, datatype: p.datatype ?? undefined, unit: p.unit ?? undefined, singleValued: p.single_valued, status: p.status }),
    ),
  };
};
const toClass = (c: { iri: string; label: string; parent: string | null; kind: 'continuant' | 'occurrent'; status: 'base' | 'accepted' | 'proposed' | 'dismissed'; pack_term: string | null; since_version: number | null }) =>
  defined({ iri: c.iri, label: c.label, parent: c.parent ?? undefined, kind: c.kind, status: c.status, packTerm: c.pack_term ?? undefined, sinceVersion: c.since_version === null ? undefined : String(c.since_version) });

/** One class, by IRI or by its label. */
export const readClass = async (db: pg.Pool, iriOrName: string) => {
  const c = (
    await db.query<Parameters<typeof toClass>[0]>(
      'select iri, label, parent, kind, status, pack_term, since_version from kg.classes where iri = $1 or lower(label) = lower($1) order by iri = $1 desc limit 1',
      [iriOrName],
    )
  ).rows[0];
  if (!c) throw new Problem(404, 'not_found', `The ontology has no class "${iriOrName}".`);
  return toClass(c);
};

/** Terms extraction asked for that the ontology lacks, from sources in sight. */
export const listCandidates = async (db: pg.PoolClient) =>
  (
    await db.query<{ term: string; kind: 'class' | 'predicate'; suggested_parent: string | null; why: string; asked_by: number; status: 'proposed' | 'adopted' | 'dismissed' }>(
      'select term, kind, suggested_parent, why, asked_by, status from kg.candidates order by asked_by desc, term',
    )
  ).rows.map((c) => defined({ term: c.term, kind: c.kind, suggestedParent: c.suggested_parent ?? undefined, why: c.why || undefined, askedBy: c.asked_by, status: c.status }));
