import { randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { callerFromHeaders, type NewAuditEntry } from '@augur/service-kit';
import { DEPLOYMENT_ADMIN_ROLE, DirectoryError, type Directory, type NewPerson, type PersonChanges } from './directory.ts';
import { DEFAULT_LEVELS, MAX_LEVEL_NAME, MAX_TEAM_DEPTH, type WorkspaceStore } from './workspaces.ts';

/** Easy to read out or type: no 0/O, 1/l/I. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * A one-time password the person replaces at first sign-in, like "k7mq-3xrt-p9wd-h4nc": 19 characters,
 * so it meets the realm's 15-character floor (ADR 0038).
 */
export const temporaryPassword = () =>
  Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')).join('-');

const name = { type: 'string', minLength: 1, maxLength: 80, pattern: '\\S' } as const;
const email = { type: 'string', minLength: 3, maxLength: 254, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' } as const;
const ids = { type: 'array', maxItems: 50, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 100 } } as const;

export const newPersonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['firstName', 'lastName', 'email'],
  properties: {
    username: { type: 'string', pattern: '^[a-z0-9][a-z0-9._-]{1,59}$' },
    firstName: name,
    lastName: name,
    email,
    roles: ids,
    departments: ids,
  },
} as const;

export const personChangesSchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: { firstName: name, lastName: name, email, enabled: { type: 'boolean' }, roles: ids, departments: ids },
} as const;

const departmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: { name: { type: 'string', minLength: 1, maxLength: 60, pattern: '^[^/]*[^/\\s][^/]*$' } },
} as const;

const levelsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['levels'],
  properties: { levels: { type: 'array', minItems: 1, maxItems: MAX_TEAM_DEPTH, items: { type: 'string', minLength: 1, maxLength: MAX_LEVEL_NAME } } },
} as const;

const newDepartmentSchema = {
  ...departmentSchema,
  properties: { ...departmentSchema.properties, parentId: { type: 'string', minLength: 1, maxLength: 100 } },
} as const;

/** The part of an email before the @, made into a username: "Jo.Smith+x@org" → "jo.smith". */
export const usernameFrom = (address: string) =>
  address
    .split('@')[0]
    .toLowerCase()
    .replace(/\+.*$/, '')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 60) || 'person';

interface AdminOptions {
  directory?: Directory;
  /** Where the names of the levels of team are kept. */
  workspaces?: WorkspaceStore;
  audit?: (entry: NewAuditEntry, workspace?: string) => Promise<void>;
}

/**
 * People, departments and roles, for admins only. Every change is audited
 * (never a password), and an admin can't lock themselves out: they can't turn
 * off their own sign-in or take away their own admin role. Only a deployment admin
 * can give or take away that role, or change a deployment admin's sign-in.
 */
export const adminRoutes =
  ({ directory, workspaces, audit }: AdminOptions) =>
  async (app: FastifyInstance) => {
    app.addHook('onRequest', async (req, reply) => {
      if (!callerFromHeaders(req.headers)?.roles.includes('admin')) {
        return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can manage people and departments.' });
      }
      if (!directory) {
        return reply.code(503).send({ error: 'unavailable', message: 'Identity isn’t connected to the sign-in service, so people can’t be managed here yet.' });
      }
    });

    app.setErrorHandler((err: Error, req, reply) => {
      if (err instanceof DirectoryError) {
        const error = { 400: 'bad_request', 404: 'not_found', 409: 'conflict', 503: 'unavailable' }[err.status];
        return reply.code(err.status).send({ error, message: err.message });
      }
      if ((err as { validation?: unknown }).validation) {
        return reply.code(400).send({ error: 'bad_request', message: err.message });
      }
      req.log.error({ err }, 'admin request failed');
      return reply.code(500).send({ error: 'internal', message: 'Something went wrong. Nothing was changed; try again.' });
    });

    const dir = () => directory!;
    const DEPLOYMENT_ADMIN = DEPLOYMENT_ADMIN_ROLE.name;
    const isDeploymentAdmin = (req: FastifyRequest) => callerFromHeaders(req.headers)!.roles.includes(DEPLOYMENT_ADMIN);
    // Only a deployment admin may make one, or change one's role or sign-in, so an admin can't take the deployment over.
    const deploymentAdminsOnly = (reply: FastifyReply) =>
      reply.code(403).send({ error: 'forbidden', message: 'Only a deployment admin can give or take away that role, or change a deployment admin’s sign-in.' });
    const actorOf = (req: FastifyRequest) => ({ id: callerFromHeaders(req.headers)!.id, kind: 'user' as const });

    /** The change happened either way; a failed audit write is logged, not turned into a failed request. */
    // A department is a team: its changes are recorded on its floor.
    const record = (req: FastifyRequest, action: string, target: string, detail?: Record<string, unknown>) =>
      audit?.({ actor: actorOf(req), app: 'identity', action, target, ...(detail ? { detail } : {}) }, action.startsWith('department.') ? target : undefined).catch((err: Error) =>
        req.log.error({ err: err.message, action }, 'audit entry not recorded'),
      );

    app.get('/roles', async () => dir().roles());

    app.get('/people', async () => dir().people());

    app.get<{ Params: { id: string } }>('/people/:id', async (req) => dir().person(req.params.id));

    app.post<{ Body: Omit<NewPerson, 'username' | 'roles' | 'departments'> & Partial<NewPerson> }>(
      '/people',
      { schema: { body: newPersonSchema } },
      async (req, reply) => {
        const body = req.body;
        const person: NewPerson = {
          username: body.username ?? usernameFrom(body.email),
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          email: body.email.trim(),
          roles: body.roles ?? [],
          departments: body.departments ?? [],
        };
        if (person.roles.includes(DEPLOYMENT_ADMIN) && !isDeploymentAdmin(req)) return deploymentAdminsOnly(reply);
        const password = temporaryPassword();
        const created = await dir().createPerson(person, password);
        await record(req, 'person.added', created.id, { username: created.username, roles: created.roles, departments: created.departments });
        return reply.code(201).send({ person: created, temporaryPassword: password });
      },
    );

    app.patch<{ Params: { id: string }; Body: PersonChanges }>('/people/:id', { schema: { body: personChangesSchema } }, async (req, reply) => {
      const me = callerFromHeaders(req.headers)!;
      const changes = req.body;
      if (req.params.id === me.id && changes.enabled === false) {
        return reply.code(409).send({ error: 'conflict', message: 'You can’t turn off your own sign-in. Ask another admin.' });
      }
      if (req.params.id === me.id && changes.roles && !changes.roles.includes('admin')) {
        return reply.code(409).send({ error: 'conflict', message: 'You can’t take away your own admin role. Ask another admin.' });
      }
      const before = await dir().person(req.params.id);
      const held = before.roles.includes(DEPLOYMENT_ADMIN);
      const touchesRole = changes.roles !== undefined && changes.roles.includes(DEPLOYMENT_ADMIN) !== held;
      const touchesSignIn = held && ((changes.enabled !== undefined && changes.enabled !== before.enabled) || (changes.email !== undefined && changes.email !== before.email));
      if ((touchesRole || touchesSignIn) && !isDeploymentAdmin(req)) return deploymentAdminsOnly(reply);
      const after = await dir().updatePerson(req.params.id, changes);
      if (changes.enabled !== undefined && changes.enabled !== before.enabled) {
        await record(req, after.enabled ? 'person.enabled' : 'person.disabled', after.id, { username: after.username });
      }
      const changed = (['firstName', 'lastName', 'email', 'roles', 'departments'] as const).filter(
        (k) => changes[k] !== undefined && JSON.stringify(changes[k]) !== JSON.stringify(before[k]),
      );
      if (changed.length) {
        await record(req, 'person.updated', after.id, { username: after.username, ...Object.fromEntries(changed.map((k) => [k, { from: before[k], to: after[k] }])) });
      }
      return after;
    });

    app.post<{ Params: { id: string } }>('/people/:id/password', async (req, reply) => {
      if ((await dir().person(req.params.id)).roles.includes(DEPLOYMENT_ADMIN) && !isDeploymentAdmin(req)) return deploymentAdminsOnly(reply);
      const password = temporaryPassword();
      await dir().resetPassword(req.params.id, password);
      await record(req, 'person.password-reset', req.params.id);
      return { temporaryPassword: password };
    });

    app.get('/departments', async () => dir().departments());

    // What each level of department is called: Department right below the org, then Team, unless renamed here.
    app.get('/levels', async () => ({ levels: (await workspaces?.levels()) ?? DEFAULT_LEVELS, max: MAX_TEAM_DEPTH }));

    app.put<{ Body: { levels: string[] } }>('/levels', { schema: { body: levelsSchema } }, async (req) => {
      if (!workspaces) throw new DirectoryError('Level names can’t be changed here yet.', 503);
      const before = await workspaces.levels();
      const levels = await workspaces.setLevels(req.body.levels);
      if (levels.join('\n') !== before.join('\n')) await record(req, 'levels.renamed', 'team-levels', { from: before, to: levels });
      return { levels, max: MAX_TEAM_DEPTH };
    });

    app.post<{ Body: { name: string; parentId?: string } }>('/departments', { schema: { body: newDepartmentSchema } }, async (req, reply) => {
      const created = await dir().createDepartment(req.body.name.trim(), req.body.parentId);
      await record(req, 'department.created', created.id, { name: created.name, ...(created.parentId ? { parentId: created.parentId } : {}) });
      return reply.code(201).send(created);
    });

    app.patch<{ Params: { id: string }; Body: { name: string } }>('/departments/:id', { schema: { body: departmentSchema } }, async (req) => {
      const before = (await dir().departments()).find((d) => d.id === req.params.id);
      if (!before) throw new DirectoryError('That department no longer exists.', 404);
      const after = await dir().renameDepartment(req.params.id, req.body.name.trim());
      if (after.name !== before.name) await record(req, 'department.renamed', after.id, { from: before.name, to: after.name });
      return after;
    });

    const membership =
      (add: boolean) =>
      async (req: FastifyRequest<{ Params: { id: string; person: string } }>, reply: FastifyReply) => {
        const { id, person } = req.params;
        await (add ? dir().addMember(id, person) : dir().removeMember(id, person));
        await record(req, add ? 'department.member-added' : 'department.member-removed', id, { person });
        return reply.code(204).send();
      };
    app.put('/departments/:id/members/:person', membership(true));
    app.delete('/departments/:id/members/:person', membership(false));
  };
