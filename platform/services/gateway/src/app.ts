import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';
import { callerHeaders, withoutCallerHeaders, withoutServiceHeaders, type Caller } from '@platform/service-kit';
import { authenticate, AuthError, authFromEnv, type AuthConfig } from './auth.ts';

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
export const defaultUpstreams = (): Upstreams => ({
  identity: process.env.IDENTITY_URL ?? 'http://localhost:8081',
  registry: process.env.REGISTRY_URL ?? 'http://localhost:8082',
  events: process.env.EVENTS_URL ?? 'http://localhost:8084',
  ...parseUpstreams(process.env.APP_UPSTREAMS),
});

declare module 'fastify' {
  interface FastifyRequest {
    caller?: Caller;
  }
}

export interface GatewayOptions {
  upstreams?: Upstreams;
  auth?: AuthConfig;
}

/**
 * Single public entry: /api/<service>/* is forwarded to that service, but only
 * for a signed-in caller. The gateway verifies the token and passes the caller
 * on in headers, so services behind it never handle tokens.
 */
export const buildApp = async ({ upstreams = defaultUpstreams(), auth = authFromEnv() }: GatewayOptions = {}) => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.get('/healthz', async () => ({ status: 'ok', service: 'gateway' }));

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    try {
      req.caller = await authenticate(req.headers.authorization, auth);
    } catch (err) {
      if (!(err instanceof AuthError)) throw err;
      if (err.status === 401) reply.header('www-authenticate', 'Bearer');
      return reply.code(err.status).send({ error: err.status === 401 ? 'unauthenticated' : 'unavailable', message: err.message });
    }
  });

  for (const [name, upstream] of Object.entries(upstreams)) {
    await app.register(proxy, {
      upstream,
      prefix: `/api/${name}`,
      rewritePrefix: '',
      replyOptions: {
        rewriteRequestHeaders: (req, headers) => {
          // Who is calling comes only from the verified token, and nothing from outside can pose as a service.
          const clean = withoutServiceHeaders(withoutCallerHeaders(headers));
          return { ...clean, ...(req.caller ? callerHeaders(req.caller) : {}) };
        },
      },
    });
  }
  return app;
};
