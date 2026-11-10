import { pollEvery, type UpgradesApi } from './api.js';
import type { AppInstalls, AppJob, Deliveries, Overview, PlatformStatus, PlatformUpdates } from './model/types.js';

/** Everything Deployment shows, as last read from the registry. Earlier data stays when a read fails. */
export interface Data {
  /** Every unit and what needs an admin (the same source Backstage reads), and whether the caller may change things. */
  overview?: Overview;
  /** AUGUR's releases, roll-back targets and upgrade history. */
  updates?: PlatformUpdates;
  /** Installed apps' releases and jobs. */
  installs?: AppInstalls;
  /** Every app's installs and removals, newest first, for each app's history. */
  jobs?: AppJob[];
  /** Every part, backups and email, as the gateway last checked them, for Health, Backups and the overview. */
  status?: PlatformStatus;
  /** The gateway's status couldn't be read, so Health and Backups say so. */
  statusError?: string;
  /** How each app's part is taking its events, for Health. */
  deliveries?: Deliveries;
  deliveriesError?: string;
  /** Why the last read failed, in words. */
  error?: string;
  /** The app jobs couldn't be read, so each app's history says so. */
  jobsError?: string;
  loading: boolean;
  readAt?: Date;
}

const words = (e: unknown) => (e instanceof Error ? e.message : String(e));
const open = (state?: string) => state === 'requested' || state === 'running';

/** Whether something is under way, so the next read comes sooner. */
export const isRunning = (d: Data): boolean =>
  Boolean(d.overview?.units.some((u) => u.open) || open(d.updates?.upgrade?.state) || d.installs?.installed.some((a) => open(a.job?.state)));

/**
 * Reads the registry and the gateway's status, and again on a timer: every 2 s while something runs, every 30 s otherwise. A job
 * keeps going on the server whatever this app does, so another admin, or this one after a reload,
 * sees the same. `changed` runs after every read. `stop` ends the timer.
 */
export const reader = (api: UpgradesApi, changed: (d: Data) => void, timers: { set: typeof setTimeout; clear: typeof clearTimeout } = { set: setTimeout, clear: clearTimeout }) => {
  let data: Data = { loading: true };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const put = (next: Data) => {
    data = next;
    if (!stopped) changed(data);
  };

  const read = async () => {
    try {
      const [overview, updates, installs, jobs, status, deliveries] = await Promise.all([
        api.overview(),
        api.updates(),
        api.installs().catch(words),
        api.appJobs().catch(words),
        api.status().catch(words),
        api.deliveries().catch(words),
      ]);
      // Installs that can't be read keep the ones last read: an app's page would otherwise say it's up to date.
      put({
        overview,
        updates,
        installs: typeof installs === 'string' ? data.installs : installs,
        jobs: typeof jobs === 'string' ? data.jobs : jobs,
        ...(typeof installs === 'string' ? { error: `The apps’ versions couldn’t be read: ${installs}` } : {}),
        ...(typeof jobs === 'string' ? { jobsError: jobs } : {}),
        // Health and Backups keep what they last read, and say why it's old.
        status: typeof status === 'string' ? data.status : status,
        ...(typeof status === 'string' ? { statusError: status } : {}),
        deliveries: typeof deliveries === 'string' ? data.deliveries : deliveries,
        ...(typeof deliveries === 'string' ? { deliveriesError: deliveries } : {}),
        loading: false,
        readAt: new Date(),
      });
    } catch (e) {
      put({ ...data, loading: false, error: words(e) });
    }
  };

  const schedule = () => {
    if (stopped) return;
    timers.clear(timer);
    timer = timers.set(() => void read().then(schedule), pollEvery(isRunning(data)));
  };

  return {
    get data() {
      return data;
    },
    /** Reads now, then keeps reading. */
    start: () => read().then(schedule),
    /** Reads now: after a change, so the page shows it at once. */
    again: () => read().then(schedule),
    /** Takes what a change answered with, so the page shows it before the next read. */
    took: (patch: Partial<Pick<Data, 'overview' | 'updates'>>) => put({ ...data, ...patch, error: undefined, readAt: new Date() }),
    stop: () => {
      stopped = true;
      timers.clear(timer);
    },
  };
};

export type Reader = ReturnType<typeof reader>;
