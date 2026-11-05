import { WORKSPACE_HEADERS } from './caller.js';
import { serviceTimeoutMs, withDeadline } from './deadline.js';
import { type ServiceIdentity, type ServiceVerifier, type TokenSource } from './apps.js';

/**
 * How a service proves who it is to another: its own sign-in, a short-lived
 * token for its Keycloak client (see apps.ts), sent as a bearer token.
 */
export interface ServiceCredentials {
  /** The calling service, e.g. "library"; recorded as the actor in the audit log. */
  name: string;
  getToken: TokenSource;
}

export const serviceHeaders = async (credentials: ServiceCredentials): Promise<Record<string, string>> => ({
  authorization: `Bearer ${await credentials.getToken()}`,
});

/**
 * Who sent a service call: an app or platform service, by its own token; else
 * undefined (a person's token is neither). Throws ServiceAuthUnavailable when
 * the token can't be checked right now.
 */
export const identifyService = async (headers: Record<string, string | string[] | undefined>, verify: ServiceVerifier | undefined): Promise<ServiceIdentity | undefined> =>
  verify ? verify(headers) : undefined;

export class ServiceCallError extends Error {}

export interface CallOptions {
  method: 'PUT' | 'POST' | 'PATCH' | 'GET';
  url: string;
  credentials: ServiceCredentials;
  /** Sent as JSON; none for a GET. */
  body?: unknown;
  /** What is being done, for the error message: "register library". */
  what: string;
  /** The floor the call is for, sent as X-Workspace-Id. */
  workspace?: string;
  attempts?: number;
  /** Delay before the first retry; doubles after each. */
  retryMs?: number;
  fetchImpl?: typeof fetch;
  /** How long each attempt may take: serviceTimeoutMs() (a few seconds) unless the call needs longer. */
  timeoutMs?: number;
}

/**
 * Calls another service, retrying while it is unreachable or failing. A refusal
 * (4xx: bad input, wrong token, a conflict) is not retried.
 */
export async function callService({ method, url, credentials, body, what, workspace, attempts = 1, retryMs = 500, fetchImpl = fetch, timeoutMs = serviceTimeoutMs() }: CallOptions): Promise<unknown> {
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await withDeadline(fetchImpl, timeoutMs)(url, {
        method,
        headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(workspace ? { [WORKSPACE_HEADERS.id]: encodeURIComponent(workspace) } : {}), ...(await serviceHeaders(credentials)) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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
