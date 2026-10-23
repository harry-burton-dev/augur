import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';
import { callerHeaders, health, packageVersion, REQUEST_ID_HEADER, serviceLogging, withoutCallerHeaders, WORKSPACE_HEADERS, type Caller } from '@augur/service-kit';
import { authenticate, AuthError, authFromEnv, signInKeysUrl, type AuthConfig } from './auth.ts';
import { FloorLookupError, identityFloors, type FloorLookup } from './floors.ts';
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
export const PLATFORM_SERVICES = ['identity', 'registry', 'events', 'models'];

/** The platform's own services, then each app's service from APP_UPSTREAMS. The gateway knows no app by name. */
export const defaultUpstreams = (env = process.env): Upstreams => {
  const apps = parseUpstreams(env.APP_UPSTREAMS);
  // A platform name in APP_UPSTREAMS would quietly send that service's traffic to an app.
  const taken = Object.keys(apps).filter((name) => PLATFORM_SERVICES.includes(name) || name === 'gateway');
  if (taken.length) throw new Error(`APP_UPSTREAMS can't name ${taken.join(', ')}: ${taken.length === 1 ? 'that name belongs' : 'those names belong'} to the platform.`);
  return {
    identity: env.IDENTITY_URL ?? 'http://localhost:8081',
    registry: env.REGISTRY_URL ?? 'http://localhost:8082',
    events: env.EVENTS_URL ?? 'http://localhost:8084',
    models: env.MODELS_URL ?? 'http://localhost:8085',
    ...apps,
  };
};

/** The only routes anyone may reach without signing in. Everything else, including anything unmatched, needs a token. */
const PUBLIC_ROUTES = new Set(['/healthz']);

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
  /** Which floors a caller is on. Defaults to asking the identity upstream. */
  floors?: FloorLookup;
}

/**
 * Single public entry: /api/<service>/* is forwarded to that service, but only
 * for a signed-in caller. The gateway verifies the token and passes the caller
 * on in headers, so services behind it never handle tokens.
 *
 * An app names the floor a request is for with `X-Workspace-Id`. The gateway
 * checks the caller is on it and passes it on with its kind and their role,
 * or refuses the request; services never see a floor the gateway didn't check.
 */
export const buildApp = async ({ upstreams = defaultUpstreams(), auth = authFromEnv(), monitor, floors, backupDir = process.env.BACKUP_DIR }: GatewayOptions = {}) => {
  const floorsOf = floors ?? (upstreams.identity ? identityFloors({ identityUrl: upstreams.identity }) : undefined);
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
    // Decided by the route the request matched, never by its raw URL: the router decodes
    // the path, so "/%61pi/registry/…" reaches the registry while not starting with "/api/".
    if (req.routeOptions.url && PUBLIC_ROUTES.has(req.routeOptions.url)) return;
    try {
      req.caller = await authenticate(req.headers.authorization, auth);
    } catch (err) {
      if (!(err instanceof AuthError)) throw err;
      if (err.status === 401) reply.header('www-authenticate', 'Bearer');
      return reply.code(err.status).send({ error: err.status === 401 ? 'unauthenticated' : 'unavailable', message: err.message });
    }

    const raw = req.headers[WORKSPACE_HEADERS.id];
    const asked = Array.isArray(raw) ? raw[0] : raw;
    if (!asked) return;
    if (!floorsOf) return reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be checked right now.' });
    try {
      const floor = (await floorsOf(req.caller!)).find((f) => f.id === asked);
      if (!floor) return reply.code(403).send({ error: 'forbidden', message: 'You’re not on that floor, or it no longer exists.' });
      req.caller = { ...req.caller!, workspace: floor };
    } catch (err) {
      if (!(err instanceof FloorLookupError)) throw err;
      req.log.error({ err: err.message }, 'floor check failed');
      return reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be checked right now. Try again in a moment.' });
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
          // Who is calling comes only from the verified token. A service's own token is refused above: its audience isn't this one.
          // The token itself stays here: it works on every platform API, so no service, an app's least of all, is handed it.
          const { authorization: _, ...clean } = withoutCallerHeaders(headers);
          return { ...clean, [REQUEST_ID_HEADER]: req.id, ...(req.caller ? callerHeaders(req.caller) : {}) };
        },
      },
    });
  }
  return app;
};
