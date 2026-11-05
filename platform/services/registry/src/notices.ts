// What the registry tells people about updates (ADR 0044): a new release of AUGUR or an app, and how
// each upgrade or install ended. Worked out from the Upgrade Centre's overview, so the two always agree,
// and sent through the events service to everyone holding the role that acts on it.
import { notify, type NewNotification, type ServiceCredentials } from '@augur/service-kit';
import semver from 'semver';
import { AUGUR_UNIT } from './desired-state.ts';
import { overviewBuilder, type Overview, type OverviewRouteOptions, type UnitOverview } from './overview.ts';
import { DEPLOYMENT_ADMIN } from './roles.ts';

/** The app whose screen these open: the Upgrade Centre. */
export const NOTICES_APP = 'upgrades';
/** Who acts on updates: only they can install, go back or change how updates are taken (ADR 0022). */
const ACTS = [`role:${DEPLOYMENT_ADMIN}`];
/** Who hears how an update ended: they act on it, and admins run the organisation that uses it. */
const HEARS = [`role:${DEPLOYMENT_ADMIN}`, 'role:admin'];
/** A result older than this when first seen is history, not news: a restart doesn't retell last week. */
export const RESULT_NEWS_MS = 24 * 3_600_000;

/** Where in the Upgrade Centre a unit is. */
const linkFor = (unit: string) => (unit === AUGUR_UNIT ? '/augur' : `/apps/${encodeURIComponent(unit)}`);

const news = (unit: UnitOverview, n: Omit<NewNotification, 'app' | 'recipients' | 'link'>): NewNotification => ({ app: NOTICES_APP, recipients: [], link: linkFor(unit.unit), ...n });

/** A new release, once per version: whether it installs by itself or waits for someone. On hold, nothing is offered. */
const availableNotice = (u: UnitOverview): NewNotification | undefined => {
  if (!u.available || u.desired.policy === 'hold' || u.open) return undefined;
  const takes = u.automatic?.takes;
  if (takes) {
    return news(u, {
      audience: ACTS,
      key: `available:${u.unit}:${takes}`,
      level: 'info',
      title: `${u.name} ${takes} is available`,
      detail: u.window.open ? 'It installs by itself in the next few minutes.' : `It installs by itself. ${u.policy}`,
    });
  }
  return news(u, {
    audience: ACTS,
    key: `available:${u.unit}:${u.available}`,
    level: 'needs',
    title: `${u.name} ${u.available} is ready to install`,
    detail: u.automatic?.waits ?? 'It waits for a deployment admin to install it.',
  });
};

/** How the last upgrade or install ended, once per result, while it's news. */
const resultNotice = (u: UnitOverview, now: Date): NewNotification | undefined => {
  const r = u.lastResult;
  if (!r || r.state === 'cancelled' || now.getTime() - Date.parse(r.finishedAt) > RESULT_NEWS_MS) return undefined;
  const key = `result:${r.kind}:${r.id}`;
  const version = r.version ?? u.running;
  if (r.state === 'done') {
    const back = r.from && semver.valid(r.from) && semver.valid(version) && semver.lt(version, r.from);
    return news(u, { audience: HEARS, key, level: 'done', title: back ? `${u.name} went back to ${version}` : `${u.name} ${version} is installed`, ...(r.from && !back ? { detail: `It was on ${r.from}.` } : {}) });
  }
  if (r.state === 'rolled-back') {
    return news(u, { audience: HEARS, key, level: 'failed', title: `${u.name} went back to ${r.from ?? u.running} by itself`, detail: r.message ?? `The upgrade to ${version} didn’t finish.` });
  }
  // A go-back that didn't finish leaves the server on neither version: it stops work (ADR 0044 D3).
  const goingBack = r.from && semver.valid(r.from) && semver.valid(version) && semver.lt(version, r.from);
  if (goingBack) return news(u, { audience: HEARS, key, level: 'failed', urgent: true, title: `${u.name} didn’t go back to ${version}`, detail: r.message ?? 'It stopped partway. The Upgrade Centre has the steps.' });
  return news(u, { audience: HEARS, key, level: 'failed', title: `${u.name} ${version} didn’t install`, detail: r.message ?? 'It stopped partway. The Upgrade Centre has the steps.' });
};

/** The publisher halted the release a unit runs: once per release. It stops work, so it's urgent (ADR 0044 D3). */
const haltNotice = (u: UnitOverview): NewNotification | undefined =>
  u.halted ? news(u, { audience: ACTS, key: `halted:${u.unit}:${u.running}`, level: 'needs', urgent: true, title: `${u.name} ${u.running} was halted by its publisher`, detail: u.halted.reason }) : undefined;

/** Everything worth telling from the overview now. Each has a key, so sending it again tells no one twice. Pure, for tests. */
export const noticesFrom = (overview: Overview, now: Date): NewNotification[] =>
  overview.units.flatMap((u) => [resultNotice(u, now), haltNotice(u), availableNotice(u)].filter((n): n is NewNotification => !!n));

export interface UpdateNoticesOptions extends Pick<OverviewRouteOptions, 'store' | 'updates' | 'appUpdates' | 'timeZone' | 'now'> {
  eventsUrl: string;
  credentials: ServiceCredentials;
  /** How often to look; a result is told within this. */
  everyMs?: number;
  send?: (n: NewNotification) => Promise<void>;
  onError?: (err: Error) => void;
}

/**
 * Looks at the overview every minute and sends what's new. Keys the events service has seen
 * are remembered here too, so a quiet minute costs no calls; a failed send is tried next time.
 */
export const updateNotices = ({ eventsUrl, credentials, everyMs = 60_000, send, onError = () => {}, ...overview }: UpdateNoticesOptions) => {
  const sent = new Set<string>();
  const build = overviewBuilder(overview);
  const deliver = send ?? ((notification: NewNotification) => notify({ eventsUrl, credentials, notification }));
  const tick = async () => {
    const now = overview.now?.() ?? new Date();
    for (const n of noticesFrom(await build(), now)) {
      if (sent.has(n.key!)) continue;
      try {
        await deliver(n);
        sent.add(n.key!);
      } catch (err) {
        onError(err as Error);
      }
    }
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  return {
    tick,
    start() {
      const run = () => void tick().catch((err: Error) => onError(err));
      timer = setInterval(run, everyMs);
      timer.unref?.();
      run();
    },
    stop: () => clearInterval(timer),
  };
};
