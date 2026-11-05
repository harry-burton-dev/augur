import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import { callerFromHeaders, health, identifyService, packageVersion, recordAudit, ServiceAuthUnavailable, problemDetails, serviceFastifyOptions, type NewAuditEntry, type GrantLookup, type ServiceCredentials, type ServiceVerifier, signedCallers, type CallerCheck } from '@augur/service-kit';
import { adminRoutes } from './admin.ts';
import type { LifecycleStore } from './lifecycle.ts';
import { describeApi } from './contract.ts';
import { appClientRoutes, appRunnerRoutes, type AppClients } from './clients.ts';
import { TERMS_ACTION, type Directory } from './directory.ts';
import { mapFor } from './map.ts';
import { noticeSettingsRoutes } from './notice-settings.ts';
import { offeredLanguages, organisationRoutes, organisationSettings, type OrganisationStore } from './organisation.ts';
import { meRoutes, type AccountSource, type MeOptions } from './me.ts';
import { DirectoryAnswer, DirectoryQuery, findInDirectory, peopleRoutes, principalsOf, signedInPeople } from './people.ts';
import { Caller, choice, Floor, IdParams, PersonMap, ref, refused } from './schemas.ts';
import type { PreferenceStore } from './store.ts';
import { TeamDirectory } from './teams.ts';
import { floorsFor, rollupFor, type WorkspaceStore } from './workspaces.ts';

/** Names the organisation's floor in `/workspaces/:id`; floor ids are random hex, so it can't clash with one. */
const ORG_FLOOR = 'org';

/** The major version of the API this service serves; see contracts/ for its full version. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

export interface IdentityOptions {
  store: PreferenceStore;
  /** The org, its teams and everyone's own floor. */
  workspaces: WorkspaceStore;
  /** Where people are kept, and where departments were before they became teams. Without it the admin API answers 503. */
  directory?: Directory;
  /** Where each person's own account is read and changed (me.ts). Without it the account answers 503. */
  accounts?: AccountSource;
  /** Where apps' own sign-ins are made. Without it issuing one answers 503. */
  appClients?: AppClients;
  /** Where admins' changes are recorded, with the floor they're about. Without it nothing is audited. */
  audit?: (entry: NewAuditEntry, workspace?: string) => Promise<void>;
  /** Checks platform services' own sign-in tokens, for the floor lookups only they may make. */
  verifyService?: ServiceVerifier;
  /** Checks the caller the gateway signed (callerCheckFromEnv). Without it `x-user-*` headers are believed as they come, as in local dev. */
  callers?: CallerCheck;
  /** What apps are granted, from the registry, so an app with `people:read` can look people up. */
  grants?: GrantLookup;
  /** Tells people through the events service, as identity (an admin hears when someone asks to leave). */
  tell?: MeOptions['tell'];
  /** What other services keep about a person, for the copy of their data they download. */
  dataFrom?: MeOptions['dataFrom'];
  /** The languages the deployment offers people (REALM_LANGUAGES). */
  languages?: string[];
  /** The organisation's settings beside its floor's name (ADR 0042). */
  organisation: OrganisationStore;
  /** What identity keeps about each account's life (ADR 0040). */
  lifecycle: LifecycleStore;
}

/** Records audit entries with the events service, as identity. */
export const auditTo = (eventsUrl: string, credentials: ServiceCredentials) => (entry: NewAuditEntry, workspace?: string) =>
  recordAudit({ eventsUrl, credentials, entry, workspace });

/**
 * Who people are. Sign-in itself is the OIDC provider's job (Keycloak locally);
 * this service answers "who am I" for the shell, keeps what each person has
 * chosen for it, keeps the floors people stand on (workspaces.ts), and lets
 * admins manage people in the provider and departments as teams (admin.ts),
 * so no one needs the provider's own console.
 */
export const buildApp = async ({ store, workspaces, directory, accounts, appClients, audit, verifyService, callers, grants, tell, dataFrom, languages, organisation, lifecycle }: IdentityOptions) => {
  const teams = directory ? new TeamDirectory(directory, workspaces) : undefined;
  // The languages offered, the default first: an admin's choice in Admin → Organisation, else REALM_LANGUAGES.
  const offered = async () => offeredLanguages(await organisationSettings(workspaces, organisation, languages));
  const app = Fastify(serviceFastifyOptions()).withTypeProvider<TypeBoxTypeProvider>();
  await app.register(problemDetails());
  await describeApi(app, `/${API_VERSION}`);
  // Before anything reads the caller: only the gateway's signed word says who is calling.
  app.addHook('onRequest', signedCallers(callers));
  app.get('/healthz', { schema: { hide: true } }, async () => health('identity', version, API_VERSION));

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
  await app.register(
    async (plain) => {
      const app = plain.withTypeProvider<TypeBoxTypeProvider>();
      /** True for the platform's own services; otherwise the reply is sent. */
      const platformOnly = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
          if ((await identifyService(req.headers, verifyService))?.kind === 'platform') return true;
          void reply.code(403).send({ error: 'forbidden', message: 'Only AUGUR’s own services can look floors up.' });
        } catch (err) {
          if (!(err instanceof ServiceAuthUnavailable)) throw err;
          void reply.code(503).send({ error: 'unavailable', message: err.message });
        }
        return false;
      };

      /**
       * Where a floor sits, for the platform's own services: its kind and the
       * ids from its root down to it. The registry and events store only a
       * floor's id and ask here for the rest. `org` is the floor every rule
       * starts from, a personal floor included. `org` in place of an id names
       * the organisation's own floor, for a call that names no floor.
       */
      app.get(
        '/workspaces/:id',
        {
          schema: {
            summary: 'Where a floor sits (platform services only)',
            description: [
              "For AUGUR's own services, signed in as themselves, which store only",
              "a floor's id. Archived teams are still found, so old records resolve.",
              `"${ORG_FLOOR}" in place of an id names the organisation's own floor.`,
            ].join(' '),
            params: IdParams,
            response: {
              200: Type.Object(
                {
                  id: Type.String(),
                  kind: choice(['org', 'personal', 'team']),
                  path: Type.Array(Type.String(), { description: "Ids from the floor's root down to it; a personal floor is alone on its path" }),
                  org: Type.String({ description: "The org's id, which every rule starts from" }),
                  archivedAt: Type.Optional(Type.String({ format: 'date-time' })),
                },
                { description: "The floor's place in the tree" },
              ),
              403: refused('Not a platform service'),
              404: refused('No such floor'),
              503: refused("The caller's token can't be checked right now"),
            },
          },
        },
        async (req, reply) => {
          if (!(await platformOnly(req, reply))) return reply;
          await teams?.ready();
          const org = await workspaces.org();
          const floor = req.params.id === ORG_FLOOR ? org : await workspaces.workspace(req.params.id);
          if (!floor) return reply.code(404).send({ error: 'not_found', message: 'There is no such floor.' });
          return { id: floor.id, kind: floor.kind, path: floor.path, org: org.id, ...(floor.archivedAt ? { archivedAt: floor.archivedAt } : {}) };
        },
      );

      // Everyone who can stand on a team: its members and those of the teams below it. For team notices.
      app.get(
        '/workspaces/:id/people',
        {
          schema: {
            summary: 'Everyone who can stand on a team (platform services only)',
            description: 'Its members and those of the teams below it. Events asks this as each team notice is sent.',
            params: IdParams,
            response: {
              200: Type.Object({ workspace: Type.String(), people: Type.Array(Type.String()) }, { description: 'Person ids, sorted' }),
              403: refused('Not a platform service'),
              404: refused('No such team'),
              503: refused("The caller's token can't be checked right now"),
            },
          },
        },
        async (req, reply) => {
          if (!(await platformOnly(req, reply))) return reply;
          await teams?.ready();
          const all = await workspaces.teams();
          const team = all.find((t) => t.id === req.params.id);
          if (!team) return reply.code(404).send({ error: 'not_found', message: 'There is no such team.' });
          const below = new Set(all.filter((t) => t.path.includes(team.id)).map((t) => t.id));
          const people = new Set((await workspaces.memberships()).filter((m) => below.has(m.workspace)).map((m) => m.person));
          return { workspace: team.id, people: [...people].sort() };
        },
      );

      await app.register(peopleRoutes({ workspaces, teams, verifyService, grants }));
      await app.register(appRunnerRoutes({ clients: appClients, audit, verifyService }), { prefix: '/admin/apps' });
      await app.register(
        organisationRoutes({ workspaces, store: organisation, audit, verifyService, languages, askEveryone: directory?.askEveryone ? () => directory.askEveryone!(TERMS_ACTION) : undefined }),
      );
      await app.register(noticeSettingsRoutes({ store, accounts, workspaces, organisation, verifyService, languages: offered }));
    },
    { prefix: `/${API_VERSION}` },
  );

  await app.register(
    async (plain) => {
      const app = plain.withTypeProvider<TypeBoxTypeProvider>();
      app.addHook('onRequest', async (req, reply) => {
        if (!callerFromHeaders(req.headers)) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
      });
      const unauthenticated = refused('No signed-in caller');

      app.get(
        '/me',
        {
          schema: {
            summary: 'The signed-in caller',
            response: { 200: { ...ref(Caller), description: 'Who is calling, with their departments and roles' }, 401: unauthenticated },
          },
        },
        async (req) => callerFromHeaders(req.headers)!,
      );

      // Preferences and the caller's account: me.ts.
      await app.register(meRoutes({ store, accounts, audit: audit && ((entry) => audit(entry)), tell, dataFrom, languages: offered }));

      // Every floor the caller can stand on; their own is made the first time they ask.
      app.get(
        '/me/workspaces',
        {
          schema: {
            summary: 'Every floor the caller can stand on',
            description: [
              'Their own floor (made the first time they ask), the org, each team they',
              "are on, and every team above those. Being on a team doesn't put you on",
              'the teams below it. Ordered own floor, org, then teams in tree order.',
            ].join(' '),
            response: {
              200: Type.Object({ workspaces: Type.Array(ref(Floor)) }, { description: "The caller's floors" }),
              401: unauthenticated,
            },
          },
        },
        async (req) => {
          await teams?.ready();
          return { workspaces: await floorsFor(workspaces, callerFromHeaders(req.headers)!) };
        },
      );

      // The caller's map of the org, for Auspex: their floors with who's there and why they can come in, and every other team as a closed door.
      const signedIn = signedInPeople(teams);
      const everyone = async () => (await signedIn()).map((p) => ({ id: p.id, name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username }));
      app.get(
        '/me/map',
        {
          schema: {
            summary: "The caller's map of the org",
            description: [
              'For Auspex. Every floor the caller can stand on, with who is there and',
              'why they can come in; the teams inside ones they lead (and, for admins,',
              'every team) to see into without standing on; and every other team as a',
              'closed door that names only itself, where it sits and its leads, so the',
              'caller knows who can add them. Nothing inside a closed team is said:',
              'not its people, how many, or what it uses. Floors are the org, then',
              "teams depth first, then the caller's own floor.",
            ].join(' '),
            response: { 200: { ...ref(PersonMap), description: "The caller's map" }, 401: unauthenticated },
          },
        },
        async (req) => {
          await teams?.ready();
          const caller = callerFromHeaders(req.headers)!;
          const [own, org, all, memberships, folks] = await Promise.all([workspaces.personal(caller.id, caller.name), workspaces.org(), workspaces.teams(), workspaces.memberships(), everyone()]);
          const nameOf = new Map(folks.map((p) => [p.id, p.name]));
          nameOf.set(caller.id, caller.name);
          const mine = memberships.filter((m) => m.person === caller.id).map((m) => m.workspace);
          return mapFor({
            person: caller, own, org, teams: all, memberships, names: nameOf,
            people: folks.length ? folks.map((p) => p.id) : [caller.id],
            principals: principalsOf(caller.id, all, mine),
          });
        },
      );

      // People and teams by name, for the person choosing who to share with or mention (the SDK's searchPrincipals).
      app.get(
        '/me/directory',
        {
          schema: {
            summary: 'Find people and teams to share with',
            description: [
              'What the people picker asks as someone types (searchPrincipals in the SDK,',
              'since 1.15): people whose name, email or username has `q` in it, and',
              'every team whose name does, each sorted by name, first `limit` of each.',
              'With `ids` instead, the people and teams with those ids, to name who',
              "something is shared with. Teams the caller isn't on are found too, as on",
              'their map: a team names only itself and where it sits. People whose',
              "sign-in is turned off aren't listed.",
            ].join(' '),
            querystring: DirectoryQuery,
            response: { 200: DirectoryAnswer, 400: refused('A query it does not know, or a value out of range'), 401: unauthenticated },
          },
        },
        async (req) => {
          await teams?.ready();
          const [all, folks] = await Promise.all([workspaces.teams(), signedIn()]);
          return findInDirectory(folks, all, req.query);
        },
      );

      // A floor and every team below it the caller can stand on: what an app rolls up when someone asks to include sub-teams.
      app.get(
        '/me/workspaces/:id/rollup',
        {
          schema: {
            summary: 'A floor and every team below it the caller is on',
            description: [
              'What an app rolls up when someone asks to include sub-teams. Access',
              'flows down only, so a team below appears only if the caller is on it.',
            ].join(' '),
            params: IdParams,
            response: {
              200: Type.Object({ workspace: Type.String(), workspaces: Type.Array(ref(Floor)) }, { description: 'The floor first, then the teams below it in tree order' }),
              401: unauthenticated,
              404: refused("The caller isn't on that floor"),
            },
          },
        },
        async (req, reply) => {
          await teams?.ready();
          const floors = await floorsFor(workspaces, callerFromHeaders(req.headers)!);
          if (!floors.some((f) => f.id === req.params.id)) return reply.code(404).send({ error: 'not_found', message: 'You’re not on that floor, or it no longer exists.' });
          return { workspace: req.params.id, workspaces: rollupFor(floors, req.params.id) };
        },
      );

      await app.register(adminRoutes({ directory: teams, workspaces, audit, store, lifecycle }), { prefix: '/admin' });
      await app.register(appClientRoutes({ clients: appClients, audit }), { prefix: '/admin/apps' });
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
