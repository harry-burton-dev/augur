import { appClientId, clientCredentials, registerApp, serviceHeaders, withDeadline, type ServiceCredentials } from '@augur/service-kit';
import type { AppJob, JobReporter, PlatformCalls } from './runner.ts';
import { Withdrawn, type AfterWatchLook, type Report, type Reporter, type Target } from './upgrade.ts';

export interface RegistryOptions {
  registryUrl: string;
  credentials: ServiceCredentials;
  /** How long a report keeps being retried: the registry itself restarts during an upgrade. */
  retryForMs?: number;
  retryMs?: number;
  fetchImpl?: typeof fetch;
}

/** The registry's side of an upgrade, asked as the updater (platform-updater). */
export const registryClient = ({ registryUrl, credentials, retryForMs = 5 * 60_000, retryMs = 2_000, fetchImpl = fetch }: RegistryOptions) => {
  const url = (path: string) => `${registryUrl.replace(/\/$/, '')}/v1/platform/upgrade${path}`;

  /** The open upgrade, or undefined when there's nothing to do. */
  const target = async (): Promise<Target | undefined> => {
    const res = await withDeadline(fetchImpl)(url('/target'), { headers: await serviceHeaders(credentials) });
    if (res.status === 204) return undefined;
    if (!res.ok) throw new Error(`The registry answered ${res.status} when asked what to upgrade to.`);
    return (await res.json()) as Target;
  };

  /** Reports a step to the upgrade `id`, retrying while the registry is away. */
  const reporter =
    (id: string): Reporter =>
    async (report: Report) => {
      const started = Date.now();
      let problem = '';
      while (Date.now() - started <= retryForMs) {
        try {
          const res = await withDeadline(fetchImpl)(url('/progress'), {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(await serviceHeaders(credentials)) },
            body: JSON.stringify({ id, ...report }),
          });
          if (res.ok) return;
          if (res.status === 404) throw new Withdrawn('The upgrade was cancelled or has ended.');
          problem = `it answered ${res.status}`;
          // A refusal other than a restart's won't change by asking again.
          if (res.status < 500 && res.status !== 401) break;
        } catch (err) {
          if (err instanceof Withdrawn) throw err;
          problem = `it couldn’t be reached (${(err as Error).message})`;
        }
        await new Promise((resolve) => setTimeout(resolve, retryMs));
      }
      throw new Error(`Couldn’t tell the registry how ${report.step} went: ${problem}.`);
    };

  /** The light watch's next look, or undefined when none is due. */
  const afterWatch = async (): Promise<AfterWatchLook | undefined> => {
    const res = await withDeadline(fetchImpl)(url('/after-watch'), { headers: await serviceHeaders(credentials) });
    if (res.status === 204 || res.status === 404) return undefined;
    if (!res.ok) throw new Error(`The registry answered ${res.status} when asked about the light watch.`);
    return (await res.json()) as AfterWatchLook;
  };

  /** Tells the registry what one look of the light watch saw. */
  const afterLook = async (look: { id: string; calls: number; serverErrors: number; signInProblem?: string }) => {
    const res = await withDeadline(fetchImpl)(url('/after-watch'), { method: 'POST', headers: { 'content-type': 'application/json', ...(await serviceHeaders(credentials)) }, body: JSON.stringify(look) });
    // 404: an upgrade since ended it.
    if (!res.ok && res.status !== 404) throw new Error(`The registry answered ${res.status} to the light watch’s look.`);
  };

  return { target, reporter, afterWatch, afterLook };
};

/**
 * The app runner's side of the registry and identity, asked as the updater; registering a version
 * is asked as the app itself, with the sign-in the runner just gave it.
 */
export const appRunnerClient = ({ registryUrl, identityUrl, credentials, oidc, retryForMs = 60_000, retryMs = 2_000, fetchImpl = fetch }: RegistryOptions & { identityUrl: string; oidc: { tokenUrl: string } }) => {
  const registry = (path: string) => `${registryUrl.replace(/\/$/, '')}/v1${path}`;
  const call = async (url: string, method: string, body: unknown, what: string, as: ServiceCredentials = credentials) => {
    const res = await withDeadline(fetchImpl)(url, { method, headers: { 'content-type': 'application/json', ...(await serviceHeaders(as)) }, body: JSON.stringify(body) });
    if (!res.ok) {
      const said = ((await res.json().catch(() => ({}))) as { message?: string }).message;
      throw new Error(`${what}: it answered ${res.status}${said ? `, ${said.replace(/\.$/, '')}` : ''}.`);
    }
  };

  /** The oldest open job, or undefined when there's nothing to do. */
  const next = async (): Promise<AppJob | undefined> => {
    const res = await withDeadline(fetchImpl)(registry('/app-runner/next'), { headers: await serviceHeaders(credentials) });
    if (res.status === 204) return undefined;
    if (!res.ok) throw new Error(`The registry answered ${res.status} when asked for the app runner’s next job.`);
    return (await res.json()) as AppJob;
  };

  /** Reports a step of job `id`, retrying a while if the registry is away. */
  const reporter =
    (id: string): JobReporter =>
    async (report) => {
      const started = Date.now();
      let problem = '';
      while (Date.now() - started <= retryForMs) {
        try {
          const res = await withDeadline(fetchImpl)(registry(`/app-runner/jobs/${encodeURIComponent(id)}/progress`), {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(await serviceHeaders(credentials)) },
            body: JSON.stringify(report),
          });
          if (res.ok) return;
          if (res.status === 404) throw new Withdrawn('The job was cancelled or has ended.');
          problem = `it answered ${res.status}`;
          if (res.status < 500 && res.status !== 401) break;
        } catch (err) {
          if (err instanceof Withdrawn) throw err;
          problem = `it couldn’t be reached (${(err as Error).message})`;
        }
        await new Promise((resolve) => setTimeout(resolve, retryMs));
      }
      throw new Error(`Couldn’t tell the registry how ${report.step} went: ${problem}.`);
    };

  const calls: PlatformCalls = {
    setCredential: (app, secret) =>
      call(`${identityUrl.replace(/\/$/, '')}/v1/admin/apps/${encodeURIComponent(app)}/credential`, 'PUT', { secret }, `Identity didn’t take ${app}’s sign-in`),
    async register(manifest, secret) {
      const as = { name: manifest.id, getToken: clientCredentials({ tokenUrl: oidc.tokenUrl, clientId: appClientId(manifest.id), clientSecret: secret }) };
      await registerApp({ registryUrl, credentials: as, manifest, fetchImpl, env: {} });
    },
    setUpstream: (app, url) => call(registry(`/apps/${encodeURIComponent(app)}/upstream`), 'PUT', { url }, `The registry didn’t take where ${app} is`),
    async putFrontend(app, version, tarball) {
      const res = await withDeadline(fetchImpl)(registry(`/apps/${encodeURIComponent(app)}/versions/${encodeURIComponent(version)}/frontend`), {
        method: 'PUT',
        headers: { 'content-type': 'application/gzip', ...(await serviceHeaders(credentials)) },
        // A copy (at most the bundle ceiling): the fetch types want a plain ArrayBuffer behind the body.
        body: new Uint8Array(tarball),
      });
      if (!res.ok) {
        const said = ((await res.json().catch(() => ({}))) as { message?: string }).message;
        throw new Error(`The registry didn’t keep ${app} ${version}’s frontend: it answered ${res.status}${said ? `, ${said.replace(/\.$/, '')}` : ''}.`);
      }
    },
  };

  /** Tells the registry the deployment's own networks (PUT /v1/runner/networks), which no app's address may be on. */
  const setOwnNetworks = (networks: string[]) => call(registry('/runner/networks'), 'PUT', { networks }, 'The registry didn’t take the deployment’s own networks');

  return { next, reporter, calls, setOwnNetworks };
};
