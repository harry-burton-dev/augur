import { randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import { callerFromHeaders, type NewAuditEntry } from '@augur/service-kit';
import { DEPLOYMENT_ADMIN_ROLE, DirectoryError, type Directory, type NewPerson, type Person as DirectoryPerson } from './directory.ts';
import { Department, departmentName, empty, IdParams, LevelNames, NewPerson as NewPersonSchema, Person, PersonChanges, ref, refused, Role, TeamLevels } from './schemas.ts';
import { withLifecycle, type LifecycleStore } from './lifecycle.ts';
import type { PreferenceStore } from './store.ts';
import { DEFAULT_LEVELS, MAX_TEAM_DEPTH, type WorkspaceStore } from './workspaces.ts';

/** Easy to read out or type: no 0/O, 1/l/I. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * A one-time password the person replaces at first sign-in, like "k7mq-3xrt-p9wd-h4nc": 19 characters,
 * so it meets the realm's 15-character floor (ADR 0038).
 */
export const temporaryPassword = () =>
  Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')).join('-');

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
  /** Where requests to leave are kept: the leaver flow closes them. */
  store?: PreferenceStore;
  /** What identity keeps about each account's life: last sign-in, why it's off, that they left. */
  lifecycle?: LifecycleStore;
}

/** The longest note an admin can leave on a leaver, for whoever reads Activity later. */
const LEAVER_NOTE = 500;

/**
 * People, departments and roles, for admins only. Every change is audited
 * (never a password), and an admin can't lock themselves out: they can't turn
 * off their own sign-in or take away their own admin role. Only a deployment admin
 * can give or take away that role, or change a deployment admin's sign-in.
 */
export const adminRoutes =
  ({ directory, workspaces, audit, store, lifecycle }: AdminOptions) =>
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

    /**
     * Each department someone joins or leaves, however it happened (added with departments, or their list
     * changed), is recorded on that department as the membership routes record it, so its floor's Activity
     * shows it and followers hear platform.team.member-added or -removed there (docs/domain-events.md).
     */
    const joined = async (req: FastifyRequest, person: string, before: string[], after: string[]) => {
      for (const id of after.filter((d) => !before.includes(d))) await record(req, 'department.member-added', id, { person });
      for (const id of before.filter((d) => !after.includes(d))) await record(req, 'department.member-removed', id, { person });
    };

    /** People as admins see them: with their state and what is kept about their account's life. */
    const decorate = async <P extends DirectoryPerson>(people: P[]) => {
      const kept = lifecycle ? await lifecycle.get(people.length === 1 ? [people[0]!.id] : undefined) : new Map();
      return people.map((p) => withLifecycle(p, kept.get(p.id)));
    };
    const one = async <P extends DirectoryPerson>(p: P) => (await decorate([p]))[0]!;
    const now = () => new Date().toISOString();

    // What every /admin path can answer: the hooks above send these before a route runs.
    const guarded = {
      401: refused('No signed-in caller'),
      403: refused('Not an admin'),
      503: refused("Identity isn't connected to the sign-in service"),
    };
    const deploymentAdmins = refused('Not an admin, or not a deployment admin when the deployment-admin role or a deployment admin’s sign-in is touched');

    app.get('/roles', { schema: { summary: 'The roles an admin can give people', response: { 200: Type.Array(ref(Role), { description: 'Roles' }), ...guarded } } }, async () => dir().roles());

    app.get('/people', { schema: { summary: 'Everyone in the directory', response: { 200: Type.Array(ref(Person), { description: 'People' }), ...guarded } } }, async () => decorate(await dir().people()));

    app.get(
      '/people/:id',
      {
        schema: {
          summary: 'One person',
          params: IdParams,
          response: { 200: { ...ref(Person), description: 'The person' }, ...guarded, 404: refused('No such person') },
        },
      },
      async (req) => one(await dir().person(req.params.id)),
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
        await joined(req, created.id, [], created.departments);
        return reply.code(201).send({ person: await one(created), temporaryPassword: password });
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
            409: refused('The change would lock the caller out, the email is taken, or they have left and the change would turn their sign-in back on'),
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
        if (changes.enabled === true && !before.enabled && (await one(before)).state === 'left') {
          return reply.code(409).send({ error: 'conflict', message: 'They’ve left, and a leaver doesn’t come back. Add them again if they return.' });
        }
        const held = before.roles.includes(DEPLOYMENT_ADMIN);
        const touchesRole = changes.roles !== undefined && changes.roles.includes(DEPLOYMENT_ADMIN) !== held;
        const touchesSignIn = held && ((changes.enabled !== undefined && changes.enabled !== before.enabled) || (changes.email !== undefined && changes.email !== before.email));
        if ((touchesRole || touchesSignIn) && !isDeploymentAdmin(req)) return deploymentAdminsOnly(reply);
        const after = await dir().updatePerson(req.params.id, changes);
        if (changes.enabled !== undefined && changes.enabled !== before.enabled) {
          await (after.enabled ? lifecycle?.enabled(after.id) : lifecycle?.disabled(after.id, 'admin', now()));
          await record(req, after.enabled ? 'person.enabled' : 'person.disabled', after.id, { username: after.username });
        }
        // Turning someone off signs them out everywhere now (ADR 0040). Asking again ends them again,
        // so an admin can retry if Keycloak couldn't be reached the first time.
        if (changes.enabled === false) await dir().endSessions(after.id);
        const changed = (['firstName', 'lastName', 'email', 'roles', 'departments'] as const).filter(
          (k) => changes[k] !== undefined && JSON.stringify(changes[k]) !== JSON.stringify(before[k]),
        );
        if (changed.length) {
          await record(req, 'person.updated', after.id, { username: after.username, ...Object.fromEntries(changed.map((k) => [k, { from: before[k], to: after[k] }])) });
        }
        if (changed.includes('departments')) await joined(req, after.id, before.departments, after.departments);
        return one(after);
      },
    );

    app.get(
      '/leave-requests',
      {
        schema: {
          summary: 'Everyone who has asked to leave, oldest first',
          description: 'People ask in their account (POST /me/leave); the leaver flow closes the request.',
          response: {
            200: Type.Array(
              Type.Object({ person: Type.String(), requestedAt: Type.String({ format: 'date-time' }), note: Type.Optional(Type.String()) }),
              { description: 'Open requests to leave' },
            ),
            ...guarded,
          },
        },
      },
      async () => (store ? store.leaveRequests() : []),
    );

    app.post(
      '/people/:id/leave',
      {
        schema: {
          summary: 'Someone leaves the organisation: the leaver flow',
          description: [
            'Turns off their sign-in, signs them out everywhere (sessions and offline tokens) and records',
            '`person.left`, which followers hear as `platform.person.left` so apps hand on or archive what the',
            'person owns, to `handOverTo` when it is given. Their teams, roles and data stay as they were until',
            "the deployment's retention period ends. Closes their request to leave, if they made one.",
          ].join(' '),
          params: IdParams,
          body: Type.Object(
            {
              handOverTo: Type.Optional(Type.String({ minLength: 1, maxLength: 100, description: 'Who takes on what they own: someone whose sign-in is on' })),
              note: Type.Optional(Type.String({ maxLength: LEAVER_NOTE, description: 'Why, or what was agreed, for Activity' })),
            },
            { additionalProperties: false },
          ),
          response: {
            200: { ...ref(Person), description: 'The person, now turned off' },
            400: refused('The person to hand over to is the leaver, is turned off, or isn’t in the directory'),
            ...guarded,
            403: deploymentAdmins,
            404: refused('No such person'),
            409: refused('The caller is the leaver, or they have already left'),
          },
        },
      },
      async (req, reply) => {
        const me = callerFromHeaders(req.headers)!;
        const id = req.params.id;
        if (id === me.id) return reply.code(409).send({ error: 'conflict', message: 'You can’t run the leaver flow on yourself. Ask another admin.' });
        const before = await dir().person(id);
        if (before.roles.includes(DEPLOYMENT_ADMIN) && !isDeploymentAdmin(req)) return deploymentAdminsOnly(reply);
        if ((await one(before)).state === 'left') return reply.code(409).send({ error: 'conflict', message: 'They’ve already left.' });
        const { handOverTo } = req.body;
        const note = req.body.note?.trim() || undefined;
        if (handOverTo !== undefined) {
          if (handOverTo === id) return reply.code(400).send({ error: 'bad_request', message: 'Hand their work to someone else, not to the person leaving.' });
          const heir = await dir()
            .person(handOverTo)
            .catch((err: Error) => {
              if (err instanceof DirectoryError && err.status === 404) return undefined;
              throw err;
            });
          if (!heir) return reply.code(400).send({ error: 'bad_request', message: 'The person to hand over to isn’t in the directory.' });
          if (!heir.enabled) return reply.code(400).send({ error: 'bad_request', message: `${heir.firstName} ${heir.lastName}’s sign-in is off, so they can’t take this on. Pick someone who can sign in.` });
        }
        const after = before.enabled ? await dir().updatePerson(id, { enabled: false }) : before;
        if (before.enabled) {
          await lifecycle?.disabled(id, 'leaver', now());
          await record(req, 'person.disabled', id, { username: after.username });
        }
        await dir().endSessions(id);
        const asked = store ? await store.withdrawLeave(id) : false;
        await lifecycle?.left(id, { at: now(), by: me.id, ...(handOverTo ? { handOverTo } : {}) });
        await record(req, 'person.left', id, { username: after.username, asked, ...(handOverTo ? { handOverTo } : {}), ...(note ? { note } : {}) });
        return one(after);
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
