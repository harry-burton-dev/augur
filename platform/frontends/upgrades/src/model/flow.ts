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
            ? `${up.version} is running but didn’t pass its checks${up.message ? `: ${up.message}` : '.'} It didn’t go back by itself because a breaking release is in between. See docs/upgrade-went-back.md before you do anything.`
            : `It stopped partway${up.message ? `: ${up.message}` : '.'} It couldn’t go back by itself. Follow docs/upgrade-went-back.md, with the backup it took first.`,
      };
    case 'cancelled':
      return { kind: 'cancelled', words: `The upgrade to ${up.version} was cancelled before it started. Nothing changed.` };
    default:
      return undefined;
  }
};
