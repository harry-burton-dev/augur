/**
 * The identity API's wire shapes, once: Fastify validates requests against them, and
 * contracts/identity.openapi.yaml is generated from them (pnpm contracts, ADR 0055).
 * A shape with an `$id` is a named schema in the contract; routes point at it with `ref`.
 */
import Type, { type Static, type TSchema } from 'typebox';
import { MAX_LEVEL_NAME, MAX_TEAM_DEPTH } from './workspaces.ts';

/** Points at a named schema, keeping its TypeScript type. */
export const ref = <T extends TSchema & { $id?: string }>(schema: T) => Type.Unsafe<Static<T>>(Type.Ref(schema.$id!));

/** One of a few strings; says it is a string, as the hand-written contract did. */
export const choice = <const T extends string[]>(values: T, options: { description?: string } = {}) => Type.Unsafe<T[number]>({ type: 'string', enum: values, ...options });

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

const KIND = choice(['org', 'personal', 'team']);
const ROLE = choice(['member', 'lead']);
const strings = (description?: string) => Type.Array(Type.String(), description ? { description } : {});

export const TeamLevels = Type.Object(
  {
    levels: strings('Default ["Department", "Team"]'),
    max: Type.Integer({ description: 'How many levels departments can nest' }),
  },
  { $id: 'TeamLevels' },
);

export const WorkspaceRef = Type.Object(
  {
    id: Type.String(),
    kind: choice(['personal', 'team', 'org']),
    name: Type.String({ description: '"You" for your own floor' }),
    slug: Type.String({ description: 'The word in links, /@finance/…; your own floor is always "me"' }),
    level: Type.Optional(
      Type.String({
        description:
          'Teams only: the name of the level the team sits at, "Department" right below the org and "Team" below that unless an admin renamed them (GET /admin/levels). The kind stays team.',
      }),
    ),
  },
  { $id: 'WorkspaceRef' },
);

export const Floor = Type.Intersect(
  [
    ref(WorkspaceRef),
    Type.Object({
      path: Type.Array(ref(WorkspaceRef), { description: 'From the org down to this floor, itself included. Your own floor is alone on its path.' }),
      role: choice(['member', 'lead'], { description: 'lead on your own floor and on teams you lead' }),
      direct: Type.Boolean({ description: "False when you're on it only through a team below it" }),
    }),
  ],
  { $id: 'Floor' },
);

export const MapPerson = Type.Object({ id: Type.String(), name: Type.String() }, { $id: 'MapPerson' });

export const FloorReason = Type.Object(
  {
    kind: choice(['own', 'org', 'member', 'inside', 'leads-above', 'admin']),
    role: Type.Optional(ROLE),
    via: Type.Optional(ref(MapPerson)),
    team: Type.Optional(ref(MapPerson)),
  },
  {
    $id: 'FloorReason',
    description:
      'Why the caller can come in: own (their own floor), org (everyone is), member (with role), inside (on a team inside it, `via`), leads-above (leads `team`, which this sits inside), admin.',
  },
);

export const PersonMap = Type.Object(
  {
    floors: Type.Array(
      Type.Object({
        id: Type.String(),
        kind: KIND,
        name: Type.String(),
        slug: Type.String(),
        parentId: Type.Optional(Type.String()),
        depth: Type.Integer({ minimum: 0, maximum: MAX_TEAM_DEPTH }),
        open: Type.Boolean({ description: 'False for a team the caller sees into without standing on it' }),
        why: ref(FloorReason),
        people: Type.Integer({ description: 'Everyone who can stand on it' }),
        leads: Type.Array(ref(MapPerson)),
        members: Type.Optional(
          Type.Array(Type.Intersect([ref(MapPerson), Type.Object({ role: ROLE })]), { description: 'Who is on a team directly, leads first' }),
        ),
      }),
    ),
    closed: Type.Array(
      Type.Object({
        id: Type.String(),
        name: Type.String(),
        parentId: Type.Optional(Type.String()),
        depth: Type.Integer({ minimum: 1, maximum: MAX_TEAM_DEPTH }),
        leads: Type.Array(ref(MapPerson)),
      }),
    ),
    principals: strings(),
  },
  { $id: 'PersonMap' },
);

export const Role = Type.Object({ name: Type.String(), description: Type.Optional(Type.String()) }, { $id: 'Role' });

export const Person = Type.Object(
  {
    id: Type.String(),
    username: Type.String(),
    firstName: Type.String(),
    lastName: Type.String(),
    email: Type.Optional(Type.String()),
    enabled: Type.Boolean({ description: 'False when their sign-in is turned off' }),
    invited: Type.Boolean({ description: 'Still has to choose their own password' }),
    roles: strings(),
    departments: strings('Department ids'),
    createdAt: Type.Optional(Type.String({ format: 'date-time' })),
  },
  { $id: 'Person' },
);

const name = () => Type.String({ minLength: 1, maxLength: 80, pattern: '\\S' });
const email = () => Type.String({ minLength: 3, maxLength: 254, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' });
const ids = () => Type.Array(Type.String({ minLength: 1, maxLength: 100 }), { maxItems: 50, uniqueItems: true });

export const NewPerson = Type.Object(
  {
    username: Type.Optional(Type.String({ pattern: '^[a-z0-9][a-z0-9._-]{1,59}$', description: 'Defaults to the part of the email before the @' })),
    firstName: name(),
    lastName: name(),
    email: email(),
    roles: Type.Optional(ids()),
    departments: Type.Optional(ids()),
  },
  { $id: 'NewPerson', additionalProperties: false },
);

export const PersonChanges = Type.Object(
  {
    firstName: Type.Optional(name()),
    lastName: Type.Optional(name()),
    email: Type.Optional(email()),
    enabled: Type.Optional(Type.Boolean()),
    roles: Type.Optional(ids()),
    departments: Type.Optional(ids()),
  },
  { $id: 'PersonChanges', additionalProperties: false, minProperties: 1 },
);

export const Department = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    parentId: Type.Optional(Type.String({ description: 'The department it sits inside; absent at the top' })),
    members: strings('Ids of its own members'),
  },
  { $id: 'Department' },
);

/** A department's name: not blank, and no "/". */
export const departmentName = () => Type.String({ minLength: 1, maxLength: 60, pattern: '^[^/]*[^/\\s][^/]*$', description: 'No /' });

/** The names of the levels of department, from the top. */
export const LevelNames = Type.Object(
  { levels: Type.Array(Type.String({ minLength: 1, maxLength: MAX_LEVEL_NAME }), { minItems: 1, maxItems: MAX_TEAM_DEPTH }) },
  { additionalProperties: false },
);

export const Caller = Type.Object(
  {
    id: Type.String({ description: 'Stable id from the sign-in provider' }),
    name: Type.String(),
    email: Type.Optional(Type.String()),
    departments: strings(),
    roles: strings(),
    signedInAt: Type.Optional(Type.String({ format: 'date-time', description: 'When they last entered their password, when the gateway said' })),
    workspace: Type.Optional(
      Type.Object(
        { id: Type.String(), kind: choice(['personal', 'team', 'org']), role: ROLE },
        { description: 'The floor the request is for, when it named one (x-workspace-id) and the gateway checked the caller is on it' },
      ),
    ),
  },
  { $id: 'Caller' },
);

/** A time of day, 00:00 to 23:59. */
const HHMM = '^([01][0-9]|2[0-3]):[0-5][0-9]$';

/** Refused, not dropped, when unknown: a misspelt setting should fail loudly, not vanish. */
export const Preferences = Type.Object(
  {
    reduceMotion: Type.Optional(Type.Boolean()),
    density: Type.Optional(choice(['comfortable', 'compact'])),
    areaTitles: Type.Optional(Type.Boolean({ description: 'Area title cards on arriving at a floor or opening an app; on unless false' })),
    toasts: Type.Optional(Type.Boolean({ description: 'Each new notification also said once as a toast; off unless true' })),
    away: Type.Optional(Type.Boolean()),
    recent: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 64 }), { maxItems: 12, description: 'App ids, most recent first' })),
    muted: Type.Optional(
      Type.Array(Type.String({ minLength: 1, maxLength: 64 }), {
        maxItems: 100,
        uniqueItems: true,
        description: 'App ids whose notifications land in the stream silently and never on Home',
      }),
    ),
    quietKinds: Type.Optional(
      Type.Array(Type.String({ pattern: '^[a-z][a-z0-9-]{1,39}:[a-z][a-z0-9-]{0,39}$' }), {
        maxItems: 200,
        uniqueItems: true,
        description: 'Kinds of notification, as "<app>:<kind>", that land in the stream silently and never on Home or as a toast',
      }),
    ),
    pinned: Type.Optional(
      Type.Array(Type.String({ minLength: 1, maxLength: 64 }), {
        maxItems: 12,
        uniqueItems: true,
        description: 'App ids they keep first on Home and in the list of apps, in their order',
      }),
    ),
    startFloor: Type.Optional(Type.String({ minLength: 1, maxLength: 64, description: 'The floor id AUGUR opens on when an address names none; their own floor without it' })),
    awayMessage: Type.Optional(Type.String({ maxLength: 140, description: 'What their away status says' })),
    awayUntil: Type.Optional(Type.String({ format: 'date-time', description: 'When being away ends by itself' })),
    timeZone: Type.Optional(Type.String({ minLength: 1, maxLength: 64, description: "IANA, such as Europe/London; without it the organisation's, then the browser's" })),
    notifications: Type.Optional(
      Type.Object(
        {
          email: Type.Optional(Type.Boolean({ description: 'An email for each thing that needs them; on unless false' })),
          digest: Type.Optional(choice(['off', 'daily', 'weekly'], { description: 'One email gathering the rest; off unless chosen' })),
          quietHours: Type.Optional(
            Type.Object(
              { from: Type.String({ pattern: HHMM }), to: Type.String({ pattern: HHMM }) },
              { additionalProperties: false, description: 'HH:MM in their time zone: no toasts and no email between them' },
            ),
          ),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { $id: 'Preferences', additionalProperties: false, description: "Every field is optional; what's missing takes the shell's default." },
);

/** An app's id, as in its manifest. */
export const AppParams = Type.Object({ id: Type.String({ pattern: '^[a-z][a-z0-9-]{1,39}$' }) });

/** A path with only an id in it. */
export const IdParams = Type.Object({ id: Type.String() });

/** Every named schema, in the order the contract lists them. */
export const SCHEMAS = [Refusal, TeamLevels, WorkspaceRef, Floor, MapPerson, FloorReason, PersonMap, Role, Person, NewPerson, PersonChanges, Department, Caller, Preferences];
