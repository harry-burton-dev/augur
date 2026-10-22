import { timingSafeEqual } from 'node:crypto';
import { WORKSPACE_HEADERS } from './caller.js';
import { type ServiceIdentity, type ServiceVerifier, type TokenSource } from './apps.js';

/**
 * How platform and app services prove to each other that a call comes from
 * inside: the environment's service token, plus the calling service's name.
 * The gateway strips both headers, so they cannot be sent from outside.
 */
export const SERVICE_TOKEN_HEADER = 'x-service-token';
export const SERVICE_NAME_HEADER = 'x-service-name';

/**
 * How a service proves who it is: its own sign-in (`getToken`, see apps.ts),
 * or the environment's shared service token, which is on its way out.
 */
export type ServiceCredentials =
  | {
      /** The calling service, e.g. "library"; recorded as the actor in the audit log. */
      name: string;
      token: string;
    }
  | { name: string; getToken: TokenSource };

export const serviceHeaders = async (credentials: ServiceCredentials): Promise<Record<string, string>> =>
  'getToken' in credentials
    ? { authorization: `Bearer ${await credentials.getToken()}` }
    : { [SERVICE_TOKEN_HEADER]: credentials.token, [SERVICE_NAME_HEADER]: credentials.name };

/** Removes service headers, so a client cannot pose as a service. The gateway calls this on every request. */
export const withoutServiceHeaders = <H extends Record<string, unknown>>(headers: H): H =>
  Object.fromEntries(
    Object.entries(headers).filter(([k]) => ![SERVICE_TOKEN_HEADER, SERVICE_NAME_HEADER].includes(k.toLowerCase())),
  ) as H;

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** The calling service's name when the request carries the right token, else undefined. No token configured means no service is trusted. */
export const serviceFromHeaders = (headers: Record<string, string | string[] | undefined>, expectedToken: string | undefined): string | undefined => {
  const token = headers[SERVICE_TOKEN_HEADER];
  if (!expectedToken || typeof token !== 'string' || !sameSecret(token, expectedToken)) return undefined;
  const name = headers[SERVICE_NAME_HEADER];
  return typeof name === 'string' && name ? name : 'service';
};

export interface ServiceCheck {
  /** Checks an app's or platform service's own token. */
  verify?: ServiceVerifier;
  /** The environment's shared service token; whoever has it counts as a platform service. */
  token?: string;
}

/**
 * Who sent a service call: an app or platform service by its own token, or a
 * holder of the shared service token (as a platform service), else undefined.
 * Throws ServiceAuthUnavailable when a token can't be checked right now.
 */
export const identifyService = async (headers: Record<string, string | string[] | undefined>, { verify, token }: ServiceCheck): Promise<ServiceIdentity | undefined> => {
  const legacy = serviceFromHeaders(headers, token);
  if (legacy) return { kind: 'platform', name: legacy };
  return verify ? verify(headers) : undefined;
};

export class ServiceCallError extends Error {}

export interface CallOptions {
  method: 'PUT' | 'POST';
  url: string;
  credentials: ServiceCredentials;
  body: unknown;
  /** What is being done, for the error message: "register library". */
  what: string;
  /** The floor the call is for, sent as X-Workspace-Id. */
  workspace?: string;
  attempts?: number;
  /** Delay before the first retry; doubles after each. */
  retryMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Calls another service, retrying while it is unreachable or failing. A refusal
 * (4xx: bad input, wrong token, a conflict) is not retried.
 */
export async function callService({ method, url, credentials, body, what, workspace, attempts = 1, retryMs = 500, fetchImpl = fetch }: CallOptions): Promise<unknown> {
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method,
        headers: { 'content-type': 'application/json', ...(workspace ? { [WORKSPACE_HEADERS.id]: encodeURIComponent(workspace) } : {}), ...(await serviceHeaders(credentials)) },
        body: JSON.stringify(body),
      });
      const reply = (await res.json().catch(() => ({}))) as { message?: string };
      if (res.ok) return reply;
      lastError = `it answered ${res.status}${reply.message ? `: ${reply.message.replace(/\.$/, '')}` : ''}`;
      if (res.status < 500) break;
    } catch (err) {
      lastError = `it could not be reached (${(err as Error).message})`;
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, retryMs * 2 ** (attempt - 1)));
  }
  throw new ServiceCallError(`Could not ${what}: ${lastError}.`);
}
