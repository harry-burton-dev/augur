import { randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import { callerFromHeaders, signedInRecently, type NewAuditEntry } from '@augur/service-kit';
import { DEPLOYMENT_ADMIN_ROLE, DirectoryError, type Directory, type NewPerson, type Person as DirectoryPerson } from './directory.ts';
import { choice, Department, departmentName, empty, IdParams, LevelNames, NewPerson as NewPersonSchema, Person, PersonChanges, ref, refused, Role, TeamLevels } from './schemas.ts';
import { withLifecycle, type IdlePolicy, type LifecycleStore } from './lifecycle.ts';
import { addDays, runLeaver, todayIn } from './leavers.ts';
import { deleteAccount } from './deletion.ts';
import { organisationSettings, type OrganisationStore } from './organisation.ts';
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
  /** The organisation's idle-account days and time zone, for when an idle sign-in turns off and when a last day ends. */
  organisation?: OrganisationStore;
  /** Removes a deleted person's personal values from Activity (the events service); without it nobody can be deleted. */
  redact?: (person: string) => Promise<unknown>;
}

/** How recently a deployment admin must have entered their password to delete an account now. */
const DELETE_SIGN_IN_MS = 10 * 60_000;

/** How far ahead a leaver's last day can be set (PER-194 spec 5). */
const LAST_DAY_AHEAD = 90;

/** The longest note an admin can leave on a leaver, for whoever reads Activity later. */
const LEAVER_NOTE = 500;

/**
 * People, departments and roles, for admins only. Every change is audited
 * (never a password), and an admin can't lock themselves out: they can't turn
 * off their own sign-in or take away their own admin role. Only a deployment admin
 * can give or take away that role, or change a deployment admin's sign-in.
 */
export const adminRoutes =
  ({ directory, workspaces, audit, store, lifecycle, organisation, redact }: AdminOptions) =>
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

    /** The organisation's settings, when identity keeps them. */
    const org = async () => (workspaces && organisation ? organisationSettings(workspaces, organisation) : undefined);
    /** Whether, and when, idle sign-ins turn off here; unknown (and not shown) when it can't be read. */
    const idlePolicy = async (): Promise<IdlePolicy | undefined> => {
      const [settings, canEmail] = await Promise.all([org().catch(() => undefined), dir().canEmail().catch(() => undefined)]);
      return settings && canEmail !== undefined ? { ...settings.idle, canEmail, ...(redact ? { leaverDeleteAfterDays: settings.security.leaverRetentionDays } : {}) } : undefined;
    };
    /** People as admins see them: with their state and what is kept about their account's life. */
    const decorate = async <P extends DirectoryPerson>(people: P[]) => {
      const [kept, policy] = await Promise.all([lifecycle ? lifecycle.get(people.length === 1 ? [people[0]!.id] : undefined) : new Map(), idlePolicy()]);
      const at = new Date();
      return people.map((p) => withLifecycle(p, kept.get(p.id), at, policy));
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
          description: 'With `lockout` as the sign-in service has it now: whether wrong passwords have locked them out, and how many in a row.',
          params: IdParams,
          response: {
            200: {
              ...Type.Intersect([
                ref(Person),
                Type.Object({
                  lockout: Type.Optional(
                    Type.Object(
                      { locked: Type.Boolean(), failures: Type.Integer({ minimum: 0 }), lastFailureAt: Type.Optional(Type.String({ format: 'date-time' })) },
                      { description: 'Left out when the sign-in service couldn’t say' },
                    ),
                  ),
                }),
              ]),
              description: 'The person',
            },
            ...guarded,
            404: refused('No such person'),
          },
        },
      },
      async (req) => {
        const p = await one(await dir().person(req.params.id));
        const lockout = await dir()
          .lockout(p.id)
          .catch((err: Error) => {
            req.log.warn({ err: err.message }, 'lockout not read');
            return undefined;
          });
        if (!lockout) return p;
        // The sign-in service's own answer beats the one worked out from copied events.
        const { locked: _guess, ...rest } = p as typeof p & { locked?: boolean };
        return { ...rest, ...(lockout.locked && p.state === 'active' ? { locked: true } : {}), lockout };
      },
    );

    /** How long an invite's link works: 72 hours (PER-194 spec). */
    const INVITE_HOURS = 72;
    const NO_EMAIL = 'Email isn’t set up on this deployment, so an invite can’t be sent. Whoever runs the server adds the SMTP_* settings to .env (docs/deploy.md, Email). Give them a one-time password instead.';
    const InviteResult = Type.Object(
      {
        method: choice(['email', 'temporary-password']),
        sentTo: Type.Optional(Type.String()),
        expiresAt: Type.Optional(Type.String({ format: 'date-time' })),
        error: Type.Optional(Type.String({ description: 'The account was made but the email couldn’t be sent: resend it, or give a one-time password' })),
      },
      { description: 'How they start' },
    );
    /** Emails an invite and keeps when it runs out; a failure is said, not thrown, because the account is already made. */
    const invite = async (id: string, email: string | undefined) => {
      const at = new Date();
      const expiresAt = new Date(at.getTime() + INVITE_HOURS * 3_600_000).toISOString();
      try {
        await dir().sendInvite(id, INVITE_HOURS * 3600);
      } catch (err) {
        await lifecycle?.invited(id, 'email');
        return { method: 'email' as const, error: (err as Error).message };
      }
      await lifecycle?.invited(id, 'email', { at: at.toISOString(), expiresAt });
      return { method: 'email' as const, ...(email ? { sentTo: email } : {}), expiresAt };
    };

    app.get(
      '/lifecycle',
      {
        schema: {
          summary: 'What the account lifecycle can do on this deployment',
          description: [
            'For Admin to show what is unavailable and why: `email` is whether the sign-in service can send invites.',
            '`today` is the date in the organisation’s time zone, the earliest last day a leaver can have.',
          ].join(' '),
          response: {
            200: Type.Object(
              { email: Type.Boolean(), today: Type.Optional(Type.String({ format: 'date' })), lastDayAhead: Type.Optional(Type.Integer({ description: 'How many days ahead a last day can be' })) },
              { description: 'What works' },
            ),
            ...guarded,
          },
        },
      },
      async () => {
        const settings = await org().catch(() => undefined);
        return { email: await dir().canEmail(), ...(settings ? { today: todayIn(settings.timeZone), lastDayAhead: LAST_DAY_AHEAD } : {}) };
      },
    );

    app.post(
      '/people',
      {
        schema: {
          summary: 'Add someone: an invite email, or a one-time password they replace at first sign-in',
          description: [
            '`start` is `email` by default when the sign-in service can send email, else `temporary-password`.',
            'An invite emails a link that works for 72 hours to confirm their email and choose a password.',
            'If the account is made but the email can’t be sent, the answer is still 201, with `invite.error`.',
          ].join(' '),
          body: ref(NewPersonSchema),
          response: {
            201: Type.Object(
              { person: ref(Person), invite: InviteResult, temporaryPassword: Type.Optional(Type.String()) },
              { description: 'Added. A one-time password is returned once and kept nowhere it can be read again.' },
            ),
            400: refused("A field is missing or wrong, a role or department doesn't exist, or an invite was asked for and email isn't set up"),
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
        const canEmail = await dir().canEmail();
        const method = body.start ?? (canEmail ? 'email' : 'temporary-password');
        if (method === 'email' && !canEmail) return reply.code(400).send({ error: 'bad_request', message: NO_EMAIL });
        const password = method === 'temporary-password' ? temporaryPassword() : undefined;
        const created = await dir().createPerson(person, password);
        await record(req, 'person.added', created.id, { username: created.username, roles: created.roles, departments: created.departments, method });
        await joined(req, created.id, [], created.departments);
        let started;
        if (method === 'email') started = await invite(created.id, created.email);
        else {
          await lifecycle?.invited(created.id, 'temporary-password');
          started = { method };
        }
        return reply.code(201).send({ person: await one(created), invite: started, ...(password ? { temporaryPassword: password } : {}) });
      },
    );

    app.post(
      '/people/:id/invite',
      {
        schema: {
          summary: 'Send someone a new invite email',
          description: 'A new link that works for 72 hours; the old one stops working. Recorded as `person.invite-resent`.',
          params: IdParams,
          response: {
            200: Type.Object({ invite: InviteResult }, { description: 'Sent' }),
            ...guarded,
            403: deploymentAdmins,
            404: refused('No such person'),
            409: refused('They have already set up, or they have left'),
            503: refused("Email isn't set up, or the sign-in service couldn't send it"),
          },
        },
      },
      async (req, reply) => {
        const p = await one(await dir().person(req.params.id));
        if (p.roles.includes(DEPLOYMENT_ADMIN) && !isDeploymentAdmin(req)) return deploymentAdminsOnly(reply);
        if (p.state === 'left') return reply.code(409).send({ error: 'conflict', message: 'They’ve left, so there’s nothing to invite them to.' });
        if (p.state !== 'invited') return reply.code(409).send({ error: 'conflict', message: 'They’ve already set up their account.' });
        if (!(await dir().canEmail())) return reply.code(503).send({ error: 'unavailable', message: NO_EMAIL });
        const sent = await invite(p.id, p.email);
        if (sent.error) return reply.code(503).send({ error: 'unavailable', message: sent.error });
        await record(req, 'person.invite-resent', p.id, { username: p.username });
        return { invite: sent };
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
          summary: 'Someone leaves the organisation: the leaver flow, now or after their last day',
          description: [
            'Turns off their sign-in, signs them out everywhere (sessions and offline tokens) and records',
            '`person.left`, which followers hear as `platform.person.left` so apps hand on or archive what the',
            'person owns, to `handOverTo` when it is given. Their teams, roles and data stay as they were until',
            "the deployment's retention period ends. Closes their request to leave, if they made one.",
            `With \`lastDay\` (today to ${LAST_DAY_AHEAD} days ahead, in the organisation's time zone) nothing happens yet:`,
            'the flow is set to run once that day is over (`leaving` on the person), recorded as `person.leave-scheduled`,',
            'and can be cancelled until then. Sending it again moves the day.',
          ].join(' '),
          params: IdParams,
          body: Type.Object(
            {
              handOverTo: Type.Optional(Type.String({ minLength: 1, maxLength: 100, description: 'Who takes on what they own: someone whose sign-in is on' })),
              note: Type.Optional(Type.String({ maxLength: LEAVER_NOTE, description: 'Why, or what was agreed, for Activity' })),
              lastDay: Type.Optional(Type.String({ format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Their last day; the flow runs once it is over' })),
            },
            { additionalProperties: false },
          ),
          response: {
            200: { ...ref(Person), description: 'The person, now turned off, or with `leaving` set' },
            400: refused('The person to hand over to is the leaver, is turned off, or isn’t in the directory, or the last day is in the past or too far ahead'),
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
        const { handOverTo, lastDay } = req.body;
        // The form can't show a note already agreed, so one left empty keeps it: moving a last day mustn't lose it.
        const note = req.body.note?.trim() || (await lifecycle?.get([id]))?.get(id)?.leaving?.note;
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
        if (lastDay !== undefined) {
          if (!lifecycle) return reply.code(503).send({ error: 'unavailable', message: 'A last day can’t be kept here yet. Run the leaver flow now instead.' });
          const today = todayIn((await org())?.timeZone ?? 'UTC');
          if (lastDay < today) return reply.code(400).send({ error: 'bad_request', message: 'Their last day is in the past. Leave it empty to run the leaver flow now.' });
          if (lastDay > addDays(today, LAST_DAY_AHEAD)) return reply.code(400).send({ error: 'bad_request', message: `Set a last day within ${LAST_DAY_AHEAD} days, and move it later if it changes.` });
          await lifecycle.scheduleLeave(id, { on: lastDay, by: me.id, ...(handOverTo ? { handOverTo } : {}), ...(note ? { note } : {}) });
          await record(req, 'person.leave-scheduled', id, { username: before.username, lastDay, ...(handOverTo ? { handOverTo } : {}) });
          return one(before);
        }
        const after = await runLeaver(
          { directory: dir(), lifecycle, store, audit: (entry) => record(req, entry.action, entry.target!, entry.detail) ?? Promise.resolve(), now },
          id,
          { by: me.id, ...(handOverTo ? { handOverTo } : {}), ...(note ? { note } : {}) },
        );
        return one(after);
      },
    );

    app.delete(
      '/people/:id/leave',
      {
        schema: {
          summary: 'Cancel a leaver flow set for after someone’s last day',
          description: 'Recorded as `person.leave-cancelled`. Nothing had happened to them yet, so nothing is undone.',
          params: IdParams,
          response: {
            200: { ...ref(Person), description: 'The person, no longer leaving' },
            ...guarded,
            403: deploymentAdmins,
            404: refused('No such person'),
            409: refused('No leaver flow was set for them, or it has already run'),
          },
        },
      },
      async (req, reply) => {
        const p = await dir().person(req.params.id);
        if (p.roles.includes(DEPLOYMENT_ADMIN) && !isDeploymentAdmin(req)) return deploymentAdminsOnly(reply);
        if (!(await lifecycle?.cancelLeave(p.id))) {
          return reply.code(409).send({ error: 'conflict', message: (await one(p)).state === 'left' ? 'They’ve already left; a leaver doesn’t come back.' : 'They weren’t set to leave.' });
        }
        await record(req, 'person.leave-cancelled', p.id, { username: p.username });
        return one(p);
      },
    );

    app.delete(
      '/people/:id',
      {
        schema: {
          summary: 'Delete a leaver’s account now, without waiting for the retention period (deployment admins only)',
          description: [
            'Only for someone who has left, by a deployment admin who entered their password in the last 10 minutes',
            '(401 sign_in_again otherwise). Runs the same steps as deletion after retention (ADR 0072): Activity loses their',
            'personal values, identity forgets their preferences and teams, Keycloak deletes the account, then',
            '`person.deleted` is recorded, which followers hear as `platform.person.deleted`. It can’t be undone.',
          ].join(' '),
          params: IdParams,
          response: {
            200: Type.Object({ deleted: Type.Literal(true) }, { description: 'Deleted; only their id is kept, in Activity' }),
            ...guarded,
            401: refused('sign_in_again: enter the password again first'),
            403: refused('Not a deployment admin'),
            404: refused('No such person'),
            409: refused('They haven’t left'),
            503: refused('Activity couldn’t be cleaned of their details, so nothing was deleted yet'),
          },
        },
      },
      async (req, reply) => {
        const me = callerFromHeaders(req.headers)!;
        if (!isDeploymentAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only a deployment admin can delete an account.' });
        if (!signedInRecently(me, DELETE_SIGN_IN_MS)) return reply.code(401).send({ error: 'sign_in_again', message: 'Enter your password again to delete an account. It’s asked for anything this drastic.' });
        if (!lifecycle || !redact) return reply.code(503).send({ error: 'unavailable', message: 'Accounts can’t be deleted here yet: identity can’t reach Activity to remove their details.' });
        const kept = (await lifecycle.get([req.params.id])).get(req.params.id);
        if (!kept?.left) {
          await dir().person(req.params.id);
          return reply.code(409).send({ error: 'conflict', message: 'They haven’t left. Run the leaver flow first.' });
        }
        try {
          await deleteAccount({ directory: dir(), lifecycle, store, workspaces, redact, audit: (e) => record(req, e.action, e.target!, e.detail) ?? Promise.resolve() }, req.params.id, me.id);
        } catch (err) {
          req.log.error({ err: (err as Error).message }, 'account not deleted');
          return reply.code(503).send({ error: 'unavailable', message: `Not deleted yet: ${(err as Error).message} It’s tried again within five minutes.` });
        }
        return { deleted: true as const };
      },
    );

    app.post(
      '/people/:id/unlock',
      {
        schema: {
          summary: 'Lift a lockout for wrong passwords',
          description: 'They can sign in again at once. Recorded as `person.unlocked`.',
          params: IdParams,
          response: {
            204: empty('Unlocked'),
            ...guarded,
            403: deploymentAdmins,
            404: refused('No such person'),
            409: refused('They aren’t locked out'),
          },
        },
      },
      async (req, reply) => {
        const p = await dir().person(req.params.id);
        if (p.roles.includes(DEPLOYMENT_ADMIN) && !isDeploymentAdmin(req)) return deploymentAdminsOnly(reply);
        const { locked, failures } = await dir().lockout(p.id);
        if (!locked) {
          await lifecycle?.unlocked(p.id);
          return reply.code(409).send({ error: 'conflict', message: 'They aren’t locked out.' });
        }
        await dir().unlock(p.id);
        await lifecycle?.unlocked(p.id);
        await record(req, 'person.unlocked', p.id, { username: p.username, failures });
        return reply.code(204).send(null);
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
