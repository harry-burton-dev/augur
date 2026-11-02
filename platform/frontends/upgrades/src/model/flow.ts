import type { Upgrade, UpgradeStep } from './types.js';

/** Each step the updater reports, in the spec's words. */
export const STEP_WORDS: Record<UpgradeStep['step'], string> = {
  preflight: 'Check the server can take it',
  backup: 'Back up and test the backup',
  pull: 'Fetch the new images',
  'roll-forward': 'Start each part on the new version',
  verify: 'Check everything is running',
  watch: 'Watch it for 10 minutes',
  'roll-back': 'Go back to the old version',
};

/** The steps of an upgrade that goes well, in order. Going back only shows once it happens. */
const PLAN: UpgradeStep['step'][] = ['preflight', 'backup', 'pull', 'roll-forward', 'verify', 'watch'];

export interface FlowStep {
  step: UpgradeStep['step'];
  label: string;
  state: 'done' | 'now' | 'next' | 'failed';
  message?: string;
  at?: string;
}

/**
 * Every step of an upgrade with where it stands: the updater's reports, and the planned steps
 * not reached yet. A step that failed says so; going back is added once the updater starts it.
 */
export const flowSteps = (up: Pick<Upgrade, 'state' | 'steps'>): FlowStep[] => {
  const last = new Map(up.steps.map((s) => [s.step, s]));
  const ended = up.state !== 'requested' && up.state !== 'running';
  const order = [...PLAN, ...(last.has('roll-back') ? (['roll-back'] as const) : [])];
  return order.map((step) => {
    const s = last.get(step);
    if (!s) return { step, label: STEP_WORDS[step], state: 'next' };
    // A step still "running" when the upgrade has ended didn't finish.
    const state = s.state === 'done' ? 'done' : s.state === 'failed' || ended ? 'failed' : 'now';
    return { step, label: STEP_WORDS[step], state, ...(s.message ? { message: s.message } : {}), at: s.at };
  });
};

export type Ending = { kind: 'done' | 'went-back' | 'failed' | 'cancelled'; words: string };

/**
 * How an upgrade ended, in one of four ways (spec: "Endings"), or nothing while it runs.
 * A failed upgrade may still be on the new release, when going back would cross a breaking one.
 */
export const endingOf = (up: Upgrade, running: string): Ending | undefined => {
  switch (up.state) {
    case 'done':
      return { kind: 'done', words: `Upgraded from ${up.from} to ${up.version}.` };
    case 'rolled-back':
      return { kind: 'went-back', words: `Back on ${up.from}: ${up.message ?? `the upgrade to ${up.version} didn’t finish, so it went back by itself.`}` };
    case 'failed':
      return {
        kind: 'failed',
        words:
          running === up.version
            ? `${up.version} is running but didn’t pass its checks${up.message ? `: ${up.message}` : '.'} It didn’t go back by itself because a breaking release is in between. See “Going back” in docs/upgrade.md.`
            : `It stopped partway${up.message ? `: ${up.message}` : '.'} It couldn’t go back by itself. Follow “Going back” in docs/upgrade.md, with the backup it took first.`,
      };
    case 'cancelled':
      return { kind: 'cancelled', words: `The upgrade to ${up.version} was cancelled before it started. Nothing changed.` };
    default:
      return undefined;
  }
};

/** What the step-up return address carries, so the page asks again where it left off. */
export type Resume = { kind: 'upgrade' | 'go-back'; version: string } | { kind: 'install'; app: string; version: string } | { kind: 'settings'; unit: string };

const PARAMS = { upgrade: 'upgrade', 'go-back': 'go-back', install: 'install', settings: 'settings' } as const;

/** The address to come back to after entering the password again. */
export const returnTo = (path: string, r: Resume): string =>
  `${path}?${PARAMS[r.kind]}=${encodeURIComponent(r.kind === 'install' ? `${r.app}@${r.version}` : r.kind === 'settings' ? r.unit : r.version)}`;

/** Where the shell asks for the password again, then sends the person back. */
export const signInAgainUrl = (back: string): string => `/auth/again?return=${encodeURIComponent(back)}`;

/** What to ask again on the way back from entering the password, and the search without it. */
export const resumeFrom = (search: string): { resume?: Resume; rest: string } => {
  const params = new URLSearchParams(search);
  const upgrade = params.get(PARAMS.upgrade);
  const back = params.get(PARAMS['go-back']);
  const install = params.get(PARAMS.install);
  const settings = params.get(PARAMS.settings);
  Object.values(PARAMS).forEach((p) => params.delete(p));
  const rest = params.toString();
  const at = install?.lastIndexOf('@') ?? -1;
  const resume: Resume | undefined = upgrade
    ? { kind: 'upgrade', version: upgrade }
    : back
      ? { kind: 'go-back', version: back }
      : install && at > 0
        ? { kind: 'install', app: install.slice(0, at), version: install.slice(at + 1) }
        : settings
          ? { kind: 'settings', unit: settings }
          : undefined;
  return { ...(resume ? { resume } : {}), rest: rest ? `?${rest}` : '' };
};

/** New settings typed before going to enter the password, kept for this tab until it's back. */
const ENTERED_KEY = 'augur.upgrade-settings';
export const keepEntered = (settings: Record<string, string>) => {
  try {
    if (Object.keys(settings).length) sessionStorage.setItem(ENTERED_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing: they're typed again.
  }
};
export const takeEntered = (): Record<string, string> => {
  try {
    const text = sessionStorage.getItem(ENTERED_KEY);
    sessionStorage.removeItem(ENTERED_KEY);
    return text ? (JSON.parse(text) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

/**
 * Unsaved settings for one unit, kept for this tab while the person enters the password again,
 * so the editor opens with them on the way back. Only ever read back for the same unit.
 */
const DRAFT_KEY = 'augur.upgrade-draft';
export const keepDraft = (unit: string, draft: unknown) => {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ unit, draft }));
  } catch {
    // Private browsing: they're chosen again.
  }
};
export const takeDraft = <T>(unit: string): T | undefined => {
  try {
    const text = sessionStorage.getItem(DRAFT_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
    const kept = text ? (JSON.parse(text) as { unit?: string; draft?: T }) : undefined;
    return kept?.unit === unit ? kept.draft : undefined;
  } catch {
    return undefined;
  }
};
