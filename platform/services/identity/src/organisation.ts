import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type, { type Static } from 'typebox';
import pg from 'pg';
import { callerFromHeaders, identifyService, ServiceAuthUnavailable, type Migration, type NewAuditEntry, type ServiceVerifier } from '@augur/service-kit';
import { refused } from './schemas.ts';
import type { WorkspaceStore } from './workspaces.ts';

/**
 * The organisation's own settings (ADR 0042): its name, its time zone and who its email comes from.
 * The name is the organisation's floor's name, so there is one of it: ORG_NAME seeds it at first start
 * and Admin → Organisation changes it after. The rest is kept here, in identity's schema. Anyone signed
 * in, and any service signed in as itself, can read them; only an admin can change them, and every
 * change is audited.
 */

/** Until an admin chooses one. */
export const DEFAULT_TIME_ZONE = 'UTC';
export const MAX_ORG_NAME = 100;
export const MAX_SENDER_NAME = 100;

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

export const Organisation = Type.Object(
  {
    name: Type.String({ description: "The organisation's name: its floor's name, seeded from ORG_NAME at first start" }),
    timeZone: Type.String({ description: `An IANA time zone, e.g. Europe/London. ${DEFAULT_TIME_ZONE} until an admin chooses one` }),
    sender: Sender,
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
  },
  { additionalProperties: false, minProperties: 1, description: 'Only what changes' },
);
export type OrganisationChanges = Static<typeof OrganisationChanges>;

/** What identity keeps beside the floor's name. */
interface Kept {
  timeZone?: string;
  senderName?: string;
  senderAddress?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** Where the organisation's settings are kept; the name is the floor's, in the workspace store. */
export interface OrganisationStore {
  get(): Promise<Kept>;
  put(kept: Kept): Promise<void>;
}

export class MemoryOrganisationStore implements OrganisationStore {
  private kept: Kept = {};
  async get() {
    return { ...this.kept };
  }
  async put(kept: Kept) {
    this.kept = { ...kept };
  }
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

/** On Postgres; the preference store runs the migrations. */
export class PgOrganisationStore implements OrganisationStore {
  constructor(private readonly pool: pg.Pool) {}

  async get() {
    const { rows } = await this.pool.query<{ time_zone: string | null; sender_name: string | null; sender_address: string | null; updated_at: Date | null; updated_by: string | null }>(
      'select time_zone, sender_name, sender_address, updated_at, updated_by from identity.organisation',
    );
    const r = rows[0];
    if (!r) return {};
    return {
      ...(r.time_zone ? { timeZone: r.time_zone } : {}),
      ...(r.sender_name ? { senderName: r.sender_name } : {}),
      ...(r.sender_address ? { senderAddress: r.sender_address } : {}),
      ...(r.updated_at ? { updatedAt: r.updated_at.toISOString() } : {}),
      ...(r.updated_by ? { updatedBy: r.updated_by } : {}),
    };
  }

  async put(k: Kept) {
    await this.pool.query(
      `insert into identity.organisation (only_row, time_zone, sender_name, sender_address, updated_at, updated_by) values (true, $1, $2, $3, $4, $5)
       on conflict (only_row) do update set time_zone = excluded.time_zone, sender_name = excluded.sender_name,
         sender_address = excluded.sender_address, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      [k.timeZone ?? null, k.senderName ?? null, k.senderAddress ?? null, k.updatedAt ?? null, k.updatedBy ?? null],
    );
  }
}

/** The settings as everyone reads them: what is kept, with the defaults filled in. */
export const organisationSettings = async (workspaces: WorkspaceStore, store: OrganisationStore): Promise<Organisation> => {
  const [org, kept] = await Promise.all([workspaces.org(), store.get()]);
  return {
    name: org.name,
    timeZone: kept.timeZone && knownZone(kept.timeZone) ? kept.timeZone : DEFAULT_TIME_ZONE,
    sender: { name: kept.senderName ?? org.name, ...(kept.senderAddress ? { address: kept.senderAddress } : {}) },
    ...(kept.updatedAt ? { updatedAt: kept.updatedAt } : {}),
    ...(kept.updatedBy ? { updatedBy: kept.updatedBy } : {}),
  };
};

interface OrganisationOptions {
  workspaces: WorkspaceStore;
  store: OrganisationStore;
  audit?: (entry: NewAuditEntry, workspace?: string) => Promise<void>;
  verifyService?: ServiceVerifier;
  now?: () => Date;
}

/** `/organisation` for anyone signed in or any service; `/admin/organisation` for admins. */
export const organisationRoutes =
  ({ workspaces, store, audit, verifyService, now = () => new Date() }: OrganisationOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();

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
      if (!caller.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can change the organisation’s settings.', whoCanChange: 'An admin' });
    };

    app.get(
      '/organisation',
      {
        onRequest: readers,
        schema: {
          summary: "The organisation's name, time zone and email sender",
          description: 'For anyone signed in, and any service signed in as itself, so every part of AUGUR shows the same name and times (ADR 0042).',
          response: { 200: Organisation, 401: refused('Not signed in, and not a service'), 503: refused("Services' sign-ins can't be checked right now") },
        },
      },
      async () => organisationSettings(workspaces, store),
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

    app.patch(
      '/admin/organisation',
      {
        onRequest: admins,
        schema: {
          summary: "Change the organisation's settings, audited as organisation.changed (admins only)",
          description: 'Only the fields sent change. The name renames the organisation’s floor, which everyone sees.',
          body: OrganisationChanges,
          response: {
            200: { ...Organisation, description: 'The settings now' },
            400: refused('A name with a slash or only spaces, an unknown time zone, or a sender that is not one line or not an email address'),
            401: refused('No signed-in caller'),
            403: refused('Not an admin'),
          },
        },
      },
      async (req, reply) => {
        const changes = req.body;
        if (changes.timeZone !== undefined && !knownZone(changes.timeZone)) {
          return reply.code(400).send({ error: 'bad_request', message: `“${changes.timeZone}” isn’t a time zone AUGUR knows. Choose one from the list.` });
        }
        const before = await organisationSettings(workspaces, store);
        const kept = await store.get();
        const actor = callerFromHeaders(req.headers)!.id;
        if (changes.name !== undefined && changes.name.trim() !== before.name) await workspaces.renameOrg(changes.name.trim());
        const next: Kept = {
          ...kept,
          ...(changes.timeZone !== undefined ? { timeZone: changes.timeZone } : {}),
          ...(changes.sender ? { senderName: changes.sender.name.trim(), senderAddress: changes.sender.address ?? undefined } : {}),
        };
        const after = await organisationSettings(workspaces, { get: async () => next, put: async () => undefined });
        const from: Record<string, unknown> = {};
        const to: Record<string, unknown> = {};
        for (const key of ['name', 'timeZone', 'sender'] as const) {
          if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
            from[key] = before[key];
            to[key] = after[key];
          }
        }
        if (!Object.keys(to).length) return before;
        const stamped = { ...next, updatedAt: now().toISOString(), updatedBy: actor };
        await store.put(stamped);
        await audit?.({ actor: { id: actor, kind: 'user' }, app: 'identity', action: 'organisation.changed', target: 'organisation', detail: { from, to } }).catch((err: Error) =>
          req.log.error({ err: err.message }, 'audit entry not recorded'),
        );
        return { ...after, updatedAt: stamped.updatedAt, updatedBy: actor };
      },
    );
  };
