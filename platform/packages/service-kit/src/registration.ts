import { callService, serviceHeaders, ServiceCallError, type ServiceCredentials } from './service.js';
import { withDeadline } from './deadline.js';

export interface RegisterOptions {
  /** The registry's internal address, e.g. http://registry:8082. */
  registryUrl: string;
  credentials: ServiceCredentials;
  /** The app's manifest.json. */
  manifest: { id: string } & Record<string, unknown>;
  attempts?: number;
  retryMs?: number;
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
}

/**
 * Puts an app in the platform's catalogue. Its service calls this when it
 * starts; it retries while the registry is not up yet. Under a deployment's
 * app runner (APP_REGISTERED_BY=runner) it does nothing and answers false: the
 * runner registers the version itself once it has passed its health check, so
 * a version that never comes up is never offered.
 */
export async function registerApp({ registryUrl, credentials, manifest, attempts = 6, retryMs, fetchImpl, env = process.env }: RegisterOptions): Promise<boolean> {
  if (env.APP_REGISTERED_BY === 'runner') return false;
  await callService({
    method: 'PUT',
    url: `${registryUrl.replace(/\/$/, '')}/v1/apps/${encodeURIComponent(manifest.id)}`,
    credentials,
    body: manifest,
    what: `register ${manifest.id} with the registry`,
    attempts,
    retryMs,
    fetchImpl,
  });
  return true;
}

export interface SettingsOptions {
  /** The registry's internal address, e.g. http://registry:8082. */
  registryUrl: string;
  credentials: ServiceCredentials;
  /** The app's id. */
  app: string;
  fetchImpl?: typeof fetch;
}

/**
 * The app's own settings (its manifest's `settings`) as admins set them in Admin, Apps,
 * by setting id: an admin's value, or the setting's default. Ask again whenever the value
 * is about to be used, since an admin can change it at any time. Throws ServiceCallError
 * when the registry can't say.
 */
export async function appSettings({ registryUrl, credentials, app, fetchImpl = fetch }: SettingsOptions): Promise<Record<string, number>> {
  const what = `read ${app}'s settings from the registry`;
  const res = await withDeadline(fetchImpl)(`${registryUrl.replace(/\/$/, '')}/v1/apps/${encodeURIComponent(app)}/settings`, { headers: await serviceHeaders(credentials) }).catch((err: Error) => {
    throw new ServiceCallError(`Could not ${what}: ${err.message}.`);
  });
  const reply = (await res.json().catch(() => ({}))) as { settings?: { id: string; value: number }[]; message?: string };
  if (!res.ok || !Array.isArray(reply.settings)) throw new ServiceCallError(`Could not ${what}: it answered ${res.status}${reply.message ? `: ${reply.message.replace(/\.$/, '')}` : ''}.`);
  return Object.fromEntries(reply.settings.map((s) => [s.id, s.value]));
}
