import { timingSafeEqual } from 'node:crypto';

/**
 * How platform and app services prove to each other that a call comes from
 * inside: the environment's service token, plus the calling service's name.
 * The gateway strips both headers, so they cannot be sent from outside.
 */
export const SERVICE_TOKEN_HEADER = 'x-service-token';
export const SERVICE_NAME_HEADER = 'x-service-name';

export interface ServiceCredentials {
  /** The calling service, e.g. "library"; recorded as the actor in the audit log. */
  name: string;
  token: string;
}

export const serviceHeaders = ({ name, token }: ServiceCredentials): Record<string, string> => ({
  [SERVICE_TOKEN_HEADER]: token,
  [SERVICE_NAME_HEADER]: name,
});

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

export class ServiceCallError extends Error {}

export interface CallOptions {
  method: 'PUT' | 'POST';
  url: string;
  credentials: ServiceCredentials;
  body: unknown;
  /** What is being done, for the error message: "register library". */
  what: string;
  attempts?: number;
  /** Delay before the first retry; doubles after each. */
  retryMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Calls another service, retrying while it is unreachable or failing. A refusal
 * (4xx: bad input, wrong token, a conflict) is not retried.
 */
export async function callService({ method, url, credentials, body, what, attempts = 1, retryMs = 500, fetchImpl = fetch }: CallOptions): Promise<unknown> {
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method,
        headers: { 'content-type': 'application/json', ...serviceHeaders(credentials) },
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
