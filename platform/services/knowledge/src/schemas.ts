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
    effects: Type.Record(Type.String(), Type.Array(Type.String()), { description: 'What changed, by kind: sources, entities, observations, beliefs.' }),
    replayed: Type.Optional(Type.Boolean({ description: 'A repeat of an earlier request with the same key and body: this is its first answer.' })),
    dryRun: Type.Optional(Type.Boolean()),
    wouldSucceed: Type.Optional(Type.Boolean()),
    why: Type.Optional(Type.String({ description: 'On a dry run that would be refused, why.' })),
  },
  { $id: 'ActionResult' },
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
  { kind: Type.Union([Type.Literal('entity'), Type.Literal('observation'), Type.Literal('belief'), Type.Literal('source')]), id: Type.String(), unseen: ref(Unseen) },
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
    state: Type.Union([Type.Literal('memory'), Type.Literal('held'), Type.Literal('disputed')]),
    heldBy: Type.String({ description: 'Who held it, or memory.' }),
    evidence: ref(Evidence),
  },
  { $id: 'Belief' },
);
export const BeliefList = Type.Object({ floor: Type.String(), seeing: Type.Array(Type.String()), beliefs: Type.Array(ref(Belief)) }, { $id: 'BeliefList' });

export const SCHEMAS = [Problem, Meta, Floor, ActionDecl, Catalogue, ActionResult, Unseen, UnseenObject, Entity, Value, Evidence, Belief, BeliefList];
