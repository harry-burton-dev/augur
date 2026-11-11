import type { AppManifestEntry, MountContext } from '@augur/mfe-sdk';
import { isRefusal, type Refusal } from './model/roles.js';
import type { AllowedOrigin, AppInstalls, AppVersion, AppJob, Deliveries, IssuedSignIn, PastedRelease, Principal, DesiredState, DesiredStateInput, Overview, PlatformStatus, PlatformUpdates, ReportingView } from './model/types.js';

/** A call the platform turned down, with the refusal when it explained itself. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly refusal?: Refusal,
    /** The server's `error`, such as `sign_in_again` when the password is needed again. */
    readonly code?: string,
  ) {
    super(message);
  }
}

const REGISTRY = '/api/registry/v1';

/** Values for a release's settings, by id, given with its install. */
export type GivenSettings = Record<string, string | number | boolean>;

/**
 * Deployment's calls, through the gateway with `ctx.fetch`: the registry's, and two reads for Health and Backups.
 * Upgrades and settings never call the updater directly: the registry queues the work
 * and the updater picks it up, so a job keeps going when the page closes.
 */
export const upgradesApi = (ctx: Pick<MountContext, 'fetch'>) => {
  const call = async <T>(method: string, path: string, body?: unknown, base = REGISTRY): Promise<T> => {
    let res: Response;
    try {
      res = await ctx.fetch(`${base}${path}`, {
        method,
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('AUGUR can’t be reached. Check your connection; nothing was changed.', 0);
    }
    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const refusal = isRefusal(data) ? data : undefined;
      const message = (data as { message?: string }).message ?? `That didn’t work (${res.status}). Nothing was changed.`;
      throw new ApiError(message, res.status, refusal, (data as { error?: string }).error);
    }
    return data as T;
  };
  const unit = (id: string) => `/platform/units/${encodeURIComponent(id)}/desired-state`;
  return {
    updates: () => call<PlatformUpdates>('GET', '/platform/updates'),
    checkNow: () => call<PlatformUpdates>('POST', '/platform/updates/check'),
    upgrade: (version: string, settings: Record<string, string> = {}) =>
      call<PlatformUpdates>('PUT', '/platform/upgrade', Object.keys(settings).length ? { version, settings } : { version }),
    /** Installs a halted release on a dev or preview server, only to test going back (ADR 0051). */
    installHalted: (version: string, reason: string) => call<PlatformUpdates>('PUT', '/platform/upgrade/halted', { version, reason }),
    goBack: (version: string) => call<PlatformUpdates>('PUT', '/platform/go-back', { version }),
    cancel: () => call<PlatformUpdates>('DELETE', '/platform/upgrade'),
    installs: () => call<AppInstalls>('GET', '/app-runner/apps'),
    /** Every app's installs and removals, newest first, for the history. */
    appJobs: async () => (await call<{ jobs: AppJob[] }>('GET', '/app-runner/jobs')).jobs,
    checkApps: () => call<AppInstalls>('POST', '/app-runner/check'),
    /** Installs a release from the feed, with any settings it can't start without. Turned down with `sign_in_again` unless the password was just entered. */
    install: (app: string, version: string, settings: GivenSettings = {}) =>
      call<AppJob>('POST', '/app-runner/jobs', { action: 'install', app, version, ...(Object.keys(settings).length ? { settings } : {}) }),
    /** Reads a release file from an address, for an app no feed lists. Needs the password just entered too. */
    readRelease: (url: string) => call<PastedRelease>('POST', '/app-runner/releases/read', { url }),
    /** Installs a release given whole, such as one read from an address. */
    installRelease: (release: PastedRelease['release'], settings: GivenSettings = {}) =>
      call<AppJob>('POST', '/app-runner/jobs', { action: 'install', release, ...(Object.keys(settings).length ? { settings } : {}) }),
    /** Stops and removes an app's containers, its data kept for a while. Needs the password just entered too. */
    remove: (app: string) => call<AppJob>('POST', '/app-runner/jobs', { action: 'remove', app }),
    /** Gives one of an app's settings a value, or with null puts it back to its default. A secret needs the password just entered. */
    setSetting: (app: string, setting: string, value: string | number | boolean | null) =>
      call<AppInstalls>('PUT', `/app-runner/apps/${encodeURIComponent(app)}/settings/${encodeURIComponent(setting)}`, { value }),
    /** Lets an app's parts that ask for it reach the internet, or takes that away. Needs the password just entered too. */
    setInternet: (app: string, allowed: boolean) => call<AppInstalls>('PUT', `/app-runner/apps/${encodeURIComponent(app)}/internet`, { allowed }),
    /** Who may try an app's previews, by person id. */
    setDevelopers: (app: string, people: string[]) => call<AppInstalls>('PUT', `/app-runner/apps/${encodeURIComponent(app)}/developers`, { people }),
    /** A new secret for an app's service to sign in with; the old one stops working at once. */
    issueSignIn: (app: string) => call<IssuedSignIn>('POST', `/admin/apps/${encodeURIComponent(app)}/credential`, undefined, '/api/identity/v1'),
    /** The versions kept of an app its own service registers, and which one the shell is given. */
    versions: (app: string) => call<AppVersion[]>('GET', `/apps/${encodeURIComponent(app)}/versions`),
    /** Gives the shell one kept version and holds the app there; null follows new versions again. */
    pin: (app: string, version: string | null) =>
      version === null
        ? call<{ pinnedVersion?: string }>('DELETE', `/apps/${encodeURIComponent(app)}/pin`)
        : call<{ pinnedVersion?: string }>('PUT', `/apps/${encodeURIComponent(app)}/pin`, { version }),
    /** The sites apps may load from besides AUGUR's own address. */
    origins: () => call<AllowedOrigin[]>('GET', '/origins'),
    allowOrigin: (origin: string) => call<AllowedOrigin>('POST', '/origins', { origin }),
    removeOrigin: (origin: string) => call('DELETE', `/origins/${encodeURIComponent(origin)}`),
    /** People by name, or named by id, from the directory (people:read). */
    people: async (query: { q: string } | { ids: string[] }): Promise<Principal[]> => {
      const search = 'q' in query ? `q=${encodeURIComponent(query.q)}` : `ids=${query.ids.map(encodeURIComponent).join(',')}`;
      const found = await call<{ people: { id: string; name: string; email?: string }[] }>('GET', `/directory?${search}`, undefined, '/api/identity/v1');
      return found.people.map((p) => ({ kind: 'person' as const, id: p.id, name: p.name, ...(p.email ? { detail: p.email } : {}) }));
    },
    /** The apps this person can open, for this app's own name and icon and each app's icon. */
    manifest: () => call<AppManifestEntry[]>('GET', '/manifest'),
    /** Every unit, its desired state, what's next and what needs an admin: the same shape Backstage's card reads. */
    overview: () => call<Overview>('GET', '/platform/overview'),
    /** Every part as the gateway last checked it, with backups and email. */
    status: () => call<PlatformStatus>('GET', '/status', undefined, '/api/gateway/v1'),
    /** How each app's part is taking the events pushed to it. */
    deliveries: () => call<Deliveries>('GET', '/deliveries', undefined, '/api/events/v1'),
    /** Sets how a unit takes new releases (ADR 0020), and answers with the overview. */
    setDesired: (id: string, input: DesiredStateInput) => call<Overview>('PUT', unit(id), input),
    desiredHistory: async (id: string) => (await call<{ history: DesiredState[] }>('GET', `${unit(id)}/history`)).history,
    /** Whether this deployment reports to Backstage, its public key and how the last send went (ADR 0019). */
    reporting: () => call<ReportingView>('GET', '/platform/reporting'),
    /** The signed record as a file, with the name the registry gives it, to carry to Backstage by hand. */
    exportReport: async (): Promise<{ name: string; blob: Blob }> => {
      let res: Response;
      try {
        res = await ctx.fetch(`${REGISTRY}/platform/reporting/export`, { method: 'GET' });
      } catch {
        throw new ApiError('AUGUR can’t be reached. Check your connection and export again.', 0);
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new ApiError(data.message ?? `The export didn’t work (${res.status}).`, res.status, undefined, data.error);
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'deployment-report.json';
      return { name, blob: await res.blob() };
    },
    /** Marks a finished upgrade or app job looked at, for every admin. */
    markSeen: (kind: 'upgrade' | 'app-job', id: string) => call<Overview>('POST', `/platform/results/${kind}/${encodeURIComponent(id)}/seen`),
  };
};

export type UpgradesApi = ReturnType<typeof upgradesApi>;

/** How often to ask again: every 2 s while something runs, every 30 s otherwise. */
export const pollEvery = (running: boolean): number => (running ? 2_000 : 30_000);
