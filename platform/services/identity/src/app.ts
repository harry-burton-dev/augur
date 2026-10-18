import Fastify from 'fastify';
import { callerFromHeaders } from '@platform/service-kit';

/**
 * Who people are. Sign-in itself is the OIDC provider's job (Keycloak locally);
 * this service answers "who am I" for the shell and, later, holds the
 * directory of people and departments the provider does not.
 */
export const buildApp = async () => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.get('/healthz', async () => ({ status: 'ok', service: 'identity' }));

  app.get('/me', async (req, reply) => {
    const caller = callerFromHeaders(req.headers);
    if (!caller) return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
    return caller;
  });

  return app;
};
