import { createPrivateKey, createPublicKey, randomBytes, type KeyObject } from 'node:crypto';
import { calculateJwkThumbprint, createLocalJWKSet, createRemoteJWKSet, errors, exportJWK, jwtVerify, SignJWT, type JSONWebKeySet, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { CALLER_HEADERS, callerHeaders, DELEGATION_HEADERS, WORKSPACE_HEADERS, type Caller, type CallerWorkspace } from './caller.js';

/**
 * The gateway signs the caller it passes on, so a service believes a person is
 * calling only when the gateway says so. Anyone else on the network can still
 * send `x-user-*` headers; a service that checks callers drops them and reads
 * the person from this one header, a short-lived token for that service alone.
 */
export const CALLER_TOKEN_HEADER = 'x-augur-caller';

/** Where the gateway publishes the keys it signs callers with. No sign-in is needed: they are public keys. */
export const CALLER_KEYS_PATH = '/api/gateway/v1/caller-keys';

/**
 * The gateway itself, when it asks a platform service something for its own work (such as
 * where each app's service is), signed like any caller. Only the gateway signs callers, and
 * a person's id is their sign-in subject, so no person can be this one.
 */
export const GATEWAY_CALLER: Caller = { id: 'augur:gateway', name: 'Gateway', departments: [], roles: [] };
export const isGatewayCaller = (caller?: Pick<Caller, 'id'>) => caller?.id === GATEWAY_CALLER.id;

/** Where the gateway is inside a deployment, when GATEWAY_URL doesn't say. */
export const DEFAULT_GATEWAY_URL = 'http://gateway:8080';

/**
 * The id of the caller the gateway signs when one of AUGUR's own services calls an app's part through it
 * (contract 3, spec 8.6: the events service pushing an event): `augur:<service>`, no person. Only the gateway
 * signs callers and a person's id is their sign-in subject, so nothing else can be one.
 */
export const serviceCallerId = (service: string): string => `augur:${service}`;
/** The caller for one of AUGUR's own services, as the gateway signs it for a part. */
export const callerOfService = (service: string): Caller => ({ id: serviceCallerId(service), name: service, departments: [], roles: [] });
/**
 * The fleet's machine client (ADR 0100): a program that runs deployments from files, signed in as the Keycloak
 * client `platform-fleet`. Through the gateway it reaches only the registry's routes that read and change what the
 * server runs. It comes from outside the deployment, so it is not one of AUGUR's own services: its caller id is
 * `client:platform-fleet`, which isServiceCaller doesn't take, and a service decides what it may do by isFleetCaller.
 */
export const FLEET_SERVICE = 'fleet';
/** The fleet client's Keycloak client: the name its changes are recorded under. */
export const FLEET_CLIENT_ID = `platform-${FLEET_SERVICE}`;
/** The caller the gateway signs for the fleet's client. No person's id has a colon (it is their sign-in subject). */
export const FLEET_CALLER: Caller = { id: `client:${FLEET_CLIENT_ID}`, name: FLEET_CLIENT_ID, departments: [], roles: [] };
/** Whether a caller is the fleet's client, as the gateway signs it. */
export const isFleetCaller = (caller?: Pick<Caller, 'id'>): boolean => caller?.id === FLEET_CALLER.id;

/** Whether a caller is one of AUGUR's own services (the gateway included) rather than a person or an app. */
export const isServiceCaller = (caller?: Pick<Caller, 'id'>): boolean => typeof caller?.id === 'string' && caller.id.startsWith('augur:');
/** Which of AUGUR's services a service caller is; undefined for anyone else. */
export const serviceOfCaller = (caller?: Pick<Caller, 'id'>): string | undefined => (isServiceCaller(caller) ? caller!.id.slice('augur:'.length) : undefined);

/** How long a signed caller lasts. It is made per request, so a minute is plenty and a copied one soon stops working. */
export const CALLER_LIFETIME_SECONDS = 60;
/** The issuer every signed caller names: the gateway, the only thing that signs them. */
export const CALLER_ISSUER = 'augur-gateway';
const LIFETIME_SECONDS = CALLER_LIFETIME_SECONDS;
const ISSUER = CALLER_ISSUER;

export interface SignOptions {
  /**
   * How long the token lasts, in seconds; the minute of `CALLER_LIFETIME_SECONDS` unless said. A
   * delegated caller (contract 3) lasts `APP_DELEGATION_SECONDS`, because a part carries it on its
   * own later calls for the person.
   */
  lifetimeSeconds?: number;
}

export interface CallerSigner {
  /** A token naming the caller, which only `audience` (the service it is sent to) accepts. */
  sign(caller: Caller, audience: string, options?: SignOptions): Promise<string>;
  /** The public key, for services to check tokens with. */
  keys(): Promise<JSONWebKeySet>;
}

// An Ed25519 private key is its 32-byte seed behind this fixed PKCS#8 prefix.
const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex');

/** Where a signing key comes from: 32 bytes, as 64 hex characters (`openssl rand -hex 32`). */
const keyFrom = (seed: string | undefined, setting: string): KeyObject => {
  if (seed && !/^[0-9a-fA-F]{64}$/.test(seed)) throw new Error(`${setting} must be 64 hex characters (openssl rand -hex 32).`);
  const bytes = seed ? Buffer.from(seed, 'hex') : randomBytes(32);
  if (bytes.length !== 32) throw new Error(`${setting} must be 64 hex characters (openssl rand -hex 32).`);
  return createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, bytes]), format: 'der', type: 'pkcs8' });
};
const publicJwk = async (privateKey: KeyObject) => {
  const jwk = await exportJWK(createPublicKey(privateKey));
  return { ...jwk, kid: await calculateJwkThumbprint(jwk), alg: 'EdDSA', use: 'sig' };
};

export interface SignerOptions {
  /**
   * The key that comes next (CALLER_SIGNING_KEY_NEXT), published beside the current one but never signed with, so
   * every service already knows it when it becomes the current key: docs/signed-caller.md, "Changing the key".
   */
  next?: string;
}

/**
 * Signs with the Ed25519 key made from `seed` (32 bytes, hex). Without one a new key is made each start, which only
 * `pnpm dev:app` and tests may do (`callerSignerFromEnv`): a deployment gives every gateway the same CALLER_SIGNING_KEY.
 */
export const callerSigner = (seed?: string, { next }: SignerOptions = {}): CallerSigner => {
  const privateKey = keyFrom(seed, 'CALLER_SIGNING_KEY');
  const nextKey = next ? keyFrom(next, 'CALLER_SIGNING_KEY_NEXT') : undefined;
  if (next && seed && next.toLowerCase() === seed.toLowerCase()) throw new Error('CALLER_SIGNING_KEY_NEXT is the same as CALLER_SIGNING_KEY: give it the key that comes next, or leave it empty.');
  const current = publicJwk(privateKey);
  const published = (async () => [await current, ...(nextKey ? [await publicJwk(nextKey)] : [])])();
  return {
    async sign(caller, audience, { lifetimeSeconds = LIFETIME_SECONDS } = {}) {
      const { kid } = await current;
      return new SignJWT({
        name: caller.name,
        ...(caller.email ? { email: caller.email } : {}),
        departments: caller.departments,
        roles: caller.roles,
        ...(caller.workspace ? { workspace: caller.workspace } : {}),
        ...(caller.signedInAt ? { signedInAt: caller.signedInAt } : {}),
        ...(caller.app ? { app: caller.app, scopes: caller.scopes ?? [] } : {}),
        ...(caller.persona ? { persona: caller.persona } : {}),
      })
        .setProtectedHeader({ alg: 'EdDSA', kid })
        .setSubject(caller.id)
        .setIssuer(ISSUER)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(`${lifetimeSeconds}s`)
        .sign(privateKey);
    },
    async keys() {
      return { keys: await published };
    },
  };
};

/**
 * The gateway's signer, from CALLER_SIGNING_KEY and CALLER_SIGNING_KEY_NEXT. In production (NODE_ENV=production, as
 * every image sets) the key is required: a gateway that made up its own would sign callers no second gateway, and no
 * restart of this one, could check.
 */
export const callerSignerFromEnv = (env = process.env): CallerSigner => {
  const seed = env.CALLER_SIGNING_KEY || undefined;
  if (!seed && env.NODE_ENV === 'production') {
    throw new Error('CALLER_SIGNING_KEY isn’t set, and the gateway needs it to sign callers: put one in .env on the server (openssl rand -hex 32), then start the gateway again (docs/signed-caller.md).');
  }
  return callerSigner(seed, { next: env.CALLER_SIGNING_KEY_NEXT || undefined });
};

/** A signed caller that is missing, forged, expired or for another service. */
export class CallerTokenError extends Error {}
/** The gateway's keys can't be fetched, so no signed caller can be checked right now. */
export class CallerKeysUnavailable extends Error {}

/** Checks a signed caller and returns who it names. */
export type CallerCheck = (token: string) => Promise<Caller>;

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
const KINDS: readonly string[] = ['personal', 'team', 'org'];

export const callerFromClaims = (claims: JWTPayload): Caller => {
  const w = claims.workspace as Partial<CallerWorkspace> | undefined;
  const app = typeof claims.app === 'string' ? claims.app : undefined;
  const email = typeof claims.email === 'string' ? claims.email : undefined;
  const signedInAt = typeof claims.signedInAt === 'string' && !Number.isNaN(Date.parse(claims.signedInAt)) ? claims.signedInAt : undefined;
  const persona = typeof claims.persona === 'string' ? claims.persona : undefined;
  return {
    id: String(claims.sub),
    name: typeof claims.name === 'string' ? claims.name : String(claims.sub),
    ...(email ? { email } : {}),
    departments: strings(claims.departments),
    roles: strings(claims.roles),
    ...(signedInAt ? { signedInAt } : {}),
    ...(w && typeof w.id === 'string' && typeof w.kind === 'string' && KINDS.includes(w.kind)
      ? { workspace: { id: w.id, kind: w.kind, role: w.role === 'lead' ? 'lead' : 'member' } }
      : {}),
    ...(app ? { app, scopes: strings(claims.scopes) } : {}),
    ...(persona ? { persona } : {}),
  };
};

export interface CallerCheckOptions {
  /** This service's name as the gateway reaches it (`identity`, or an app's id): tokens for any other service are refused. */
  audience: string;
  keys: JWTVerifyGetKey;
}

export const callerCheck = ({ audience, keys }: CallerCheckOptions): CallerCheck => async (token) => {
  try {
    const { payload } = await jwtVerify(token, keys, { issuer: ISSUER, audience, algorithms: ['EdDSA'], clockTolerance: 10 });
    if (!payload.sub) throw new CallerTokenError('The signed caller names nobody.');
    return callerFromClaims(payload);
  } catch (err) {
    if (err instanceof CallerTokenError) throw err;
    if (err instanceof errors.JWKSTimeout || !(err instanceof errors.JOSEError)) throw new CallerKeysUnavailable((err as Error).message);
    throw new CallerTokenError(err.code === 'ERR_JWT_EXPIRED' ? 'The signed caller has expired.' : 'The signed caller is not valid.');
  }
};

/** A check against a signer in the same process, for tests: sign a caller as the gateway would and send it. */
export const callerCheckFor = (signer: CallerSigner, audience: string): CallerCheck => {
  const keys = signer.keys().then(createLocalJWKSet);
  return callerCheck({ audience, keys: async (header, token) => (await keys)(header, token) });
};

/** How long a service keeps the gateway's published keys before fetching them again. */
export const CALLER_KEYS_MAX_AGE_MS = 60_000;

/** The setting that lets a service believe `x-user-*` headers unchecked: `pnpm dev:app` and local runs only. */
export const INSECURE_DEV_CALLERS = 'AUGUR_INSECURE_DEV_CALLERS';

/**
 * Checks callers against the gateway's published key: at CALLER_KEYS_URL when set, otherwise at
 * GATEWAY_URL (default `http://gateway:8080`). It fails closed: a service checks callers unless it is
 * told plainly not to, with AUGUR_INSECURE_DEV_CALLERS=1 (as `pnpm dev:app` sets) or inside Vitest
 * (NODE_ENV=test and VITEST, both of which it sets; NODE_ENV=test alone is not enough). Then it
 * returns undefined and `x-user-*` headers are believed as they come. In production
 * (NODE_ENV=production, which every image, compose service and app container sets) callers are
 * always checked.
 */
export const callerCheckFromEnv = (audience: string, env = process.env): CallerCheck | undefined => {
  const unchecked = env.NODE_ENV !== 'production' && (env[INSECURE_DEV_CALLERS] === '1' || (env.NODE_ENV === 'test' && Boolean(env.VITEST)));
  if (unchecked && !env.CALLER_KEYS_URL) return undefined;
  const url = env.CALLER_KEYS_URL || `${(env.GATEWAY_URL || DEFAULT_GATEWAY_URL).replace(/\/+$/, '')}${CALLER_KEYS_PATH}`;
  // A new gateway key is fetched as soon as a token names it, at most every few seconds, and the whole set at least
  // every minute: a key the gateway publishes as the next one is known within a minute, and one it drops is forgotten.
  return callerCheck({ audience, keys: createRemoteJWKSet(new URL(url), { cooldownDuration: 5_000, cacheMaxAge: CALLER_KEYS_MAX_AGE_MS }) });
};

type HeaderBag = Record<string, string | string[] | undefined>;
const PERSON_HEADERS: readonly string[] = [...Object.values(CALLER_HEADERS), WORKSPACE_HEADERS.kind, WORKSPACE_HEADERS.role, ...Object.values(DELEGATION_HEADERS)];

const LOOPBACK: readonly string[] = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

/**
 * The setting that lets a server admin act as someone from inside a service's own container, when AUGUR can't sign
 * them in (docs/signed-caller.md, "Break-glass"). Only `on` turns it on; it is off unless an admin sets it for a
 * service and restarts it, and every call it lets through is logged.
 */
export const BREAK_GLASS = 'CALLER_BREAK_GLASS';
export const breakGlassFromEnv = (env = process.env): boolean => env[BREAK_GLASS] === 'on';

export interface SignedCallersOptions {
  /** Believe `x-user-*` headers on a call from inside the container (loopback). CALLER_BREAK_GLASS=on unless said. */
  breakGlass?: boolean;
}

interface HookRequest {
  headers: HeaderBag;
  ip: string;
  log: { warn: (obj: object, msg: string) => void };
}
interface HookReply {
  code(status: number): { send(body: unknown): unknown };
}

/**
 * A Fastify `onRequest` hook that makes `callerFromHeaders` read only what the
 * gateway signed. It drops any `x-user-*` headers a request brings, then puts
 * back the caller from a valid signed token. A request with a bad token is
 * refused; one without a token is treated as having no caller, which is how a
 * service's own calls arrive. Without a check (AUGUR_INSECURE_DEV_CALLERS=1, tests) it changes nothing.
 *
 * A call from inside the service's own container (loopback) is checked like any other. Only with break-glass
 * on (CALLER_BREAK_GLASS=on, set by a server admin for that service) is it believed as it comes, and each one is
 * logged: it is how an admin acts as someone when AUGUR can't sign them in
 * (`docker compose exec registry node -e "fetch('http://localhost:8082/…')"`).
 *
 *     app.addHook('onRequest', signedCallers(callerCheckFromEnv('identity')));
 */
export const signedCallers = (check: CallerCheck | undefined, { breakGlass = breakGlassFromEnv() }: SignedCallersOptions = {}) => async (req: HookRequest, reply: HookReply) => {
  if (!check) return;
  if (breakGlass && LOOPBACK.includes(req.ip)) {
    // Only a call that names someone is logged: the container's own health checks name nobody.
    if (req.headers[CALLER_HEADERS.id] !== undefined) req.log.warn({ caller: req.headers[CALLER_HEADERS.id] }, `believed a caller from inside the container (${BREAK_GLASS}=on, break-glass)`);
    return;
  }
  const raw = req.headers[CALLER_TOKEN_HEADER];
  const token = Array.isArray(raw) ? raw[0] : raw;
  for (const name of PERSON_HEADERS) delete req.headers[name];
  delete req.headers[CALLER_TOKEN_HEADER];
  if (!token) return;
  try {
    const caller = await check(token);
    // The floor in the token is the one the gateway checked; any other the request names is not the caller's.
    delete req.headers[WORKSPACE_HEADERS.id];
    Object.assign(req.headers, callerHeaders(caller));
  } catch (err) {
    if (err instanceof CallerTokenError) {
      req.log.warn({ reason: err.message }, 'refused a signed caller');
      return reply.code(401).send({ error: 'unauthenticated', message: 'Sign in to continue.' });
    }
    if (err instanceof CallerKeysUnavailable) {
      req.log.warn({ reason: err.message }, 'gateway keys unavailable');
      return reply.code(503).send({ error: 'unavailable', message: 'Sign-in can’t be checked right now. Try again in a moment.' });
    }
    throw err;
  }
};

/** The headers the gateway sends a service for a caller: the signed token, for that service only. */
export const signedCallerHeaders = async (signer: CallerSigner, caller: Caller, audience: string): Promise<Record<string, string>> => ({
  [CALLER_TOKEN_HEADER]: await signer.sign(caller, audience),
});
