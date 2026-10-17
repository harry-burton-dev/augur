import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';

export const defaultUpstreams = {
  identity: process.env.IDENTITY_URL ?? 'http://localhost:8081',
  registry: process.env.REGISTRY_URL ?? 'http://localhost:8082',
  library: process.env.LIBRARY_URL ?? 'http://localhost:8083',
  events: process.env.EVENTS_URL ?? 'http://localhost:8084',
};

export type Upstreams = Record<string, string>;

/** Single public entry: /api/<service>/* is forwarded to that service. Token checks land in build step 4. */
export const buildApp = async (upstreams: Upstreams = defaultUpstreams) => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.get('/healthz', async () => ({ status: 'ok', service: 'gateway' }));
  for (const [name, upstream] of Object.entries(upstreams)) {
    await app.register(proxy, { upstream, prefix: `/api/${name}`, rewritePrefix: '' });
  }
  return app;
};
