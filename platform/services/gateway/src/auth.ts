import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import type { Caller } from '@platform/service-kit';

export interface AuthConfig {
  /** The sign-in service's issuer, exactly as it appears in tokens. */
  issuer: string;
  /** The audience tokens must be issued for. */
  audience: string;
  /** Where the issuer's signing keys come from. */
  keys: JWTVerifyGetKey;
}

/**
 * OIDC_ISSUER defaults to the local Keycloak realm. OIDC_JWKS_URL is only needed
 * when the gateway reaches the issuer at another address than browsers do, as in Docker.
 */
export const authFromEnv = (env = process.env): AuthConfig => {
  const issuer = env.OIDC_ISSUER ?? 'http://localhost:8180/realms/platform';
  const jwks = env.OIDC_JWKS_URL ?? `${issuer}/protocol/openid-connect/certs`;
  return { issuer, audience: env.OIDC_AUDIENCE ?? 'platform-api', keys: createRemoteJWKSet(new URL(jwks)) };
};

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
  return {
    id,
    name: str(claims.name) ?? str(claims.preferred_username) ?? id,
    ...(email ? { email } : {}),
    departments: strings(claims.departments),
    roles: strings(claims.roles),
  };
};

/** Verifies a request's bearer token and returns its caller. */
export const authenticate = async (authorization: string | undefined, config: AuthConfig): Promise<Caller> => {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw new AuthError('Sign in to continue.', 401);
  try {
    const { payload } = await jwtVerify(token, config.keys, { issuer: config.issuer, audience: config.audience });
    if (!payload.sub) throw new AuthError('Your sign-in is not valid. Sign in again.', 401);
    return callerFromClaims(payload);
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
