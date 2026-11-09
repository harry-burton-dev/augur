/**
 * Default apps (spec 9.7, ADR 0075 "pillar"): the apps a deployment names in DEFAULT_APPS are installed from the
 * feed on their first chance, their asks agreed by the deployment, and can't be removed while they're named. Nothing
 * of them ships inside AUGUR's release. Each is asked for once: an install that fails stays failed in Admin → Apps,
 * where an admin installs it by hand.
 */
import { reservedIdProblem } from '@augur/service-kit';
import type { AppRelease } from './store.ts';
import { newestOn, type AppFeedRelease } from './app-updates.ts';
import { declaredSettings, missingMessage, missingRequired } from './settings.ts';

/** An app id as the registry takes one (app-runner-schemas.ts). */
const APP_ID = /^[a-z][a-z0-9-]{1,39}$/;

/** DEFAULT_APPS as ids, split by commas or spaces, and what is wrong with it. */
export const parseDefaultApps = (text: string | undefined): { apps: string[]; problems: string[] } => {
  const ids = [...new Set((text ?? '').split(/[\s,]+/).filter(Boolean))];
  const problems = ids.flatMap((id) => {
    if (!APP_ID.test(id)) return [`"${id}" in DEFAULT_APPS isn’t an app id: lower-case letters, digits and dashes, starting with a letter.`];
    const reserved = reservedIdProblem(id);
    return reserved ? [`DEFAULT_APPS: ${reserved}`] : [];
  });
  return { apps: problems.length ? [] : ids, problems };
};

/** Where one default app stands, as Admin → Apps shows it. */
export interface DefaultAppState {
  app: string;
  /** installed: it runs; asked: its install was asked for, and how that went is its job's; waiting: not yet, and why. */
  state: 'installed' | 'asked' | 'waiting';
  /** Why it isn't installed yet, while waiting. */
  problem?: string;
}

export interface DefaultsInput {
  defaults: string[];
  releases: AppFeedRelease[];
  installed: string[];
  /** The default apps already asked for once. */
  asked: string[];
  /** Why a release can't install on this server, if it can't (its file, or the server's ring). */
  problemOf: (release: AppRelease, listed: AppFeedRelease['channel']) => string | undefined;
  /** Whether an admin already gave the app a value for this setting. */
  hasValue: (app: string, setting: string) => boolean;
  /** Whether the feed can be installed from now (false while it's refused or expired). */
  feedUsable: boolean;
}

/** What to install now, and where each default app stands. Stable releases only: a deployment's defaults are its production apps. */
export const defaultsPlan = ({ defaults, releases, installed, asked, problemOf, hasValue, feedUsable }: DefaultsInput) => {
  const install: { app: string; release: AppRelease }[] = [];
  const states: DefaultAppState[] = defaults.map((app) => {
    if (installed.includes(app)) return { app, state: 'installed' };
    if (asked.includes(app)) return { app, state: 'asked' };
    if (!feedUsable) return { app, state: 'waiting', problem: 'The app feed can’t be read now; it’s asked for once it can.' };
    const newest = newestOn(releases, app, 'stable');
    if (!newest?.release) return { app, state: 'waiting', problem: `The app feed has no stable release of ${app} yet.` };
    const problem = problemOf(newest.release, newest.channel);
    if (problem) return { app, state: 'waiting', problem };
    const missing = missingRequired(declaredSettings(newest.release.manifest), (setting) => hasValue(app, setting));
    if (missing.length) return { app, state: 'waiting', problem: missingMessage(newest.release.manifest.name, missing) };
    install.push({ app, release: newest.release });
    return { app, state: 'asked' };
  });
  return { install, states };
};

/** Why a default app can't be removed from the server. */
export const defaultRemoveProblem = (app: string) =>
  `${app} is one of this deployment’s default apps (DEFAULT_APPS), so it can’t be removed. Take it out of DEFAULT_APPS in .env and run pc up -d, then remove it.`;
