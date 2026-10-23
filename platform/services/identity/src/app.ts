import Fastify from 'fastify';
import { callerFromHeaders, health, identifyService, packageVersion, recordAudit, ServiceAuthUnavailable, serviceLogging, type NewAuditEntry, type ServiceCredentials, type ServiceVerifier } from '@platform/service-kit';
import { adminRoutes } from './admin.ts';
import { appClientRoutes, type AppClients } from './clients.ts';
import type { Directory } from './directory.ts';
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
    away: { type: 'boolean' },
    recent: { type: 'array', maxItems: 12, items: { type: 'string', minLength: 1, maxLength: 64 } },
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
  /** Where admins' changes are recorded. Without it nothing is audited. */
  audit?: (entry: NewAuditEntry) => Promise<void>;
  /** Checks platform services' own sign-in tokens, for the floor lookups only they may make. */
  verifyService?: ServiceVerifier;
}

/** Records audit entries with the events service, as identity. */
export const auditTo = (eventsUrl: string, credentials: ServiceCredentials) => (entry: NewAuditEntry) =>
  recordAudit({ eventsUrl, credentials, entry });

/**
 * Who people are. Sign-in itself is the OIDC provider's job (Keycloak locally);
 * this service answers "who am I" for the shell, keeps what each person has
 * chosen for it, keeps the floors people stand on (workspaces.ts), and lets
 * admins manage people in the provider and departments as teams (admin.ts),
 * so no one needs the provider's own console.
 */
export const buildApp = async ({ store = new MemoryPreferenceStore(), workspaces = new MemoryWorkspaceStore(), directory, appClients, audit, verifyService }: IdentityOptions = {}) => {
  const teams = directory ? new TeamDirectory(directory, workspaces) : undefined;
  const app = Fastify({ ...serviceLogging(), ajv: { customOptions: { removeAdditional: false } } });
  app.get('/healthz', async () => health('identity', version, API_VERSION));

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
  await app.register(
    async (app) => {
      /**
       * Where a floor sits, for the platform's own services: its kind and the
       * ids from its root down to it. The registry and events store only a
       * floor's id and ask here for the rest. `org` is the floor every rule
       * starts from, a personal floor included.
       */
      app.get<{ Params: { id: string } }>('/workspaces/:id', async (req, reply) => {
        let service;
        try {
          service = await identifyService(req.headers, verifyService);
        } catch (err) {
          if (!(err instanceof ServiceAuthUnavailable)) throw err;
          return reply.code(503).send({ error: 'unavailable', message: err.message });
        }
        if (service?.kind !== 'platform') return reply.code(403).send({ error: 'forbidden', message: 'Only the platform’s own services can look floors up.' });
        await teams?.ready();
        const [floor, org] = await Promise.all([workspaces.workspace(req.params.id), workspaces.org()]);
        if (!floor) return reply.code(404).send({ error: 'not_found', message: 'There is no such floor.' });
        return { id: floor.id, kind: floor.kind, path: floor.path, org: org.id, ...(floor.archivedAt ? { archivedAt: floor.archivedAt } : {}) };
      });
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

      // A floor and every team below it the caller can stand on: what an app rolls up when someone asks to include sub-teams.
      app.get<{ Params: { id: string } }>('/me/workspaces/:id/rollup', async (req, reply) => {
        await teams?.ready();
        const floors = await floorsFor(workspaces, callerFromHeaders(req.headers)!);
        if (!floors.some((f) => f.id === req.params.id)) return reply.code(404).send({ error: 'not_found', message: 'You’re not on that floor, or it no longer exists.' });
        return { workspace: req.params.id, workspaces: rollupFor(floors, req.params.id) };
      });

      await app.register(adminRoutes({ directory: teams, audit }), { prefix: '/admin' });
      await app.register(appClientRoutes({ clients: appClients, audit }), { prefix: '/admin/apps' });
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
