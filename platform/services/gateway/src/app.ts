import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import replyFrom from '@fastify/reply-from';
import type { IncomingHttpHeaders } from 'node:http';
import proxy from '@fastify/http-proxy';
import {
  CALLER_KEYS_PATH,
  CALLER_TOKEN_HEADER,
  callerHeaders,
  callerSignerFromEnv,
  health,
  packageVersion,
  REQUEST_ID_HEADER,
  serviceLogging,
  signedCallerHeaders,
  withoutCallerHeaders,
  WORKSPACE_HEADERS,
  type Caller,
  type CallerSigner,
} from '@augur/service-kit';
import { authenticate, AuthError, authFromEnv, signInKeysUrl, type AuthConfig } from './auth.ts';
import { FloorLookupError, identityFloors, type FloorLookup } from './floors.ts';
import { backupStatus, HealthMonitor, probesFor, publicAccess } from './status.ts';
import { Traffic, TRAFFIC_PATH } from './traffic.ts';
import { AppAccessUnavailable, capped, DEFAULT_UPLOAD_MB, registryAppAccess, TooLarge, type AppAccess } from './uploads.ts';
import { Readable } from 'node:stream';
import { registryUpstreams, UpstreamsUnavailable, type AppUpstreams } from './upstreams.ts';

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
const PUBLIC_ROUTES = new Set(['/healthz', CALLER_KEYS_PATH, TRAFFIC_PATH]);

declare module 'fastify' {
  interface FastifyRequest {
    caller?: Caller;
    signedCaller?: Record<string, string>;
    /** The body went past what the app may be sent, part way through. */
    tooLarge?: string;
  }
}

export interface GatewayOptions {
  upstreams?: Upstreams;
  auth?: AuthConfig;
  /** Counts calls and server errors for GET /traffic. */
  traffic?: Traffic;
  /** Checks every upstream for Status. By default one is made for the upstreams and started. */
  monitor?: HealthMonitor;
  /** Where the backup container writes its results (BACKUP_DIR). Without it Status says nothing about backups. */
  backupDir?: string;
  /** What infra/deploy/public.sh writes (PUBLIC_ACCESS_FILE). Without it Status says nothing about the internet. */
  publicAccessFile?: string;
  /** Which floors a caller is on. Defaults to asking the identity upstream. */
  floors?: FloorLookup;
  /** Signs the caller passed on to each service. Defaults to CALLER_SIGNING_KEY, or a new key each start. */
  signer?: CallerSigner;
  /** Which apps a person may use on a floor, and what each may be sent. Defaults to asking the registry upstream. */
  access?: AppAccess;
  /** Where apps' services are beyond `upstreams`. Defaults to asking the registry upstream. */
  apps?: AppUpstreams;
}

/**
 * Single public entry: /api/<service>/* is forwarded to that service, but only
 * for a signed-in caller. The gateway verifies the token and passes the caller
 * on in headers, so services behind it never handle tokens.
 *
 * An app names the floor a request is for with `X-Workspace-Id`. The gateway
 * checks the caller is on it and passes it on with its kind and their role,
 * or refuses the request; services never see a floor the gateway didn't check.
 * A call to an app is refused unless the app is on for the caller on that floor
 * (or on the organisation's, when the call names none).
 *
 * The caller also goes in one signed header (`x-augur-caller`) that only the
 * service it is sent to accepts, so a service can tell the gateway's word from
 * headers anyone on the network could send. See docs/signed-caller.md.
 */
export const buildApp = async ({ upstreams = defaultUpstreams(), auth = authFromEnv(), monitor, floors, backupDir = process.env.BACKUP_DIR, publicAccessFile = process.env.PUBLIC_ACCESS_FILE, signer = callerSignerFromEnv(), access, apps, traffic = new Traffic() }: GatewayOptions = {}) => {
  const appUpstreams = apps ?? (upstreams.registry ? registryUpstreams({ registryUrl: upstreams.registry, signer }) : undefined);
  const appAccess = access ?? (upstreams.registry ? registryAppAccess({ registryUrl: upstreams.registry, signer }) : undefined);
  const floorsOf = floors ?? (upstreams.identity ? identityFloors({ identityUrl: upstreams.identity, signer }) : undefined);
  const app = Fastify(serviceLogging());
  // Someone reporting a problem can quote it, and it finds the request in every service's logs.
  app.addHook('onSend', async (req, reply) => {
    reply.header(REQUEST_ID_HEADER, req.id);
  });
  app.get('/healthz', async () => health('gateway', version, API_VERSION));
  // How calls through the gateway have answered lately, for the updater's watch after an upgrade.
  // Only the deployment's own network reaches it: nginx forwards only /api/.
  app.addHook('onResponse', async (req, reply) => {
    if (req.routeOptions.url && PUBLIC_ROUTES.has(req.routeOptions.url)) return;
    traffic.record(reply.statusCode);
  });
  app.get<{ Querystring: { minutes?: number } }>(TRAFFIC_PATH, { schema: { querystring: { type: 'object', properties: { minutes: { type: 'integer', minimum: 1, maximum: 15 } } } } }, async (req) => traffic.snapshot(req.query.minutes));
  // The public key services check signed callers with. It is public, so anyone may fetch it.
  app.get(CALLER_KEYS_PATH, async () => signer.keys());

  const statusMonitor =
    monitor ??
    new HealthMonitor({
      probes: probesFor(upstreams, PLATFORM_SERVICES, signInKeysUrl(auth)),
      // Apps whose service the registry knows of are checked too, found again each round.
      moreProbes: appUpstreams ? async () => probesFor((await appUpstreams()).apps, PLATFORM_SERVICES) : undefined,
    });
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
      ...(publicAccessFile ? { publicAccess: await publicAccess(publicAccessFile) } : {}),
    };
  });

  /**
   * The floor an app call is checked on: the one the caller named, or else the organisation's, so a
   * call without X-Workspace-Id can't reach an app that is off where everyone stands.
   */
  const checkedOn = async (caller: Caller): Promise<Caller> => {
    if (caller.workspace || !floorsOf) return caller;
    const org = (await floorsOf(caller)).find((f) => f.kind === 'org');
    return org ? { ...caller, workspace: org } : caller;
  };

  /**
   * Before a call goes on to `name`: sign the caller for it. An app is only reached by someone it is on
   * for, on that floor (not turned off or blocked there, and their role allows it), and its body is held
   * to what it may be sent.
   */
  const beforeProxy = async (name: string, req: FastifyRequest, reply: FastifyReply) => {
    req.signedCaller = req.caller ? await signedCallerHeaders(signer, req.caller, name) : undefined;
    // The platform's services check their callers themselves.
    if (PLATFORM_SERVICES.includes(name) || !req.caller) return;
    let apps: Map<string, { maxUpload?: number }> | undefined;
    try {
      apps = appAccess ? await appAccess(await checkedOn(req.caller)) : undefined;
    } catch (err) {
      if (!(err instanceof AppAccessUnavailable) && !(err instanceof FloorLookupError)) throw err;
      req.log.error({ err: err.message }, 'app access check failed');
      if (req.body instanceof Readable) req.body.resume();
      return reply.code(503).send({ error: 'unavailable', message: 'Whether you can use this app can’t be checked right now. Try again in a moment.' });
    }
    const allowed = apps?.get(name);
    if (apps && !allowed) {
      if (req.body instanceof Readable) req.body.resume();
      return reply.code(403).send({ error: 'forbidden', message: `${name} isn’t available to you${req.caller.workspace ? ' on this floor' : ''}.` });
    }
    // Bodies stream through, never held here.
    if (!(req.body instanceof Readable)) return;
    const mb = allowed?.maxUpload ?? DEFAULT_UPLOAD_MB;
    const tooLarge = `This is more than ${name} takes at once (${mb} MB).`;
    const bytes = mb * 1024 * 1024;
    if (Number(req.headers['content-length'] ?? 0) > bytes) {
      req.body.resume();
      return reply.code(413).send({ error: 'too_large', message: tooLarge });
    }
    // A body without a length (sent as a stream) is counted as it passes, and cut off past the limit.
    const counted = capped(bytes);
    counted.on('error', (err) => {
      if (err instanceof TooLarge) req.tooLarge = tooLarge;
    });
    req.body = req.body.pipe(counted);
  };

  const replyOptions = {
    onError: (reply: FastifyReply, { error }: { error: Error }) => {
      if (reply.request.tooLarge) return void reply.code(413).send({ error: 'too_large', message: reply.request.tooLarge });
      // As reply-from answers by default.
      reply.send(error);
    },
    rewriteRequestHeaders: (req: FastifyRequest['raw'] & { id?: string }, headers: IncomingHttpHeaders) => {
      const request = req as unknown as FastifyRequest;
      // Who is calling comes only from the verified token. A service's own token is refused above: its audience isn't this one.
      // The token itself stays here: it works on every platform API, so no service, an app's least of all, is handed it.
      // The plain caller headers stay for apps that don't check the signed one yet.
      const { authorization: _, [CALLER_TOKEN_HEADER]: __, ...clean } = withoutCallerHeaders(headers);
      return { ...clean, [REQUEST_ID_HEADER]: request.id, ...(request.caller ? { ...callerHeaders(request.caller), ...request.signedCaller } : {}) };
    },
  };

  // The platform's own services, and apps named in APP_UPSTREAMS: known when the gateway starts.
  for (const [name, upstream] of Object.entries(upstreams)) {
    await app.register(proxy, {
      upstream,
      prefix: `/api/${name}`,
      rewritePrefix: '',
      // The signed caller is made before the request goes on, since signing is asynchronous.
      preHandler: (req, reply) => beforeProxy(name, req, reply),
      replyOptions: replyOptions as never,
    });
  }

  // Every other app: wherever the registry says its service is, set by whatever runs it. The routes
  // above are more specific, so the platform's services and APP_UPSTREAMS always win.
  if (appUpstreams) {
    await app.register(async (sub) => {
      await sub.register(replyFrom);
      // Bodies are passed on as they arrive, as the proxies above do.
      sub.removeAllContentTypeParsers();
      sub.addContentTypeParser('*', (_req, payload, done) => done(null, payload));
      const handler = async (req: FastifyRequest<{ Params: { name: string; '*'?: string } }>, reply: FastifyReply) => {
        const { name } = req.params;
        let upstream: string | undefined;
        let previews: Record<string, string> | undefined;
        try {
          const known = name in upstreams ? undefined : await appUpstreams();
          upstream = known?.apps[name];
          previews = known?.previews[name];
        } catch (err) {
          if (!(err instanceof UpstreamsUnavailable)) throw err;
          req.log.error({ err: err.message }, 'app upstreams unavailable');
          return reply.code(503).send({ error: 'unavailable', message: 'Where this app is can’t be looked up right now. Try again in a moment.' });
        }
        if (!upstream) return reply.code(404).send({ error: 'not_found', message: `Nothing is served at /api/${name}.` });
        await beforeProxy(name, req, reply);
        if (reply.sent) return reply;
        const rest = req.params['*'] ?? '';
        // A developer who chose one of the app's previews is sent to it instead; everyone else to the app.
        const preview = req.caller ? previews?.[req.caller.id] : undefined;
        return reply.from(`${preview ?? upstream}/${rest}`, replyOptions as never);
      };
      sub.all('/api/:name', handler);
      sub.all('/api/:name/*', handler);
    });
  }
  return app;
};
