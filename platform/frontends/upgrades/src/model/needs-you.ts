import type { InstalledApp, PlatformUpdates } from './types.js';

/** One thing waiting on a person: why it's there, and one action. */
export interface NeedsYouItem {
  key: string;
  kind: 'feed' | 'halted' | 'failed' | 'went-back' | 'approval' | 'updater';
  /** "augur" or an app id. */
  unit: string;
  title: string;
  why: string;
  action: { verb: string; to: string };
}

const SEEN_KEY = 'upgrades.seen-results';

/**
 * Everything waiting on a person across AUGUR and the apps, worst first. A failed or
 * went-back upgrade stays until someone opens it (`seen` holds the job ids opened).
 * The overview endpoint (coming) returns the same list; this builds it from today's endpoints.
 */
export const needsYou = (u: PlatformUpdates, apps: InstalledApp[], seen: ReadonlySet<string>, augurName = 'AUGUR'): NeedsYouItem[] => {
  const out: NeedsYouItem[] = [];
  const trust = u.feedTrust;
  if (trust?.state === 'failed' || trust?.state === 'expired') {
    out.push({
      key: `feed-${trust.state}`,
      kind: 'feed',
      unit: 'augur',
      title: trust.state === 'failed' ? 'The release feed failed its signature check' : 'The release feed has expired',
      why: `${trust.note ?? (trust.state === 'failed' ? 'It isn’t from a trusted publisher.' : 'It’s older than its expiry; usually the mirror needs refreshing.')} Nothing new is offered until it’s fixed; everything keeps running.`,
      action: { verb: 'See how to fix it', to: '/feed' },
    });
  }
  const halted = u.needsYou.find((n) => n.kind === 'halted');
  if (halted) {
    out.push({ key: `halted-augur-${u.running.version}`, kind: 'halted', unit: 'augur', title: `${augurName} ${u.running.version} was halted`, why: halted.message, action: { verb: 'Move off it', to: '/augur' } });
  }
  for (const app of apps) {
    if (app.halted) {
      out.push({ key: `halted-${app.app}-${app.version}`, kind: 'halted', unit: app.app, title: `${app.name} ${app.version} was halted`, why: app.halted.reason, action: { verb: 'Move off it', to: `/apps/${app.app}` } });
    }
  }
  const up = u.upgrade;
  if (up && (up.state === 'failed' || up.state === 'rolled-back') && !seen.has(up.id)) {
    out.push({
      key: `result-${up.id}`,
      kind: up.state === 'failed' ? 'failed' : 'went-back',
      unit: 'augur',
      title: up.state === 'failed' ? `Upgrading ${augurName} to ${up.version} stopped partway` : `${augurName} went back to ${up.from} by itself`,
      why: up.message ?? 'Open the log to see which step failed.',
      action: { verb: 'Open the log', to: `/history/${up.id}` },
    });
  }
  for (const app of apps) {
    const job = app.job;
    if (job?.state === 'failed' && !seen.has(job.id)) {
      out.push({ key: `result-${job.id}`, kind: 'failed', unit: app.app, title: `${job.action === 'install' ? 'Installing' : 'Removing'} ${app.name} failed`, why: job.message ?? 'Open the log to see which step failed.', action: { verb: 'Open the log', to: `/history/${job.id}` } });
    }
    if (app.update?.needs.length && !app.update.halted) {
      out.push({
        key: `approval-${app.app}-${app.update.version}`,
        kind: 'approval',
        unit: app.app,
        title: `${app.name} ${app.update.version} is waiting for you`,
        why: app.update.needs.join(' '),
        action: { verb: 'Review', to: `/apps/${app.app}/review/${app.update.version}` },
      });
    }
  }
  return out;
};

/** The results someone has opened, kept per browser so a dismissed item stays gone. */
export const loadSeen = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
};

export const markSeen = (id: string): void => {
  try {
    const seen = loadSeen();
    seen.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-50)));
  } catch {
    // storage blocked: the item shows again next time, which is safe
  }
};
