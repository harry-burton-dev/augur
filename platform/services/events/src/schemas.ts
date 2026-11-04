/**
 * The events API's wire shapes, once: Fastify validates requests against them, and
 * contracts/events.openapi.yaml is generated from them (pnpm contracts, ADR 0055).
 * A shape with an `$id` is a named schema in the contract; routes point at it with `ref`.
 */
import Type, { type Static, type TSchema } from 'typebox';

/** Points at a named schema, keeping its TypeScript type. */
export const ref = <T extends TSchema & { $id?: string }>(schema: T) => Type.Unsafe<Static<T>>(Type.Ref(schema.$id!));

/** A topic: the publisher's id, then what happened, dotted: "folio.document.published". */
export const TOPIC = '^[a-z][a-z0-9-]*(\\.[a-z][a-z0-9-]*)+$';
const LEVEL = Type.Enum(['needs', 'info', 'done', 'failed']);

export const EventFloor = Type.Object(
  { id: Type.String(), path: Type.Array(Type.String()) },
  { $id: 'EventFloor', description: 'The floor it happened on, and its path from the root as it stood then' },
);

export const NotificationAction = Type.Object(
  {
    label: Type.String({ minLength: 1, maxLength: 30, description: '"Approve", "Open"' }),
    intent: Type.Object(
      {
        type: Type.String({ pattern: '^[a-z][a-z0-9.-]*$', maxLength: 80, description: 'An intent type some app handles' }),
        payload: Type.Optional(Type.Unknown({ description: "The app's own; at most 1024 bytes as JSON" })),
      },
      { additionalProperties: false },
    ),
  },
  { $id: 'NotificationAction', additionalProperties: false },
);

export const NewNotification = Type.Object(
  {
    app: Type.String({ pattern: '^[a-z][a-z0-9-]{1,39}$', description: 'The app it is about; the Shell opens it' }),
    recipients: Type.Array(Type.String({ minLength: 1, maxLength: 100 }), {
      maxItems: 500,
      uniqueItems: true,
      description: 'User ids; empty only with toTeam or audience',
    }),
    toTeam: Type.Optional(Type.Boolean({ description: "To everyone on the team the call's floor names, instead of recipients" })),
    audience: Type.Optional(
      Type.Array(Type.String({ pattern: '^(org|(person|team|tree|role):[A-Za-z0-9_.:-]{1,100})$' }), {
        minItems: 1,
        maxItems: 20,
        uniqueItems: true,
        description: "Platform services only. Principals such as role:deployment-admin, worked out by identity as it's sent, instead of recipients",
      }),
    ),
    key: Type.Optional(Type.String({ minLength: 1, maxLength: 200, description: "The sender's name for this news; each person is told an app's key once" })),
    level: Type.Enum(['needs', 'info', 'done', 'failed'], { description: '"needs" when the person has to act' }),
    title: Type.String({ minLength: 1, maxLength: 200 }),
    detail: Type.Optional(Type.String({ maxLength: 2000 })),
    link: Type.Optional(Type.String({ pattern: '^/', maxLength: 500, description: 'Path inside the app to open' })),
    actions: Type.Optional(
      Type.Array(ref(NotificationAction), {
        maxItems: 2,
        description: 'Buttons on it in the Shell; pressing one raises its intent through the shell and marks it read',
      }),
    ),
  },
  { $id: 'NewNotification', additionalProperties: false },
);

export const Notification = Type.Object(
  {
    id: Type.String(),
    app: Type.String(),
    level: LEVEL,
    title: Type.String(),
    detail: Type.Optional(Type.String()),
    link: Type.Optional(Type.String()),
    actions: Type.Optional(Type.Array(ref(NotificationAction))),
    createdAt: Type.String({ format: 'date-time' }),
    readAt: Type.Optional(Type.String({ format: 'date-time' })),
    workspace: Type.Optional(ref(EventFloor)),
  },
  { $id: 'Notification' },
);

export const NewAuditEntry = Type.Object(
  {
    actor: Type.Object(
      {
        id: Type.String({ minLength: 1, maxLength: 100, description: "A person's id or a service's name" }),
        kind: Type.Enum(['user', 'service']),
      },
      { additionalProperties: false },
    ),
    app: Type.String({ minLength: 1, maxLength: 40, description: 'The app or service it happened in' }),
    action: Type.String({ pattern: TOPIC, maxLength: 80, description: 'A dotted verb, e.g. "document.published"' }),
    target: Type.Optional(Type.String({ maxLength: 200 })),
    detail: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { maxProperties: 50 })),
  },
  { $id: 'NewAuditEntry', additionalProperties: false },
);

export const AuditEntry = Type.Intersect(
  [ref(NewAuditEntry), Type.Object({ id: Type.String(), at: Type.String({ format: 'date-time' }), workspace: Type.Optional(ref(EventFloor)) })],
  { $id: 'AuditEntry' },
);

export const TeamNotices = Type.Object({ workspace: Type.String(), on: Type.Boolean() }, { $id: 'TeamNotices' });

export const NewDomainEvent = Type.Object(
  {
    topic: Type.String({ pattern: TOPIC, maxLength: 120, examples: ['folio.document.published'] }),
    id: Type.String({ minLength: 1, maxLength: 100, description: "The publisher's own id for it" }),
    workspace: Type.Optional(Type.String({ minLength: 1, maxLength: 100, description: 'The floor it happened on' })),
    payload: Type.Unknown(),
  },
  { $id: 'NewDomainEvent', additionalProperties: false },
);

export const DomainEvent = Type.Object(
  {
    seq: Type.String(),
    topic: Type.String(),
    id: Type.String(),
    publisher: Type.String(),
    at: Type.String({ format: 'date-time' }),
    workspace: Type.Optional(ref(EventFloor)),
    payload: Type.Unknown(),
  },
  { $id: 'DomainEvent' },
);


/**
 * What every refusal carries: an RFC 9457 problem (`application/problem+json`, @augur/service-kit's
 * problemDetails), with AUGUR's `reason` and `whoCanChange`, and `error` and `message` for SDK 1.x clients.
 * A handler may send just `{ error, message }`: problemDetails adds the rest.
 */
export const Refusal = Type.Unsafe<{ error: string; message: string; [extension: string]: unknown }>(
  Type.Object(
    {
      type: Type.String({ description: 'about:blank unless the problem names its own type' }),
      title: Type.String({ description: "The status's own phrase" }),
      status: Type.Integer(),
      detail: Type.String({ description: 'Says why, and what would change it' }),
      instance: Type.Optional(Type.String()),
      reason: Type.String({ description: 'A stable code a client can switch on', examples: ['forbidden'] }),
      whoCanChange: Type.Optional(Type.String({ description: 'Who can fix it, in plain words, when someone can' })),
      error: Type.String({ description: 'The same as reason, for SDK 1.x clients' }),
      message: Type.String({ description: 'The same as detail, for SDK 1.x clients' }),
    },
    { $id: 'Refusal' },
  ),
);

/** A refusal, and when it happens. */
export const refused = (description: string) => ({ description, content: { 'application/problem+json': { schema: ref(Refusal) } } });

/** A reply with no body. */
export const empty = (description: string) => Type.Null({ description });

/** Every named schema, in the order the contract lists them. */
export const SCHEMAS = [Refusal, NewNotification, NotificationAction, Notification, NewAuditEntry, AuditEntry, EventFloor, TeamNotices, NewDomainEvent, DomainEvent];
