import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * Each app's service signs in to the platform as itself: a Keycloak client
 * named `app-<id>` with its own secret, which gets short-lived tokens with the
 * client-credentials grant. Platform services check those tokens, then what the
 * app is granted on the floor a call is for. Keycloak only says which app is
 * calling; the registry says what it may do, floor by floor.
 */

/** What an app can be granted. An app always may register itself; everything else it asks for in its manifest's `scopes`. */
export const SCOPES = ['notifications:send', 'audit:write', 'models:use', 'events:publish', 'events:subscribe', 'people:read', 'inbox:write'] as const;
export type Scope = (typeof SCOPES)[number];

/** The audience every app and platform service token is issued for. */
export const SERVICES_AUDIENCE = 'platform-services';

/** The Keycloak client an app signs in as. */
export const appClientId = (app: string) => `app-${app}`;
/** The Keycloak client a platform service signs in as. */
export const platformClientId = (service: string) => `platform-${service}`;

/** Who a service call comes from: an app's service, or one of the platform's own. */
export type ServiceIdentity = { kind: 'app'; app: string } | { kind: 'platform'; name: string };

/** The name a service call is recorded under: the app's id, or the platform service's name. */
export const serviceName = (who: ServiceIdentity) => (who.kind === 'app' ? who.app : who.name);

export const identityFromClientId = (clientId: string): ServiceIdentity | undefined => {
  const app = /^app-([a-z][a-z0-9-]{1,39})$/.exec(clientId)?.[1];
  if (app) return { kind: 'app', app };
  const name = /^platform-([a-z][a-z0-9-]{1,39})$/.exec(clientId)?.[1];
  return name ? { kind: 'platform', name } : undefined;
};

/** Gets a current access token; cached until shortly before it expires. */
export type TokenSource = () => Promise<string>;

export class ServiceTokenError extends Error {}

export interface ClientCredentialsOptions {
  /** The sign-in service's token endpoint, as this service reaches it. */
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** Signs in as a client with its secret, and keeps the token until 30 seconds before it expires. */
export const clientCredentials = ({ tokenUrl, clientId, clientSecret, fetchImpl = fetch, now = Date.now }: ClientCredentialsOptions): TokenSource => {
  let cached: { value: string; expires: number } | undefined;
  let pending: Promise<string> | undefined;
  const fetchToken = async () => {
    let res: Response;
    try {
      res = await fetchImpl(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
      });
    } catch (err) {
      throw new ServiceTokenError(`${clientId} could not reach the sign-in service (${(err as Error).message}).`);
    }
    if (!res.ok) throw new ServiceTokenError(`${clientId} could not sign in: the sign-in service answered ${res.status}. Check its client secret.`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    cached = { value: body.access_token, expires: now() + body.expires_in * 1000 };
    return body.access_token;
  };
  return async () => {
    if (cached && cached.expires - 30_000 > now()) return cached.value;
    pending ??= fetchToken().finally(() => (pending = undefined));
    return pending;
  };
};

export interface ServiceAuthConfig {
  /** The sign-in service's issuer, exactly as it appears in tokens. */
  issuer: string;
  keys: JWTVerifyGetKey;
  audience?: string;
}

/**
 * Where a service finds the sign-in service: OIDC_ISSUER as tokens name it, and
 * OIDC_JWKS_URL / OIDC_TOKEN_URL when this service reaches it at another
 * address (inside Docker). Locally it is the dev stack's Keycloak.
 */
export const serviceAuthFromEnv = (env = process.env) => {
  const issuer = env.OIDC_ISSUER ?? 'http://localhost:8180/realms/platform';
  const internal = env.OIDC_INTERNAL_URL?.replace(/\/$/, '') ?? issuer;
  return {
    issuer,
    tokenUrl: env.OIDC_TOKEN_URL ?? `${internal}/protocol/openid-connect/token`,
    jwksUrl: env.OIDC_JWKS_URL ?? `${internal}/protocol/openid-connect/certs`,
  };
};

/** This service's own sign-in, from SERVICE_CLIENT_SECRET; undefined when it has none. */
export const tokenSourceFromEnv = (clientId: string, env = process.env): TokenSource | undefined => {
  const secret = env.SERVICE_CLIENT_SECRET;
  return secret ? clientCredentials({ tokenUrl: serviceAuthFromEnv(env).tokenUrl, clientId, clientSecret: secret }) : undefined;
};

/** Checks the tokens apps and platform services send, with the sign-in service's keys. */
export const serviceVerifierFromEnv = (env = process.env) => {
  const { issuer, jwksUrl } = serviceAuthFromEnv(env);
  return serviceVerifier({ issuer, keys: createRemoteJWKSet(new URL(jwksUrl)) });
};

/** A token we could not check because the sign-in service is out of reach, as opposed to a bad one. */
export class ServiceAuthUnavailable extends Error {}

/**
 * Who sent a service call, from its bearer token: undefined when there is no
 * token or it isn't a valid app or platform-service token (a person's token is
 * neither). Throws ServiceAuthUnavailable when the keys can't be fetched.
 */
export const serviceVerifier =
  ({ issuer, keys, audience = SERVICES_AUDIENCE }: ServiceAuthConfig) =>
  async (headers: Record<string, string | string[] | undefined>): Promise<ServiceIdentity | undefined> => {
    const authorization = headers.authorization;
    const token = typeof authorization === 'string' ? authorization.match(/^Bearer\s+(\S+)$/i)?.[1] : undefined;
    if (!token) return undefined;
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience });
      return typeof payload.azp === 'string' ? identityFromClientId(payload.azp) : undefined;
    } catch (err) {
      if (err instanceof errors.JWKSTimeout || !(err instanceof errors.JOSEError)) throw new ServiceAuthUnavailable('The sign-in service can’t be reached to check this call.');
      return undefined;
    }
  };

export type ServiceVerifier = ReturnType<typeof serviceVerifier>;

/** How an app's service signs in, from its environment (SERVICE_CLIENT_SECRET, issued by an admin); undefined without it. */
export const appCredentialsFromEnv = (app: string, env = process.env): { name: string; getToken: TokenSource } | undefined => {
  const getToken = tokenSourceFromEnv(appClientId(app), env);
  return getToken ? { name: app, getToken } : undefined;
};

/** How a platform service signs in, from its environment (SERVICE_CLIENT_SECRET); undefined without it. */
export const platformCredentialsFromEnv = (service: string, env = process.env): { name: string; getToken: TokenSource } | undefined => {
  const getToken = tokenSourceFromEnv(platformClientId(service), env);
  return getToken ? { name: service, getToken } : undefined;
};
