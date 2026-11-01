import { levelFrom } from './model/levels.js';
import type { UnitState } from './model/states.js';
import type { OverviewUnit, Policy } from './model/types.js';

export const AUGUR = 'augur';

/** One row of the overview: AUGUR or an installed app. */
export interface UnitRow {
  id: string;
  name: string;
  running: string;
  offered?: string;
  state: UnitState;
  policy: Policy;
  pin?: string;
  held: boolean;
  /** Where its page is, inside the Upgrade Centre. */
  to: string;
}

/**
 * A unit's state in the spec's words, from what the registry says about it. Running
 * and watching win, then a halted release, then Hold; an offer waits for its window
 * when Automatic would take it, and for a person when it wouldn't.
 */
export const stateOf = (u: OverviewUnit, now: Date, watchingUntil?: string): UnitState => {
  if (u.open) return 'running';
  if (watchingUntil && Date.parse(watchingUntil) > now.getTime()) return 'watching';
  if (u.halted) return 'halted';
  if (u.desired.policy === 'hold') return 'held';
  if (!u.available) return 'up-to-date';
  if (u.desired.policy === 'ask' || !u.automatic?.takes) return 'waiting-you';
  return u.window.open ? 'update-available' : 'waiting-window';
};

export const rowOf = (u: OverviewUnit, now: Date, watchingUntil?: string): UnitRow => ({
  id: u.unit,
  name: u.name,
  running: u.running,
  offered: u.available,
  state: stateOf(u, now, watchingUntil),
  policy: u.desired.policy,
  pin: u.desired.pin,
  held: u.desired.policy === 'hold',
  to: u.unit === AUGUR ? `/${AUGUR}` : `/apps/${u.unit}`,
});

/** "Patch", "Minor" or "Major" from what runs, for a release's line. */
export const levelWord = (running: string, to: string): string => ({ patch: 'Patch', minor: 'Minor', major: 'Major' })[levelFrom(running, to)];
