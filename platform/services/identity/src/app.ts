import Fastify from 'fastify';
import { callerFromHeaders, health, packageVersion } from '@platform/service-kit';
import { MemoryPreferenceStore, type PreferenceStore, type Preferences } from './store.ts';

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
}

/**
 * Who people are. Sign-in itself is the OIDC provider's job (Keycloak locally);
 * this service answers "who am I" for the shell, keeps what each person has
 * chosen for it, and, later, holds the directory of people and departments the
 * provider does not.
 */
export const buildApp = async ({ store = new MemoryPreferenceStore() }: IdentityOptions = {}) => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test', ajv: { customOptions: { removeAdditional: false } } });
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
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
