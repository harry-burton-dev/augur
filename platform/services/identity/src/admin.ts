import { randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import { callerFromHeaders, type NewAuditEntry } from '@augur/service-kit';
import { DEPLOYMENT_ADMIN_ROLE, DirectoryError, type Directory, type NewPerson } from './directory.ts';
import { Department, departmentName, empty, IdParams, LevelNames, NewPerson as NewPersonSchema, Person, PersonChanges, ref, refused, Role, TeamLevels } from './schemas.ts';
import { DEFAULT_LEVELS, MAX_TEAM_DEPTH, type WorkspaceStore } from './workspaces.ts';

/** Easy to read out or type: no 0/O, 1/l/I. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** A one-time password the person replaces at first sign-in, like "k7mq-3xrt-p9wd". */
export const temporaryPassword = () =>
  Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')).join('-');

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
  async (plain: FastifyInstance) => {
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();
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

    // What every /admin path can answer: the hooks above send these before a route runs.
    const guarded = {
      401: refused('No signed-in caller'),
      403: refused('Not an admin'),
      503: refused("Identity isn't connected to the sign-in service"),
    };
    const deploymentAdmins = refused('Not an admin, or not a deployment admin when the deployment-admin role or a deployment admin’s sign-in is touched');

    app.get('/roles', { schema: { summary: 'The roles an admin can give people', response: { 200: Type.Array(ref(Role), { description: 'Roles' }), ...guarded } } }, async () => dir().roles());

    app.get('/people', { schema: { summary: 'Everyone in the directory', response: { 200: Type.Array(ref(Person), { description: 'People' }), ...guarded } } }, async () => dir().people());

    app.get(
      '/people/:id',
      {
        schema: {
          summary: 'One person',
          params: IdParams,
          response: { 200: { ...ref(Person), description: 'The person' }, ...guarded, 404: refused('No such person') },
        },
      },
      async (req) => dir().person(req.params.id),
    );

    app.post(
      '/people',
      {
        schema: {
          summary: 'Add someone, with a one-time password they replace at first sign-in',
          body: ref(NewPersonSchema),
          response: {
            201: Type.Object(
              { person: ref(Person), temporaryPassword: Type.String() },
              { description: 'Added. The password is returned once and kept nowhere it can be read again.' },
            ),
            400: refused("A field is missing or wrong, or a role or department doesn't exist"),
            ...guarded,
            403: deploymentAdmins,
            409: refused('The username or email is taken'),
          },
        },
      },
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

    app.patch(
      '/people/:id',
      {
        schema: {
          summary: "Change someone's name, email, roles, departments or sign-in",
          description: [
            'Only the fields sent change. roles and departments replace the whole list.',
            "An admin can't turn off their own sign-in or remove their own admin role (409).",
          ].join(' '),
          params: IdParams,
          body: ref(PersonChanges),
          response: {
            200: { ...ref(Person), description: 'The person as they now are' },
            400: refused("A field is wrong, or a role or department doesn't exist"),
            ...guarded,
            403: deploymentAdmins,
            404: refused('No such person'),
            409: refused('The change would lock the caller out, or the email is taken'),
          },
        },
      },
      async (req, reply) => {
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
      },
    );

    app.post(
      '/people/:id/password',
      {
        schema: {
          summary: 'Give someone a new one-time password',
          params: IdParams,
          response: {
            200: Type.Object({ temporaryPassword: Type.String() }, { description: 'The new password, returned once' }),
            ...guarded,
            403: refused('Not an admin, or not a deployment admin when the person is one'),
            404: refused('No such person'),
          },
        },
      },
      async (req, reply) => {
        if ((await dir().person(req.params.id)).roles.includes(DEPLOYMENT_ADMIN) && !isDeploymentAdmin(req)) return deploymentAdminsOnly(reply);
        const password = temporaryPassword();
        await dir().resetPassword(req.params.id, password);
        await record(req, 'person.password-reset', req.params.id);
        return { temporaryPassword: password };
      },
    );

    app.get(
      '/departments',
      { schema: { summary: 'Every department, nested ones included', response: { 200: Type.Array(ref(Department), { description: 'Departments' }), ...guarded } } },
      async () => dir().departments(),
    );

    // What each level of department is called: Department right below the org, then Team, unless renamed here.
    app.get(
      '/levels',
      {
        schema: {
          summary: 'What each level of department is called, from the top',
          response: {
            200: { ...ref(TeamLevels), description: 'The names, the first for departments right below the org; a level deeper than the names takes the last one' },
            ...guarded,
          },
        },
      },
      async () => ({ levels: (await workspaces?.levels()) ?? DEFAULT_LEVELS, max: MAX_TEAM_DEPTH }),
    );

    app.put(
      '/levels',
      {
        schema: {
          summary: 'Rename the levels, audited as levels.renamed',
          body: LevelNames,
          response: {
            200: { ...ref(TeamLevels), description: 'Renamed' },
            400: refused(`No names, more than ${MAX_TEAM_DEPTH}, an empty or too-long name, or two levels with the same name`),
            ...guarded,
          },
        },
      },
      async (req) => {
        if (!workspaces) throw new DirectoryError('Level names can’t be changed here yet.', 503);
        const before = await workspaces.levels();
        const levels = await workspaces.setLevels(req.body.levels);
        if (levels.join('\n') !== before.join('\n')) await record(req, 'levels.renamed', 'team-levels', { from: before, to: levels });
        return { levels, max: MAX_TEAM_DEPTH };
      },
    );

    app.post(
      '/departments',
      {
        schema: {
          summary: 'Add a department, at the top or inside another',
          body: Type.Object({ name: departmentName(), parentId: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })) }, { additionalProperties: false }),
          response: {
            201: { ...ref(Department), description: 'Added' },
            400: refused(`The name is empty or has a /, the parent doesn't exist, or it would sit more than ${MAX_TEAM_DEPTH} deep`),
            ...guarded,
            409: refused('A department beside it already has that name'),
          },
        },
      },
      async (req, reply) => {
        const created = await dir().createDepartment(req.body.name.trim(), req.body.parentId);
        await record(req, 'department.created', created.id, { name: created.name, ...(created.parentId ? { parentId: created.parentId } : {}) });
        return reply.code(201).send(created);
      },
    );

    app.patch(
      '/departments/:id',
      {
        schema: {
          summary: 'Rename a department',
          params: IdParams,
          body: Type.Object({ name: departmentName() }, { additionalProperties: false }),
          response: {
            200: { ...ref(Department), description: 'Renamed' },
            400: refused('The name is empty or has a /'),
            ...guarded,
            404: refused('No such department'),
            409: refused('A department beside it already has that name'),
          },
        },
      },
      async (req) => {
        const before = (await dir().departments()).find((d) => d.id === req.params.id);
        if (!before) throw new DirectoryError('That department no longer exists.', 404);
        const after = await dir().renameDepartment(req.params.id, req.body.name.trim());
        if (after.name !== before.name) await record(req, 'department.renamed', after.id, { from: before.name, to: after.name });
        return after;
      },
    );

    const membership =
      (add: boolean) =>
      async (req: FastifyRequest<{ Params: { id: string; person: string } }>, reply: FastifyReply) => {
        const { id, person } = req.params;
        await (add ? dir().addMember(id, person) : dir().removeMember(id, person));
        await record(req, add ? 'department.member-added' : 'department.member-removed', id, { person });
        return reply.code(204).send();
      };
    const membershipSchema = (summary: string, done: string) => ({
      summary,
      params: Type.Object({ id: Type.String(), person: Type.String() }),
      response: { 204: empty(done), ...guarded, 404: refused('No such person or department') },
    });
    app.put('/departments/:id/members/:person', { schema: membershipSchema('Put someone in a department', "They're in it") }, membership(true));
    app.delete('/departments/:id/members/:person', { schema: membershipSchema('Take someone out of a department', "They're out of it") }, membership(false));
  };
