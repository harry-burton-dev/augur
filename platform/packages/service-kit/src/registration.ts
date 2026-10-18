/**
 * How an app's service puts its app in the platform's catalogue. It calls the
 * registry directly on the internal network with the environment's registration
 * token; the gateway strips this header, so it cannot be used from outside.
 */
export const REGISTRATION_TOKEN_HEADER = 'x-registration-token';

export interface RegisterOptions {
  /** The registry's internal address, e.g. http://registry:8082. */
  registryUrl: string;
  token: string;
  /** The app's manifest.json. */
  manifest: { id: string } & Record<string, unknown>;
  attempts?: number;
  /** Delay before the first retry; doubles after each. */
  retryMs?: number;
  fetchImpl?: typeof fetch;
}

export class RegistrationError extends Error {}

/**
 * Registers the app, retrying while the registry is not up yet. A refusal
 * (a bad manifest, a wrong token, a route another app has) is not retried.
 */
export async function registerApp({ registryUrl, token, manifest, attempts = 6, retryMs = 500, fetchImpl = fetch }: RegisterOptions): Promise<void> {
  const url = `${registryUrl.replace(/\/$/, '')}/apps/${encodeURIComponent(manifest.id)}`;
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', [REGISTRATION_TOKEN_HEADER]: token },
        body: JSON.stringify(manifest),
      });
      if (res.ok) return;
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      lastError = `the registry answered ${res.status}${body.message ? `: ${body.message.replace(/\.$/, '')}` : ''}`;
      if (res.status < 500) break;
    } catch (err) {
      lastError = `the registry could not be reached (${(err as Error).message})`;
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, retryMs * 2 ** (attempt - 1)));
  }
  throw new RegistrationError(`Could not register ${manifest.id}: ${lastError}.`);
}
