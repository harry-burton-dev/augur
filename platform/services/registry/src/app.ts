import Fastify, { type FastifyRequest } from 'fastify';
import { callerFromHeaders, health, packageVersion, recordAudit, serviceFromHeaders, type NewAuditEntry, type ServiceCredentials } from '@platform/service-kit';
import { appEntrySchema, conflictFor, platformApps, versionProblem, type AppEntry } from './manifest.ts';
import { MemoryAppStore, RouteTakenError, type AppStore } from './store.ts';

/** The major version of the API this service serves; see contracts/ for its full version. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

export interface RegistryOptions {
  store?: AppStore;
  /** The environment's service token: lets apps' services register themselves. Without it only admins can change the catalogue. */
  serviceToken?: string;
  /** Where changes to the catalogue are recorded. Without it nothing is audited. */
  audit?: (entry: NewAuditEntry) => Promise<void>;
}

/** Records audit entries with the events service, as the registry. */
export const auditTo = (eventsUrl: string, credentials: ServiceCredentials) => (entry: NewAuditEntry) =>
  recordAudit({ eventsUrl, credentials, entry });

/**
 * The catalogue of apps. The platform's own apps are built in; every other app
 * registers itself, and each person is shown only the apps their roles allow.
 */
export const buildApp = async ({ store = new MemoryAppStore(), serviceToken, audit }: RegistryOptions = {}) => {
  // Unknown manifest fields are refused, not dropped: a misspelt requiredRole must not open an app to everyone.
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test', ajv: { customOptions: { removeAdditional: false } } });
  app.get('/healthz', async () => health('registry', version, API_VERSION));

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
  await app.register(
    async (app) => {
      // The gateway verified who is calling and passed it on.
      app.get('/manifest', async (req) => {
        const roles = callerFromHeaders(req.headers)?.roles ?? [];
        const apps = [...platformApps, ...(await store.list())];
        return apps.filter((a) => !a.requiredRole || roles.includes(a.requiredRole));
      });

      /** Who may change the catalogue: an app's service with the service token, or an admin. */
      const changedBy = (req: FastifyRequest): NewAuditEntry['actor'] | undefined => {
        const service = serviceFromHeaders(req.headers, serviceToken);
        if (service) return { id: service, kind: 'service' };
        const caller = callerFromHeaders(req.headers);
        return caller?.roles.includes('admin') ? { id: caller.id, kind: 'user' } : undefined;
      };

      /** The catalogue changed either way; a failed audit write is logged, not turned into a failed request. */
      const record = (req: FastifyRequest, entry: NewAuditEntry) =>
        audit?.(entry).catch((err: Error) => req.log.error({ err: err.message, action: entry.action }, 'audit entry not recorded'));

      app.put<{ Params: { id: string }; Body: AppEntry }>(
        '/apps/:id',
        { schema: { body: appEntrySchema } },
        async (req, reply) => {
          const by = changedBy(req);
          if (!by) return reply.code(403).send({ error: 'forbidden', message: 'Only an app’s own service or an admin can register apps.' });
          const entry = req.body;
          if (entry.id !== req.params.id) return reply.code(400).send({ error: 'bad_request', message: `The manifest is for "${entry.id}", not "${req.params.id}".` });
          const badVersion = versionProblem(entry);
          if (badVersion) return reply.code(400).send({ error: 'bad_request', message: badVersion });
          const conflict = conflictFor(entry, await store.list());
          if (conflict) return reply.code(409).send({ error: 'conflict', message: conflict });
          try {
            const created = await store.put(entry, by.id);
            req.log.info({ app: entry.id, version: entry.version, by: by.id }, created ? 'app registered' : 'app updated');
            await record(req, { actor: by, app: 'registry', action: created ? 'app.registered' : 'app.updated', target: entry.id, detail: { version: entry.version } });
            return reply.code(created ? 201 : 200).send(entry);
          } catch (err) {
            if (err instanceof RouteTakenError) return reply.code(409).send({ error: 'conflict', message: err.message });
            throw err;
          }
        },
      );

      app.delete<{ Params: { id: string } }>('/apps/:id', async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can remove apps.' });
        if (!(await store.remove(req.params.id))) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
        req.log.info({ app: req.params.id, by: caller.id }, 'app removed');
        await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: 'app.removed', target: req.params.id });
        return reply.code(204).send();
      });
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
