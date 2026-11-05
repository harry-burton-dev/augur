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
    kind: Type.Optional(
      Type.String({ pattern: '^[a-z][a-z0-9-]{0,39}$', description: "One of the kinds the app's manifest declares (notifications.kinds), so people can choose how each kind reaches them" }),
    ),
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
    kind: Type.Optional(Type.String({ description: "One of the app's notifications.kinds" })),
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

// ---- the Inbox (ADR 0026) ----

const SLUG = '^[a-z][a-z0-9-]{0,39}$';
const PERSON_OR_TEAM_ID = Type.String({ minLength: 1, maxLength: 100 });

export const InboxRef = Type.Object(
  {
    kind: Type.String({ minLength: 1, maxLength: 40, description: '"ref", or a DocumentRef, EntityRef or UnitRef kind' }),
    app: Type.Optional(Type.String({ maxLength: 40 })),
    id: Type.String({ minLength: 1, maxLength: 200 }),
    label: Type.Optional(Type.String({ maxLength: 200 })),
  },
  { $id: 'InboxRef', additionalProperties: true, maxProperties: 12, description: "A reference back to the thing in the app (the SDK's Ref and its kin), carried as found" },
);

export const InboxOwner = Type.Object(
  {
    kind: Type.Enum(['person', 'team']),
    id: PERSON_OR_TEAM_ID,
    role: Type.Optional(Type.Enum(['lead'], { description: "For a team item: only the team's leads take it" })),
  },
  { $id: 'InboxOwner', additionalProperties: false, description: 'Who an item waits on' },
);

const InboxAllow = Type.Object(
  {
    decline: Type.Optional(Type.Boolean({ default: true })),
    handOn: Type.Optional(Type.Boolean({ default: true })),
    selfComplete: Type.Optional(Type.Boolean({ default: false, description: 'Whether the person may mark it done in the shell' })),
  },
  { additionalProperties: false },
);

const OpenIntent = Type.Object(
  {
    type: Type.String({ pattern: '^[a-z][a-z0-9.-]*$', maxLength: 80, description: 'An intent type some app handles' }),
    payload: Type.Optional(Type.Unknown({ description: "The app's own; at most 1024 bytes as JSON" })),
  },
  { additionalProperties: false },
);

const WHEN = Type.String({ maxLength: 40, pattern: '^\\d{4}-\\d{2}-\\d{2}([T ][0-9:.]+(Z|[+-]\\d{2}:?\\d{2})?)?$', description: 'An ISO date, or date and time' });

export const NewInboxItem = Type.Object(
  {
    kind: Type.String({ pattern: SLUG, description: "One of the kinds the app's manifest declares (inbox.kinds)" }),
    owner: ref(InboxOwner),
    title: Type.String({ minLength: 1, maxLength: 200 }),
    detail: Type.Optional(Type.String({ maxLength: 1000 })),
    subject: ref(InboxRef),
    refs: Type.Optional(Type.Array(ref(InboxRef), { maxItems: 5 })),
    open: Type.Optional(OpenIntent),
    path: Type.Optional(Type.String({ pattern: '^/', maxLength: 500, description: 'Where in the app Open goes when there is no intent' })),
    due: Type.Optional(WHEN),
    allow: Type.Optional(InboxAllow),
    from: Type.Optional(Type.String({ minLength: 1, maxLength: 100, description: 'The person on whose behalf the app made it' })),
    reopen: Type.Optional(Type.Boolean({ description: 'Opens a closed item again' })),
  },
  { $id: 'NewInboxItem', additionalProperties: false },
);

export const InboxChange = Type.Object(
  {
    state: Type.Optional(Type.Enum(['done', 'withdrawn'], { description: 'Closes it: the work was done, or the app took it back' })),
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    detail: Type.Optional(Type.String({ maxLength: 1000 })),
    due: Type.Optional(WHEN),
    refs: Type.Optional(Type.Array(ref(InboxRef), { maxItems: 5 })),
    note: Type.Optional(Type.String({ maxLength: 500, description: "Why, kept in the item's history" })),
  },
  { $id: 'InboxChange', additionalProperties: false },
);

export const InboxItem = Type.Object(
  {
    id: Type.String(),
    app: Type.String(),
    key: Type.String(),
    kind: Type.String(),
    owner: ref(InboxOwner),
    takenBy: Type.Optional(Type.String()),
    takenAt: Type.Optional(Type.String({ format: 'date-time' })),
    state: Type.Enum(['open', 'done', 'declined', 'handed-on', 'withdrawn'], { description: 'handed-on is never set: handing on changes the owner and keeps it open' }),
    title: Type.Optional(Type.String({ description: 'Left out of a leads-only item shown to a member' })),
    detail: Type.Optional(Type.String()),
    subject: Type.Optional(ref(InboxRef)),
    refs: Type.Optional(Type.Array(ref(InboxRef))),
    open: Type.Optional(OpenIntent),
    path: Type.Optional(Type.String()),
    due: Type.Optional(Type.String({ format: 'date-time' })),
    overdue: Type.Optional(Type.Boolean()),
    allow: Type.Object({ decline: Type.Boolean(), handOn: Type.Boolean(), selfComplete: Type.Boolean() }),
    from: Type.Optional(Type.String()),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
    closedAt: Type.Optional(Type.String({ format: 'date-time' })),
    closedBy: Type.Optional(Type.String()),
    closeNote: Type.Optional(Type.String()),
    workspace: Type.Optional(ref(EventFloor)),
    redacted: Type.Optional(Type.Boolean({ description: "A leads-only item shown to a member: that it's there, not what it is" })),
  },
  { $id: 'InboxItem' },
);

export const InboxHistory = Type.Object(
  {
    at: Type.String({ format: 'date-time' }),
    by: Type.Optional(Type.String({ description: "A person's id; none when the app did it" })),
    action: Type.Enum(['created', 'updated', 'taken', 'released', 'declined', 'handed-on', 'done', 'withdrawn', 'reopened']),
    from: Type.Optional(Type.String({ description: 'person:<id> or team:<id>' })),
    to: Type.Optional(Type.String()),
    note: Type.Optional(Type.String()),
  },
  { $id: 'InboxHistory' },
);

export const InboxCounts = Type.Object(
  {
    you: Type.Integer({ description: 'Open items on the person, or taken by them' }),
    teams: Type.Integer({ description: "Untaken items of the person's teams they could take" }),
    overdue: Type.Integer({ description: 'Of `you`, those past due' }),
    doneDays: Type.Integer({ minimum: 1, description: 'How many days back the done tab looks (the deployment's INBOX_DONE_DAYS)' }),
  },
  { $id: 'InboxCounts' },
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
export const SCHEMAS = [Refusal, NewNotification, NotificationAction, Notification, NewAuditEntry, AuditEntry, EventFloor, TeamNotices, NewDomainEvent, DomainEvent, InboxRef, InboxOwner, NewInboxItem, InboxChange, InboxItem, InboxHistory, InboxCounts];
