import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type, { type Static } from 'typebox';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { callerFromHeaders, identifyService, noShadow, ServiceAuthUnavailable, signedInRecently, type Migration, type NewAuditEntry, type ServiceVerifier, type Shadow } from '@augur/service-kit';
import { DEPLOYMENT_ADMIN_ROLE } from './directory.ts';
import { refused } from './schemas.ts';
import type { WorkspaceStore } from './workspaces.ts';

/**
 * The organisation's own settings (ADR 0042): its name, time zone, email sender, logo, sign-in notice,
 * languages, and its security and retention rules. The name is the organisation's floor's name, so there is
 * one of it: ORG_NAME seeds it at first start and Admin → Organisation changes it after. The rest is kept here,
 * in identity's schema. Anyone signed in, and any service signed in as itself, can read them; an admin changes
 * them, and a deployment admin who just entered their password changes security and retention. Every change is
 * audited. The parts Keycloak shows (the notice, languages, two steps for everyone) reach it through the realm
 * job, at the next start or upgrade (ADR 0057), since identity itself may not change how people sign in.
 */

/** Until an admin chooses one. */
export const DEFAULT_TIME_ZONE = 'UTC';
export const MAX_ORG_NAME = 100;
export const MAX_SENDER_NAME = 100;

/**
 * Idle accounts (PER-194): after `warningDays` without a sign-in Keycloak emails the person, and at
 * `turnOffDays` it turns their sign-in off. Every sign-in starts the count again. These are the defaults
 * until an admin changes them; the bounds keep a warning at least a week before the turn-off.
 */
export const IDLE_DEFAULTS = { on: true, warningDays: 60, turnOffDays: 90 } as const;
export const IDLE_BOUNDS = { minWarningDays: 7, minNoticeDays: 7, maxTurnOffDays: 730 } as const;

/** Leavers' accounts are deleted this long after they leave (ADR 0040), until an admin changes it. */
export const RETENTION_DEFAULTS = { leaverRetentionDays: 90, activityRetentionDays: 365 } as const;
export const RETENTION_BOUNDS = { leaver: { min: 7, max: 3650 }, activity: { min: 90, max: 3650 } } as const;

/** The sign-in notice, as Keycloak's Terms and Conditions step shows it. */
export const NOTICE_LIMITS = { title: 80, text: 5000 } as const;

/** The logo: a PNG, small enough for every sign-in page, at least tall enough to read. */
export const LOGO_LIMITS = { bytes: 256 * 1024, maxSide: 1024, minHeight: 32 } as const;
/** Where sign-in pages fetch the logo from, through the gateway, without signing in. */
export const PUBLIC_LOGO_PATH = '/api/identity/v1/public/organisation/logo';

/**
 * The languages Keycloak's own words come in, so the ones its sign-in pages (and AUGUR's theme, which uses
 * them) can offer. The realm job leaves out any the running Keycloak doesn't have, and says so.
 */
export const SIGN_IN_LANGUAGES: readonly string[] = [
  'ar', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa', 'fi', 'fr', 'hu', 'it', 'ja', 'ka', 'lt', 'lv', 'nl', 'no', 'pl', 'pt', 'pt-BR', 'ru', 'sk', 'sv', 'th', 'tr', 'uk', 'zh-CN', 'zh-TW',
];

/** The time zones an admin can choose: the IANA names this runtime knows, and UTC. */
export const TIME_ZONES: readonly string[] = [...new Set(['UTC', ...Intl.supportedValuesOf('timeZone')])];
const knownZone = (zone: string) => TIME_ZONES.includes(zone);

/** Plain, one line: nothing that could start a second mail header. */
const ONE_LINE = '^[^\\r\\n]*$';

export const Sender = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: MAX_SENDER_NAME, pattern: ONE_LINE, description: 'Who email says it is from, e.g. the organisation\'s name' }),
    address: Type.Optional(Type.String({ format: 'email', maxLength: 254, description: 'The address email is sent from. Absent until an admin sets one; mail is not sent from AUGUR without it' })),
  },
  { additionalProperties: false },
);

export const Idle = Type.Object(
  {
    on: Type.Boolean({ description: 'Whether accounts nobody signs in to are warned and then turned off' }),
    warningDays: Type.Integer({ minimum: IDLE_BOUNDS.minWarningDays, maximum: IDLE_BOUNDS.maxTurnOffDays - IDLE_BOUNDS.minNoticeDays, description: 'Days without a sign-in before the warning email' }),
    turnOffDays: Type.Integer({ minimum: IDLE_BOUNDS.minWarningDays + IDLE_BOUNDS.minNoticeDays, maximum: IDLE_BOUNDS.maxTurnOffDays, description: `Days without a sign-in before their sign-in turns off: at least ${IDLE_BOUNDS.minNoticeDays} after the warning` }),
  },
  { additionalProperties: false, description: `Idle accounts. ${IDLE_DEFAULTS.warningDays} and ${IDLE_DEFAULTS.turnOffDays} days, on, until an admin changes them` },
);
export type Idle = Static<typeof Idle>;

export const Logo = Type.Object(
  {
    url: Type.String({ description: 'Where anyone, signed in or not, fetches it: changes when the logo does' }),
    sha256: Type.String(),
    width: Type.Integer(),
    height: Type.Integer(),
  },
  { additionalProperties: false, description: 'The organisation’s logo, a PNG' },
);

export const Notice = Type.Object(
  {
    on: Type.Boolean({ description: 'Whether people read and accept it before they use AUGUR' }),
    title: Type.Optional(Type.String({ maxLength: NOTICE_LIMITS.title })),
    text: Type.Optional(Type.String({ maxLength: NOTICE_LIMITS.text, description: 'Plain text; a blank line between paragraphs' })),
    version: Type.Integer({ description: 'Goes up each time everyone is asked to accept it again' }),
    changedAt: Type.Optional(Type.String({ format: 'date-time' })),
    changedBy: Type.Optional(Type.String()),
  },
  { additionalProperties: false, description: 'The sign-in notice, shown as Keycloak’s Terms and Conditions step. Off until an admin turns it on' },
);
export type Notice = Static<typeof Notice>;

export const Security = Type.Object(
  {
    twoStepForAll: Type.Boolean({ description: 'Everyone, not only the admin roles, signs in with a code app or a passkey' }),
    leaverRetentionDays: Type.Integer({ minimum: RETENTION_BOUNDS.leaver.min, maximum: RETENTION_BOUNDS.leaver.max, description: 'Days a leaver’s account is kept after they leave' }),
    activityRetentionDays: Type.Integer({ minimum: RETENTION_BOUNDS.activity.min, maximum: RETENTION_BOUNDS.activity.max, description: 'Days Activity keeps its entries' }),
  },
  { additionalProperties: false, description: `Changed only by a deployment admin who just entered their password. Two steps for admins only, ${RETENTION_DEFAULTS.leaverRetentionDays} and ${RETENTION_DEFAULTS.activityRetentionDays} days, until one changes them` },
);
export type Security = Static<typeof Security>;

export const Organisation = Type.Object(
  {
    name: Type.String({ description: "The organisation's name: its floor's name, seeded from ORG_NAME at first start" }),
    timeZone: Type.String({ description: `An IANA time zone, e.g. Europe/London. ${DEFAULT_TIME_ZONE} until an admin chooses one` }),
    sender: Sender,
    idle: Idle,
    logo: Type.Optional(Logo),
    notice: Notice,
    languages: Type.Array(Type.String(), { description: 'The languages offered at sign-in and in Account: REALM_LANGUAGES until an admin chooses' }),
    defaultLanguage: Type.String({ description: 'One of `languages`, for anyone who hasn’t chosen' }),
    security: Security,
    updatedAt: Type.Optional(Type.String({ format: 'date-time', description: 'When an admin last changed them' })),
    updatedBy: Type.Optional(Type.String({ description: 'Who last changed them' })),
  },
  { description: "The organisation's settings (ADR 0042)" },
);
export type Organisation = Static<typeof Organisation>;

export const OrganisationChanges = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: MAX_ORG_NAME, pattern: '^[^\\r\\n/]*[^\\s/][^\\r\\n/]*$', description: 'No slash and not only spaces' })),
    timeZone: Type.Optional(Type.String({ minLength: 1, maxLength: 64, description: 'An IANA time zone; GET /admin/organisation/time-zones lists them' })),
    sender: Type.Optional(
      Type.Object(
        {
          name: Type.String({ minLength: 1, maxLength: MAX_SENDER_NAME, pattern: '^[^\\r\\n]*\\S[^\\r\\n]*$' }),
          address: Type.Union([Type.String({ format: 'email', maxLength: 254 }), Type.Null()], { description: 'null takes the address away' }),
        },
        { additionalProperties: false },
      ),
    ),
    idle: Type.Optional(Type.Partial(Idle, { additionalProperties: false, minProperties: 1, description: 'Only what changes; the warning stays at least a week before the turn-off' })),
    notice: Type.Optional(
      Type.Object(
        {
          on: Type.Optional(Type.Boolean()),
          title: Type.Optional(Type.String({ maxLength: NOTICE_LIMITS.title, pattern: ONE_LINE })),
          text: Type.Optional(Type.String({ maxLength: NOTICE_LIMITS.text })),
          askAgain: Type.Optional(Type.Boolean({ description: 'Ask everyone to accept it again at their next sign-in' })),
        },
        { additionalProperties: false, minProperties: 1 },
      ),
    ),
    languages: Type.Optional(Type.Array(Type.String({ maxLength: 35 }), { minItems: 1, maxItems: 40, uniqueItems: true, description: 'GET /admin/organisation/languages lists the ones there are' })),
    defaultLanguage: Type.Optional(Type.String({ maxLength: 35 })),
    security: Type.Optional(Type.Partial(Security, { additionalProperties: false, minProperties: 1, description: 'Only a deployment admin who just entered their password' })),
  },
  { additionalProperties: false, minProperties: 1, description: 'Only what changes' },
);
export type OrganisationChanges = Static<typeof OrganisationChanges>;

/** What identity keeps beside the floor's name. */
interface Kept {
  timeZone?: string;
  senderName?: string;
  senderAddress?: string;
  idle?: Partial<Idle>;
  logo?: { sha256: string; width: number; height: number };
  notice?: { on?: boolean; title?: string; text?: string; version?: number; changedAt?: string; changedBy?: string };
  languages?: string[];
  defaultLanguage?: string;
  security?: Partial<Security>;
  updatedAt?: string;
  updatedBy?: string;
}

/** A logo as kept: the PNG and what was read from it. */
export interface StoredLogo {
  png: Buffer;
  sha256: string;
  width: number;
  height: number;
}

/** Where the organisation's settings are kept; the name is the floor's, in the workspace store. */
export interface OrganisationStore {
  get(): Promise<Kept>;
  /** Everything but the logo, which `setLogo` keeps. */
  put(kept: Kept): Promise<void>;
  logo(): Promise<StoredLogo | undefined>;
  setLogo(logo: StoredLogo | undefined): Promise<void>;
}

export const organisationMigrations: Migration[] = [
  {
    id: 'organisation_001_settings',
    sql: `
      create table identity.organisation (
        only_row boolean primary key default true check (only_row),
        time_zone text,
        sender_name text,
        sender_address text,
        updated_at timestamptz,
        updated_by text
      );`,
  },
];

/** Added after identity's released migrations, so it runs after them. */
export const organisationIdleMigrations: Migration[] = [
  {
    id: 'organisation_002_idle',
    sql: `
      -- Idle accounts (PER-194): unset means the default.
      alter table identity.organisation
        add column idle_on boolean,
        add column idle_warning_days int,
        add column idle_turn_off_days int;`,
  },
];

/** Added after the idle days, so it runs after them. */
export const organisationMoreMigrations: Migration[] = [
  {
    id: 'organisation_003_logo_notice_languages_security',
    sql: `
      -- The logo, the sign-in notice, the languages offered, and security and retention (PER-196). Unset means the default.
      alter table identity.organisation
        add column logo bytea,
        add column logo_sha256 text,
        add column logo_width int,
        add column logo_height int,
        add column notice_on boolean,
        add column notice_title text,
        add column notice_text text,
        add column notice_version int,
        add column notice_changed_at timestamptz,
        add column notice_changed_by text,
        add column languages text[],
        add column default_language text,
        add column two_step_for_all boolean,
        add column leaver_retention_days int,
        add column activity_retention_days int;`,
  },
];

/** What a PNG says about itself in its header, or why it isn't one AUGUR takes as a logo. */
export const readPng = (bytes: Buffer): { width: number; height: number } | { refused: string } => {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((b, i) => bytes[i] !== b) || bytes.toString('latin1', 12, 16) !== 'IHDR') {
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    return { refused: jpeg ? 'That’s a JPEG. Save it as a PNG and try again.' : 'That isn’t a PNG. Save the logo as a PNG and try again.' };
  }
  if (bytes.length > LOGO_LIMITS.bytes) return { refused: `The logo can be at most ${LOGO_LIMITS.bytes / 1024} KB.` };
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width > LOGO_LIMITS.maxSide || height > LOGO_LIMITS.maxSide) return { refused: `The logo can be at most ${LOGO_LIMITS.maxSide} px on each side; this one is ${width} × ${height}.` };
  if (height < LOGO_LIMITS.minHeight || width < 1) return { refused: `The logo must be at least ${LOGO_LIMITS.minHeight} px tall to read; this one is ${height}.` };
  return { width, height };
};

/** The notice's text as Keycloak's Terms and Conditions page shows it: escaped, a paragraph per blank line. */
export const noticeHtml = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '<br>')}</p>`)
    .join('');

/** On Postgres; the preference store runs the migrations. */
export class PgOrganisationStore implements OrganisationStore {
  constructor(private readonly pool: pg.Pool) {}

  async get(): Promise<Kept> {
    const { rows } = await this.pool.query<Row>(`select ${COLUMNS.join(', ')} from identity.organisation`);
    const r = rows[0];
    if (!r) return {};
    const some = (o: Record<string, unknown>) => (Object.values(o).some((v) => v !== undefined) ? o : undefined);
    const v = <T>(x: T | null) => (x === null ? undefined : x);
    const idle = some({ on: v(r.idle_on), warningDays: v(r.idle_warning_days), turnOffDays: v(r.idle_turn_off_days) });
    const notice = some({
      on: v(r.notice_on),
      title: v(r.notice_title),
      text: v(r.notice_text),
      version: v(r.notice_version),
      changedAt: r.notice_changed_at?.toISOString(),
      changedBy: v(r.notice_changed_by),
    });
    const security = some({ twoStepForAll: v(r.two_step_for_all), leaverRetentionDays: v(r.leaver_retention_days), activityRetentionDays: v(r.activity_retention_days) });
    return JSON.parse(
      JSON.stringify({
        timeZone: v(r.time_zone),
        senderName: v(r.sender_name),
        senderAddress: v(r.sender_address),
        idle,
        logo: r.logo_sha256 ? { sha256: r.logo_sha256, width: r.logo_width, height: r.logo_height } : undefined,
        notice,
        languages: v(r.languages),
        defaultLanguage: v(r.default_language),
        security,
        updatedAt: r.updated_at?.toISOString(),
        updatedBy: v(r.updated_by),
      }),
    ) as Kept;
  }

  async put(k: Kept) {
    const values = [
      k.timeZone, k.senderName, k.senderAddress, k.idle?.on, k.idle?.warningDays, k.idle?.turnOffDays,
      k.notice?.on, k.notice?.title, k.notice?.text, k.notice?.version, k.notice?.changedAt, k.notice?.changedBy,
      k.languages, k.defaultLanguage, k.security?.twoStepForAll, k.security?.leaverRetentionDays, k.security?.activityRetentionDays,
      k.updatedAt, k.updatedBy,
    ].map((x) => x ?? null);
    const cols = PUT_COLUMNS;
    await this.pool.query(
      `insert into identity.organisation (only_row, ${cols.join(', ')}) values (true, ${cols.map((_, i) => `$${i + 1}`).join(', ')})
       on conflict (only_row) do update set ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}`,
      values,
    );
  }

  async logo() {
    const { rows } = await this.pool.query<{ logo: Buffer | null; logo_sha256: string | null; logo_width: number | null; logo_height: number | null }>(
      'select logo, logo_sha256, logo_width, logo_height from identity.organisation',
    );
    const r = rows[0];
    return r?.logo && r.logo_sha256 ? { png: r.logo, sha256: r.logo_sha256, width: r.logo_width ?? 0, height: r.logo_height ?? 0 } : undefined;
  }

  async setLogo(logo: StoredLogo | undefined) {
    await this.pool.query(
      `insert into identity.organisation (only_row, logo, logo_sha256, logo_width, logo_height) values (true, $1, $2, $3, $4)
       on conflict (only_row) do update set logo = excluded.logo, logo_sha256 = excluded.logo_sha256, logo_width = excluded.logo_width, logo_height = excluded.logo_height`,
      [logo?.png ?? null, logo?.sha256 ?? null, logo?.width ?? null, logo?.height ?? null],
    );
  }
}

interface Row {
  time_zone: string | null;
  sender_name: string | null;
  sender_address: string | null;
  idle_on: boolean | null;
  idle_warning_days: number | null;
  idle_turn_off_days: number | null;
  logo_sha256: string | null;
  logo_width: number | null;
  logo_height: number | null;
  notice_on: boolean | null;
  notice_title: string | null;
  notice_text: string | null;
  notice_version: number | null;
  notice_changed_at: Date | null;
  notice_changed_by: string | null;
  languages: string[] | null;
  default_language: string | null;
  two_step_for_all: boolean | null;
  leaver_retention_days: number | null;
  activity_retention_days: number | null;
  updated_at: Date | null;
  updated_by: string | null;
}

/** Everything `put` writes, in the order of its values. */
const PUT_COLUMNS = [
  'time_zone', 'sender_name', 'sender_address', 'idle_on', 'idle_warning_days', 'idle_turn_off_days',
  'notice_on', 'notice_title', 'notice_text', 'notice_version', 'notice_changed_at', 'notice_changed_by',
  'languages', 'default_language', 'two_step_for_all', 'leaver_retention_days', 'activity_retention_days',
  'updated_at', 'updated_by',
];
const COLUMNS = [...PUT_COLUMNS, 'logo_sha256', 'logo_width', 'logo_height'];

/** The settings as everyone reads them: what is kept, with the defaults filled in. `deploymentLanguages` is REALM_LANGUAGES. */
export const organisationSettings = async (workspaces: WorkspaceStore, store: Pick<OrganisationStore, 'get'>, deploymentLanguages: string[] = ['en']): Promise<Organisation> => {
  const [org, kept] = await Promise.all([workspaces.org(), store.get()]);
  const languages = kept.languages?.length ? kept.languages : deploymentLanguages.length ? deploymentLanguages : ['en'];
  const defaultLanguage = kept.defaultLanguage && languages.includes(kept.defaultLanguage) ? kept.defaultLanguage : languages[0]!;
  return {
    name: org.name,
    timeZone: kept.timeZone && knownZone(kept.timeZone) ? kept.timeZone : DEFAULT_TIME_ZONE,
    sender: { name: kept.senderName ?? org.name, ...(kept.senderAddress ? { address: kept.senderAddress } : {}) },
    idle: { ...IDLE_DEFAULTS, ...kept.idle },
    ...(kept.logo ? { logo: { ...kept.logo, url: `${PUBLIC_LOGO_PATH}?v=${kept.logo.sha256.slice(0, 12)}` } } : {}),
    notice: { on: false, version: 0, ...kept.notice },
    languages,
    defaultLanguage,
    security: { twoStepForAll: false, ...RETENTION_DEFAULTS, ...kept.security },
    ...(kept.updatedAt ? { updatedAt: kept.updatedAt } : {}),
    ...(kept.updatedBy ? { updatedBy: kept.updatedBy } : {}),
  };
};

/** The languages offered, the default first, as Account and the realm job want them. */
export const offeredLanguages = (o: Pick<Organisation, 'languages' | 'defaultLanguage'>) => [o.defaultLanguage, ...o.languages.filter((l) => l !== o.defaultLanguage)];

/** What a deployment admin must have done just before changing security and retention (ADR 0022). */
export const SECURITY_SIGN_IN_MS = 10 * 60_000;

interface OrganisationOptions {
  /** Compares this service's own admin checks with the permissions service (shadow mode, ADR 0085). */
  shadow?: Shadow;
  workspaces: WorkspaceStore;
  store: OrganisationStore;
  audit?: (entry: NewAuditEntry, workspace?: string) => Promise<void>;
  verifyService?: ServiceVerifier;
  /** REALM_LANGUAGES: what is offered until an admin chooses. */
  languages?: string[];
  /** Asks everyone whose sign-in is on to accept the notice at their next sign-in; says how many. Without it, nobody can be asked. */
  askEveryone?: () => Promise<number>;
  now?: () => Date;
}

/** Fields in the order Activity lists them. */
const FIELDS = ['name', 'timeZone', 'sender', 'idle', 'notice', 'languages', 'defaultLanguage', 'security'] as const;

/**
 * `/organisation` for anyone signed in or any service; `/admin/organisation` for admins; `/organisation/policy`
 * for AUGUR's own services; and the logo at `/public/organisation/logo` for anyone, signed in or not.
 */
export const organisationRoutes =
  ({ workspaces, store, audit, verifyService, languages: deploymentLanguages = ['en'], askEveryone, now = () => new Date(), shadow = noShadow }: OrganisationOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();
    const settings = () => organisationSettings(workspaces, store, deploymentLanguages);
    const record = (req: FastifyRequest, entry: Omit<NewAuditEntry, 'app' | 'target' | 'actor'>) =>
      audit?.({ actor: { id: callerFromHeaders(req.headers)!.id, kind: 'user' }, app: 'identity', target: 'organisation', ...entry }).catch((err: Error) =>
        req.log.error({ err: err.message }, 'audit entry not recorded'),
      );

    /** A signed-in person, or a service signed in as itself; otherwise the reply is sent. */
    const readers = async (req: FastifyRequest, reply: FastifyReply) => {
      if (callerFromHeaders(req.headers)) return;
      try {
        if (await identifyService(req.headers, verifyService)) return;
      } catch (err) {
        if (!(err instanceof ServiceAuthUnavailable)) throw err;
        return reply.code(503).send({ error: 'unavailable', message: err.message });
      }
      return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
    };
    const admins = async (req: FastifyRequest, reply: FastifyReply) => {
      const caller = callerFromHeaders(req.headers);
      if (!caller) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
      const admin = caller.roles.includes('admin');
      shadow.check('identity.organisation', caller, { action: 'can_manage_org', resource: { type: 'org', id: 'this' }, as: 'persona' }, admin);
      if (!admin) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can change the organisation’s settings.', whoCanChange: 'An admin' });
    };

    app.get(
      '/organisation',
      {
        onRequest: readers,
        schema: {
          summary: "The organisation's settings: name, time zone, email sender, idle-account days, logo, sign-in notice, languages, security and retention",
          description: 'For anyone signed in, and any service signed in as itself, so every part of AUGUR shows the same name and times (ADR 0042).',
          response: { 200: Organisation, 401: refused('Not signed in, and not a service'), 503: refused("Services' sign-ins can't be checked right now") },
        },
      },
      async () => settings(),
    );

    app.get(
      '/organisation/policy',
      {
        schema: {
          summary: 'How long things are kept, for AUGUR’s own services',
          description: 'Activity’s retention for the events service, and the leaver and idle-account rules for whatever applies them.',
          response: {
            200: Type.Object({ activityRetentionDays: Type.Integer(), leaverRetentionDays: Type.Integer(), idle: Idle }),
            403: refused('Not one of AUGUR’s own services'),
            503: refused("Services' sign-ins can't be checked right now"),
          },
        },
      },
      async (req, reply) => {
        try {
          if ((await identifyService(req.headers, verifyService))?.kind !== 'platform') return reply.code(403).send({ error: 'forbidden', message: 'Only AUGUR’s own services read the organisation’s policy.' });
        } catch (err) {
          if (!(err instanceof ServiceAuthUnavailable)) throw err;
          return reply.code(503).send({ error: 'unavailable', message: err.message });
        }
        const s = await settings();
        return { activityRetentionDays: s.security.activityRetentionDays, leaverRetentionDays: s.security.leaverRetentionDays, idle: s.idle };
      },
    );

    // Sign-in pages show it before anyone has signed in: the gateway passes this one path on without a caller.
    app.get(
      '/public/organisation/logo',
      { schema: { summary: "The organisation's logo, for anyone", description: 'A PNG. The gateway serves it at /api/identity/v1/public/organisation/logo without a sign-in.', hide: true } },
      async (req, reply) => {
        const logo = await store.logo();
        const safe = { 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" };
        if (!logo) return reply.code(404).headers(safe).send({ error: 'not_found', message: 'This organisation has no logo.' });
        const etag = `"${logo.sha256}"`;
        reply.headers({ ...safe, etag, 'cache-control': 'public, max-age=300' });
        if (req.headers['if-none-match'] === etag) return reply.code(304).send();
        return reply.type('image/png').send(logo.png);
      },
    );

    app.get(
      '/admin/organisation/time-zones',
      {
        onRequest: admins,
        schema: {
          summary: 'The time zones an admin can choose (admins only)',
          response: { 200: Type.Array(Type.String(), { description: 'IANA names, UTC first' }), 401: refused('No signed-in caller'), 403: refused('Not an admin') },
        },
      },
      async () => [...TIME_ZONES],
    );

    app.get(
      '/admin/organisation/languages',
      {
        onRequest: admins,
        schema: {
          summary: 'The languages an admin can offer (admins only)',
          description: 'The languages the sign-in service has words in. The realm job leaves out any the running one lacks.',
          response: { 200: Type.Array(Type.String(), { description: 'Language tags, such as en or pt-BR' }), 401: refused('No signed-in caller'), 403: refused('Not an admin') },
        },
      },
      async () => [...SIGN_IN_LANGUAGES],
    );

    app.patch(
      '/admin/organisation',
      {
        onRequest: admins,
        schema: {
          summary: "Change the organisation's settings, audited as organisation.changed (admins only; security and retention need a deployment admin)",
          description: [
            'Only the fields sent change. The name renames the organisation’s floor, which everyone sees.',
            '`security` needs the deployment-admin role and a password entered in the last 10 minutes, or it answers 401 sign_in_again.',
            '`notice.askAgain` asks everyone to accept the notice at their next sign-in, audited as organisation.notice-asked.',
            'The notice, languages and two steps for everyone reach the sign-in service when AUGUR next starts or upgrades.',
          ].join(' '),
          body: OrganisationChanges,
          response: {
            200: { ...Organisation, description: 'The settings now' },
            400: refused('A name with a slash or only spaces, an unknown time zone or language, a sender that is not one line or not an email address, idle or retention days out of bounds, or a notice turned on without a title and text'),
            401: refused('No signed-in caller, or sign_in_again for security'),
            403: refused('Not an admin, or security from someone who isn’t a deployment admin'),
            503: refused('Asked everyone again, but the sign-in service can’t be reached'),
          },
        },
      },
      async (req, reply) => {
        const changes = req.body;
        const caller = callerFromHeaders(req.headers)!;
        const bad = (message: string) => reply.code(400).send({ error: 'bad_request', message });
        if (changes.security) {
          const held = caller.roles.includes(DEPLOYMENT_ADMIN_ROLE.name);
          shadow.check('identity.organisation.security', caller, { action: 'admin', resource: { type: 'deployment', id: 'this' }, as: 'persona' }, held);
          if (!held) {
            return reply.code(403).send({ error: 'forbidden', message: 'Only a deployment admin can change security and retention.', whoCanChange: 'A deployment admin' });
          }
          if (!signedInRecently(caller, SECURITY_SIGN_IN_MS, now().getTime())) {
            return reply.code(401).send({ error: 'sign_in_again', message: 'Enter your password again to change security and retention. It’s asked for anything this drastic.' });
          }
        }
        if (changes.timeZone !== undefined && !knownZone(changes.timeZone)) return bad(`“${changes.timeZone}” isn’t a time zone AUGUR knows. Choose one from the list.`);
        const unknown = changes.languages?.find((l) => !SIGN_IN_LANGUAGES.includes(l));
        if (unknown) return bad(`The sign-in pages have no words in “${unknown}”. Choose from the list.`);
        const before = await settings();
        if (changes.idle) {
          const idle = { ...before.idle, ...changes.idle };
          if (idle.turnOffDays - idle.warningDays < IDLE_BOUNDS.minNoticeDays) return bad(`Turn accounts off at least ${IDLE_BOUNDS.minNoticeDays} days after the warning, so people have time to sign in.`);
        }
        const languages = changes.languages ?? before.languages;
        const defaultLanguage = changes.defaultLanguage ?? (languages.includes(before.defaultLanguage) ? before.defaultLanguage : languages[0]!);
        if (!languages.includes(defaultLanguage)) return bad(`The default language must be one of those offered (${languages.join(', ')}).`);
        const kept = await store.get();
        const stamp = now().toISOString();

        let notice = kept.notice;
        let asked = false;
        if (changes.notice) {
          const { askAgain, ...n } = changes.notice;
          const next = { ...before.notice, ...n, ...(n.title !== undefined ? { title: n.title.trim() || undefined } : {}), ...(n.text !== undefined ? { text: n.text.trim() || undefined } : {}) };
          if (next.on && (!next.title || !next.text)) return bad('A notice that is on needs a title and its text.');
          if (askAgain && !next.on) return bad('Turn the notice on to ask everyone to accept it.');
          const worded = next.title !== before.notice.title || next.text !== before.notice.text || next.on !== before.notice.on;
          asked = Boolean(askAgain);
          if (asked && !askEveryone) return reply.code(503).send({ error: 'unavailable', message: 'The sign-in service isn’t connected, so nobody can be asked to accept the notice again.' });
          notice = {
            on: next.on,
            ...(next.title ? { title: next.title } : {}),
            ...(next.text ? { text: next.text } : {}),
            version: before.notice.version + (asked ? 1 : 0),
            ...(worded || asked ? { changedAt: stamp, changedBy: caller.id } : { changedAt: before.notice.changedAt, changedBy: before.notice.changedBy }),
          };
        }

        if (changes.name !== undefined && changes.name.trim() !== before.name) await workspaces.renameOrg(changes.name.trim());
        const next: Kept = {
          ...kept,
          ...(changes.timeZone !== undefined ? { timeZone: changes.timeZone } : {}),
          ...(changes.sender ? { senderName: changes.sender.name.trim(), senderAddress: changes.sender.address ?? undefined } : {}),
          ...(changes.idle ? { idle: { ...kept.idle, ...changes.idle } } : {}),
          ...(notice ? { notice } : {}),
          ...(changes.languages || changes.defaultLanguage ? { languages, defaultLanguage } : {}),
          ...(changes.security ? { security: { ...kept.security, ...changes.security } } : {}),
        };
        const after = await organisationSettings(workspaces, { get: async () => next }, deploymentLanguages);
        const from: Record<string, unknown> = {};
        const to: Record<string, unknown> = {};
        // The notice's text is long and may be sensitive: Activity gets its length, never the words.
        const shown = (key: (typeof FIELDS)[number], o: Organisation) => {
          if (key !== 'notice') return o[key];
          const { text, changedAt: _, changedBy: __, ...n } = o.notice;
          return { ...n, ...(text ? { textLength: text.length } : {}) };
        };
        for (const key of FIELDS) {
          if (JSON.stringify(shown(key, before)) !== JSON.stringify(shown(key, after))) {
            from[key] = shown(key, before);
            to[key] = shown(key, after);
          }
        }
        if (!Object.keys(to).length && !asked) return before;
        const stamped = { ...next, updatedAt: stamp, updatedBy: caller.id };
        await store.put(stamped);
        if (Object.keys(to).length) await record(req, { action: 'organisation.changed', detail: { from, to } });
        if (asked) {
          const people = await askEveryone!().catch((err: Error) => err);
          if (people instanceof Error) {
            req.log.error({ err: people.message }, 'notice not asked again');
            return reply.code(503).send({ error: 'unavailable', message: `Saved, but nobody could be asked to accept the notice again: ${people.message} Try asking again.` });
          }
          await record(req, { action: 'organisation.notice-asked', detail: { version: after.notice.version, people } });
        }
        return { ...after, updatedAt: stamp, updatedBy: caller.id };
      },
    );

    // The logo: its own request, so a large file never rides along with the other settings.
    await app.register(async (scope) => {
      scope.addContentTypeParser('image/png', { parseAs: 'buffer', bodyLimit: LOGO_LIMITS.bytes }, (_req, body, done) => done(null, body));
      const typed = scope.withTypeProvider<TypeBoxTypeProvider>();
      typed.put(
        '/admin/organisation/logo',
        {
          onRequest: admins,
          bodyLimit: LOGO_LIMITS.bytes,
          schema: {
            summary: "Set the organisation's logo, a PNG (admins only), audited as organisation.changed",
            description: `A PNG of at most ${LOGO_LIMITS.bytes / 1024} KB and ${LOGO_LIMITS.maxSide} px on each side, at least ${LOGO_LIMITS.minHeight} px tall. Sent as image/png.`,
            response: { 200: Logo, 400: refused('Not a PNG, or the wrong size'), 401: refused('No signed-in caller'), 403: refused('Not an admin'), 413: refused('Larger than the limit'), 415: refused('Not sent as image/png') },
          },
        },
        async (req, reply) => {
          const png = req.body as Buffer;
          const read = readPng(png);
          if ('refused' in read) return reply.code(400).send({ error: 'bad_request', message: read.refused });
          const sha256 = createHash('sha256').update(png).digest('hex');
          const before = (await store.get()).logo;
          await store.setLogo({ png, sha256, ...read });
          if (before?.sha256 !== sha256) await record(req, { action: 'organisation.changed', detail: { from: { logo: before?.sha256 ?? null }, to: { logo: sha256 } } });
          return { sha256, ...read, url: `${PUBLIC_LOGO_PATH}?v=${sha256.slice(0, 12)}` };
        },
      );
      typed.delete(
        '/admin/organisation/logo',
        { onRequest: admins, schema: { summary: "Take the organisation's logo away (admins only)", response: { 204: Type.Null(), 401: refused('No signed-in caller'), 403: refused('Not an admin') } } },
        async (req, reply) => {
          const before = (await store.get()).logo;
          if (before) {
            await store.setLogo(undefined);
            await record(req, { action: 'organisation.changed', detail: { from: { logo: before.sha256 }, to: { logo: null } } });
          }
          return reply.code(204).send(null);
        },
      );
    });
  };
