import { timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyRequest } from 'fastify';
import { callerFromHeaders, REGISTRATION_TOKEN_HEADER } from '@platform/service-kit';
import { appEntrySchema, conflictFor, platformApps, type AppEntry } from './manifest.ts';
import { MemoryAppStore, RouteTakenError, type AppStore } from './store.ts';

export interface RegistryOptions {
  store?: AppStore;
  /** Lets apps' services register themselves. Without it only admins can change the catalogue. */
  registrationToken?: string;
}

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * The catalogue of apps. The platform's own apps are built in; every other app
 * registers itself, and each person is shown only the apps their roles allow.
 */
export const buildApp = async ({ store = new MemoryAppStore(), registrationToken }: RegistryOptions = {}) => {
  // Unknown manifest fields are refused, not dropped: a misspelt requiredRole must not open an app to everyone.
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test', ajv: { customOptions: { removeAdditional: false } } });
  app.get('/healthz', async () => ({ status: 'ok', service: 'registry' }));

  // The gateway verified who is calling and passed it on.
  app.get('/manifest', async (req) => {
    const roles = callerFromHeaders(req.headers)?.roles ?? [];
    const apps = [...platformApps, ...(await store.list())];
    return apps.filter((a) => !a.requiredRole || roles.includes(a.requiredRole));
  });

  /** Who may change the catalogue: an app's service with the registration token, or an admin. */
  const changedBy = (req: FastifyRequest): string | undefined => {
    const token = req.headers[REGISTRATION_TOKEN_HEADER];
    if (registrationToken && typeof token === 'string' && sameSecret(token, registrationToken)) return 'service';
    const caller = callerFromHeaders(req.headers);
    return caller?.roles.includes('admin') ? caller.id : undefined;
  };

  app.put<{ Params: { id: string }; Body: AppEntry }>(
    '/apps/:id',
    { schema: { body: appEntrySchema } },
    async (req, reply) => {
      const by = changedBy(req);
      if (!by) return reply.code(403).send({ error: 'forbidden', message: 'Only an app’s own service or an admin can register apps.' });
      const entry = req.body;
      if (entry.id !== req.params.id) return reply.code(400).send({ error: 'bad_request', message: `The manifest is for "${entry.id}", not "${req.params.id}".` });
      const conflict = conflictFor(entry, await store.list());
      if (conflict) return reply.code(409).send({ error: 'conflict', message: conflict });
      try {
        const created = await store.put(entry, by);
        req.log.info({ app: entry.id, version: entry.version, by }, created ? 'app registered' : 'app updated');
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
    return reply.code(204).send();
  });

  return app;
};
