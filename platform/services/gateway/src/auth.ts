import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { identityFromClientId, SERVICES_AUDIENCE, type Caller } from '@augur/service-kit';

export interface AuthConfig {
  /** The sign-in service's issuer, exactly as it appears in tokens. */
  issuer: string;
  /** The audience people's tokens are issued for. */
  audience: string;
  /**
   * The audience apps' and platform services' own tokens are issued for (client credentials, spec 8.2).
   * `platform-services` unless the deployment says otherwise (OIDC_SERVICE_AUDIENCE).
   */
  serviceAudience?: string;
  /** Where the issuer's signing keys come from. */
  keys: JWTVerifyGetKey;
  /** The address `keys` come from, when they come from the network; Status checks it. */
  keysUrl?: string;
  /** The issuer's token endpoint as the gateway reaches it, which a part's client-credentials grant is passed on to (spec 8.4). */
  tokenUrl?: string;
}

/** The setting that changes which audience service tokens must carry. */
export const SERVICE_AUDIENCE_SETTING = 'OIDC_SERVICE_AUDIENCE';

/**
 * OIDC_ISSUER defaults to the local Keycloak realm. OIDC_JWKS_URL is only needed
 * when the gateway reaches the issuer at another address than browsers do, as in Docker;
 * OIDC_INTERNAL_URL (or OIDC_TOKEN_URL) likewise says where the token endpoint is reached.
 */
export const authFromEnv = (env = process.env): AuthConfig => {
  const issuer = env.OIDC_ISSUER ?? 'http://localhost:8180/realms/platform';
  const jwks = env.OIDC_JWKS_URL ?? `${issuer}/protocol/openid-connect/certs`;
  const tokenUrl = env.OIDC_TOKEN_URL ?? `${(env.OIDC_INTERNAL_URL ?? issuer).replace(/\/$/, '')}/protocol/openid-connect/token`;
  return { issuer, audience: env.OIDC_AUDIENCE ?? 'platform-api', serviceAudience: env[SERVICE_AUDIENCE_SETTING] ?? SERVICES_AUDIENCE, keys: createRemoteJWKSet(new URL(jwks)), keysUrl: jwks, tokenUrl };
};

/** Where the gateway fetches signing keys from, which is the sign-in service as the gateway reaches it. */
export const signInKeysUrl = (config: AuthConfig): string | undefined => config.keysUrl;

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 503,
  ) {
    super(message);
  }
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

/** Who a verified token is for. `departments` and `roles` are claims the sign-in service adds. */
export const callerFromClaims = (claims: JWTPayload): Caller => {
  const id = String(claims.sub);
  const email = str(claims.email);
  const authTime = typeof claims.auth_time === 'number' ? new Date(claims.auth_time * 1000).toISOString() : undefined;
  return {
    id,
    name: str(claims.name) ?? str(claims.preferred_username) ?? id,
    ...(email ? { email } : {}),
    departments: strings(claims.departments),
    roles: strings(claims.roles),
    // When they last entered their password, for what needs a fresh sign-in.
    ...(authTime ? { signedInAt: authTime } : {}),
  };
};

/**
 * Who a verified token belongs to (spec 8.2): a person, an app's own service (client `app-<id>`), or one of
 * AUGUR's own services (client `platform-<name>`). Which is decided by the token's audience; the client comes
 * from `azp`, which Keycloak sets on a client-credentials token (`client_id` where an issuer uses that instead).
 */
export type Authenticated = { kind: 'person'; caller: Caller } | { kind: 'app'; app: string } | { kind: 'service'; service: string };

/** The token's client, for a service token. */
const clientOf = (claims: JWTPayload): string | undefined => str(claims.azp) ?? str(claims.client_id);

/**
 * Verifies a request's bearer token and says whose it is. A person's token must carry the person audience,
 * a service's the service audience; anything else is refused.
 */
export const authenticate = async (authorization: string | undefined, config: AuthConfig): Promise<Authenticated> => {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw new AuthError('Sign in to continue.', 401);
  const serviceAudience = config.serviceAudience ?? SERVICES_AUDIENCE;
  try {
    const { payload } = await jwtVerify(token, config.keys, { issuer: config.issuer, audience: [config.audience, serviceAudience] });
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (audiences.includes(config.audience)) {
      if (!payload.sub) throw new AuthError('Your sign-in is not valid. Sign in again.', 401);
      return { kind: 'person', caller: callerFromClaims(payload) };
    }
    const client = clientOf(payload);
    const identity = client ? identityFromClientId(client) : undefined;
    if (!identity) throw new AuthError('Your sign-in is not valid. Sign in again.', 401);
    return identity.kind === 'app' ? { kind: 'app', app: identity.app } : { kind: 'service', service: identity.name };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    if (err instanceof errors.JWTExpired) throw new AuthError('Your sign-in has expired. Sign in again.', 401);
    // Keys we could not fetch say nothing about the token: the sign-in service is unreachable.
    if (err instanceof errors.JWKSTimeout || !(err instanceof errors.JOSEError)) {
      throw new AuthError('Sign-in is unavailable right now.', 503);
    }
    throw new AuthError('Your sign-in is not valid. Sign in again.', 401);
  }
};
