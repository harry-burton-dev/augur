// The seam's query reads (dev plan, PR 3b): what is known by a key, what an extractor may be told, what links
// to an entity, what contradicts, what waits on you, the summaries, a structured query and recall. Each is read
// as the person on the floor they name: row security decides what is there, and what may be known to exist but
// not opened comes back as an Unseen that names no label.
import type pg from 'pg';
import { Problem } from '@augur/service-kit';
import { entityId, entityUuid } from './ids.ts';
import {
  BELIEF_COLUMNS,
  type BeliefRow,
  type Clocks,
  defined,
  ENTITY_COLUMNS,
  type EntityRow,
  type FloorKind,
  iso,
  likeText,
  LIVE,
  notFound,
  onClocks,
  readEntity,
  toBelief,
  toEntity,
  unseenElsewhere,
  type Value,
} from './objects.ts';

/** How alike a name must be to a stretch of the text asked about (pg_trgm's word similarity, 0 to 1). */
const NAME_MATCH = 0.6;
const entities = async (db: pg.PoolClient, sight: string[], ids: string[]) =>
  ids.length ? (await db.query<EntityRow>(`select ${ENTITY_COLUMNS} from kg.entities e where e.id = any($1::uuid[]) order by e.id`, [ids])).rows.map((e) => toEntity(e, sight)) : [];

// ---- Lookup by identity key

/** Whether a thing with this key is known, and where: the entity in sight, or only the kind of floor. Never a personal floor's. */
export const lookup = async (db: pg.PoolClient, sight: string[], scheme: string, value: string) => {
  const k = (await db.query<{ entity: string | null; in_sight: boolean; kept_on: string }>('select * from kg.lookup_key($1, $2)', [scheme, value])).rows[0];
  if (!k) throw notFound('entity with that key');
  if (k.in_sight && k.entity) {
    const entity = await readEntity(db, sight, k.entity);
    if (entity) return entity;
  }
  if (k.in_sight || k.kept_on === 'personal') throw notFound('entity with that key');
  // The entity's id isn't given outside sight (T3): the Unseen names the key that was asked about.
  return unseenElsewhere('entity', `${scheme}:${value}`, k.kept_on as Exclude<FloorKind, 'personal'>);
};

// ---- What an extractor may be told is already known

/**
 * Entities named on the floors in sight, for an extractor working for this floor. With a text, those it may be
 * about: a name or identity key that appears in it, then names alike to a stretch of it, nearest first.
 */
export const knownEntities = async (db: pg.PoolClient, sight: string[], text: string | undefined, limit: number) => {
  const { rows } = await db.query<EntityRow & { rank: number }>(
    `with m as (
       select e.id, case when $1::text is null then 0
                         when e.id in (select kg.keys_in($1)) then 3
                         when exists (select 1 from kg.entity_names n where n.entity = e.id and strpos(lower($1), lower(n.name)) > 0) then 2
                         else coalesce((select max(word_similarity(n.name, $1)) from kg.entity_names n where n.entity = e.id), 0) end as rank
       from kg.entities e where e.state = 'active')
     select ${ENTITY_COLUMNS}, m.rank from m join kg.entities e on e.id = m.id
     where $1::text is null or m.rank >= $2
     order by m.rank desc, e.id limit $3`,
    [text ?? null, NAME_MATCH, limit + 1],
  );
  const page = rows.slice(0, limit);
  return { entities: page.map((e) => toEntity(e, sight)), more: rows.length > limit };
};

// ---- The subgraph around an entity

type Belief = ReturnType<typeof toBelief>;
type Entity = ReturnType<typeof toEntity>;

/**
 * The entity and what links to it through live beliefs in sight, breadth first to `depth` hops, at most `limit`
 * nodes. An entity a belief in sight links to but no floor in sight names comes back as an Unseen.
 */
export const subgraph = async (db: pg.PoolClient, sight: string[], uuid: string, { depth, limit, predicates }: { depth: number; limit: number; predicates?: string[] }) => {
  const root = await readEntity(db, sight, uuid);
  if (!root) throw notFound('entity');
  const nodes = new Map<string, Entity>([[uuid, root]]);
  const unseen = new Map<string, ReturnType<typeof unseenElsewhere>>();
  const edges = new Map<string, Belief>();
  let frontier = [uuid];
  let cut = false;
  for (let hop = 0; hop < depth && frontier.length && !cut; hop++) {
    const { rows } = await db.query<BeliefRow>(
      `select ${BELIEF_COLUMNS} from kg.beliefs b
       where (b.subject = any($1::uuid[]) or b.object = any($1::uuid[])) and b.object is not null and ${LIVE}
         and ($2::text[] is null or b.predicate = any($2::text[]))
       order by b.recorded_at, b.id`,
      [frontier, predicates?.length ? predicates : null],
    );
    const reached: string[] = [];
    for (const b of rows) {
      edges.set(b.id, toBelief(b));
      for (const end of [b.subject, b.object!]) if (!nodes.has(end) && !unseen.has(end) && !reached.includes(end)) reached.push(end);
    }
    const next: string[] = [];
    for (const e of await entities(db, sight, reached)) {
      if (nodes.size >= limit) {
        cut = true;
        break;
      }
      const id = entityUuid(e.id)!;
      nodes.set(id, e);
      next.push(id);
    }
    for (const id of reached.filter((r) => !nodes.has(r))) {
      if (cut) break;
      const kind = (await db.query<{ kind: 'team' | 'org' | null }>('select kg.entity_elsewhere($1) as kind', [id])).rows[0]!.kind;
      if (kind) unseen.set(id, unseenElsewhere('entity', entityId(id), kind));
    }
    frontier = next;
  }
  // An edge to a node the cap left out goes too, so every edge's two ends are in the answer.
  const kept = [...edges.values()].filter((b) => [b.subject, b.object!].every((id) => nodes.has(entityUuid(id)!) || unseen.has(entityUuid(id)!)));
  return defined({ nodes: [...nodes.values()], edges: kept, unseen: [...unseen.values()], limitApplied: cut ? limit : undefined });
};

// ---- Conflicts and possible duplicates

/** Live beliefs in sight that contradict each other, and continuants that may be two things taken for one. */
export const conflicts = async (db: pg.PoolClient, floor: string) => {
  const [pairs, dups] = await Promise.all([
    db.query<{ subject: string; predicate: string; a: string; b: string; overlap_from: Date | null; overlap_to: Date | null }>(
      'select subject, predicate, a, b, lower(overlap) as overlap_from, upper(overlap) as overlap_to from kg.conflicts order by subject, predicate, a, b',
    ),
    db.query<{ entity: string; predicate: string }>('select entity, predicate from kg.possible_duplicates order by entity, predicate'),
  ]);
  return {
    floor,
    conflicts: pairs.rows.map((c) => defined({ subject: entityId(c.subject), predicate: c.predicate, beliefs: [c.a, c.b], overlapFrom: iso(c.overlap_from), overlapTo: iso(c.overlap_to) })),
    possibleDuplicates: dups.rows.map((d) => ({ entity: entityId(d.entity), predicate: d.predicate })),
  };
};

// ---- What waits on this floor for you

type Can = Record<string, boolean | string>;
type QueueItem = { kind: 'to-confirm' | 'to-hold' | 'to-settle' | 'to-keep'; id: string; can: Can };

/**
 * What waits on this floor for the person asking, each with what they can do about it and, when they can't,
 * why and who can. Claims to confirm and to hold on a shared floor, disputes to settle or withdraw, and on your
 * own floor, flagged text to keep.
 */
export const queue = async (db: pg.PoolClient, floor: string, person: string) => {
  const f = (await db.query<{ kind: FloorKind; hold_policy: 'role' | 'auto'; owner: string | null }>('select kind, hold_policy, owner from kg.floors where id = $1', [floor])).rows[0];
  if (!f) throw notFound('floor');
  const roles = (await db.query<{ roles: string[] }>('select kg.my_roles($1) as roles', [floor])).rows[0]!.roles;
  const settler = roles.includes('settler');
  const items: QueueItem[] = [];
  // Live, unflagged observations on this floor that no belief rests on yet.
  const waiting = `o.floor = $1 and o.retracted_at is null and o.forgotten_at is null and not o.flagged
    and not exists (select 1 from kg.belief_evidence e where e.observation = o.id)`;
  if (f.kind !== 'personal') {
    const toConfirm = await db.query<{ id: string; author: string; mine: boolean }>(
      `select o.id, s.author, exists (select 1 from kg.faithful_checks c where c.observation = o.id and c.by_person = $2) as mine
       from kg.observations o join kg.sources s on s.id = o.source
       where ${waiting} and not exists (select 1 from kg.faithful_checks c where c.observation = o.id and c.verdict = 'faithful')
       order by o.recorded_at, o.id`,
      [floor, person],
    );
    for (const o of toConfirm.rows) {
      if (o.mine) continue;
      items.push({
        kind: 'to-confirm',
        id: o.id,
        can: o.author === person ? { confirm: false, why: 'The author of the source can’t confirm what was read from it.', whoCanChange: 'Anyone else on this floor.' } : { confirm: true },
      });
    }
    const toHold = await db.query<{ id: string }>(
      `select o.id from kg.observations o where ${waiting}
         and exists (select 1 from kg.faithful_checks c where c.observation = o.id and c.verdict = 'faithful')
         and not exists (select 1 from kg.faithful_checks c where c.observation = o.id and c.verdict = 'unfaithful')
       order by o.recorded_at, o.id`,
      [floor],
    );
    const canHold: Can = f.hold_policy === 'auto' || settler ? { hold: true } : { hold: false, why: 'Holding needs this floor’s settler role.', whoCanChange: 'A lead of the team, or an admin.' };
    for (const o of toHold.rows) items.push({ kind: 'to-hold', id: o.id, can: canHold });
  } else if (f.owner === person) {
    const toKeep = await db.query<{ id: string }>(
      `select o.id from kg.observations o where o.floor = $1 and o.flagged and o.kept_at is null and o.retracted_at is null and o.forgotten_at is null order by o.recorded_at, o.id`,
      [floor],
    );
    for (const o of toKeep.rows) items.push({ kind: 'to-keep', id: o.id, can: { keep: true } });
  }
  const disputes = await db.query<{ dispute: string; mine: boolean; settles: boolean }>('select * from kg.disputes_waiting() order by dispute');
  for (const d of disputes.rows) items.push({ kind: 'to-settle', id: d.dispute, can: defined({ settle: d.settles, withdraw: d.mine }) });
  return { floor, items };
};

// ---- Summaries

/** The summaries of an entity on the floors in sight, nearest first, each marked when its beliefs moved on since. */
export const summaries = async (db: pg.PoolClient, sight: string[], floor: string, uuid: string) => {
  if (!(await readEntity(db, sight, uuid))) throw notFound('entity');
  const { rows } = await db.query<{ floor: string; text: string; written_at: Date; beliefs_changed_at: Date | null; stale: boolean }>(
    `select s.floor, s.text, s.written_at, kg.last_change(s.entity) as beliefs_changed_at,
            exists (select 1 from kg.stale_summaries t where t.entity = s.entity and t.floor = s.floor) as stale
     from kg.summaries s where s.entity = $1`,
    [uuid],
  );
  const near = (f: string) => sight.indexOf(f);
  const entity = entityId(uuid);
  const found = rows
    .sort((a, b) => near(a.floor) - near(b.floor))
    .map((s) =>
      defined({
        entity,
        floor: s.floor,
        state: s.stale ? ('older-than-beliefs' as const) : ('current' as const),
        text: s.text,
        writtenAt: s.written_at.toISOString(),
        beliefsChangedAt: iso(s.beliefs_changed_at),
        why: s.stale ? 'What the floors believe changed after this was written. Reflect writes it again.' : undefined,
      }),
    );
  return {
    floor,
    summaries: found.length ? found : [{ entity, floor, state: 'none' as const, why: 'No summary of this has been written on the floors you can see. Reflect writes one.' }],
  };
};

// ---- A structured query over beliefs

export interface Where {
  predicate: string;
  equals?: Value;
  object?: string;
  modality?: string;
}
export interface Query extends Clocks {
  class?: string;
  kind?: 'continuant' | 'occurrent';
  text?: string;
  where?: Where[];
  cursor?: string;
  limit: number;
}

/** One `where` as a condition on beliefs (as b), its values pushed onto params. */
const matches = (w: Where, params: unknown[]) => {
  const p = (v: unknown) => `$${params.push(v)}`;
  const parts = [`b.predicate = ${p(w.predicate)}`];
  if (w.equals !== undefined) {
    parts.push(`b.value -> 'v' = ${p(JSON.stringify(w.equals.v))}::jsonb`);
    if (w.equals.unit !== undefined) parts.push(`b.value ->> 'unit' = ${p(w.equals.unit)}`);
  }
  if (w.object !== undefined) {
    const uuid = entityUuid(w.object);
    if (!uuid) throw new Problem(422, 'invalid_input', `"${w.object}" isn’t an entity id.`, { extensions: { problems: [`where.object: "${w.object}" isn’t an entity id.`] } });
    parts.push(`b.object = ${p(uuid)}::uuid`);
  }
  if (w.modality !== undefined) parts.push(`b.modality = ${p(w.modality)}`);
  return parts.join(' and ');
};

/**
 * Entities in sight that fit the query (class, kind, a name, and a belief for each `where`, on the clocks given),
 * with the beliefs that made each fit. Paged by entity id like the entity list.
 */
export const query = async (db: pg.PoolClient, sight: string[], q: Query) => {
  const after = q.cursor === undefined ? null : entityUuid(q.cursor);
  if (q.cursor !== undefined && !after) throw new Problem(422, 'invalid_input', 'That cursor isn’t one a page of the query gave.');
  const params: unknown[] = [q.class ?? null, q.text === undefined ? null : likeText(q.text), q.kind ?? null, after];
  if (q.class !== undefined && !(await db.query('select 1 from kg.classes where iri = $1 or lower(label) = lower($1)', [q.class])).rowCount) {
    throw new Problem(422, 'invalid_input', `The ontology has no class "${q.class}".`, { extensions: { problems: [`class: the ontology has no class "${q.class}".`] } });
  }
  const wheres = (q.where ?? []).map((w) => `${matches(w, params)} and ${onClocks(q, params)}`);
  const fits = wheres.map((c) => `exists (select 1 from kg.beliefs b where b.subject = e.id and ${c})`).join(' and ');
  params.push(q.limit + 1);
  const { rows } = await db.query<EntityRow>(
    `with c as (select iri from kg.classes where $1::text is not null and (iri = $1 or lower(label) = lower($1)) limit 1)
     select ${ENTITY_COLUMNS} from kg.entities e
     where ($1::text is null or exists (select 1 from c where kg.subclass_of(e.class, c.iri)))
       and ($2::text is null or exists (select 1 from kg.entity_names n where n.entity = e.id and n.name ilike $2))
       and ($3::text is null or coalesce(kg.is_occurrent(e.class), false) = ($3 = 'occurrent'))
       and ($4::uuid is null or e.id > $4)
       ${fits ? `and ${fits}` : ''}
     order by e.id limit $${params.length}`,
    params,
  );
  const page = rows.slice(0, q.limit);
  let beliefs: Belief[] = [];
  if (page.length && wheres.length) {
    const bp: unknown[] = [page.map((e) => e.id)];
    const any = (q.where ?? []).map((w) => `(${matches(w, bp)})`).join(' or ');
    const { rows: bs } = await db.query<BeliefRow>(
      `select ${BELIEF_COLUMNS} from kg.beliefs b where b.subject = any($1::uuid[]) and (${any}) and ${onClocks(q, bp)} order by b.subject, b.predicate, b.recorded_at`,
      bp,
    );
    beliefs = bs.map((b) => toBelief(b, q));
  }
  return defined({ entities: page.map((e) => toEntity(e, sight)), beliefs: wheres.length ? beliefs : undefined, next: rows.length > q.limit ? entityId(page.at(-1)!.id) : undefined });
};

// ---- Recall

type Why = 'text' | 'semantic' | 'link' | 'time';
/** What recall can't do on this deployment, and so ran without: there are no vectors yet. */
const RAN_WITHOUT: Why[] = ['semantic'];
/** A rough count of what an answer costs an agent: about four characters a token. */
const tokens = (x: unknown) => Math.ceil(JSON.stringify(x).length / 4);

/**
 * Recall for a person or an agent: beliefs about the entities the text names (text), about what those link to
 * (link), and with `at`, what was so then (time); and their summaries. Semantic retrieval waits for vectors and
 * is said to be missing. Each hit says why it matched; a token budget cuts the answer and says where.
 */
export const recall = async (db: pg.PoolClient, sight: string[], { text, at, limit, tokenBudget }: { text: string; at?: string; limit: number; tokenBudget?: number }) => {
  const named = (
    await db.query<{ id: string; score: number }>(
      `select e.id, max(case when strpos(lower($1), lower(n.name)) > 0 then 1 else word_similarity(n.name, $1) end) as score
       from kg.entities e join kg.entity_names n on n.entity = e.id where e.state = 'active'
       group by e.id having max(case when strpos(lower($1), lower(n.name)) > 0 then 1 else word_similarity(n.name, $1) end) >= $2
       order by score desc, e.id limit $3`,
      [text, NAME_MATCH, limit],
    )
  ).rows;
  const ids = named.map((n) => n.id);
  const score = new Map(named.map((n) => [n.id, Number(n.score)]));
  const params: unknown[] = [ids];
  const when = onClocks({ at }, params);
  const { rows } = await db.query<BeliefRow>(
    `select ${BELIEF_COLUMNS} from kg.beliefs b where (b.subject = any($1::uuid[]) or b.object = any($1::uuid[])) and ${when} order by b.recorded_at desc, b.id`,
    params,
  );
  type Hit = { belief?: Belief; summary?: { entity: string; floor: string; state: 'current' | 'older-than-beliefs'; text: string; writtenAt: string }; why: Why[] };
  const hits: { rank: number; hit: Hit }[] = rows.map((b) => {
    const why: Why[] = [];
    if (ids.includes(b.subject)) why.push('text');
    if (b.object && (ids.includes(b.object) || why.length)) why.push('link');
    if (at !== undefined) why.push('time');
    const rank = Math.max(score.get(b.subject) ?? 0, b.object ? (score.get(b.object) ?? 0) * 0.8 : 0) + why.length * 0.1;
    return { rank, hit: { belief: toBelief(b, { at }), why } };
  });
  const sums = ids.length
    ? (
        await db.query<{ entity: string; floor: string; text: string; written_at: Date; stale: boolean }>(
          `select s.entity, s.floor, s.text, s.written_at, exists (select 1 from kg.stale_summaries t where t.entity = s.entity and t.floor = s.floor) as stale
           from kg.summaries s where s.entity = any($1::uuid[])`,
          [ids],
        )
      ).rows
    : [];
  for (const s of sums) {
    const summary = { entity: entityId(s.entity), floor: s.floor, state: s.stale ? ('older-than-beliefs' as const) : ('current' as const), text: s.text, writtenAt: s.written_at.toISOString() };
    hits.push({ rank: (score.get(s.entity) ?? 0) + 0.15, hit: { summary, why: ['text'] } });
  }
  const ranked = hits.sort((a, b) => b.rank - a.rank).map((h) => h.hit);
  const kept: typeof ranked = [];
  let spent = 0;
  let cutAt: number | undefined;
  for (const h of ranked) {
    if (kept.length >= limit) break;
    const cost = tokens(h);
    if (tokenBudget !== undefined && spent + cost > tokenBudget) {
      cutAt = spent;
      break;
    }
    spent += cost;
    kept.push(h);
  }
  return defined({ hits: kept, ranWithout: RAN_WITHOUT, cutAt });
};
