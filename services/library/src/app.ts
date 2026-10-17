import Fastify from 'fastify';

export const buildApp = async () => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.get('/healthz', async () => ({ status: 'ok', service: 'library' }));
  return app;
};
