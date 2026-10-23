import Fastify from 'fastify';
import { health, packageVersion } from '@augur/service-kit';

/** The major version of the API this service serves. Its routes go under /v1, as the platform's do. */
export const API_VERSION = 'v1';
const version = packageVersion(import.meta.url);

export const buildApp = async () => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.get('/healthz', async () => health('library', version, API_VERSION));
  return app;
};
