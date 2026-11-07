/**
 * The gateway's own API's wire shapes, once: contracts/gateway.openapi.yaml is generated from them
 * (pnpm contracts, ADR 0055). A shape with an `$id` is a named schema in the contract; routes point at
 * it with `ref`. What the gateway forwards to other services is described in their contracts.
 */
import Type, { type Static, type TSchema } from 'typebox';

/** Points at a named schema, keeping its TypeScript type. */
export const ref = <T extends TSchema & { $id?: string }>(schema: T) => Type.Unsafe<Static<T>>(Type.Ref(schema.$id!));

export const ComponentStatus = Type.Object(
  {
    name: Type.String({ description: 'The name it is reached at, e.g. "registry" or "sign-in"' }),
    kind: Type.Enum(['gateway', 'service', 'app', 'sign-in'], { description: "A platform service, or an app's own service" }),
    state: Type.Enum(['up', 'slow', 'down', 'checking'], { description: '"slow" answered in more than 2 seconds; "checking" has not been checked yet' }),
    version: Type.Optional(Type.String({ description: 'The release its /healthz reports' })),
    api: Type.Optional(Type.String({ description: 'The API major it serves, e.g. "v1"' })),
    latencyMs: Type.Optional(Type.Integer({ description: 'How long the last answer took' })),
    checkedAt: Type.Optional(Type.String({ format: 'date-time' })),
    seenAt: Type.Optional(Type.String({ format: 'date-time', description: 'When it last answered' })),
    problem: Type.Optional(Type.String({ description: 'Why it is down, in words an admin can act on' })),
  },
  { $id: 'ComponentStatus' },
);

export const BackupRun = Type.Object(
  {
    at: Type.String({ format: 'date-time' }),
    ok: Type.Boolean(),
    file: Type.Optional(Type.String()),
    bytes: Type.Optional(Type.Integer()),
    problem: Type.Optional(Type.String()),
  },
  { $id: 'BackupRun' },
);

export const PublicAccess = Type.Object(
  {
    open: Type.Boolean(),
    until: Type.Optional(Type.String({ format: 'date-time', description: 'When it closes by itself' })),
  },
  {
    $id: 'PublicAccess',
    description: "Whether AUGUR is open to the internet through Tailscale Funnel (infra/deploy/public.sh). Absent when the gateway isn't told.",
  },
);

export const EmailStatus = Type.Object(
  {
    state: Type.Enum(['off', 'ok', 'attention'], { description: '"off" with no relay set, "attention" when the relay is set but did not answer its last check' }),
    problem: Type.Optional(Type.String({ description: 'Why, and who can change it, in words an admin can act on' })),
    relay: Type.Optional(Type.String({ description: 'The relay as host:port, never its sign-in' })),
    from: Type.Optional(Type.String({ description: "The address mail comes from: the organisation's sender address (Admin, Organisation), or SMTP_FROM" })),
    fromName: Type.Optional(Type.String({ description: "The name mail comes from: the organisation's sender name, or the product's name" })),
    checkedAt: Type.Optional(Type.String({ format: 'date-time' })),
  },
  { $id: 'EmailStatus', description: "Whether AUGUR can send email through the organisation's relay (ADR 0035, 0065); checked at most every 5 minutes" },
);

export const OffsiteCopy = Type.Object(
  {
    at: Type.String({ format: 'date-time' }),
    ok: Type.Boolean(),
    snapshot: Type.Optional(Type.String({ description: "The database copy's restic snapshot, its first 8 characters" })),
    keepDays: Type.Optional(Type.Integer({ description: 'How many days of copies the bucket keeps' })),
    problem: Type.Optional(Type.String()),
  },
  { $id: 'OffsiteCopy', description: "The last copy of the night's backup off the server, with restic (ADR 0060)" },
);

export const PointInTime = Type.Object(
  {
    at: Type.String({ format: 'date-time', description: 'When the backup container last looked (hourly)' }),
    ok: Type.Boolean(),
    bases: Type.Optional(Type.Integer({ description: 'Base backups kept, one a night' })),
    earliest: Type.Optional(Type.String({ format: 'date-time', description: 'The earliest moment the database can be restored to: when the oldest base backup was taken' })),
    archivedAt: Type.Optional(Type.String({ format: 'date-time', description: 'When Postgres last archived a WAL file' })),
    copiedAt: Type.Optional(Type.String({ format: 'date-time', description: 'When the WAL archive was last copied off the server' })),
    problem: Type.Optional(Type.String()),
    lastTest: Type.Optional(
      Type.Object(
        {
          at: Type.String({ format: 'date-time' }),
          ok: Type.Boolean(),
          base: Type.Optional(Type.String({ description: 'The base backup the changes were replayed onto' })),
          seconds: Type.Optional(Type.Integer()),
          mark: Type.Optional(Type.String({ description: 'The moment marked on the live database before the test' })),
          reached: Type.Optional(Type.String({ description: 'The last change the replay reached' })),
          problem: Type.Optional(Type.String()),
        },
        { description: 'The weekly test: the newest base backup restored and every archived change since replayed onto it' },
      ),
    ),
  },
  { $id: 'PointInTime', description: 'Restoring the database to a point in time: archived WAL replayed onto a nightly base backup (ADR 0064)' },
);

export const BackupStatus = Type.Object(
  {
    state: Type.Enum(['ok', 'attention'], { description: '"attention" when backups cannot be relied on right now' }),
    problem: Type.Optional(Type.String({ description: 'Why, in words an admin can act on' })),
    lastBackup: Type.Optional(ref(BackupRun)),
    offsite: Type.Optional(ref(OffsiteCopy)),
    pointInTime: Type.Optional(ref(PointInTime)),
    lastRestoreTest: Type.Optional(
      Type.Intersect([
        ref(BackupRun),
        Type.Object({
          from: Type.Optional(Type.Enum(['local', 'offsite'], { description: 'Restored from the backup on this server, or from the off-server copy' })),
          seconds: Type.Optional(Type.Integer()),
          people: Type.Optional(Type.Integer({ description: 'People in the restored sign-in realm' })),
          apps: Type.Optional(Type.Integer()),
          auditEntries: Type.Optional(Type.Integer()),
          appsNotRestored: Type.Optional(
            Type.Array(
              Type.Object({
                app: Type.String({ description: 'The app whose schema it was' }),
                errors: Type.Integer(),
                problem: Type.String({ description: 'The first error' }),
              }),
              { description: "Apps whose data didn't all come back. AUGUR's own did, so the test passed (ADR 0073)" },
            ),
          ),
        }),
      ]),
    ),
  },
  { $id: 'BackupStatus' },
);

export const Seeding = Type.Object(
  {
    allowed: Type.Boolean(),
    why: Type.Optional(Type.String({ description: 'Why not, when it is off' })),
    whoCanChange: Type.Optional(Type.String({ description: 'Who can turn it on, and how' })),
  },
  { $id: 'Seeding', description: 'Whether `pnpm seed` may fill this deployment with synthetic sample data (SEED_ALLOWED, ADR 0056)' },
);

/** The gateway's public key, as a JSON Web Key. */
const CallerKey = Type.Object({
  kty: Type.Literal('OKP'),
  crv: Type.Literal('Ed25519'),
  x: Type.String(),
  kid: Type.String(),
  alg: Type.Literal('EdDSA'),
  use: Type.Optional(Type.Literal('sig')),
});

export const CallerKeys = Type.Object({ keys: Type.Array(CallerKey) }, { description: 'The keys' });

export const Status = Type.Object(
  {
    components: Type.Array(ref(ComponentStatus)),
    backups: Type.Optional(ref(BackupStatus)),
    publicAccess: Type.Optional(ref(PublicAccess)),
    email: ref(EmailStatus),
    seeding: ref(Seeding),
  },
  { description: 'Every component, the gateway first' },
);

export const BrowserTelemetry = Type.Object(
  {
    on: Type.Boolean({ description: 'Whether the shell should send browser errors and traces here' }),
    why: Type.Optional(Type.String({ description: 'Why it is off, and who can change that' })),
  },
  { $id: 'BrowserTelemetry', description: 'Whether this deployment collects browser telemetry (ADR 0059)' },
);

/** An OTLP/HTTP JSON export request, as Faro's OTLP transport sends it. The gateway reads only the resource lists. */
export const OtlpExport = Type.Object(
  {
    resourceLogs: Type.Optional(Type.Array(Type.Object({}, { additionalProperties: true }))),
    resourceSpans: Type.Optional(Type.Array(Type.Object({}, { additionalProperties: true }))),
  },
  { additionalProperties: true, description: 'OTLP/HTTP JSON: resourceLogs for logs, resourceSpans for traces' },
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

/** Every named schema, in the order the contract lists them. */
export const SCHEMAS = [Refusal, ComponentStatus, BackupRun, PublicAccess, EmailStatus, OffsiteCopy, PointInTime, BackupStatus, Seeding, BrowserTelemetry];
