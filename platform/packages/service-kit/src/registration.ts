import { callService, type ServiceCredentials } from './service.js';

export interface RegisterOptions {
  /** The registry's internal address, e.g. http://registry:8082. */
  registryUrl: string;
  credentials: ServiceCredentials;
  /** The app's manifest.json. */
  manifest: { id: string } & Record<string, unknown>;
  attempts?: number;
  retryMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Puts an app in the platform's catalogue. Its service calls this when it
 * starts; it retries while the registry is not up yet.
 */
export async function registerApp({ registryUrl, credentials, manifest, attempts = 6, retryMs, fetchImpl }: RegisterOptions): Promise<void> {
  await callService({
    method: 'PUT',
    url: `${registryUrl.replace(/\/$/, '')}/apps/${encodeURIComponent(manifest.id)}`,
    credentials,
    body: manifest,
    what: `register ${manifest.id} with the registry`,
    attempts,
    retryMs,
    fetchImpl,
  });
}
