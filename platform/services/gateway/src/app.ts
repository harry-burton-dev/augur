import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';

export type Upstreams = Record<string, string>;

/** "library=http://library:8083,other=http://other:8090" → { library: …, other: … } */
export const parseUpstreams = (spec = ''): Upstreams =>
  Object.fromEntries(
    spec
      .split(',')
      .map((pair) => pair.trim().split('='))
      .filter(([name, url]) => name && url)
      .map(([name, url]) => [name.trim(), url.trim()]),
  );

/** The platform's own services, then each app's service from APP_UPSTREAMS. The gateway knows no app by name. */
export const defaultUpstreams: Upstreams = {
  identity: process.env.IDENTITY_URL ?? 'http://localhost:8081',
  registry: process.env.REGISTRY_URL ?? 'http://localhost:8082',
  events: process.env.EVENTS_URL ?? 'http://localhost:8084',
  ...parseUpstreams(process.env.APP_UPSTREAMS),
};

/** Single public entry: /api/<service>/* is forwarded to that service. Token checks land in build step 4. */
export const buildApp = async (upstreams: Upstreams = defaultUpstreams) => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.get('/healthz', async () => ({ status: 'ok', service: 'gateway' }));
  for (const [name, upstream] of Object.entries(upstreams)) {
    await app.register(proxy, { upstream, prefix: `/api/${name}`, rewritePrefix: '' });
  }
  return app;
};
