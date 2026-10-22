import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { callerFromHeaders, health, packageVersion, recordAudit, serviceFromHeaders, serviceLogging, type NewAuditEntry, type ServiceCredentials } from '@platform/service-kit';
import { appEntrySchema, conflictFor, platformApps, unbuiltApps, versionProblem, type AppEntry } from './manifest.ts';
import { MemoryAppStore, RouteTakenError, UnknownVersionError, type AppRecord, type AppStore } from './store.ts';

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

/** A registered app as admins see it in the catalogue. */
const catalogueEntry = (r: AppRecord) => ({
  ...r.entry,
  platform: false,
  enabled: r.enabled,
  registeredBy: r.registeredBy,
  registeredAt: r.registeredAt,
  updatedAt: r.updatedAt,
  ...(r.pinnedVersion ? { pinnedVersion: r.pinnedVersion } : {}),
});

/**
 * The catalogue of apps. The platform's own apps are built in; every other app
 * registers itself, and each person is shown only the apps their roles allow.
 */
export const buildApp = async ({ store = new MemoryAppStore(), serviceToken, audit }: RegistryOptions = {}) => {
  // Unknown manifest fields are refused, not dropped: a misspelt requiredRole must not open an app to everyone.
  const app = Fastify({ ...serviceLogging(), ajv: { customOptions: { removeAdditional: false } } });
  app.get('/healthz', async () => health('registry', version, API_VERSION));

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
  await app.register(
    async (app) => {
      // The gateway verified who is calling and passed it on.
      app.get('/manifest', async (req) => {
        const roles = callerFromHeaders(req.headers)?.roles ?? [];
        const registered = (await store.records()).filter((r) => r.enabled).map((r) => r.entry);
        const apps = [...platformApps.filter((a) => !unbuiltApps.has(a.id)), ...registered];
        return apps.filter((a) => !a.requiredRole || roles.includes(a.requiredRole));
      });

      const isAdmin = (req: FastifyRequest) => callerFromHeaders(req.headers)?.roles.includes('admin') ?? false;

      /** The whole catalogue for admins: every app, on or off, with who registered it and when. */
      app.get('/apps', async (req, reply) => {
        if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see the whole catalogue.' });
        const platform = platformApps.filter((a) => !unbuiltApps.has(a.id)).map((entry) => ({ ...entry, platform: true, enabled: true }));
        return [...platform, ...(await store.records()).map(catalogueEntry)];
      });

      /** An app's kept versions, newest first, and which one the shell is given. */
      app.get<{ Params: { id: string } }>('/apps/:id/versions', async (req, reply) => {
        if (!isAdmin(req)) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can see an app’s versions.' });
        const record = (await store.records()).find((r) => r.entry.id === req.params.id);
        if (!record) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
        return (await store.versions(req.params.id)).map((v) => ({ ...v, serving: v.version === record.entry.version }));
      });

      /** Serve one kept version and hold the app there, whatever registers next; or let go and serve the newest. */
      const pin = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply, version: string | null) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can choose an app’s version.' });
        if (platformApps.some((a) => a.id === req.params.id)) return reply.code(409).send({ error: 'conflict', message: 'Platform apps change with the platform’s own release.' });
        try {
          const changed = await store.pin(req.params.id, version);
          if (!changed) return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          req.log.info({ app: req.params.id, version: changed.entry.version, pinned: version !== null, by: caller.id }, version === null ? 'app unpinned' : 'app pinned');
          await record(req, {
            actor: { id: caller.id, kind: 'user' },
            app: 'registry',
            action: version === null ? 'app.unpinned' : 'app.pinned',
            target: req.params.id,
            detail: { version: changed.entry.version },
          });
          return catalogueEntry(changed);
        } catch (err) {
          if (err instanceof UnknownVersionError) return reply.code(404).send({ error: 'not_found', message: err.message });
          if (err instanceof RouteTakenError) return reply.code(409).send({ error: 'conflict', message: err.message });
          throw err;
        }
      };
      app.put<{ Params: { id: string }; Body: { version: string } }>(
        '/apps/:id/pin',
        { schema: { body: { type: 'object', additionalProperties: false, required: ['version'], properties: { version: { type: 'string', minLength: 1, maxLength: 64 } } } } },
        (req, reply) => pin(req, reply, req.body.version),
      );
      app.delete<{ Params: { id: string } }>('/apps/:id/pin', (req, reply) => pin(req, reply, null));

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
            const pinned = (await store.records()).find((r) => r.entry.id === entry.id)?.pinnedVersion;
            const held = pinned !== undefined && pinned !== entry.version;
            req.log.info({ app: entry.id, version: entry.version, by: by.id, held }, created ? 'app registered' : held ? 'app version kept, pinned elsewhere' : 'app updated');
            await record(req, {
              actor: by,
              app: 'registry',
              action: created ? 'app.registered' : 'app.updated',
              target: entry.id,
              detail: { version: entry.version, ...(held ? { heldAt: pinned } : {}) },
            });
            return reply.code(created ? 201 : 200).send(entry);
          } catch (err) {
            if (err instanceof RouteTakenError) return reply.code(409).send({ error: 'conflict', message: err.message });
            throw err;
          }
        },
      );

      app.patch<{ Params: { id: string }; Body: { enabled: boolean } }>(
        '/apps/:id',
        { schema: { body: { type: 'object', additionalProperties: false, required: ['enabled'], properties: { enabled: { type: 'boolean' } } } } },
        async (req, reply) => {
          const caller = callerFromHeaders(req.headers);
          if (!caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only an admin can turn apps on or off.' });
          const platform = platformApps.find((a) => a.id === req.params.id);
          if (platform) return reply.code(409).send({ error: 'conflict', message: `${platform.name} is part of the platform and can’t be turned off.` });
          const before = (await store.records()).find((r) => r.entry.id === req.params.id);
          if (!before || !(await store.setEnabled(req.params.id, req.body.enabled))) {
            return reply.code(404).send({ error: 'not_found', message: `No app "${req.params.id}" is registered.` });
          }
          if (before.enabled !== req.body.enabled) {
            req.log.info({ app: req.params.id, enabled: req.body.enabled, by: caller.id }, req.body.enabled ? 'app turned on' : 'app turned off');
            await record(req, { actor: { id: caller.id, kind: 'user' }, app: 'registry', action: req.body.enabled ? 'app.enabled' : 'app.disabled', target: req.params.id });
          }
          return catalogueEntry({ ...before, enabled: req.body.enabled });
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
