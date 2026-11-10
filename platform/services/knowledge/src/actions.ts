/**
 * The action catalogue: every way anything in the graph changes. `GET /v1/actions` lists it, with each
 * action's input as JSON Schema, and `POST /v1/actions/{action}` takes one. Clients bind to it at run time
 * (draft 4: "the catalogue is data"), so a new action needs no client rebuild. Within a major an action is
 * only added; no input gains a required field.
 *
 * Each action runs inside one transaction as the person on the floor they stand on, through the store's
 * act_* functions, which check who may do it. Nothing here decides that.
 */
import type pg from 'pg';
import Type, { type Static, type TSchema } from 'typebox';
import { Compile } from 'typebox/compile';
import { entityId, entityUuid, isUuid } from './ids.ts';

/** What an action changed, by kind of object: `{ observations: [...], beliefs: [...] }`. */
export type Effects = Record<string, string[]>;

export interface ActionDecl<T extends TSchema = TSchema> {
  name: string;
  /** The API version that added it. */
  since: string;
  summary: string;
  input: T;
  /** Who may take it, in words. */
  who: string;
  scope: 'knowledge:act' | 'knowledge:extract';
  /** A floor role or standing it also needs. */
  role?: 'settler' | 'raiser' | 'ontology-admin' | 'owner' | 'author' | 'member';
  grantedToAppsByDefault: boolean;
  undoable: boolean;
  emits: string[];
  run(db: pg.ClientBase, input: Static<T>): Promise<Effects>;
}

/** The input doesn't fit: what to fix, in words. */
export class InvalidInput extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join(' '));
  }
}

const Id = (description: string) => Type.String({ minLength: 1, maxLength: 80, description });
const uuidOf = (id: string, what: string) => {
  if (!isUuid(id)) throw new InvalidInput([`${what} isn’t an id the graph gave.`]);
  return id;
};
const entityOf = (id: string, refs: Map<string, string>, what: string) => {
  const uuid = refs.get(id) ?? entityUuid(id);
  if (!uuid) throw new InvalidInput([`${what} names "${id}", which is neither an entity in this call nor an entity id.`]);
  return uuid;
};
const count = (n: string) => {
  if (!/^\d{1,9}$/.test(n)) throw new InvalidInput([`A version must be a whole number; "${n}" isn’t.`]);
  return Number(n);
};

const Value = Type.Object(
  {
    v: Type.Union([Type.Number(), Type.String({ maxLength: 2000 }), Type.Boolean()]),
    unit: Type.Optional(Type.String({ maxLength: 40 })),
    approx: Type.Optional(Type.Boolean()),
    asked: Type.Optional(Type.String({ maxLength: 200, description: 'When the predicate is the generic fallback, the predicate name the extractor asked for.' })),
  },
  { additionalProperties: false, description: 'A typed value. A quantity keeps its unit apart from its number.' },
);
const Key = Type.Object({ scheme: Type.String({ minLength: 1, maxLength: 60 }), value: Type.String({ minLength: 1, maxLength: 200 }) }, { additionalProperties: false });
const Modality = Type.Union([Type.Literal('reported'), Type.Literal('expected'), Type.Literal('planned'), Type.Literal('possible'), Type.Literal('denied')]);
const Precision = Type.Union([Type.Literal('minute'), Type.Literal('day'), Type.Literal('month'), Type.Literal('year'), Type.Literal('unknown')]);

const RetainInput = Type.Object(
  {
    source: Type.Object(
      {
        app: Type.String({ minLength: 1, maxLength: 60, description: 'The app that holds the source.' }),
        ref: Type.String({ minLength: 1, maxLength: 200 }),
        version: Type.String({ pattern: '^[0-9]{1,9}$', description: 'Versions of one (app, ref) are one source and count once.' }),
        contentSha256: Type.String({ pattern: '^[0-9a-f]{64}$' }),
        title: Type.String({ minLength: 1, maxLength: 300 }),
        writtenAt: Type.Optional(Type.String({ format: 'date-time' })),
      },
      { additionalProperties: false },
    ),
    text: Type.Optional(
      Type.String({
        minLength: 1,
        maxLength: 200_000,
        description: 'The source’s text, for the service to extract from through the models service, instead of entities and observations. The answer says what it kept back.',
      }),
    ),
    extractor: Type.Optional(Type.String({ minLength: 1, maxLength: 100, description: 'Who or what extracted the claims. Required with entities and observations.' })),
    promptVersion: Type.Optional(Type.String({ maxLength: 60 })),
    ontologyVersion: Type.Optional(Type.String({ pattern: '^[0-9]{1,9}$', description: 'The ontology the extractor read; the current one when left out.' })),
    entities: Type.Optional(Type.Array(
      Type.Object(
        {
          ref: Type.String({ minLength: 1, maxLength: 60, description: 'Local to this call. Resolution chooses the entity.' }),
          label: Type.String({ minLength: 1, maxLength: 200 }),
          class: Type.String({ minLength: 1, maxLength: 300, description: 'A declared class IRI.' }),
          aliases: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 200 }), { maxItems: 20 })),
          identityKeys: Type.Optional(Type.Array(Key, { maxItems: 10 })),
        },
        { additionalProperties: false },
      ),
      { maxItems: 200 },
    )),
    observations: Type.Optional(Type.Array(
      Type.Object(
        {
          subject: Type.String({ minLength: 1, maxLength: 80, description: 'An entity of this call, by its ref, or an entity id.' }),
          predicate: Type.String({ minLength: 1, maxLength: 300, description: 'A declared IRI.' }),
          kind: Type.Union([Type.Literal('property'), Type.Literal('link')]),
          value: Type.Optional(Value),
          object: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
          quote: Type.String({ maxLength: 2000 }),
          anchor: Type.Optional(Type.Object({ start: Type.Integer({ minimum: 0 }), end: Type.Integer({ minimum: 0 }) }, { additionalProperties: false })),
          modality: Modality,
          validFrom: Type.Optional(Type.String({ format: 'date-time' })),
          validTo: Type.Optional(Type.String({ format: 'date-time' })),
          validPrecision: Type.Optional(Precision),
          attributedTo: Type.Optional(Type.String({ maxLength: 200 })),
          flag: Type.Optional(
            Type.String({ minLength: 1, maxLength: 300, description: 'Why its text seems to speak to the system rather than about the world. It is kept flagged: no floor believes it until its owner keeps it.' }),
          ),
        },
        { additionalProperties: false },
      ),
      { maxItems: 500 },
    )),
    proposals: Type.Optional(
      Type.Array(
        Type.Object(
          {
            term: Type.String({ minLength: 1, maxLength: 120, pattern: '^[A-Za-z][A-Za-z0-9]*$' }),
            kind: Type.Union([Type.Literal('class'), Type.Literal('predicate')]),
            parent: Type.String({ minLength: 1, maxLength: 300, description: 'The declared term it would sit under.' }),
            why: Type.String({ minLength: 1, maxLength: 300 }),
          },
          { additionalProperties: false },
        ),
        { maxItems: 50, description: 'Terms the ontology lacks that the extractor would have used. Each is recorded as a candidate; none is adopted here.' },
      ),
    ),
  },
  { additionalProperties: false, description: 'Extraction output. It can only add: no confirm, dispute, hold, raise or merge can be said here.' },
);

/** The ontology version a claim was read against, when the caller leaves it out: the current one. */
const currentOntology = async (db: pg.ClientBase) => (await db.query<{ v: number }>('select max(version)::int as v from kg.ontology_versions')).rows[0]!.v;

/** How alike two names must be (pg_trgm similarity) to be one entity's, when no key or exact name settles it. */
const SAME_NAME = 0.8;

/** An entity this call names: one an identity key in sight already names, one with the same label and class in sight, one whose name is nearly the same, or a new one here. */
const resolve = async (db: pg.ClientBase, source: string, e: NonNullable<Static<typeof RetainInput>['entities']>[number]) => {
  let uuid: string | undefined;
  const unknownKeys: Static<typeof Key>[] = [];
  for (const key of e.identityKeys ?? []) {
    const { rows } = await db.query<{ entity: string | null }>('select entity from kg.lookup_key($1, $2)', [key.scheme, key.value]);
    if (!rows.length) unknownKeys.push(key);
    else uuid ??= rows[0]!.entity ?? undefined;
  }
  uuid ??= (
    await db.query<{ entity: string }>(
      `select n.entity from kg.entity_names n join kg.entities e on e.id = n.entity where n.name = $1 and e.class = $2 and e.state = 'active' order by n.is_label desc limit 1`,
      [e.label, e.class],
    )
  ).rows[0]?.entity;
  // Then a name close enough to be the same one written another way ("MV Saltmarsh Heron" and "Saltmarsh Heron" are,
  // at 0.84; "Crane C2" and "Crane C3" are not, at 0.6), of the same class, and only when it is one entity, never a guess between two.
  uuid ??= await (async () => {
    const { rows } = await db.query<{ entity: string }>(
      `select distinct n.entity from kg.entity_names n join kg.entities e on e.id = n.entity
       where n.name % $1 and similarity(n.name, $1) >= $3 and e.class = $2 and e.state = 'active' limit 2`,
      [e.label, e.class, SAME_NAME],
    );
    return rows.length === 1 ? rows[0]!.entity : undefined;
  })();
  uuid ??= (await db.query<{ id: string }>('select kg.act_new_entity($1, $2) as id', [e.class, e.label])).rows[0]!.id;
  await db.query('select kg.act_mention($1, $2, $3, null, true)', [source, uuid, e.label]);
  for (const alias of e.aliases ?? []) await db.query('select kg.act_mention($1, $2, $3, null, false)', [source, uuid, alias]);
  // A key known elsewhere stays where it is: adding it here would say which floor keeps it.
  for (const key of unknownKeys) await db.query('select kg.act_add_key($1, $2, $3)', [uuid, key.scheme, key.value]);
  return uuid;
};

/** What `retain` takes, as extraction makes it. */
export type RetainInputOf = Static<typeof RetainInput>;

const retain: ActionDecl<typeof RetainInput> = {
  name: 'retain',
  since: '1.0',
  summary: 'Keep what an extractor read in one source: its entities and its claims, on the floor you stand on',
  input: RetainInput,
  who: 'Anyone who can stand on the floor, for a source on it. On a personal floor each claim is kept as memory at once.',
  scope: 'knowledge:extract',
  grantedToAppsByDefault: true,
  undoable: true,
  emits: ['platform.knowledge.entity.created', 'platform.knowledge.observation.retained'],
  async run(db, input) {
    const { source: s } = input;
    // Text is extracted before the action runs (app.ts), so what reaches here is what was extracted.
    if (input.text !== undefined) throw new InvalidInput(['Send the text to extract, or the entities and observations extracted from it, not both.']);
    if (!input.extractor) throw new InvalidInput(['Say who extracted the claims (extractor).']);
    const source = (await db.query<{ id: string }>('select kg.act_add_source($1, $2, $3, $4, $5, $6) as id', [s.app, s.ref, count(s.version), s.contentSha256, s.title, s.writtenAt ?? null])).rows[0]!.id;
    const refs = new Map<string, string>();
    for (const e of input.entities ?? []) {
      if (refs.has(e.ref)) throw new InvalidInput([`Two entities in this call are both "${e.ref}".`]);
      refs.set(e.ref, await resolve(db, source, e));
    }
    const version = input.ontologyVersion ? count(input.ontologyVersion) : await currentOntology(db);
    const observations: string[] = [];
    for (const [i, o] of (input.observations ?? []).entries()) {
      const at = `Claim ${i + 1}`;
      if (o.kind === 'link' && (!o.object || o.value)) throw new InvalidInput([`${at} is a link, so it names an object and no value.`]);
      if (o.kind === 'property' && (!o.value || o.object)) throw new InvalidInput([`${at} is a property, so it carries a value and no object.`]);
      if (o.anchor && o.anchor.end < o.anchor.start) throw new InvalidInput([`${at}'s anchor ends before it starts.`]);
      const { rows } = await db.query<{ id: string }>(
        `select kg.act_retain($1, $2, $3, $4::jsonb, $5, $6, case when $7::int is null then null else int4range($7::int, $8::int) end,
           tstzrange($9::timestamptz, $10::timestamptz), $11, $12, $13, $14, $15, $16, $17, $18) as id`,
        [
          source,
          entityOf(o.subject, refs, `${at}'s subject`),
          o.predicate,
          o.value ? JSON.stringify(o.value) : null,
          o.object ? entityOf(o.object, refs, `${at}'s object`) : null,
          o.quote,
          o.anchor?.start ?? null,
          o.anchor?.end ?? null,
          o.validFrom ?? null,
          o.validTo ?? null,
          o.validPrecision ?? null,
          o.modality,
          o.attributedTo ?? null,
          input.extractor,
          input.promptVersion ?? '',
          version,
          o.flag !== undefined,
          o.flag ?? null,
        ],
      );
      observations.push(rows[0]!.id);
    }
    for (const p of input.proposals ?? []) await db.query('select kg.act_propose($1, $2, $3, $4, $5)', [p.term, p.kind, p.parent, p.why, source]);
    const beliefs = (await db.query<{ belief: string }>('select distinct belief from kg.belief_evidence where observation = any ($1::uuid[])', [observations])).rows.map((r) => r.belief);
    return { sources: [source], entities: [...new Set(refs.values())].map(entityId), observations, beliefs };
  },
};

const HoldInput = Type.Object(
  {
    observations: Type.Array(Id('An observation'), { minItems: 1, maxItems: 100 }),
    supersedes: Type.Optional(Type.Array(Id('A belief this one replaces'), { maxItems: 100 })),
    into: Type.Optional(Id('An existing belief this evidence also supports')),
  },
  { additionalProperties: false },
);
const hold: ActionDecl<typeof HoldInput> = {
  name: 'hold',
  since: '1.0',
  summary: 'Hold faithful observations as what this floor believes',
  input: HoldInput,
  who: 'The floor’s settler, or anyone on a floor that holds on its own.',
  scope: 'knowledge:act',
  role: 'settler',
  grantedToAppsByDefault: false,
  undoable: true,
  emits: ['platform.knowledge.belief.held'],
  async run(db, input) {
    const { rows } = await db.query<{ id: string }>('select kg.act_hold($1::uuid[], $2::uuid[], $3) as id', [
      input.observations.map((o) => uuidOf(o, 'An observation')),
      (input.supersedes ?? []).map((b) => uuidOf(b, 'A superseded belief')),
      input.into ? uuidOf(input.into, 'The belief to add to') : null,
    ]);
    return { beliefs: [rows[0]!.id] };
  },
};

const KeepInput = Type.Object({ observation: Id('A flagged observation on your own floor') }, { additionalProperties: false });
const keep: ActionDecl<typeof KeepInput> = {
  name: 'keep',
  since: '1.0',
  summary: 'Keep a flagged observation on your own floor, as memory',
  input: KeepInput,
  who: 'The owner of the personal floor it is on.',
  scope: 'knowledge:act',
  role: 'owner',
  grantedToAppsByDefault: false,
  undoable: true,
  emits: [],
  async run(db, input) {
    await db.query('select kg.act_keep($1)', [uuidOf(input.observation, 'The observation')]);
    return { observations: [input.observation] };
  },
};

const ConfirmInput = Type.Object(
  { observation: Id('An observation on a shared floor'), verdict: Type.Union([Type.Literal('faithful'), Type.Literal('unfaithful')]) },
  { additionalProperties: false },
);
const confirmFaithful: ActionDecl<typeof ConfirmInput> = {
  name: 'confirm-faithful',
  since: '1.0',
  summary: 'Say whether an observation says what its source says',
  input: ConfirmInput,
  who: 'Anyone on the floor but the source’s author.',
  scope: 'knowledge:act',
  role: 'member',
  grantedToAppsByDefault: true,
  undoable: false,
  emits: [],
  async run(db, input) {
    await db.query('select kg.act_check_faithful($1, $2)', [uuidOf(input.observation, 'The observation'), input.verdict]);
    return { observations: [input.observation] };
  },
};

/** Every action, by name. */
export const CATALOGUE: ActionDecl[] = [retain, hold, keep, confirmFaithful] as ActionDecl[];
export const actionNamed = (name: string) => CATALOGUE.find((a) => a.name === name);

const checkers = new Map(CATALOGUE.map((a) => [a.name, Compile(a.input)]));
/** The input as the action takes it, or InvalidInput saying what doesn't fit. */
export const checkInput = (action: ActionDecl, input: unknown) => {
  const check = checkers.get(action.name)!;
  if (check.Check(input)) return input;
  throw new InvalidInput(check.Errors(input).slice(0, 10).map((e) => `${e.instancePath || 'The input'}: ${e.message}.`));
};

/** The catalogue entry as the seam shows it: the input is plain JSON Schema. */
export const declaration = ({ run: _, input, ...rest }: ActionDecl) => ({ ...rest, input: JSON.parse(JSON.stringify(input)) as Record<string, unknown> });
