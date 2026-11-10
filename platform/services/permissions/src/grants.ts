import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import pg from 'pg';
import { callerFromHeaders, runMigrations, sendProblem, steadyPool, type Caller, type NewAuditEntry } from '@augur/service-kit';
import type { CheckKey } from './openfga.ts';
import { migrations } from './store.ts';

/**
 * Roles made in AUGUR and the grants that give them (ADR 0085, spec sections 4 and 5). A role is a set of
 * holders, made for a floor or the org by whoever may manage it; a grant puts someone in a role, or gives a
 * role's holders something on a floor or the org. Each grant is a relationship in OpenFGA and a row in the
 * ledger, which says who gave it, why, until when, and what right giving it needed. When the giver loses that
 * right, what they gave is revoked (the cascade), because OpenFGA doesn't do that by itself.
 */

export interface Role {
  id: string;
  name: string;
  /** `floor:<id>` or `org:<id>`. */
  scope: string;
  madeBy: string;
  /** The admin persona they made it as, if any. */
  madeAs?: string;
  madeAt: string;
}

export interface Grant {
  id: string;
  giver: string;
  giverAs?: string;
  /** OpenFGA's user: `person:x`, `persona:x#holder`, `floor:x#member` or `role:x#assignee`. */
  subject: string;
  relation: string;
  object: string;
  /** The right giving it needed, as `relation object`: what the cascade checks the giver still has. */
  needs: string;
  reason: string;
  madeAt: string;
  expiresAt?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
}

export interface GrantStore {
  addRole(role: Omit<Role, 'id'>): Promise<Role>;
  role(id: string): Promise<Role | undefined>;
  roles(scope: string): Promise<Role[]>;
  addGrant(grant: Omit<Grant, 'id' | 'revokedAt' | 'revokedBy' | 'revokeReason'>): Promise<Grant>;
  grant(id: string): Promise<Grant | undefined>;
  /** Grants not revoked and not past their time, on `object` or every one. */
  live(at: Date, object?: string): Promise<Grant[]>;
  /** Marks it revoked, returning it, or undefined when it already was. */
  revoke(id: string, by: string, reason: string, at: Date): Promise<Grant | undefined>;
}

type RoleRow = { id: string; name: string; scope: string; made_by: string; made_as: string | null; made_at: Date };
type GrantRow = {
  id: string;
  giver: string;
  giver_as: string | null;
  subject: string;
  relation: string;
  object: string;
  needs: string;
  reason: string;
  made_at: Date;
  expires_at: Date | null;
  revoked_at: Date | null;
  revoked_by: string | null;
  revoke_reason: string | null;
};
const roleOf = (r: RoleRow): Role => ({ id: r.id, name: r.name, scope: r.scope, madeBy: r.made_by, ...(r.made_as ? { madeAs: r.made_as } : {}), madeAt: r.made_at.toISOString() });
const grantOf = (r: GrantRow): Grant => ({
  id: r.id,
  giver: r.giver,
  ...(r.giver_as ? { giverAs: r.giver_as } : {}),
  subject: r.subject,
  relation: r.relation,
  object: r.object,
  needs: r.needs,
  reason: r.reason,
  madeAt: r.made_at.toISOString(),
  ...(r.expires_at ? { expiresAt: r.expires_at.toISOString() } : {}),
  ...(r.revoked_at ? { revokedAt: r.revoked_at.toISOString() } : {}),
  ...(r.revoked_by ? { revokedBy: r.revoked_by } : {}),
  ...(r.revoke_reason ? { revokeReason: r.revoke_reason } : {}),
});

export class PgGrantStore implements GrantStore {
  constructor(private readonly pool: pg.Pool) {}

  static async connect(connectionString: string) {
    const store = new PgGrantStore(steadyPool(new pg.Pool({ connectionString })));
    await runMigrations(store.pool, { schema: 'permissions', migrations });
    return store;
  }

  async addRole(r: Omit<Role, 'id'>) {
    const { rows } = await this.pool.query<RoleRow>('insert into permissions.roles (id, name, scope, made_by, made_as, made_at) values ($1, $2, $3, $4, $5, $6) returning *', [
      randomUUID(),
      r.name,
      r.scope,
      r.madeBy,
      r.madeAs ?? null,
      r.madeAt,
    ]);
    return roleOf(rows[0]!);
  }

  async role(id: string) {
    const { rows } = await this.pool.query<RoleRow>('select * from permissions.roles where id = $1', [id]);
    return rows[0] && roleOf(rows[0]);
  }

  async roles(scope: string) {
    const { rows } = await this.pool.query<RoleRow>('select * from permissions.roles where scope = $1 order by name', [scope]);
    return rows.map(roleOf);
  }

  async addGrant(g: Omit<Grant, 'id' | 'revokedAt' | 'revokedBy' | 'revokeReason'>) {
    const { rows } = await this.pool.query<GrantRow>(
      `insert into permissions.grants (id, giver, giver_as, subject, relation, object, needs, reason, made_at, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
      [randomUUID(), g.giver, g.giverAs ?? null, g.subject, g.relation, g.object, g.needs, g.reason, g.madeAt, g.expiresAt ?? null],
    );
    return grantOf(rows[0]!);
  }

  async grant(id: string) {
    const { rows } = await this.pool.query<GrantRow>('select * from permissions.grants where id = $1', [id]);
    return rows[0] && grantOf(rows[0]);
  }

  async live(at: Date, object?: string) {
    const { rows } = await this.pool.query<GrantRow>(
      `select * from permissions.grants where revoked_at is null and (expires_at is null or expires_at > $1) and ($2::text is null or object = $2) order by made_at`,
      [at, object ?? null],
    );
    return rows.map(grantOf);
  }

  async revoke(id: string, by: string, reason: string, at: Date) {
    const { rows } = await this.pool.query<GrantRow>(
      'update permissions.grants set revoked_at = $2, revoked_by = $3, revoke_reason = $4 where id = $1 and revoked_at is null returning *',
      [id, at, by, reason],
    );
    return rows[0] && grantOf(rows[0]);
  }
}

/** Roles and grants kept in memory: for tests and for running the service without a database. */
export class MemoryGrantStore implements GrantStore {
  readonly roleList: Role[] = [];
  readonly grantList: Grant[] = [];

  async addRole(r: Omit<Role, 'id'>) {
    const role = { id: randomUUID(), ...r };
    this.roleList.push(role);
    return { ...role };
  }

  async role(id: string) {
    const r = this.roleList.find((x) => x.id === id);
    return r && { ...r };
  }

  async roles(scope: string) {
    return this.roleList.filter((r) => r.scope === scope).sort((a, b) => a.name.localeCompare(b.name));
  }

  async addGrant(g: Omit<Grant, 'id' | 'revokedAt' | 'revokedBy' | 'revokeReason'>) {
    const grant = { id: randomUUID(), ...g };
    this.grantList.push(grant);
    return { ...grant };
  }

  async grant(id: string) {
    const g = this.grantList.find((x) => x.id === id);
    return g && { ...g };
  }

  async live(at: Date, object?: string) {
    const when = at.toISOString();
    return this.grantList.filter((g) => !g.revokedAt && (!g.expiresAt || g.expiresAt > when) && (!object || g.object === object)).map((g) => ({ ...g }));
  }

  async revoke(id: string, by: string, reason: string, at: Date) {
    const g = this.grantList.find((x) => x.id === id && !x.revokedAt);
    if (!g) return undefined;
    Object.assign(g, { revokedAt: at.toISOString(), revokedBy: by, revokeReason: reason });
    return { ...g };
  }
}

/** What the routes need of OpenFGA: always fresh, since these are the checks a revoke must reach at once (D8). */
export interface GrantEngine {
  check(key: CheckKey): Promise<boolean>;
  write(writes: CheckKey[], deletes: CheckKey[]): Promise<void>;
}

/**
 * What a role's holders may be given, and the right on the floor or org the giver needs for it. Only relations
 * the model lets `role#assignee` hold, and none that only a persona may (admin): a role is never an admin
 * backdoor. Lead and member are given to positions by identity; a role adds to them, never replaces them.
 */
export const GIVES: Record<'floor' | 'org', Record<string, string>> = {
  floor: { lead: 'can_manage_members', member: 'can_manage_members', settler: 'can_manage_members', raiser: 'can_manage_members' },
  org: { publisher: 'can_manage_org', audit_reader: 'can_manage_org' },
};

const ID = '^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$';
const Scope = Type.Object({ type: Type.Union([Type.Literal('floor'), Type.Literal('org')]), id: Type.String({ pattern: ID }) });
const Problem = Type.Object({ error: Type.String(), message: Type.String() });
const RoleView = Type.Object({ id: Type.String(), name: Type.String(), scope: Type.String(), madeBy: Type.String(), madeAs: Type.Optional(Type.String()), madeAt: Type.String({ format: 'date-time' }) });
const GrantView = Type.Object({
  id: Type.String(),
  giver: Type.String(),
  giverAs: Type.Optional(Type.String()),
  subject: Type.String(),
  relation: Type.String(),
  object: Type.String(),
  reason: Type.String(),
  madeAt: Type.String({ format: 'date-time' }),
  expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
});
const Reason = Type.String({ minLength: 3, maxLength: 300, description: 'Why, in a few words. Recorded with the grant.' });
const view = (g: Grant) => ({
  id: g.id,
  giver: g.giver,
  ...(g.giverAs ? { giverAs: g.giverAs } : {}),
  subject: g.subject,
  relation: g.relation,
  object: g.object,
  reason: g.reason,
  madeAt: g.madeAt,
  ...(g.expiresAt ? { expiresAt: g.expiresAt } : {}),
});

/** Who a check is about: the admin persona the caller is acting as (signed in by the gateway), else the person. */
export const subjectOf = (caller: Caller) => (caller.persona ? `persona:${caller.persona}` : `person:${caller.id}`);

/** The relationship a grant is, with its end time as the model's condition. */
export const keyOf = (g: Pick<Grant, 'subject' | 'relation' | 'object' | 'expiresAt'>): CheckKey => ({
  user: g.subject,
  relation: g.relation,
  object: g.object,
  ...(g.expiresAt ? { condition: { name: 'not_expired', context: { grant_expires: g.expiresAt } } } : {}),
});

export interface GrantRouteOptions {
  grants: GrantStore;
  engine: GrantEngine;
  /** The org's id, for `org:this`. */
  org: () => string | undefined;
  audit?: (entry: NewAuditEntry) => Promise<void>;
  now: () => Date;
}

/**
 * The cascade (D7): every live grant whose giver no longer holds the right it needed is revoked, in OpenFGA and
 * in the ledger, and recorded. Run after identity's floors and positions change, and on a timer besides.
 */
export const cascade = async ({ grants, engine, audit, now }: Pick<GrantRouteOptions, 'grants' | 'engine' | 'audit' | 'now'>): Promise<Grant[]> => {
  const at = now();
  const revoked: Grant[] = [];
  for (const g of await grants.live(at)) {
    const [relation, object] = g.needs.split(' ') as [string, string];
    const giver = g.giverAs ? `persona:${g.giverAs}` : `person:${g.giver}`;
    if (await engine.check({ user: giver, relation, object })) continue;
    await engine.write([], [keyOf(g)]);
    const done = await grants.revoke(g.id, 'permissions', `${g.giverAs ?? g.giver} can no longer give it`, at);
    if (!done) continue;
    revoked.push(done);
    await record(audit, { actor: { id: 'permissions', kind: 'service' }, app: 'permissions', action: 'grant.revoked', target: g.object, detail: { grant: g.id, subject: g.subject, relation: g.relation, cascade: true, giver: g.giver } });
  }
  return revoked;
};

const record = async (audit: GrantRouteOptions['audit'], entry: NewAuditEntry) => {
  try {
    await audit?.(entry);
  } catch {
    // The change stands; the audit log hears of it when it can.
  }
};

/**
 * The routes, reached through the gateway at /api/permissions/v1: roles for a floor or the org, putting
 * someone in a role (until a time, if given), giving a role's holders something, and revoking a grant. Each
 * write checks the giver's own right first: you only give what you hold.
 */
export const grantRoutes =
  ({ grants, engine, org, audit, now }: GrantRouteOptions) =>
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();

    const objectOf = (s: { type: 'floor' | 'org'; id: string }) => {
      if (s.type === 'org' && s.id === 'this') {
        const known = org();
        return known ? `org:${known}` : undefined;
      }
      return `${s.type}:${s.id}`;
    };
    const unavailable = (reply: FastifyReply, err: unknown) => {
      reply.log.warn({ err }, 'roles or grants could not be reached');
      return sendProblem(reply, 503, 'unavailable', 'Roles and grants can’t be changed right now. Nothing changed. A deployment admin can see why on Status.');
    };
    const signedIn = (reply: FastifyReply) => {
      sendProblem(reply, 401, 'unauthenticated', 'Sign in to continue.');
      return undefined;
    };
    const actor = (caller: Caller) => ({ id: caller.id, kind: 'user' as const });
    const asWhom = (caller: Caller) => (caller.persona ? { giverAs: caller.persona } : {});

    app.get(
      '/v1/roles',
      {
        schema: {
          summary: 'The roles made for a floor or the org',
          querystring: Type.Object({ scope: Type.String({ pattern: '^(floor|org):[A-Za-z0-9][A-Za-z0-9._-]{0,199}$' }) }),
          response: { 200: Type.Object({ roles: Type.Array(RoleView) }), 401: Problem, 403: Problem, 503: Problem },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers) ?? signedIn(reply);
        if (!caller) return reply;
        const [type, id] = req.query.scope.split(':') as ['floor' | 'org', string];
        const scope = objectOf({ type, id });
        if (!scope) return unavailable(reply, new Error('org unknown'));
        try {
          if (!(await engine.check({ user: subjectOf(caller), relation: 'can_see', object: scope }))) return sendProblem(reply, 403, 'forbidden', 'You can see the roles only of floors you stand on.');
          return { roles: await grants.roles(scope) };
        } catch (err) {
          return unavailable(reply, err);
        }
      },
    );

    app.post(
      '/v1/roles',
      {
        schema: {
          summary: 'Make a role for a floor you manage, or for the org as an org admin',
          body: Type.Object({ name: Type.String({ minLength: 1, maxLength: 80 }), scope: Scope }),
          response: { 201: RoleView, 401: Problem, 403: Problem, 503: Problem },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers) ?? signedIn(reply);
        if (!caller) return reply;
        const scope = objectOf(req.body.scope);
        if (!scope) return unavailable(reply, new Error('org unknown'));
        try {
          if (!(await engine.check({ user: subjectOf(caller), relation: 'can_create_role', object: scope }))) {
            return sendProblem(reply, 403, 'forbidden', `Only whoever manages ${req.body.scope.type === 'org' ? 'the org (an org admin, acting as one)' : 'that floor (a lead of it or a floor above, or an org admin)'} can make a role for it.`);
          }
          const role = await grants.addRole({ name: req.body.name.trim(), scope, madeBy: caller.id, ...(caller.persona ? { madeAs: caller.persona } : {}), madeAt: now().toISOString() });
          await engine.write([{ user: scope, relation: 'scope', object: `role:${role.id}` }], []);
          await record(audit, { actor: actor(caller), app: 'permissions', action: 'role.created', target: `role:${role.id}`, detail: { name: role.name, scope, ...asWhom(caller) } });
          return reply.code(201).send(role);
        } catch (err) {
          return unavailable(reply, err);
        }
      },
    );

    app.get(
      '/v1/roles/:role',
      {
        schema: {
          summary: 'A role, who holds it, and what it gives',
          params: Type.Object({ role: Type.String({ pattern: ID }) }),
          response: { 200: Type.Object({ role: RoleView, holders: Type.Array(GrantView), gives: Type.Array(GrantView) }), 401: Problem, 403: Problem, 404: Problem, 503: Problem },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers) ?? signedIn(reply);
        if (!caller) return reply;
        try {
          const role = await grants.role(req.params.role);
          if (!role) return sendProblem(reply, 404, 'not_found', 'That role doesn’t exist.');
          if (!(await engine.check({ user: subjectOf(caller), relation: 'can_see', object: role.scope }))) return sendProblem(reply, 403, 'forbidden', 'You can see the roles only of floors you stand on.');
          const at = now();
          const of = `role:${role.id}`;
          const holders = (await grants.live(at, of)).map(view);
          const gives = (await grants.live(at)).filter((g) => g.subject === `${of}#assignee`).map(view);
          return { role, holders, gives };
        } catch (err) {
          return unavailable(reply, err);
        }
      },
    );

    app.post(
      '/v1/roles/:role/holders',
      {
        schema: {
          summary: 'Put a person, a position’s holders or a floor’s members in a role, until a time if given',
          params: Type.Object({ role: Type.String({ pattern: ID }) }),
          body: Type.Object({
            to: Type.Object({ type: Type.Union([Type.Literal('person'), Type.Literal('position'), Type.Literal('floor')]), id: Type.String({ pattern: ID }) }),
            reason: Reason,
            expiresAt: Type.Optional(Type.String({ format: 'date-time', description: 'When it stops. Not for a whole floor.' })),
          }),
          response: { 201: GrantView, 400: Problem, 401: Problem, 403: Problem, 404: Problem, 503: Problem },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers) ?? signedIn(reply);
        if (!caller) return reply;
        const { to, reason, expiresAt } = req.body;
        if (expiresAt && to.type === 'floor') return sendProblem(reply, 400, 'invalid', 'A whole floor’s members are given a role for good. Give it to people or positions to make it end.');
        if (expiresAt && Date.parse(expiresAt) <= now().getTime()) return sendProblem(reply, 400, 'invalid', 'That time has passed. Choose one still to come.');
        const subject = to.type === 'person' ? `person:${to.id}` : to.type === 'position' ? `persona:${to.id}#holder` : `floor:${to.id}#member`;
        try {
          const role = await grants.role(req.params.role);
          if (!role) return sendProblem(reply, 404, 'not_found', 'That role doesn’t exist.');
          const object = `role:${role.id}`;
          if (!(await engine.check({ user: subjectOf(caller), relation: 'can_assign', object }))) {
            return sendProblem(reply, 403, 'forbidden', `Only whoever manages ${role.scope.startsWith('org:') ? 'the org' : 'its floor'} can give ${role.name}.`);
          }
          const grant = await grants.addGrant({ giver: caller.id, ...asWhom(caller), subject, relation: 'assignee', object, needs: `can_assign ${object}`, reason, madeAt: now().toISOString(), ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}) });
          await engine.write([keyOf(grant)], []);
          await record(audit, { actor: actor(caller), app: 'permissions', action: 'role.given', target: object, detail: { grant: grant.id, name: role.name, to: subject, reason, ...(grant.expiresAt ? { expiresAt: grant.expiresAt } : {}), ...asWhom(caller) } });
          return reply.code(201).send(view(grant));
        } catch (err) {
          return unavailable(reply, err);
        }
      },
    );

    app.post(
      '/v1/roles/:role/gives',
      {
        schema: {
          summary: 'Give a role’s holders something on a floor or the org, such as settling a floor’s disputes',
          params: Type.Object({ role: Type.String({ pattern: ID }) }),
          body: Type.Object({ relation: Type.String({ pattern: '^[a-z][a-z_]{0,63}$' }), on: Scope, reason: Reason }),
          response: { 201: GrantView, 400: Problem, 401: Problem, 403: Problem, 404: Problem, 503: Problem },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers) ?? signedIn(reply);
        if (!caller) return reply;
        const { relation, on, reason } = req.body;
        const needed = GIVES[on.type][relation];
        if (!needed) return sendProblem(reply, 400, 'invalid', `A role can be given ${Object.keys(GIVES[on.type]).join(', ')} on ${on.type === 'org' ? 'the org' : 'a floor'}, not ${relation}.`);
        const object = objectOf(on);
        if (!object) return unavailable(reply, new Error('org unknown'));
        try {
          const role = await grants.role(req.params.role);
          if (!role) return sendProblem(reply, 404, 'not_found', 'That role doesn’t exist.');
          const me = subjectOf(caller);
          const [mayAssign, mayGive] = [await engine.check({ user: me, relation: 'can_assign', object: `role:${role.id}` }), await engine.check({ user: me, relation: needed, object })];
          if (!mayAssign || !mayGive) return sendProblem(reply, 403, 'forbidden', `You can give ${role.name} only what you could give yourself, where you manage it.`);
          const grant = await grants.addGrant({ giver: caller.id, ...asWhom(caller), subject: `role:${role.id}#assignee`, relation, object, needs: `${needed} ${object}`, reason, madeAt: now().toISOString() });
          await engine.write([keyOf(grant)], []);
          await record(audit, { actor: actor(caller), app: 'permissions', action: 'role.gives', target: object, detail: { grant: grant.id, role: role.id, name: role.name, relation, reason, ...asWhom(caller) } });
          return reply.code(201).send(view(grant));
        } catch (err) {
          return unavailable(reply, err);
        }
      },
    );

    app.delete(
      '/v1/grants/:grant',
      {
        schema: {
          summary: 'Take back a grant: whoever gave it, or anyone who could give it now',
          params: Type.Object({ grant: Type.String({ format: 'uuid' }) }),
          querystring: Type.Object({ reason: Type.Optional(Reason) }),
          response: { 204: Type.Null(), 401: Problem, 403: Problem, 404: Problem, 503: Problem },
        },
      },
      async (req, reply) => {
        const caller = callerFromHeaders(req.headers) ?? signedIn(reply);
        if (!caller) return reply;
        try {
          const g = await grants.grant(req.params.grant);
          if (!g || g.revokedAt) return sendProblem(reply, 404, 'not_found', 'That grant doesn’t exist, or was already taken back.');
          const [relation, object] = g.needs.split(' ') as [string, string];
          const mine = g.giver === caller.id && (g.giverAs ?? undefined) === (caller.persona ?? undefined);
          if (!mine && !(await engine.check({ user: subjectOf(caller), relation, object }))) return sendProblem(reply, 403, 'forbidden', 'Only whoever gave it, or someone who could give it now, can take it back.');
          await engine.write([], [keyOf(g)]);
          const reason = req.query.reason ?? 'Taken back';
          await grants.revoke(g.id, caller.id, reason, now());
          await record(audit, { actor: actor(caller), app: 'permissions', action: 'grant.revoked', target: g.object, detail: { grant: g.id, subject: g.subject, relation: g.relation, reason, ...asWhom(caller) } });
          // Someone who held it may have given on from it.
          await cascade({ grants, engine, ...(audit ? { audit } : {}), now });
          return reply.code(204).send(null);
        } catch (err) {
          return unavailable(reply, err);
        }
      },
    );
  };
