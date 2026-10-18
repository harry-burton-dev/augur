import Fastify from 'fastify';
import { callerFromHeaders, health, packageVersion } from '@platform/service-kit';

/** The major version of the API this service serves; see contracts/ for its full version. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

/**
 * Who people are. Sign-in itself is the OIDC provider's job (Keycloak locally);
 * this service answers "who am I" for the shell and, later, holds the
 * directory of people and departments the provider does not.
 */
export const buildApp = async () => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.get('/healthz', async () => health('identity', version, API_VERSION));

  // The HTTP API, under its major version. A breaking change goes under /v2 beside it; /v1 stays until no one calls it.
  await app.register(
    async (app) => {
      app.get('/me', async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
        return caller;
      });
    },
    { prefix: `/${API_VERSION}` },
  );

  return app;
};
