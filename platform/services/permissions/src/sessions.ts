import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import pg from 'pg';
import { callerFromHeaders, runMigrations, sendProblem, signedInRecently, steadyPool, type Caller, type Migration, type NewAuditEntry } from '@augur/service-kit';

/**
 * Persona sessions (ADR 0086, amended by 0089; PDR-024 "Act as"). An everyday persona works through holding
 * it, with no switch. An admin persona, one that is an admin of the org or of the deployment, works only
 * while its holder has said they are acting as it: after a fresh sign-in, with a reason, for a limited time.
 * This service keeps those sessions. The gateway asks it whether one is live before it lets a call act as
 * the persona.
 */

/** One person acting as one admin persona, from `startedAt` until `endsAt` or until it is ended. */
export interface PersonaSession {
  id: string;
  person: string;
  persona: string;
  reason: string;
  startedAt: string;
  endsAt: string;
  /** Set once it was ended before its time: by the person, or by starting another. */
  endedAt?: string;
}

export interface SessionStore {
  /** Starts a session, ending any other live one of the same person first: one persona at a time. */
  start(session: Omit<PersonaSession, 'id' | 'endedAt'>): Promise<{ started: PersonaSession; ended?: PersonaSession }>;
  /** The person's live session at `now`, if any. */
  live(person: string, now: Date): Promise<PersonaSession | undefined>;
  /** Ends the person's live session at `now`, returning it, or undefined when there was none. */
  end(person: string, now: Date): Promise<PersonaSession | undefined>;
}

export const migrations: Migration[] = [
  {
    id: '001-persona-sessions',
    sql: `
      create table permissions.persona_sessions (
        id uuid primary key,
        person text not null,
        persona text not null,
        reason text not null,
        started_at timestamptz not null,
        ends_at timestamptz not null,
        ended_at timestamptz
      );
      create index persona_sessions_live on permissions.persona_sessions (person) where ended_at is null;`,
  },
];

type Row = { id: string; person: string; persona: string; reason: string; started_at: Date; ends_at: Date; ended_at: Date | null };
const fromRow = (r: Row): PersonaSession => ({
  id: r.id,
  person: r.person,
  persona: r.persona,
  reason: r.reason,
  startedAt: r.started_at.toISOString(),
  endsAt: r.ends_at.toISOString(),
  ...(r.ended_at ? { endedAt: r.ended_at.toISOString() } : {}),
});

/** Sessions in the `permissions` schema, beside OpenFGA's own tables, under the service's own login. */
export class PgSessionStore implements SessionStore {
  constructor(private readonly pool: pg.Pool) {}

  static async connect(connectionString: string) {
    const store = new PgSessionStore(steadyPool(new pg.Pool({ connectionString })));
    await runMigrations(store.pool, { schema: 'permissions', migrations });
    return store;
  }

  async start(s: Omit<PersonaSession, 'id' | 'endedAt'>) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      // Serialise one person's starts, so two at once can't leave two sessions live.
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [`persona-session:${s.person}`]);
      const ended = await client.query<Row>(
        'update permissions.persona_sessions set ended_at = $2 where person = $1 and ended_at is null and ends_at > $2 returning *',
        [s.person, s.startedAt],
      );
      const { rows } = await client.query<Row>(
        'insert into permissions.persona_sessions (id, person, persona, reason, started_at, ends_at) values ($1, $2, $3, $4, $5, $6) returning *',
        [randomUUID(), s.person, s.persona, s.reason, s.startedAt, s.endsAt],
      );
      await client.query('commit');
      return { started: fromRow(rows[0]!), ...(ended.rows[0] ? { ended: fromRow(ended.rows[0]) } : {}) };
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async live(person: string, now: Date) {
    const { rows } = await this.pool.query<Row>(
      'select * from permissions.persona_sessions where person = $1 and ended_at is null and ends_at > $2 order by started_at desc limit 1',
      [person, now],
    );
    return rows[0] && fromRow(rows[0]);
  }

  async end(person: string, now: Date) {
    const { rows } = await this.pool.query<Row>(
      'update permissions.persona_sessions set ended_at = $2 where person = $1 and ended_at is null and ends_at > $2 returning *',
      [person, now],
    );
    return rows[0] && fromRow(rows[0]);
  }
}

/** Sessions kept in memory: for tests and for running the service without a database. */
export class MemorySessionStore implements SessionStore {
  readonly sessions: PersonaSession[] = [];

  private liveOf(person: string, at: string) {
    return this.sessions.find((s) => s.person === person && !s.endedAt && s.endsAt > at);
  }

  async start(s: Omit<PersonaSession, 'id' | 'endedAt'>) {
    const ended = this.liveOf(s.person, s.startedAt);
    if (ended) ended.endedAt = s.startedAt;
    const started = { id: randomUUID(), ...s };
    this.sessions.push(started);
    return { started: { ...started }, ...(ended ? { ended: { ...ended } } : {}) };
  }

  async live(person: string, now: Date) {
    const s = this.liveOf(person, now.toISOString());
    return s && { ...s };
  }

  async end(person: string, now: Date) {
    const s = this.liveOf(person, now.toISOString());
    if (!s) return undefined;
    s.endedAt = now.toISOString();
    return { ...s };
  }
}

/** How long a session may last (D4), a deployment's own choice: PERSONA_DEPLOYMENT_ADMIN_MINUTES and PERSONA_ORG_ADMIN_MINUTES. */
export interface SessionLimits {
  /** A persona that is a deployment admin: 60 minutes by default. */
  deploymentAdminMinutes: number;
  /** A persona that is an org admin only: 480 minutes (a working day) by default. */
  orgAdminMinutes: number;
}
export const DEFAULT_LIMITS: SessionLimits = { deploymentAdminMinutes: 60, orgAdminMinutes: 480 };

/** How recently someone must have entered their password to start acting as an admin persona (the spec's step-up). */
export const FRESH_SIGN_IN_MS = 5 * 60 * 1000;

/** What a persona is to its holder: which admin it is, so whether it needs "Act as", and for how long at most. */
export interface PersonaPowers {
  deploymentAdmin: boolean;
  orgAdmin: boolean;
}

/** What the routes need of OpenFGA, so they never build checks themselves. */
export interface PersonaQuestions {
  /** The personas the person holds. */
  held(person: string): Promise<string[]>;
  /** Which admin the persona is. */
  powers(persona: string): Promise<PersonaPowers>;
}

export interface SessionRouteOptions {
  sessions: SessionStore;
  questions: PersonaQuestions;
  limits?: SessionLimits;
  /** Who may ask whether a session is live: the gateway and AUGUR's own services (app.ts's mayAsk). */
  mayAsk: (req: FastifyRequest, reply: FastifyReply) => Promise<boolean>;
  audit?: (entry: NewAuditEntry) => Promise<void>;
  now: () => Date;
}

const Session = Type.Object(
  {
    id: Type.String(),
    persona: Type.String(),
    reason: Type.String(),
    startedAt: Type.String({ format: 'date-time' }),
    endsAt: Type.String({ format: 'date-time' }),
  },
  { $id: 'PersonaSession', description: 'Someone acting as an admin persona, until endsAt.' },
);
const Problem = Type.Object({ error: Type.String(), message: Type.String() });

const view = (s: PersonaSession) => ({ id: s.id, persona: s.persona, reason: s.reason, startedAt: s.startedAt, endsAt: s.endsAt });

/** The longest a session as this persona may last, or undefined when it is no admin and so needs no "Act as". */
export const longestMinutes = (powers: PersonaPowers, limits: SessionLimits) =>
  powers.deploymentAdmin ? limits.deploymentAdminMinutes : powers.orgAdmin ? limits.orgAdminMinutes : undefined;

/**
 * The person's own routes, reached through the gateway at /api/permissions/v1/personas: which personas they
 * hold and which need "Act as", starting a session with a reason, and ending it. And the gateway's question:
 * is this person acting as this persona now?
 */
export const sessionRoutes =
  ({ sessions, questions, limits = DEFAULT_LIMITS, mayAsk, audit, now }: SessionRouteOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();

    const record = async (caller: Pick<Caller, 'id'>, action: string, s: PersonaSession, detail: Record<string, unknown> = {}) => {
      try {
        await audit?.({ actor: { id: caller.id, kind: 'user' }, app: 'permissions', action, target: s.persona, detail: { session: s.id, ...detail } });
      } catch {
        // The session stands: the audit log is told as soon as it can be, not before the person can act.
      }
    };

    app.get(
      '/v1/personas',
      {
        schema: {
          summary: 'The personas you hold, which of them need “Act as”, and what you are acting as now',
          response: {
            200: Type.Object({
              personas: Type.Array(
                Type.Object({
                  id: Type.String(),
                  actAs: Type.Boolean({ description: 'An admin persona: it works only while you act as it.' }),
                  longestMinutes: Type.Optional(Type.Integer({ description: 'With actAs: the longest one session may last.' })),
                }),
              ),
              session: Type.Optional(Session),
            }),
            401: Problem,
            503: Problem,
          },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller) return sendProblem(reply, 401, 'unauthenticated', 'Sign in to continue.');
        try {
          const held = await questions.held(caller.id);
          const personas = await Promise.all(
            held.map(async (id) => {
              const most = longestMinutes(await questions.powers(id), limits);
              return { id, actAs: most !== undefined, ...(most !== undefined ? { longestMinutes: most } : {}) };
            }),
          );
          const live = await sessions.live(caller.id, now());
          return { personas, ...(live ? { session: view(live) } : {}) };
        } catch (err) {
          req.log.warn({ err }, 'personas could not be listed');
          return sendProblem(reply, 503, 'unavailable', 'Your personas can’t be listed right now. A deployment admin can see why on Status.');
        }
      },
    );

    app.post(
      '/v1/personas/:persona/sessions',
      {
        schema: {
          summary: 'Act as an admin persona you hold, for a reason, until the time limit or until you stop',
          params: Type.Object({ persona: Type.String({ minLength: 1, maxLength: 200 }) }),
          body: Type.Object({
            reason: Type.String({ minLength: 3, maxLength: 300, description: 'Why, in a few words: kept in the audit log.' }),
            minutes: Type.Optional(Type.Integer({ minimum: 1, description: 'Shorter than the longest allowed, if you like.' })),
          }),
          response: { 201: Session, 401: Problem, 403: Problem, 409: Problem, 503: Problem },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller) return sendProblem(reply, 401, 'unauthenticated', 'Sign in to continue.');
        // A call an app makes for the person never acts as their admin persona.
        if (caller.app) return sendProblem(reply, 403, 'forbidden', 'Only you, in AUGUR itself, can act as one of your personas, never an app.');
        const { persona } = req.params;
        let most: number | undefined;
        try {
          if (!(await questions.held(caller.id)).includes(persona)) {
            return sendProblem(reply, 403, 'forbidden', `You don’t hold ${persona}. An admin gives positions in Admin, People.`);
          }
          most = longestMinutes(await questions.powers(persona), limits);
        } catch (err) {
          req.log.warn({ err }, 'a persona session could not be checked');
          return sendProblem(reply, 503, 'unavailable', 'Permissions can’t be checked right now, so you can’t act as a persona. A deployment admin can see why on Status.');
        }
        if (most === undefined) return sendProblem(reply, 409, 'not_admin', `${persona} isn’t an admin persona: it works whenever you hold it, without “Act as”.`);
        if (!signedInRecently(caller, FRESH_SIGN_IN_MS, now().getTime())) {
          return sendProblem(reply, 403, 'sign_in_again', 'Sign in again to act as an admin persona: it needs a sign-in from the last 5 minutes.');
        }
        const started = now();
        const minutes = Math.min(req.body.minutes ?? most, most);
        const { started: session, ended } = await sessions.start({
          person: caller.id,
          persona,
          reason: req.body.reason,
          startedAt: started.toISOString(),
          endsAt: new Date(started.getTime() + minutes * 60_000).toISOString(),
        });
        if (ended) await record(caller, 'persona.session-ended', ended, { why: 'another started' });
        await record(caller, 'persona.session-started', session, { reason: session.reason, endsAt: session.endsAt });
        return reply.code(201).send(view(session));
      },
    );

    app.delete(
      '/v1/personas/sessions/current',
      { schema: { summary: 'Stop acting as a persona', response: { 204: Type.Null(), 401: Problem } } },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller) return sendProblem(reply, 401, 'unauthenticated', 'Sign in to continue.');
        const ended = await sessions.end(caller.id, now());
        if (ended) await record(caller, 'persona.session-ended', ended, { why: 'stopped' });
        return reply.code(204).send(null);
      },
    );

    app.post(
      '/access/v1/persona-session',
      {
        schema: {
          summary: 'Is this person acting as this persona now? For the gateway, before a call acts as it',
          body: Type.Object({ person: Type.String({ minLength: 1 }), persona: Type.String({ minLength: 1 }) }),
          response: { 200: Type.Object({ live: Type.Boolean(), endsAt: Type.Optional(Type.String({ format: 'date-time' })) }) },
        },
      },
      async (req, reply) => {
        if (!(await mayAsk(req, reply))) return reply;
        const live = await sessions.live(req.body.person, now());
        return live && live.persona === req.body.persona ? { live: true, endsAt: live.endsAt } : { live: false };
      },
    );
  };
