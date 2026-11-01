import { levelFrom, newestAllowed } from './model/levels.js';
import { unitState, type UnitState } from './model/states.js';
import type { AppInstalls, PlatformUpdates, Policy, UnitRecord } from './model/types.js';

/** One row of the overview: AUGUR or an installed app. */
export interface UnitRow {
  id: string;
  name: string;
  running: string;
  offered?: string;
  state: UnitState;
  policy?: Policy;
  pin?: string;
  held?: boolean;
  /** Where its page is, inside the Upgrade Centre. */
  to: string;
}

export const AUGUR = 'augur';

/** AUGUR's row, from the registry's updates and its desired-state record when there is one. */
export const augurRow = (u: PlatformUpdates, record: UnitRecord | undefined, now: Date, name = 'AUGUR'): UnitRow => {
  const offer = newestAllowed([...(u.available ? [u.available] : []), ...u.newer], record?.pin);
  const job = u.upgrade && (u.upgrade.state === 'running' || u.upgrade.state === 'requested') ? u.upgrade.state : undefined;
  const halted = u.needsYou.some((n) => n.kind === 'halted');
  const state = unitState(
    {
      running: u.running.version,
      runningHalted: halted ? { reason: '', at: '' } : undefined,
      offered: offer && offer.version !== u.running.version ? { version: offer.version, needsPersonSetting: u.needsYou.some((n) => n.kind === 'setting' && n.required && !n.madeUp) } : undefined,
      policy: record?.policy,
      held: Boolean(record?.hold),
      windows: record?.windows,
      timeZone: record?.timeZone,
      job,
      watchingUntil: u.upgrade?.state === 'done' ? u.upgrade.watch?.until : undefined,
    },
    now,
  );
  return { id: AUGUR, name, running: u.running.version, offered: offer?.version, state, policy: record?.policy, pin: record?.pin, held: Boolean(record?.hold), to: `/${AUGUR}` };
};

/** Each installed app's row. Apps already have a policy; a held app is one on Hold. */
export const appRows = (installs: AppInstalls, records: Record<string, UnitRecord | undefined>, now: Date): UnitRow[] =>
  installs.installed.map((app) => {
    const record = records[app.app];
    const policy = record?.policy ?? app.policy;
    const offer = app.update && !app.update.halted && (!record?.pin || newestAllowed([app.update], record.pin)) ? app.update : undefined;
    const job = app.job && (app.job.state === 'running' || app.job.state === 'requested') ? app.job.state : undefined;
    const state = unitState(
      {
        running: app.version,
        runningHalted: app.halted,
        offered: offer ? { version: offer.version, asksNewPowers: offer.needs.length > 0 } : undefined,
        policy,
        automaticUpTo: record ? undefined : 'minor',
        held: Boolean(record?.hold),
        windows: record?.windows,
        timeZone: record?.timeZone,
        job,
      },
      now,
    );
    return { id: app.app, name: app.name, running: app.version, offered: offer?.version, state, policy, pin: record?.pin, held: Boolean(record?.hold) || policy === 'hold', to: `/apps/${app.app}` };
  });

/** "Patch", "Minor" or "Major" from what runs, for a release's line. */
export const levelWord = (running: string, to: string): string => ({ patch: 'Patch', minor: 'Minor', major: 'Major' })[levelFrom(running, to)];
