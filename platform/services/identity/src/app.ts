import Fastify from 'fastify';
import { callerFromHeaders, health, packageVersion, recordAudit, serviceLogging, type NewAuditEntry, type ServiceCredentials } from '@platform/service-kit';
import { adminRoutes } from './admin.ts';
import { appClientRoutes, type AppClients } from './clients.ts';
import type { Directory } from './directory.ts';
import { MemoryPreferenceStore, type PreferenceStore, type Preferences } from './store.ts';
import { TeamDirectory } from './teams.ts';
import { floorsFor, MemoryWorkspaceStore, type WorkspaceStore } from './workspaces.ts';

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
export const buildApp = async ({ store = new MemoryPreferenceStore(), workspaces = new MemoryWorkspaceStore(), directory, appClients, audit }: IdentityOptions = {}) => {
  const teams = directory ? new TeamDirectory(directory, workspaces) : undefined;
  const app = Fastify({ ...serviceLogging(), ajv: { customOptions: { removeAdditional: false } } });
  app.get('/healthz', async () => health('identity', version, API_VERSION));

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
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

      await app.register(adminRoutes({ directory: teams, audit }), { prefix: '/admin' });
      await app.register(appClientRoutes({ clients: appClients, audit }), { prefix: '/admin/apps' });
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
