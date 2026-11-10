/**
 * The shapes of the permissions API. They follow the AuthZEN Authorization API 1.0 (OpenID Foundation):
 * an evaluation names a subject, an action and a resource, and the answer is a decision. Keeping that
 * shape keeps the gateway and services independent of the engine behind it (ADR 0085).
 */
import Type, { type Static } from 'typebox';

/** An id as OpenFGA takes it: no spaces, and none of `#`, `:` or `@`, which its keys use as separators. */
const Id = Type.String({ minLength: 1, maxLength: 256, pattern: '^[^\\s#:@]+$' });
/** A type or relation name as the model writes it. */
const Name = Type.String({ minLength: 1, maxLength: 64, pattern: '^[a-z][a-z0-9_]*$' });

export const Subject = Type.Object(
  { type: Name, id: Id, properties: Type.Optional(Type.Record(Type.String(), Type.Unknown())) },
  { description: 'Who is asking: a person, or a persona they are acting as (ADR 0086).' },
);
export const Action = Type.Object(
  { name: Name, properties: Type.Optional(Type.Record(Type.String(), Type.Unknown())) },
  { description: 'What they want to do: one of the resource type’s relations in the model, such as can_manage_members.' },
);
export const Resource = Type.Object(
  { type: Name, id: Id, properties: Type.Optional(Type.Record(Type.String(), Type.Unknown())) },
  { description: 'What they want to do it to.' },
);

export const Evaluation = Type.Object(
  { subject: Subject, action: Action, resource: Resource, context: Type.Optional(Type.Record(Type.String(), Type.Unknown())) },
  { $id: 'Evaluation', additionalProperties: false },
);
export type Evaluation = Static<typeof Evaluation>;

export const Decision = Type.Object(
  { decision: Type.Boolean() },
  { $id: 'Decision', description: 'true when the subject may; false otherwise, including when what was asked does not exist.' },
);

const PartialEvaluation = Type.Object(
  {
    subject: Type.Optional(Subject),
    action: Type.Optional(Action),
    resource: Type.Optional(Resource),
    context: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);

export const SEMANTICS = ['execute_all', 'deny_on_first_deny', 'permit_on_first_permit'] as const;

export const Evaluations = Type.Object(
  {
    subject: Type.Optional(Subject),
    action: Type.Optional(Action),
    resource: Type.Optional(Resource),
    context: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    evaluations: Type.Array(PartialEvaluation, { minItems: 1, maxItems: 50 }),
    options: Type.Optional(Type.Object({ evaluations_semantic: Type.Optional(Type.Union(SEMANTICS.map((s) => Type.Literal(s)))) })),
  },
  {
    $id: 'Evaluations',
    additionalProperties: false,
    description: 'Several evaluations at once. A subject, action, resource or context at the top is the default for each evaluation that leaves it out.',
  },
);
export type Evaluations = Static<typeof Evaluations>;

export const Decisions = Type.Object({ evaluations: Type.Array(Decision) }, { $id: 'Decisions' });
