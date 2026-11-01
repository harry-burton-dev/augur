import { levelFrom, type Level } from './levels.js';
import { insideWindow } from './time.js';
import type { Halted, Policy, Window } from './types.js';

/** The spec's eight unit states, in the order they win when several hold. */
export type UnitState = 'running' | 'watching' | 'halted' | 'held' | 'waiting-you' | 'waiting-window' | 'update-available' | 'up-to-date';

/** Each state in words, with an icon and a tone, never colour alone (WCAG 1.4.1). */
export const STATE_LOOK: Record<UnitState, { words: string; icon: string; tone: 'neutral' | 'info' | 'good' | 'warn' | 'danger' }> = {
  running: { words: 'Running now', icon: 'loader', tone: 'info' },
  watching: { words: 'Watching after upgrade', icon: 'eye', tone: 'info' },
  halted: { words: 'Halted', icon: 'octagon-alert', tone: 'danger' },
  held: { words: 'Held', icon: 'pause', tone: 'neutral' },
  'waiting-you': { words: 'Waiting for you', icon: 'hand', tone: 'warn' },
  'waiting-window': { words: 'Waiting for its window', icon: 'clock', tone: 'neutral' },
  'update-available': { words: 'Update available', icon: 'arrow-up-circle', tone: 'info' },
  'up-to-date': { words: 'Up to date', icon: 'check', tone: 'good' },
};

export interface UnitFacts {
  running: string;
  /** Running a release the feed has since halted. */
  runningHalted?: Halted;
  /** The newest release the unit's channel and pin allow, halted ones left out. */
  offered?: { version: string; needsPersonSetting?: boolean; asksNewPowers?: boolean };
  /** Absent until the desired-state record exists (ADR 0020): then every offer just shows as available. */
  policy?: Policy;
  /** How far Automatic goes: AUGUR on production takes patches, apps take patches and minors. */
  automaticUpTo?: Exclude<Level, 'major'>;
  held?: boolean;
  windows?: Window[] | 'any';
  timeZone?: string;
  job?: 'running' | 'requested';
  watchingUntil?: string;
}

const RANK: Record<Level, number> = { patch: 0, minor: 1, major: 2 };

/** Whether Automatic would take this offer by itself. It never takes a major, a setting only a person can give, or new powers. */
export const automaticTakes = (facts: UnitFacts): boolean => {
  const { offered } = facts;
  if (!offered || offered.needsPersonSetting || offered.asksNewPowers) return false;
  const level = levelFrom(facts.running, offered.version);
  return level !== 'major' && RANK[level] <= RANK[facts.automaticUpTo ?? 'patch'];
};

export const unitState = (facts: UnitFacts, now: Date): UnitState => {
  if (facts.job) return 'running';
  if (facts.watchingUntil && Date.parse(facts.watchingUntil) > now.getTime()) return 'watching';
  if (facts.runningHalted) return 'halted';
  if (facts.held || facts.policy === 'hold') return 'held';
  if (!facts.offered) return 'up-to-date';
  if (!facts.policy) return 'update-available';
  if (facts.policy === 'ask' || !automaticTakes(facts)) return 'waiting-you';
  return insideWindow(facts.windows ?? 'any', facts.timeZone ?? 'UTC', now) ? 'update-available' : 'waiting-window';
};
