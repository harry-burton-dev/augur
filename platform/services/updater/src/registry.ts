import { serviceHeaders, type ServiceCredentials } from '@augur/service-kit';
import { Withdrawn, type Report, type Reporter, type Target } from './upgrade.ts';

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
    const res = await fetchImpl(url('/target'), { headers: await serviceHeaders(credentials) });
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
          const res = await fetchImpl(url('/progress'), {
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

  return { target, reporter };
};
