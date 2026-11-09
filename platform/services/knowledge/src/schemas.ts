/**
 * The knowledge service's wire shapes, once: Fastify validates requests against them, and
 * contracts/knowledge.openapi.yaml is generated from them (pnpm contracts, ADR 0055). Draft 4's
 * openapi.yaml is the target; gap.test.ts lists what this contract still lacks against it.
 */
import Type, { type Static, type TSchema } from 'typebox';

/** Points at a named schema, keeping its TypeScript type. */
export const ref = <T extends TSchema & { $id?: string }>(schema: T) => Type.Unsafe<Static<T>>(Type.Ref(schema.$id!));

const anyObject = (description: string) => Type.Unsafe<Record<string, unknown>>({ type: 'object', description });
const FloorKind = Type.Union([Type.Literal('personal'), Type.Literal('team'), Type.Literal('org')]);
const Modality = Type.Union([Type.Literal('reported'), Type.Literal('expected'), Type.Literal('planned'), Type.Literal('possible'), Type.Literal('denied')]);
const Effects = Type.Record(Type.String(), Type.Array(Type.String()), { description: 'What changed, by kind: sources, entities, observations, beliefs.' });
const When = (description?: string) => Type.String({ format: 'date-time', ...(description ? { description } : {}) });

export const Problem = Type.Object(
  {
    type: Type.String(),
    title: Type.String(),
    status: Type.Integer(),
    detail: Type.String(),
    reason: Type.String({ description: 'A stable code to switch on: not_found, not_on_floor, not_allowed, unknown_action, idempotency_key_required, idempotency_key_reused, invalid_input, unavailable, …' }),
    whoCanChange: Type.Optional(Type.String({ description: 'A role or floor, never a person’s private detail.' })),
    problems: Type.Optional(Type.Array(Type.String(), { description: 'Each thing wrong with the input.' })),
    error: Type.String({ description: 'The same as reason, for SDK 1.x clients.' }),
    message: Type.String({ description: 'The same as detail, for SDK 1.x clients.' }),
  },
  { $id: 'Problem', description: 'RFC 9457 problem details with AUGUR’s fields.' },
);
/** A problem response, described. */
export const problem = (description: string) => ({ ...ref(Problem), description });

export const Meta = Type.Object(
  {
    apiMajor: Type.Literal(1),
    version: Type.String(),
    ontology: Type.Object({ base: Type.String({ description: 'The shipped base profile.' }), version: Type.String({ description: 'This deployment’s ontology version.' }) }),
    speaks: Type.Record(Type.String(), Type.Array(Type.Integer()), { description: 'Majors this service speaks, for the registry’s install check.' }),
  },
  { $id: 'Meta' },
);

export const Floor = Type.Object(
  {
    id: Type.String(),
    kind: FloorKind,
    parent: Type.Union([Type.String(), Type.Null()]),
    sight: Type.Array(Type.String(), { description: 'This floor and every floor it sees: those above it, and for your own floor, yours and theirs.' }),
    trust: Type.Object({ hold: Type.Union([Type.Literal('memory'), Type.Literal('role'), Type.Literal('auto')], { description: 'How a faithful claim becomes a belief here.' }) }),
  },
  { $id: 'Floor', description: 'A floor you can stand on. Its name is identity’s: ask identity for it.' },
);

export const ActionDecl = Type.Object(
  {
    name: Type.String(),
    since: Type.String(),
    summary: Type.String(),
    input: anyObject('JSON Schema for the body.'),
    who: Type.String({ description: 'Who may take it, in words.' }),
    scope: Type.Union([Type.Literal('knowledge:act'), Type.Literal('knowledge:extract')]),
    role: Type.Optional(Type.String({ description: 'The floor role or standing it also needs.' })),
    grantedToAppsByDefault: Type.Boolean(),
    undoable: Type.Boolean(),
    emits: Type.Array(Type.String()),
  },
  { $id: 'ActionDecl' },
);
export const Catalogue = Type.Object({ apiMajor: Type.Literal(1), version: Type.String(), actions: Type.Array(ref(ActionDecl)) }, { $id: 'Catalogue' });

export const ActionResult = Type.Object(
  {
    action: Type.String(),
    actionId: Type.String(),
    effects: Effects,
    replayed: Type.Optional(Type.Boolean({ description: 'A repeat of an earlier request with the same key and body: this is its first answer.' })),
    dryRun: Type.Optional(Type.Boolean()),
    wouldSucceed: Type.Optional(Type.Boolean()),
    why: Type.Optional(Type.String({ description: 'On a dry run that would be refused, why.' })),
  },
  { $id: 'ActionResult' },
);
export const ActionRecord = Type.Object(
  {
    actionId: Type.String(),
    action: Type.String(),
    by: Type.String({ description: 'Who took it: you, since you can read only your own.' }),
    at: When(),
    effects: Effects,
    undone: Type.Boolean(),
  },
  { $id: 'ActionRecord', description: 'The record of one action you took.' },
);

export const Unseen = Type.Object(
  {
    reason: Type.Union([Type.Literal('elsewhere'), Type.Literal('kept'), Type.Literal('retracted'), Type.Literal('forgotten')]),
    floorKind: FloorKind,
    message: Type.String(),
  },
  { $id: 'Unseen', description: 'Why something can’t be seen from here. Never carries its label.' },
);
export const UnseenObject = Type.Object(
  { kind: Type.Union([Type.Literal('entity'), Type.Literal('observation'), Type.Literal('belief'), Type.Literal('source'), Type.Literal('summary')]), id: Type.String(), unseen: ref(Unseen) },
  { $id: 'UnseenObject' },
);

export const Entity = Type.Object(
  {
    id: Type.String({ description: '`ent_` and a ULID. Made by the service, never by a model; it survives merges.' }),
    class: Type.String({ description: 'The nearest accepted class IRI.' }),
    kind: Type.Union([Type.Literal('continuant'), Type.Literal('occurrent')]),
    state: Type.Union([Type.Literal('active'), Type.Literal('retired'), Type.Literal('merged')]),
    mergedInto: Type.Optional(Type.String()),
    label: Type.String({ description: 'As the floors in sight know it: the nearest floor’s label.' }),
    labelFrom: Type.String({ description: 'The floor the label is from.' }),
    aliases: Type.Array(Type.String()),
  },
  { $id: 'Entity' },
);
export const EntityPage = Type.Object(
  {
    entities: Type.Array(ref(Entity)),
    next: Type.Optional(Type.String({ description: 'Pass as cursor for the next page.' })),
    limitApplied: Type.Optional(Type.Integer({ description: 'The deployment’s ceiling, when it cut the page shorter than you asked.' })),
  },
  { $id: 'EntityPage' },
);

export const Value = Type.Object(
  { v: Type.Union([Type.Number(), Type.String(), Type.Boolean()]), unit: Type.Optional(Type.String()), approx: Type.Optional(Type.Boolean()), asked: Type.Optional(Type.String()) },
  { $id: 'Value', description: 'A typed value. A quantity keeps its unit apart from its number.' },
);

export const Evidence = Type.Object(
  {
    observations: Type.Integer({ description: 'Every observation behind it, those you can’t see included.' }),
    sources: Type.Integer({ description: 'Distinct (app, ref). Versions count once.' }),
    unseen: Type.Integer({ description: 'How many of the observations are on floors you can’t see.' }),
    byFloor: Type.Array(Type.Object({ floor: Type.String(), floorKind: FloorKind, observations: Type.Integer() }), { description: 'The ones you can see, by floor.' }),
  },
  { $id: 'Evidence', description: 'Structure, not a score.' },
);

export const Dispute = Type.Object(
  {
    id: Type.String(),
    belief: Type.String(),
    floor: Type.String(),
    by: Type.String(),
    reason: Type.String(),
    at: When(),
    state: Type.Union([Type.Literal('open'), Type.Literal('upheld'), Type.Literal('retracted'), Type.Literal('withdrawn')]),
    settledBy: Type.Optional(Type.String()),
  },
  { $id: 'Dispute' },
);

export const Belief = Type.Object(
  {
    id: Type.String(),
    homeFloor: Type.String(),
    reach: Type.Array(Type.String(), { description: 'Every floor that holds it.' }),
    subject: Type.String(),
    predicate: Type.String(),
    kind: Type.Union([Type.Literal('property'), Type.Literal('link')]),
    value: Type.Optional(ref(Value)),
    object: Type.Optional(Type.String()),
    modality: Type.String(),
    validFrom: Type.Optional(Type.String({ format: 'date-time' })),
    validTo: Type.Optional(Type.String({ format: 'date-time' })),
    recordedAt: Type.String({ format: 'date-time' }),
    endedAt: Type.Optional(When('When it stopped being so.')),
    supersededAt: Type.Optional(When()),
    supersededBy: Type.Optional(Type.String()),
    state: Type.Union([Type.Literal('memory'), Type.Literal('held'), Type.Literal('disputed'), Type.Literal('superseded'), Type.Literal('ended'), Type.Literal('fallen')], {
      description: 'fallen: every observation behind it was retracted or forgotten.',
    }),
    heldBy: Type.String({ description: 'Who held it, or memory.' }),
    disputes: Type.Optional(Type.Array(ref(Dispute))),
    evidence: ref(Evidence),
  },
  { $id: 'Belief' },
);
export const BeliefList = Type.Object({ floor: Type.String(), seeing: Type.Array(Type.String()), beliefs: Type.Array(ref(Belief)) }, { $id: 'BeliefList' });

export const SourceRef = Type.Object(
  {
    id: Type.String(),
    app: Type.String({ description: 'The app that holds the source. Its text stays there.' }),
    ref: Type.String(),
    version: Type.String({ description: 'Versions of one (app, ref) are one source and count once.' }),
    title: Type.String(),
    floor: Type.String(),
    author: Type.String(),
    writtenAt: Type.Optional(When()),
    publishedFrom: Type.Optional(Type.String({ description: 'The source on a personal floor this one was published from.' })),
    extraction: Type.Optional(
      Type.Object({ observations: Type.Integer({ description: 'Observations read from it, on this floor.' }), flagged: Type.Integer({ description: 'Of those, text that addressed the system.' }) }),
    ),
  },
  { $id: 'SourceRef', description: 'A reference to a source: the app, its ref and version. The text stays in the app that holds it.' },
);

export const Observation = Type.Object(
  {
    id: Type.String(),
    floor: Type.String(),
    source: ref(SourceRef),
    subject: Type.String(),
    predicate: Type.String({ description: 'A declared relation or property IRI.' }),
    kind: Type.Union([Type.Literal('property'), Type.Literal('link')]),
    value: Type.Optional(ref(Value)),
    object: Type.Optional(Type.String()),
    quote: Type.String(),
    anchor: Type.Optional(Type.Object({ start: Type.Integer(), end: Type.Integer() })),
    modality: Modality,
    validFrom: Type.Optional(When()),
    validTo: Type.Optional(When()),
    validPrecision: Type.Union([Type.Literal('minute'), Type.Literal('day'), Type.Literal('month'), Type.Literal('year'), Type.Literal('unknown')]),
    attributedTo: Type.Optional(Type.String({ description: 'The original speaker, when the source relays someone.' })),
    flagged: Type.Optional(Type.Boolean({ description: 'Text that addressed the system. Never held on a shared floor; waits for the owner on a personal one.' })),
    flagReason: Type.Optional(Type.String()),
    state: Type.Union([Type.Literal('memory'), Type.Literal('proposed'), Type.Literal('faithful'), Type.Literal('held'), Type.Literal('disputed'), Type.Literal('retracted'), Type.Literal('flagged')]),
    faithfulBy: Type.Optional(Type.Array(Type.String())),
    derivedFrom: Type.Optional(Type.String()),
    extractor: Type.String(),
    promptVersion: Type.Optional(Type.String()),
    ontologyVersion: Type.String(),
    recordedAt: When(),
  },
  { $id: 'Observation', description: 'One claim read in one source. Immutable: a wrong one is retracted, a private one forgotten.' },
);

const Status = Type.Union([Type.Literal('base'), Type.Literal('accepted'), Type.Literal('proposed'), Type.Literal('dismissed')]);
export const Class = Type.Object(
  {
    iri: Type.String(),
    label: Type.String(),
    parent: Type.Optional(Type.String()),
    kind: Type.Union([Type.Literal('continuant'), Type.Literal('occurrent')]),
    status: Status,
    packTerm: Type.Optional(Type.String({ description: 'skos:exactMatch to the pack (Common Core Ontologies) term.' })),
    sinceVersion: Type.Optional(Type.String()),
  },
  { $id: 'Class' },
);
export const Predicate = Type.Object(
  {
    iri: Type.String(),
    label: Type.String(),
    kind: Type.Union([Type.Literal('property'), Type.Literal('link')]),
    domain: Type.Optional(Type.String()),
    range: Type.Optional(Type.String()),
    datatype: Type.Optional(Type.String({ description: 'quantity, date, text or boolean.' })),
    unit: Type.Optional(Type.String()),
    singleValued: Type.Boolean(),
    status: Status,
  },
  { $id: 'Predicate' },
);
export const Ontology = Type.Object(
  { base: Type.String(), version: Type.String(), classes: Type.Array(ref(Class)), predicates: Type.Array(ref(Predicate)) },
  { $id: 'Ontology', description: 'The deployment’s ontology now: the base profile and the terms adopted since.' },
);
export const Candidate = Type.Object(
  {
    term: Type.String(),
    kind: Type.Union([Type.Literal('class'), Type.Literal('predicate')]),
    suggestedParent: Type.Optional(Type.String()),
    why: Type.Optional(Type.String()),
    askedBy: Type.Integer({ description: 'How many sources asked for it.' }),
    status: Type.Union([Type.Literal('proposed'), Type.Literal('adopted'), Type.Literal('dismissed')]),
  },
  { $id: 'Candidate', description: 'A term extraction asked for that the ontology lacks.' },
);

export const SCHEMAS = [
  Problem, Meta, Floor, ActionDecl, Catalogue, ActionResult, ActionRecord, Unseen, UnseenObject, Entity, EntityPage, Value, Evidence, Dispute, Belief, BeliefList,
  SourceRef, Observation, Class, Predicate, Ontology, Candidate,
];
