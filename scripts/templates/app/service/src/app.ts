import Fastify from 'fastify';
import { callerFromHeaders, health, packageVersion } from '@platform/service-kit';

/** The major version of the API this service serves. Its routes go under /v1, as the platform's do. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

export const buildApp = async () => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.get('/healthz', async () => health('__ID__', version, API_VERSION));

  await app.register(
    async (app) => {
      // The gateway verified who is calling and passed them on; nobody reaches this without signing in.
      app.get('/greeting', async (req, reply) => {
        const caller = callerFromHeaders(req.headers);
        if (!caller) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to use __NAME__.' });
        return { message: `__NAME__'s service knows you as ${caller.name}.` };
      });
    },
    { prefix: `/${API_VERSION}` },
  );
  return app;
};
