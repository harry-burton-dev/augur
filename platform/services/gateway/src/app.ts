import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';
import { callerHeaders, health, packageVersion, REQUEST_ID_HEADER, serviceLogging, withoutCallerHeaders, withoutServiceHeaders, type Caller } from '@platform/service-kit';
import { authenticate, AuthError, authFromEnv, signInKeysUrl, type AuthConfig } from './auth.ts';
import { backupStatus, HealthMonitor, probesFor } from './status.ts';

/** The major version of the gateway's own API (Status); see contracts/ for its full version. */
export const API_VERSION = 'v1';

const version = packageVersion(import.meta.url);

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

/** The platform's own services, by the name they are reached at. */
export const PLATFORM_SERVICES = ['identity', 'registry', 'events'];

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
  /** Checks every upstream for Status. By default one is made for the upstreams and started. */
  monitor?: HealthMonitor;
  /** Where the backup container writes its results (BACKUP_DIR). Without it Status says nothing about backups. */
  backupDir?: string;
}

/**
 * Single public entry: /api/<service>/* is forwarded to that service, but only
 * for a signed-in caller. The gateway verifies the token and passes the caller
 * on in headers, so services behind it never handle tokens.
 */
export const buildApp = async ({ upstreams = defaultUpstreams(), auth = authFromEnv(), monitor, backupDir = process.env.BACKUP_DIR }: GatewayOptions = {}) => {
  const app = Fastify(serviceLogging());
  // Someone reporting a problem can quote it, and it finds the request in every service's logs.
  app.addHook('onSend', async (req, reply) => {
    reply.header(REQUEST_ID_HEADER, req.id);
  });
  app.get('/healthz', async () => health('gateway', version, API_VERSION));

  const statusMonitor = monitor ?? new HealthMonitor({ probes: probesFor(upstreams, PLATFORM_SERVICES, signInKeysUrl(auth)) });
  if (!monitor) {
    statusMonitor.start();
    app.addHook('onClose', async () => statusMonitor.stop());
  }

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

  // The gateway's own API: whether every part of the platform is answering, for admins.
  app.get(`/api/gateway/${API_VERSION}/status`, async (req, reply) => {
    if (!req.caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only admins can see the platform’s status.' });
    return {
      components: statusMonitor.snapshot({ version, api: API_VERSION }),
      ...(backupDir ? { backups: await backupStatus(backupDir) } : {}),
    };
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
          return { ...clean, [REQUEST_ID_HEADER]: req.id, ...(req.caller ? callerHeaders(req.caller) : {}) };
        },
      },
    });
  }
  return app;
};
