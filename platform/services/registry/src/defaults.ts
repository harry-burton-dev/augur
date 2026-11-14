/**
 * Default apps (spec 9.7, ADR 0075 "pillar"): the apps a deployment names in DEFAULT_APPS are installed from the
 * feed on their first chance, their asks agreed by the deployment, and can't be removed while they're named. Nothing
 * of them ships inside AUGUR's release. A release whose install failed isn't asked for again by itself.
 */
import { reservedIdProblem } from '@augur/service-kit';
import type { AppJob, AppRelease } from './store.ts';
import { newestOn, refusedIn, type AppFeedRelease } from './app-updates.ts';
import { declaredSettings, missingMessage, missingRequired } from './settings.ts';

/** An app id as the registry takes one (app-runner-schemas.ts). */
const APP_ID = /^[a-z][a-z0-9-]{1,39}$/;

/** A list of app ids such as DEFAULT_APPS or IN_PAGE_APPS, split by commas or spaces, and what is wrong with it. */
export const parseAppIds = (text: string | undefined, setting: string): { apps: string[]; problems: string[] } => {
  const ids = [...new Set((text ?? '').split(/[\s,]+/).filter(Boolean))];
  const problems = ids.flatMap((id) => {
    if (!APP_ID.test(id)) return [`"${id}" in ${setting} isn’t an app id: lower-case letters, digits and dashes, starting with a letter.`];
    const reserved = reservedIdProblem(id);
    return reserved ? [`${setting}: ${reserved}`] : [];
  });
  return { apps: problems.length ? [] : ids, problems };
};

/** Where one default app stands, as Admin → Apps shows it. */
export interface DefaultAppState {
  app: string;
  /** installed: it runs; asked: a job for it is waiting or under way; waiting: not yet, and why. */
  state: 'installed' | 'asked' | 'waiting';
  /** Why it isn't installed yet, while waiting. */
  problem?: string;
}

/** What of an app's jobs the plan reads. */
type JobSeen = Pick<AppJob, 'app' | 'action' | 'state' | 'requestedBy' | 'message'> & { version?: string };

export interface DefaultsInput {
  defaults: string[];
  releases: AppFeedRelease[];
  installed: string[];
  /** Every app's jobs, newest first. */
  jobs: JobSeen[];
  /** Why a release can't install on this server, if it can't (its file, or the server's ring). */
  problemOf: (release: AppRelease, listed: AppFeedRelease['channel']) => string | undefined;
  /** Whether an admin already gave the app a value for this setting. */
  hasValue: (app: string, setting: string) => boolean;
  /** Whether the feed can be installed from now (false while it's refused or expired). */
  feedUsable: boolean;
}

/** Said of a default app the next check of the feed asks for. */
export const NEXT_CHECK = 'It’s asked for at the next check of the app feed.';

/**
 * What to install now, and where each default app stands. Stable releases only: a deployment's defaults are its
 * production apps. A release whose install by the deployment failed isn't asked for again: a newer one is, or an
 * admin installs it by hand.
 */
export const defaultsPlan = ({ defaults, releases, installed, jobs, problemOf, hasValue, feedUsable }: DefaultsInput) => {
  const install: { app: string; release: AppRelease }[] = [];
  const states: DefaultAppState[] = defaults.map((app) => {
    if (installed.includes(app)) return { app, state: 'installed' };
    if (jobs.some((j) => j.app === app && (j.state === 'requested' || j.state === 'running'))) return { app, state: 'asked' };
    if (!feedUsable) return { app, state: 'waiting', problem: 'The app feed can’t be read now; it’s asked for once it can.' };
    const newest = newestOn(releases, app, 'stable');
    if (!newest?.release) {
      const refused = refusedIn(releases, app, 'stable')?.refused;
      return { app, state: 'waiting', problem: refused ?? `The app feed has no stable release of ${app} yet.` };
    }
    const problem = problemOf(newest.release, newest.channel);
    if (problem) return { app, state: 'waiting', problem };
    const missing = missingRequired(declaredSettings(newest.release.manifest), (setting) => hasValue(app, setting));
    if (missing.length) return { app, state: 'waiting', problem: missingMessage(newest.release.manifest.name, missing) };
    const failed = jobs.find((j) => j.app === app && j.action === 'install' && j.requestedBy === DEPLOYMENT && j.version === newest.version && j.state === 'failed');
    if (failed)
      return {
        app,
        state: 'waiting',
        problem: `Installing ${newest.release.manifest.name} ${newest.version} failed${failed.message ? `: ${failed.message.replace(/\.$/, '')}` : ''}. A newer release is asked for by itself; install this one by hand to try it again.`,
      };
    install.push({ app, release: newest.release });
    return { app, state: 'waiting', problem: NEXT_CHECK };
  });
  return { install, states };
};

/** Who a default app's install is asked for by: the deployment, which agreed to what it asks (spec 9.7). */
export const DEPLOYMENT = 'deployment';

/** Why a default app can't be removed from the server. */
export const defaultRemoveProblem = (app: string) =>
  `${app} is one of this deployment’s default apps (DEFAULT_APPS), so it can’t be removed. Take it out of DEFAULT_APPS in .env and run pc up -d, then remove it.`;
