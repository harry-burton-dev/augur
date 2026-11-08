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

/**
 * Signs with the Ed25519 key made from `seed` (32 bytes, hex). Without one a new
 * key is made each start: services fetch the key again when it changes, so this
 * is enough for one gateway. More than one behind a load balancer must share a seed.
 */
export const callerSigner = (seed?: string): CallerSigner => {
  const bytes = seed ? Buffer.from(seed, 'hex') : randomBytes(32);
  if (bytes.length !== 32) throw new Error('CALLER_SIGNING_KEY must be 64 hex characters (openssl rand -hex 32).');
  const privateKey: KeyObject = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, bytes]), format: 'der', type: 'pkcs8' });
  const published = (async () => {
    const jwk = await exportJWK(createPublicKey(privateKey));
    return { ...jwk, kid: await calculateJwkThumbprint(jwk), alg: 'EdDSA', use: 'sig' };
  })();
  return {
    async sign(caller, audience, { lifetimeSeconds = LIFETIME_SECONDS } = {}) {
      const { kid } = await published;
      return new SignJWT({
        name: caller.name,
        ...(caller.email ? { email: caller.email } : {}),
        departments: caller.departments,
        roles: caller.roles,
        ...(caller.workspace ? { workspace: caller.workspace } : {}),
        ...(caller.signedInAt ? { signedInAt: caller.signedInAt } : {}),
        ...(caller.app ? { app: caller.app, scopes: caller.scopes ?? [] } : {}),
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
      return { keys: [await published] };
    },
  };
};

export const callerSignerFromEnv = (env = process.env): CallerSigner => callerSigner(env.CALLER_SIGNING_KEY || undefined);

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
  const url = env.CALLER_KEYS_URL || `${(env.GATEWAY_URL || 'http://gateway:8080').replace(/\/+$/, '')}${CALLER_KEYS_PATH}`;
  // A new gateway key is fetched as soon as a token names it, at most every few seconds.
  return callerCheck({ audience, keys: createRemoteJWKSet(new URL(url), { cooldownDuration: 5_000 }) });
};

type HeaderBag = Record<string, string | string[] | undefined>;
const PERSON_HEADERS: readonly string[] = [...Object.values(CALLER_HEADERS), WORKSPACE_HEADERS.kind, WORKSPACE_HEADERS.role, ...Object.values(DELEGATION_HEADERS)];

const LOOPBACK: readonly string[] = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

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
 * A call from inside the service's own container (loopback) is believed as it
 * comes: only someone who can already run commands there can make one, and it
 * is how a server admin acts as someone when the platform can't sign them in
 * (`docker compose exec registry node -e "fetch('http://localhost:8082/…')"`).
 *
 *     app.addHook('onRequest', signedCallers(callerCheckFromEnv('identity')));
 */
export const signedCallers = (check: CallerCheck | undefined) => async (req: HookRequest, reply: HookReply) => {
  if (!check || LOOPBACK.includes(req.ip)) return;
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
