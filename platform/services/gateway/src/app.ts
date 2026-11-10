import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import replyFrom from '@fastify/reply-from';
import type { IncomingHttpHeaders } from 'node:http';
import proxy from '@fastify/http-proxy';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { Static } from 'typebox';
import { createLocalJWKSet } from 'jose';
import {
  APP_HEADER,
  PERSONA_HEADER,
  appCallerId,
  appClientId,
  CALLER_KEYS_PATH,
  CALLER_TOKEN_HEADER,
  callerHeaders,
  callerOfService,
  CallerKeysUnavailable,
  callerSignerFromEnv,
  CallerTokenError,
  DELEGATION_HEADER,
  delegationCheck,
  delegationSecondsFromEnv,
  GATEWAY_CALLER,
  health,
  packageVersion,
  REQUEST_ID_HEADER,
  problemDetails,
  serviceLogging,
  signDelegation,
  signedCallerHeaders,
  withoutCallerHeaders,
  WORKSPACE_HEADERS,
  type Caller,
  type CallerSigner,
} from '@augur/service-kit';
import { authenticate, AuthError, authFromEnv, signInKeysUrl, type AuthConfig, type Authenticated } from './auth.ts';
import { AppGrantsUnavailable, holds, notAllowed, registryGrantsFor, scopeFor, type AppGrant, type AppGrants } from './grants.ts';
import { appFailure, appLimitsFromEnv, InFlight, poolOptions, type AppLimits } from './limits.ts';
import { describeApi } from './contract.ts';
import { BrowserTelemetry, CallerKeys, OtlpExport, ref, refused, Status } from './schemas.ts';
import { FloorLookupError, identityFloors, type FloorLookup } from './floors.ts';
import { PERSONA_ID, permissionsPersonaSessions, PersonaSessionsUnavailable, type PersonaSessionCheck } from './personas.ts';
import { backupStatus, HealthMonitor, probesFor, publicAccess } from './status.ts';
import { Traffic, TRAFFIC_PATH, type TrafficPart } from './traffic.ts';
import { GatewayMetrics } from './metrics.ts';
import { browserTelemetryFrom, forward, ForwardFailed, SendLimit, stamped, TELEMETRY_BODY_LIMIT, type BrowserTelemetry as BrowserTelemetrySettings, type Signal } from './telemetry.ts';
import { AppAccessUnavailable, capped, DEFAULT_UPLOAD_MB, registryAppAccess, TooLarge, type AppAccess, type AppAllowed } from './uploads.ts';
import { Readable } from 'node:stream';
import { Mailer, mailRelayFromEnv, organisationSender, type MailStatus } from '@augur/service-kit/mail';
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
export const PLATFORM_SERVICES = ['identity', 'registry', 'events', 'models', 'knowledge', 'permissions'];

/** The platform's own services, then each app's service from APP_UPSTREAMS. The gateway knows no app by name. */
export const defaultUpstreams = (env = process.env): Upstreams => {
  const apps = parseUpstreams(env.APP_UPSTREAMS);
  // A platform name in APP_UPSTREAMS would quietly send that service's traffic to an app.
  const taken = Object.keys(apps).filter((name) => PLATFORM_SERVICES.includes(name) || name === 'gateway');
  if (taken.length) throw new Error(`APP_UPSTREAMS can't name ${taken.join(', ')}: ${taken.length === 1 ? 'that name belongs' : 'those names belong'} to AUGUR’s own services.`);
  return {
    identity: env.IDENTITY_URL ?? 'http://localhost:8081',
    registry: env.REGISTRY_URL ?? 'http://localhost:8082',
    events: env.EVENTS_URL ?? 'http://localhost:8084',
    models: env.MODELS_URL ?? 'http://localhost:8085',
    knowledge: env.KNOWLEDGE_URL ?? 'http://localhost:8086',
    permissions: env.PERMISSIONS_URL ?? 'http://localhost:8087',
    ...apps,
  };
};

/** The only routes anyone may reach without signing in. Everything else, including anything unmatched, needs a token. */
/** An app's call is one under /api/<name> where the name isn't one of AUGUR's services; anything else is AUGUR's. */
const trafficPart = (url: string): TrafficPart => {
  const name = /^\/api\/([^/?#]+)/.exec(url)?.[1];
  return name && !PLATFORM_SERVICES.includes(decodeURIComponent(name)) ? 'apps' : 'platform';
};

/**
 * The organisation's logo (ADR 0042), for sign-in pages, which are shown before anyone has signed in. The only
 * path under /api/ that needs no sign-in: one exact path, GET and HEAD only, nothing passed on but the request's
 * own `If-None-Match`, and only the image and its caching headers passed back.
 */
export const PUBLIC_LOGO_PATH = '/api/identity/v1/public/organisation/logo';
/** The most the logo route passes back; identity takes nothing larger. */
const PUBLIC_LOGO_BYTES = 512 * 1024;

/**
 * Where an app's part gets its own token (spec 8.4): a client-credentials grant, passed on to the sign-in
 * service's token endpoint as the gateway reaches it. No other grant passes, so nobody signs a person in here.
 */
export const TOKEN_PATH = '/api/identity/v1/token';

const PUBLIC_ROUTES = new Set(['/healthz', CALLER_KEYS_PATH, TRAFFIC_PATH, PUBLIC_LOGO_PATH, TOKEN_PATH]);
/** The public routes that aren't counted as traffic; a storm at the token route is one the watch should see. */
const UNCOUNTED_ROUTES = new Set([...PUBLIC_ROUTES].filter((r) => r !== TOKEN_PATH));

/** The shape of an app's id in `x-augur-app` and in a client `app-<id>`, as the manifest schema has it. */
const APP_ID = /^[a-z][a-z0-9-]{1,39}$/;
/** The shape of a floor's id a part may name: the registry is asked about nothing else. */
const FLOOR_ID = /^[A-Za-z0-9_.:-]{1,100}$/;
/** Every header the gateway itself speaks: a request may bring none of them in. */
const isGatewayHeader = (name: string) => /^x-(augur|user|workspace)-/i.test(name);

declare module 'fastify' {
  interface FastifyRequest {
    caller?: Caller;
    /** Whose token the call carries, once verified. */
    identity?: Authenticated;
    /** For an app's own token: what the registry grants it where the call is for. */
    grant?: AppGrant;
    /** The app a person's call is made for (`x-augur-app`, set by the host), once checked to be well-formed. */
    actingApp?: string;
    signedCaller?: Record<string, string>;
    /** The app whose in-flight slot this call holds, to give back when it is answered. */
    appCall?: string;
    /** What that app is called, for a refusal in words. */
    appCallName?: string;
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
  /** Whether this deployment lets an admin fill it with synthetic sample data (SEED_ALLOWED, ADR 0056). Off unless set. */
  seedAllowed?: boolean;
  /** Which floors a caller is on. Defaults to asking the identity upstream. */
  floors?: FloorLookup;
  /** Signs the caller passed on to each service. Defaults to CALLER_SIGNING_KEY, or a new key each start. */
  signer?: CallerSigner;
  /** Which apps a person may use on a floor, and what each may be sent. Defaults to asking the registry upstream. */
  access?: AppAccess;
  /** Where apps' services are beyond `upstreams`. Defaults to asking the registry upstream. */
  apps?: AppUpstreams;
  /** Whether and where browser telemetry goes (ADR 0059). Defaults to the OTEL_* settings. */
  browserTelemetry?: BrowserTelemetrySettings;
  /** What the alert rules read (ADR 0059). Defaults to the OpenTelemetry API's meter, a no-op without a collector. */
  metrics?: GatewayMetrics;
  /** Sends browser telemetry on to the collector. */
  fetchImpl?: typeof fetch;
  /** Checks the organisation's mail relay for Status (ADR 0065). Defaults to the SMTP_* settings. */
  mailer?: Mailer;
  /** What each app is granted where, for an app's own token and for a call made for an app (spec 8.2, 8.3). Defaults to asking the registry upstream. */
  appGrants?: AppGrants;
  /** The brakes on calls to apps' parts (spec 7.5). Defaults to the APP_*_TIMEOUT_MS and APP_CONCURRENT_CALLS settings. */
  limits?: AppLimits;
  /** How long a delegated caller lasts (spec 8.5). Defaults to APP_DELEGATION_SECONDS, or 300. */
  delegationSeconds?: number;
  /** Whether a person is acting as an admin persona now (ADR 0086). Defaults to asking the permissions upstream. */
  personaSessions?: PersonaSessionCheck;
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
export const buildApp = async ({ upstreams = defaultUpstreams(), auth = authFromEnv(), monitor, floors, backupDir = process.env.BACKUP_DIR, publicAccessFile = process.env.PUBLIC_ACCESS_FILE, seedAllowed = process.env.SEED_ALLOWED === 'true', signer = callerSignerFromEnv(), access, apps, traffic = new Traffic(), browserTelemetry = browserTelemetryFrom(), metrics = new GatewayMetrics(), fetchImpl = fetch, mailer, appGrants, limits = appLimitsFromEnv(), delegationSeconds = delegationSecondsFromEnv(), personaSessions }: GatewayOptions = {}) => {
  // Mail comes from the organisation's sender (Admin → Organisation), read from identity as the gateway.
  const sender = upstreams.identity
    ? organisationSender({
        identityUrl: upstreams.identity,
        headers: async () => ({ ...callerHeaders(GATEWAY_CALLER), ...(signer ? await signedCallerHeaders(signer, GATEWAY_CALLER, 'identity') : {}) }),
        fetchImpl,
        warn: (message) => console.warn(message),
      })
    : undefined;
  const mail = mailer ?? new Mailer({ relay: mailRelayFromEnv(process.env, (message) => console.warn(message)), sender });
  /** Status never waits long on the relay: a check slower than 2 seconds carries on behind, and says so meanwhile. */
  let lastEmail: MailStatus | undefined;
  const emailStatus = async (): Promise<MailStatus> => {
    const checking = mail.status().then((s) => (lastEmail = s));
    const waited = await Promise.race([checking, new Promise<undefined>((done) => (setTimeout(done, 2_000) as { unref?: () => void }).unref?.())]);
    return waited ?? lastEmail ?? { state: 'attention', problem: 'Still checking the mail relay. Look again in a moment.' };
  };
  const appUpstreams = apps ?? (upstreams.registry ? registryUpstreams({ registryUrl: upstreams.registry, signer }) : undefined);
  const appAccess = access ?? (upstreams.registry ? registryAppAccess({ registryUrl: upstreams.registry, signer }) : undefined);
  const floorsOf = floors ?? (upstreams.identity ? identityFloors({ identityUrl: upstreams.identity, signer }) : undefined);
  const grantsOf = appGrants ?? (upstreams.registry ? registryGrantsFor({ registryUrl: upstreams.registry, signer }) : undefined);
  const actingAs = personaSessions ?? (upstreams.permissions ? permissionsPersonaSessions({ permissionsUrl: upstreams.permissions, signer, fetchImpl }) : undefined);
  const inFlight = new InFlight(limits.concurrentCalls);
  // A part sends back the delegated caller the gateway signed; it is checked against the gateway's own key.
  const checkDelegation = delegationCheck({ keys: async (header, token) => createLocalJWKSet(await signer.keys())(header, token) });
  /** What an app is called where a refusal names it: what the registry says, or its id. */
  const appName = (app: string, grant?: AppGrant) => grant?.name ?? app;
  const app = Fastify(serviceLogging()).withTypeProvider<TypeBoxTypeProvider>();
  await app.register(problemDetails());
  await describeApi(app, `/api/gateway/${API_VERSION}`, `/${API_VERSION}`);
  // Someone reporting a problem can quote it, and it finds the request in every service's logs.
  app.addHook('onSend', async (req, reply) => {
    reply.header(REQUEST_ID_HEADER, req.id);
  });
  app.get('/healthz', { schema: { hide: true } }, async () => health('gateway', version, API_VERSION));
  // How calls through the gateway have answered lately, for the updater's watch after an upgrade.
  // Only the deployment's own network reaches it: nginx forwards only /api/.
  // A slot is given back once, whether the call was answered or the caller went away first (abort fires no onResponse).
  const releaseSlot = (req: FastifyRequest) => {
    if (!req.appCall) return;
    inFlight.release(req.appCall);
    req.appCall = undefined;
  };
  app.addHook('onRequestAbort', async (req) => releaseSlot(req));
  app.addHook('onResponse', async (req, reply) => {
    releaseSlot(req);
    if (req.routeOptions.url && UNCOUNTED_ROUTES.has(req.routeOptions.url)) return;
    const part = trafficPart(req.url);
    traffic.record(reply.statusCode, part);
    metrics.request(reply.statusCode, part);
  });
  app.get<{ Querystring: { minutes?: number } }>(TRAFFIC_PATH, { schema: { hide: true, querystring: { type: 'object', properties: { minutes: { type: 'integer', minimum: 1, maximum: 15 } } } } }, async (req) => traffic.snapshot(req.query.minutes));
  // The public key services check signed callers with. It is public, so anyone may fetch it.
  app.get(
    CALLER_KEYS_PATH,
    {
      schema: {
        summary: 'The public key signed callers are checked with',
        description: [
          "A JSON Web Key Set with the gateway's Ed25519 key. No sign-in is needed.",
          'The key is new each time the gateway starts unless CALLER_SIGNING_KEY is',
          "set, so fetch it again when a token names a key id you don't have.",
        ].join(' '),
        response: { 200: CallerKeys },
      },
    },
    // jose types a key loosely; the gateway signs only with its Ed25519 key.
    async () => (await signer.keys()) as Static<typeof CallerKeys>,
  );

  // The organisation's logo, from identity, to anyone: sign-in pages show it before anyone has signed in.
  app.get(PUBLIC_LOGO_PATH, { schema: { hide: true } }, async (req, reply) => {
    const identity = upstreams.identity;
    if (!identity) return reply.code(404).send({ error: 'not_found', message: 'This deployment has no logo.' });
    const asked = req.headers['if-none-match'];
    let res: Response;
    try {
      res = await fetchImpl(`${identity.replace(/\/$/, '')}/v1/public/organisation/logo`, {
        headers: { [REQUEST_ID_HEADER]: req.id, ...(typeof asked === 'string' ? { 'if-none-match': asked } : {}) },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      req.log.warn({ err: (err as Error).message }, 'logo not fetched');
      return reply.code(503).send({ error: 'unavailable', message: 'The logo can’t be fetched right now.' });
    }
    const safe = { 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" };
    if (res.status === 304) return reply.code(304).headers({ ...safe, ...(res.headers.get('etag') ? { etag: res.headers.get('etag')! } : {}) }).send();
    const bytes = res.ok ? Buffer.from(await res.arrayBuffer()) : undefined;
    if (!bytes || res.headers.get('content-type') !== 'image/png' || bytes.length > PUBLIC_LOGO_BYTES) {
      return reply.code(404).headers(safe).send({ error: 'not_found', message: 'This organisation has no logo.' });
    }
    return reply
      .code(200)
      .headers({ ...safe, 'content-type': 'image/png', 'cache-control': 'public, max-age=300', ...(res.headers.get('etag') ? { etag: res.headers.get('etag')! } : {}) })
      .send(bytes);
  });

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
  metrics.watch({ components: () => statusMonitor.snapshot({ version, api: API_VERSION }), ...(backupDir ? { backups: () => backupStatus(backupDir) } : {}) });

  app.addHook('onRequest', async (req, reply) => {
    // Decided by the route the request matched, never by its raw URL: the router decodes
    // the path, so "/%61pi/registry/…" reaches the registry while not starting with "/api/".
    if (req.routeOptions.url && PUBLIC_ROUTES.has(req.routeOptions.url)) return;
    try {
      req.identity = await authenticate(req.headers.authorization, auth);
    } catch (err) {
      if (!(err instanceof AuthError)) throw err;
      if (err.status === 401) reply.header('www-authenticate', 'Bearer');
      return reply.code(err.status).send({ error: err.status === 401 ? 'unauthenticated' : 'unavailable', message: err.message });
    }
    const raw = req.headers[WORKSPACE_HEADERS.id];
    const asked = Array.isArray(raw) ? raw[0] : raw;

    // AUGUR's own services reach each other inside the deployment; through the gateway one reaches only an app's part
    // (events pushes events to parts, spec 8.6), as a caller named after it, which the part checks (isServiceCaller).
    if (req.identity.kind === 'service') {
      // Decided by the matched route, as for public routes: an app proxy is `/api/<name>` or `/api/:name`, and the
      // gateway's own routes and the platform's services are neither.
      const target = /^\/api\/([^/]+)/.exec(req.routeOptions.url ?? '')?.[1];
      const name = target === ':name' ? (req.params as { name?: string }).name : target;
      if (!name || name === 'gateway' || PLATFORM_SERVICES.includes(name)) return reply.code(403).send({ error: 'forbidden', message: 'AUGUR’s own services reach each other inside the deployment, not through the gateway.' });
      req.caller = callerOfService(req.identity.service);
      return;
    }

    // An app's own token (spec 8.2): only for an app the registry knows and has on where the call is for.
    if (req.identity.kind === 'app') {
      const { app: id } = req.identity;
      if (asked !== undefined && !FLOOR_ID.test(asked)) return reply.code(400).send({ error: 'bad_request', message: `${WORKSPACE_HEADERS.id} must be a floor’s id.` });
      if (!grantsOf) return reply.code(503).send({ error: 'unavailable', message: 'What apps may do can’t be checked right now.' });
      let grant: AppGrant | undefined;
      try {
        grant = await grantsOf(id, asked);
      } catch (err) {
        if (!(err instanceof AppGrantsUnavailable)) throw err;
        req.log.error({ err: err.message, app: id }, 'app grants unavailable');
        return reply.code(503).send({ error: 'unavailable', message: 'What apps may do can’t be checked right now. Try again in a moment.' });
      }
      if (!grant) {
        reply.header('www-authenticate', 'Bearer');
        return reply.code(401).send({ error: 'unauthenticated', message: `${id} isn’t installed here.` });
      }
      if (!grant.on) return reply.code(403).send({ error: 'forbidden', message: `${appName(id, grant)} is turned off${asked ? ' on that floor' : ''}.` });
      req.grant = grant;
      // The floor the call is for, as the registry checked it, so the services see the same floor the grant was read on.
      const workspace = asked && grant.floorKind ? { id: asked, kind: grant.floorKind, role: 'member' as const } : undefined;
      const sentBack = req.headers[DELEGATION_HEADER];
      const delegation = Array.isArray(sentBack) ? sentBack[0] : sentBack;
      if (delegation) {
        // The part is calling onward for a person (spec 8.5): the caller is the one the gateway delegated to it.
        try {
          req.caller = await checkDelegation(delegation, id);
        } catch (err) {
          if (err instanceof CallerTokenError) {
            reply.header('www-authenticate', 'Bearer');
            return reply.code(401).send({ error: 'unauthenticated', message: err.message });
          }
          if (err instanceof CallerKeysUnavailable) return reply.code(503).send({ error: 'unavailable', message: 'The delegation can’t be checked right now.' });
          throw err;
        }
      } else {
        // The app itself: a caller named after it, so every service it reaches sees the app and its scopes.
        req.caller = { id: appCallerId(id), name: appName(id, grant), departments: [], roles: [], app: id, scopes: [...grant.scopes], ...(workspace ? { workspace } : {}) };
      }
      return;
    }

    req.caller = req.identity.caller;
    // The host names the app a person's call is for (spec 8.5); the sandbox never reaches this header.
    const forApp = req.headers[APP_HEADER];
    const acting = Array.isArray(forApp) ? forApp[0] : forApp;
    if (acting !== undefined) {
      if (!APP_ID.test(acting)) return reply.code(400).send({ error: 'bad_request', message: `${APP_HEADER} must be an app’s id.` });
      req.actingApp = acting;
    }

    // The admin persona the shell says the person is acting as (PDR-024): only while the permissions service has
    // a live session for it, and never on a call made for an app.
    const sentPersona = req.headers[PERSONA_HEADER];
    const persona = Array.isArray(sentPersona) ? sentPersona[0] : sentPersona;
    if (persona !== undefined) {
      if (!PERSONA_ID.test(persona)) return reply.code(400).send({ error: 'bad_request', message: `${PERSONA_HEADER} must be a persona’s id.` });
      if (req.actingApp) return reply.code(403).send({ error: 'forbidden', message: 'An app never acts as your admin persona. Stop “Act as” to use apps, or use AUGUR itself.' });
      if (!actingAs) return reply.code(503).send({ error: 'unavailable', message: 'You can’t act as a persona here: this deployment has no permissions service.' });
      try {
        if (!(await actingAs(req.caller.id, persona))) {
          return reply.code(403).send({ error: 'persona_ended', message: `You’re no longer acting as ${persona}: its time ran out or it was stopped. Choose “Act as” again to carry on.` });
        }
      } catch (err) {
        if (!(err instanceof PersonaSessionsUnavailable)) throw err;
        req.log.error({ err: err.message }, 'persona session check failed');
        return reply.code(503).send({ error: 'unavailable', message: 'Whether you’re acting as a persona can’t be checked right now. A deployment admin can see why on Status.' });
      }
      req.caller = { ...req.caller, persona };
    }

    if (!asked) return;
    if (!floorsOf) return reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be checked right now.' });
    try {
      const floor = (await floorsOf(req.caller)).find((f) => f.id === asked);
      if (!floor) return reply.code(403).send({ error: 'forbidden', message: 'You’re not on that floor, or it no longer exists.' });
      req.caller = { ...req.caller, workspace: floor };
    } catch (err) {
      if (!(err instanceof FloorLookupError)) throw err;
      req.log.error({ err: err.message }, 'floor check failed');
      return reply.code(503).send({ error: 'unavailable', message: 'Floors can’t be checked right now. Try again in a moment.' });
    }
  });

  // A part's own sign-in (spec 8.4): its client-credentials grant, and only that, goes on to the sign-in service.
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => done(null, body));
  app.post<{ Body: string }>(
    TOKEN_PATH,
    {
      bodyLimit: 16 * 1024,
      schema: {
        summary: 'Where an app’s part gets its own token',
        description: [
          'A client-credentials grant (application/x-www-form-urlencoded, as OAuth has it: grant_type, client_id,',
          'client_secret), passed on to the deployment’s sign-in service and answered as it answers. No other grant passes:',
          'nobody signs a person in here. No sign-in is needed to call it.',
        ].join(' '),
        consumes: ['application/x-www-form-urlencoded'],
        response: {
          200: { description: 'The token, as the sign-in service answered', type: 'object', additionalProperties: true },
          400: refused('Not a client-credentials grant'),
          401: refused('The sign-in service refused the client'),
          503: refused("The sign-in service can't be reached"),
        },
      },
    },
    async (req, reply) => {
      const form = new URLSearchParams(typeof req.body === 'string' ? req.body : '');
      if (form.get('grant_type') !== 'client_credentials') return reply.code(400).send({ error: 'bad_request', message: 'Only a client-credentials grant passes here.' });
      if (!auth.tokenUrl) return reply.code(503).send({ error: 'unavailable', message: 'The gateway isn’t told where the sign-in service issues tokens.' });
      let res: Response;
      try {
        res = await fetchImpl(auth.tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', [REQUEST_ID_HEADER]: req.id }, body: form.toString(), signal: AbortSignal.timeout(10_000) });
      } catch (err) {
        req.log.warn({ err: (err as Error).message }, 'token endpoint not reached');
        return reply.code(503).send({ error: 'unavailable', message: 'The sign-in service can’t be reached right now.' });
      }
      const text = await res.text();
      return reply.code(res.status).header('content-type', res.headers.get('content-type') ?? 'application/json').header('cache-control', 'no-store').send(text);
    },
  );

  // The gateway's own API: whether every part of the platform is answering, for admins.
  app.get(
    `/api/gateway/${API_VERSION}/status`,
    {
      schema: {
        summary: 'Whether every part of AUGUR is answering (admins only)',
        description: [
          "The gateway checks every service's /healthz and the sign-in service's",
          'signing keys every 30 seconds and keeps the last answer, so this never',
          'waits on a slow service. A component that failed its last check, or has',
          'not answered for 2 minutes, is down. `backups` is present when the',
          'gateway is told where the backup container writes (BACKUP_DIR).',
          '`email` says whether mail can be sent through the relay (SMTP_*),',
          'checked at most every 5 minutes.',
          '`seeding` says whether sample data may be added here (SEED_ALLOWED).',
        ].join(' '),
        response: {
          200: Status,
          401: refused('No signed-in caller'),
          403: refused('Not an admin, or not on the floor X-Workspace-Id names'),
          503: refused("Sign-in or floors can't be checked right now"),
        },
      },
    },
    async (req, reply) => {
      if (!req.caller?.roles.includes('admin')) return reply.code(403).send({ error: 'forbidden', message: 'Only admins can see AUGUR’s status.' });
      return {
        components: statusMonitor.snapshot({ version, api: API_VERSION }),
        ...(backupDir ? { backups: await backupStatus(backupDir) } : {}),
        ...(publicAccessFile ? { publicAccess: await publicAccess(publicAccessFile) } : {}),
        email: await emailStatus(),
        // Whether `pnpm seed` may add synthetic people and content here, and who can change that.
        seeding: seedAllowed
          ? { allowed: true }
          : { allowed: false, why: 'This deployment doesn’t allow sample data.', whoCanChange: 'A deployment admin, by setting SEED_ALLOWED=true in its .env.' },
      };
    },
  );

  // Browser telemetry (ADR 0059): whether the shell should send it, and where it sends.
  app.get(
    `/api/gateway/${API_VERSION}/telemetry`,
    {
      schema: {
        summary: 'Whether this deployment collects browser errors and traces',
        description: [
          'The shell asks once after sign-in and starts Faro only when on is true: when the deployment names a',
          'collector (OTEL_EXPORTER_OTLP_ENDPOINT). When off, why says so.',
        ].join(' '),
        response: { 200: ref(BrowserTelemetry), 401: refused('No signed-in caller') },
      },
    },
    async () => (browserTelemetry.on ? { on: true } : { on: false, ...(browserTelemetry.why ? { why: browserTelemetry.why } : {}) }),
  );

  const limit = new SendLimit();
  for (const signal of ['logs', 'traces'] as Signal[]) {
    app.post(
      `/api/gateway/${API_VERSION}/telemetry/v1/${signal}`,
      {
        bodyLimit: TELEMETRY_BODY_LIMIT,
        schema: {
          summary: `Browser ${signal} from the shell, passed on to the deployment's collector`,
          description: [
            `OTLP/HTTP JSON ${signal}, as Grafana Faro's OTLP transport sends them (ADR 0059). The gateway stamps each`,
            `resource as service.name=augur-browser with the deployment's own attributes, takes out anything that`,
            'could name a person and query strings from URLs, and forwards it. At most 256 KB a send and 60 sends a',
            'minute a person.',
          ].join(' '),
          body: OtlpExport,
          response: {
            200: { description: 'Passed on', type: 'object', additionalProperties: true },
            400: refused('Not an OTLP body of this signal'),
            401: refused('No signed-in caller'),
            409: refused('Browser telemetry is off here, with why (error telemetry_off)'),
            429: refused('More than 60 sends this minute'),
            502: refused("The collector didn't take it"),
          },
        },
      },
      async (req, reply) => {
        if (!browserTelemetry.on) return reply.code(409).send({ error: 'telemetry_off', message: browserTelemetry.why ?? 'Browser telemetry is off here.' });
        if (!limit.take(req.caller!.id)) return reply.code(429).send({ error: 'too_many', message: 'Too many sends this minute. The next minute takes them again.' });
        const body = stamped(req.body, signal, browserTelemetry.resource);
        if (!body) return reply.code(400).send({ error: 'bad_request', message: `That isn’t OTLP ${signal}.` });
        try {
          await forward(browserTelemetry, signal, body, fetchImpl);
        } catch (err) {
          if (!(err instanceof ForwardFailed)) throw err;
          req.log.warn({ err: err.message }, 'browser telemetry not forwarded');
          return reply.code(502).send({ error: 'collector_unavailable', message: err.message });
        }
        // As an OTLP collector answers: an ExportResponse with nothing rejected.
        return {};
      },
    );
  }

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
    const drop = () => {
      if (req.body instanceof Readable) req.body.resume();
    };
    const refuse = (status: 400 | 403 | 503, error: string, message: string) => {
      drop();
      return reply.code(status).send({ error, message });
    };
    const toPlatform = PLATFORM_SERVICES.includes(name);

    // An app's own token, or a part calling onward for a person (spec 8.3): within the grant, or refused naming the scope.
    if (req.identity?.kind === 'app' && req.caller && req.grant) {
      const { app: id } = req.identity;
      const scope = scopeFor(req.method, req.url, id, PLATFORM_SERVICES);
      const granted = scope === null || (scope !== undefined && req.grant.scopes.includes(scope) && (req.caller.scopes?.includes(scope) ?? true));
      if (!granted) return refuse(403, 'forbidden', notAllowed(appName(id, req.grant), scope, req.url));
      // Its own part checks callers as `app-<id>`; a service checks them as itself. A delegated person's caller is signed afresh for a minute.
      req.signedCaller = await signedCallerHeaders(signer, req.caller, name === id ? appClientId(id) : name);
      if (toPlatform) return;
    } else if (req.caller && req.actingApp) {
      // A person's call made for an app (spec 8.5): the app must be on for them here, and an AUGUR route within its grant.
      const id = req.actingApp;
      if (!toPlatform && name !== id) return refuse(400, 'bad_request', `This call is for ${id} but goes to /api/${name}.`);
      let grant: AppGrant | undefined;
      try {
        if (!grantsOf) throw new AppGrantsUnavailable('the gateway has no registry to ask');
        grant = await grantsOf(id, req.caller.workspace?.id);
      } catch (err) {
        if (!(err instanceof AppGrantsUnavailable)) throw err;
        req.log.error({ err: err.message, app: id }, 'app grants unavailable');
        return refuse(503, 'unavailable', 'What this app may do can’t be checked right now. Try again in a moment.');
      }
      if (!grant) return refuse(403, 'forbidden', `${id} isn’t installed here.`);
      if (!grant.on) return refuse(403, 'forbidden', `${appName(id, grant)} is turned off${req.caller.workspace ? ' on this floor' : ''}.`);
      if (toPlatform) {
        // The app must be on for this person here, as for a call to its own routes: blocked or needing a role they lack is not on.
        try {
          const apps = appAccess ? await appAccess(await checkedOn(req.caller)) : undefined;
          if (apps && !apps.has(id)) return refuse(403, 'forbidden', `That app isn’t available to you${req.caller.workspace ? ' on this floor' : ''}.`);
        } catch (err) {
          if (!(err instanceof AppAccessUnavailable) && !(err instanceof FloorLookupError)) throw err;
          req.log.error({ err: err.message }, 'app access check failed');
          return refuse(503, 'unavailable', 'Whether you can use this app can’t be checked right now. Try again in a moment.');
        }
        const scope = scopeFor(req.method, req.url, id, PLATFORM_SERVICES);
        if (scope === undefined || (scope !== null && !holds(grant, scope))) return refuse(403, 'forbidden', notAllowed(appName(id, grant), scope, req.url));
        // The service sees the person with the app and its scopes beside them, and applies the smaller access.
        req.signedCaller = await signedCallerHeaders(signer, { ...req.caller, app: id, scopes: [...grant.scopes, ...(grant.platformScopes ?? [])] }, name);
      } else {
        // The part receives the delegated caller, which it carries on its own calls for the person.
        req.signedCaller = { [CALLER_TOKEN_HEADER]: await signDelegation(signer, req.caller, { app: id, scopes: grant.scopes, lifetimeSeconds: delegationSeconds }) };
      }
    } else if (req.identity?.kind === 'service' && req.caller) {
      // A platform service's token (spec 8.6): only to an app's part, and only an app that is on, signed for that part to check.
      if (toPlatform) return refuse(403, 'forbidden', 'AUGUR’s own services reach each other inside the deployment, not through the gateway.');
      let grant: AppGrant | undefined;
      try {
        if (!grantsOf) throw new AppGrantsUnavailable('the gateway has no registry to ask');
        grant = await grantsOf(name);
      } catch (err) {
        if (!(err instanceof AppGrantsUnavailable)) throw err;
        req.log.error({ err: err.message, app: name }, 'app grants unavailable');
        return refuse(503, 'unavailable', 'Whether this app is on can’t be checked right now. Try again in a moment.');
      }
      if (!grant) return refuse(403, 'forbidden', `${name} isn’t installed here.`);
      if (!grant.on) return refuse(403, 'forbidden', `${appName(name, grant)} is turned off.`);
      req.signedCaller = await signedCallerHeaders(signer, req.caller, appClientId(name));
      if (!inFlight.take(name)) return refuse(503, 'unavailable', `${appName(name, grant)} is busy; try again in a moment.`);
      req.appCall = name;
      req.appCallName = appName(name, grant);
      return;
    } else if (req.caller && req.identity?.kind !== 'app' && !toPlatform && grantsOf) {
      // A person's plain call to an app (no host acting for the app: a direct API call, the run suite). An app on
      // the app contract has its part check callers for its client, `app-<id>` (spec 8.3), so the caller is signed
      // for that; a part on contract 2 checks for the app's id, as before. A gateway with no registry to ask
      // (no apps on the contract) signs for the id. A turned-off app is refused here in words naming it; one the
      // registry doesn't know is left to the catalogue check below.
      let grant: AppGrant | undefined;
      try {
        grant = await grantsOf(name, req.caller.workspace?.id);
      } catch (err) {
        if (!(err instanceof AppGrantsUnavailable)) throw err;
        req.log.error({ err: err.message, app: name }, 'app grants unavailable');
        return refuse(503, 'unavailable', 'Whether this app can be reached can’t be checked right now: AUGUR’s registry isn’t answering. Try again in a moment.');
      }
      if (grant && !grant.on) return refuse(403, 'forbidden', `${appName(name, grant)} is turned off${req.caller.workspace ? ' on this floor' : ''}.`);
      req.signedCaller = await signedCallerHeaders(signer, req.caller, grant?.contract !== undefined ? appClientId(name) : name);
    } else {
      req.signedCaller = req.caller ? await signedCallerHeaders(signer, req.caller, name) : undefined;
    }
    // The platform's services check their callers themselves.
    if (toPlatform || !req.caller) return;

    // An app's own token reaches only its own part; an app on for the person is one their catalogue lists.
    if (req.identity?.kind === 'app') {
      if (!inFlight.take(name)) return refuse(503, 'unavailable', `${appName(name, req.grant)} is busy; try again in a moment.`);
      req.appCall = name;
      req.appCallName = appName(name, req.grant);
      return;
    }
    let apps: Map<string, AppAllowed> | undefined;
    try {
      apps = appAccess ? await appAccess(await checkedOn(req.caller)) : undefined;
    } catch (err) {
      if (!(err instanceof AppAccessUnavailable) && !(err instanceof FloorLookupError)) throw err;
      req.log.error({ err: err.message }, 'app access check failed');
      return refuse(503, 'unavailable', 'Whether you can use this app can’t be checked right now. Try again in a moment.');
    }
    const allowed = apps?.get(name);
    if (apps && !allowed) return refuse(403, 'forbidden', `That app isn’t available to you${req.caller.workspace ? ' on this floor' : ''}.`);
    // Only so many calls to one app at once (spec 7.5); AUGUR's own routes are never held by this.
    if (!inFlight.take(name)) return refuse(503, 'unavailable', `${allowed?.name ?? 'This app'} is busy; try again in a moment.`);
    req.appCall = name;
    req.appCallName = allowed?.name ?? 'This app';
    // Bodies stream through, never held here.
    if (!(req.body instanceof Readable)) return;
    const mb = allowed?.maxUpload ?? DEFAULT_UPLOAD_MB;
    const tooLarge = `This is more than ${allowed?.name ?? 'this app'} takes at once (${mb} MB).`;
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
      // A part that can't be reached or doesn't answer in time, in words (spec 7.5).
      const failed = reply.request.appCall ? appFailure(error, reply.request.appCallName ?? 'This app') : undefined;
      if (failed) {
        reply.request.log.warn({ err: error.message, app: reply.request.appCall }, 'app call failed');
        return void reply.code(failed.status).send({ error: failed.status === 504 ? 'timeout' : 'bad_gateway', message: failed.message });
      }
      // As reply-from answers by default.
      reply.send(error);
    },
    rewriteRequestHeaders: (req: FastifyRequest['raw'] & { id?: string }, headers: IncomingHttpHeaders) => {
      const request = req as unknown as FastifyRequest;
      // Who is calling comes only from the verified token. A person's token stays here: it works on every platform API,
      // so no service, an app's least of all, is handed it. An app's own token goes on with its call, because the services
      // still read which app is calling from it (their second line, spec 8.3) and it reaches only AUGUR and the app's own part.
      // Every incoming x-augur-* and x-user-* header is dropped; the plain caller headers stay for apps that don't check the signed one yet.
      const { authorization, [CALLER_TOKEN_HEADER]: __, ...named } = withoutCallerHeaders(headers);
      const clean = Object.fromEntries(Object.entries(named).filter(([k]) => !isGatewayHeader(k)));
      const keepToken = request.identity?.kind === 'app' && authorization ? { authorization } : {};
      return { ...clean, ...keepToken, [REQUEST_ID_HEADER]: request.id, ...(request.caller ? { ...callerHeaders(request.caller), ...request.signedCaller } : {}) };
    },
  };

  // The platform's own services, and apps named in APP_UPSTREAMS: known when the gateway starts.
  for (const [name, upstream] of Object.entries(upstreams)) {
    await app.register(proxy, {
      upstream,
      prefix: `/api/${name}`,
      rewritePrefix: '',
      // An app's part is held to its timeouts (spec 7.5); AUGUR's own services keep the defaults.
      ...(PLATFORM_SERVICES.includes(name) ? {} : { undici: poolOptions(limits) }),
      // The signed caller is made before the request goes on, since signing is asynchronous.
      preHandler: (req, reply) => beforeProxy(name, req, reply),
      replyOptions: replyOptions as never,
    });
  }

  // Every other app: wherever the registry says its service is, set by whatever runs it. The routes
  // above are more specific, so the platform's services and APP_UPSTREAMS always win.
  if (appUpstreams) {
    await app.register(async (sub) => {
      await sub.register(replyFrom, { undici: poolOptions(limits) });
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
