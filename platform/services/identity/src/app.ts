import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { callerFromHeaders, health, identifyService, packageVersion, recordAudit, ServiceAuthUnavailable, serviceLogging, type NewAuditEntry, type GrantLookup, type ServiceCredentials, type ServiceVerifier, signedCallers, type CallerCheck } from '@augur/service-kit';
import { adminRoutes } from './admin.ts';
import { appClientRoutes, appRunnerRoutes, type AppClients } from './clients.ts';
import type { Directory } from './directory.ts';
import { mapFor } from './map.ts';
import { peopleRoutes, principalsOf } from './people.ts';
import { MemoryPreferenceStore, type PreferenceStore, type Preferences } from './store.ts';
import { TeamDirectory } from './teams.ts';
import { floorsFor, MemoryWorkspaceStore, rollupFor, type WorkspaceStore } from './workspaces.ts';

/** The major version of the API this service serves; see contracts/ for its full version. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

/** Refused, not dropped, when unknown: a misspelt setting should fail loudly, not vanish. */
export const preferencesSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reduceMotion: { type: 'boolean' },
    density: { type: 'string', enum: ['comfortable', 'compact'] },
    areaTitles: { type: 'boolean' },
    away: { type: 'boolean' },
    recent: { type: 'array', maxItems: 12, items: { type: 'string', minLength: 1, maxLength: 64 } },
    muted: { type: 'array', maxItems: 100, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 64 } },
  },
} as const;

export interface IdentityOptions {
  store?: PreferenceStore;
  /** The org, its teams and everyone's own floor. */
  workspaces?: WorkspaceStore;
  /** Where people are kept, and where departments were before they became teams. Without it the admin API answers 503. */
  directory?: Directory;
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
export const buildApp = async ({ store = new MemoryPreferenceStore(), workspaces = new MemoryWorkspaceStore(), directory, appClients, audit, verifyService, callers, grants }: IdentityOptions = {}) => {
  const teams = directory ? new TeamDirectory(directory, workspaces) : undefined;
  const app = Fastify({ ...serviceLogging(), ajv: { customOptions: { removeAdditional: false } } });
  // Before anything reads the caller: only the gateway's signed word says who is calling.
  app.addHook('onRequest', signedCallers(callers));
  app.get('/healthz', async () => health('identity', version, API_VERSION));

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
  await app.register(
    async (app) => {
      /** True for the platform's own services; otherwise the reply is sent. */
      const platformOnly = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
          if ((await identifyService(req.headers, verifyService))?.kind === 'platform') return true;
          void reply.code(403).send({ error: 'forbidden', message: 'Only the platform’s own services can look floors up.' });
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
       * starts from, a personal floor included.
       */
      app.get<{ Params: { id: string } }>('/workspaces/:id', async (req, reply) => {
        if (!(await platformOnly(req, reply))) return reply;
        await teams?.ready();
        const [floor, org] = await Promise.all([workspaces.workspace(req.params.id), workspaces.org()]);
        if (!floor) return reply.code(404).send({ error: 'not_found', message: 'There is no such floor.' });
        return { id: floor.id, kind: floor.kind, path: floor.path, org: org.id, ...(floor.archivedAt ? { archivedAt: floor.archivedAt } : {}) };
      });

      // Everyone who can stand on a team: its members and those of the teams below it. For team notices.
      app.get<{ Params: { id: string } }>('/workspaces/:id/people', async (req, reply) => {
        if (!(await platformOnly(req, reply))) return reply;
        await teams?.ready();
        const all = await workspaces.teams();
        const team = all.find((t) => t.id === req.params.id);
        if (!team) return reply.code(404).send({ error: 'not_found', message: 'There is no such team.' });
        const below = new Set(all.filter((t) => t.path.includes(team.id)).map((t) => t.id));
        const people = new Set((await workspaces.memberships()).filter((m) => below.has(m.workspace)).map((m) => m.person));
        return { workspace: team.id, people: [...people].sort() };
      });

      await app.register(peopleRoutes({ workspaces, teams, verifyService, grants }));
      await app.register(appRunnerRoutes({ clients: appClients, audit, verifyService }), { prefix: '/admin/apps' });
    },
    { prefix: `/${API_VERSION}` },
  );

  await app.register(
    async (app) => {
      app.addHook('onRequest', async (req, reply) => {
        if (!callerFromHeaders(req.headers)) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
      });

      app.get('/me', async (req) => callerFromHeaders(req.headers)!);

      app.get('/me/preferences', async (req) => store.get(callerFromHeaders(req.headers)!.id));

      app.put<{ Body: Preferences }>('/me/preferences', { schema: { body: preferencesSchema } }, async (req) => {
        await store.put(callerFromHeaders(req.headers)!.id, req.body);
        return req.body;
      });

      // Every floor the caller can stand on; their own is made the first time they ask.
      app.get('/me/workspaces', async (req) => {
        await teams?.ready();
        return { workspaces: await floorsFor(workspaces, callerFromHeaders(req.headers)!) };
      });

      // The caller's map of the org, for Auspex: their floors with who's there and why they can come in, and every other team as a closed door.
      let names: { list: { id: string; name: string }[]; at: number } | undefined;
      const everyone = async () => {
        if (!teams) return [];
        if (names && Date.now() - names.at < 30_000) return names.list;
        const list = (await teams.people()).filter((p) => p.enabled).map((p) => ({ id: p.id, name: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username }));
        names = { list, at: Date.now() };
        return list;
      };
      app.get('/me/map', async (req) => {
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
      });

      // A floor and every team below it the caller can stand on: what an app rolls up when someone asks to include sub-teams.
      app.get<{ Params: { id: string } }>('/me/workspaces/:id/rollup', async (req, reply) => {
        await teams?.ready();
        const floors = await floorsFor(workspaces, callerFromHeaders(req.headers)!);
        if (!floors.some((f) => f.id === req.params.id)) return reply.code(404).send({ error: 'not_found', message: 'You’re not on that floor, or it no longer exists.' });
        return { workspace: req.params.id, workspaces: rollupFor(floors, req.params.id) };
      });

      await app.register(adminRoutes({ directory: teams, workspaces, audit }), { prefix: '/admin' });
      await app.register(appClientRoutes({ clients: appClients, audit }), { prefix: '/admin/apps' });
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
