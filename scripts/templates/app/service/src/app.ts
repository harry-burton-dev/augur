import Fastify from 'fastify';
import { callerCheckFromEnv, callerFromHeaders, health, packageVersion, signedCallers, type CallerCheck } from '@augur/service-kit';

/** The major version of the API this service serves. Its routes go under /v1, as the platform's do. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

export interface Options {
  /** Checks the caller the gateway signed for this app. In production it is on by default; in dev `x-user-*` headers are believed. */
  callers?: CallerCheck;
}

export const buildApp = async ({ callers = callerCheckFromEnv('__ID__') }: Options = {}) => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  // Only the gateway's signed word says who is calling: headers anyone could send are dropped.
  app.addHook('onRequest', signedCallers(callers));
  app.get('/healthz', async () => health('__ID__', version, API_VERSION));

  await app.register(
    async (app) => {
      // The gateway verified who is calling and signed it; nobody reaches this without signing in.
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
