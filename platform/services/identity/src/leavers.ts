import type { NewAuditEntry } from '@augur/service-kit';
import type { Directory } from './directory.ts';
import type { LifecycleStore } from './lifecycle.ts';
import type { PreferenceStore } from './store.ts';

/**
 * The leaver flow itself (ADR 0040), run by an admin at once or, after a last day an admin set, by identity's
 * own sweep: their sign-in goes off, they're signed out everywhere, their request to leave is closed, and
 * `person.left` is recorded, which followers hear as `platform.person.left` so apps hand on what they own.
 */

export interface LeaverDeps {
  directory: Pick<Directory, 'person' | 'updatePerson' | 'endSessions'>;
  lifecycle?: Pick<LifecycleStore, 'disabled' | 'left'>;
  store?: Pick<PreferenceStore, 'withdrawLeave'>;
  /** Records in Activity; a failed write is the caller's to log. */
  audit?: (entry: NewAuditEntry) => Promise<unknown>;
  now?: () => string;
}

export interface LeaverRun {
  /** The admin who ran it, or who set it for after the last day. */
  by: string;
  handOverTo?: string;
  note?: string;
  /** Their last day, when the flow was set for after it. */
  lastDay?: string;
}

export const runLeaver = async ({ directory, lifecycle, store, audit, now = () => new Date().toISOString() }: LeaverDeps, id: string, run: LeaverRun) => {
  const actor = { id: run.by, kind: 'user' as const };
  const record = (action: string, detail: Record<string, unknown>) => audit?.({ actor, app: 'identity', action, target: id, detail });
  const before = await directory.person(id);
  const after = before.enabled ? await directory.updatePerson(id, { enabled: false }) : before;
  if (before.enabled) {
    await lifecycle?.disabled(id, 'leaver', now());
    await record('person.disabled', { username: after.username });
  }
  await directory.endSessions(id);
  const asked = store ? await store.withdrawLeave(id) : false;
  await lifecycle?.left(id, { at: now(), by: run.by, ...(run.handOverTo ? { handOverTo: run.handOverTo } : {}) });
  await record('person.left', {
    username: after.username,
    asked,
    ...(run.handOverTo ? { handOverTo: run.handOverTo } : {}),
    ...(run.note ? { note: run.note } : {}),
    ...(run.lastDay ? { lastDay: run.lastDay } : {}),
  });
  return after;
};

/** Today's date where the organisation is, as `YYYY-MM-DD`. */
export const todayIn = (timeZone: string, at = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

/** Adds days to a `YYYY-MM-DD` date. */
export const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Runs every leaver flow whose last day is over in the organisation's time zone. One that fails (the sign-in
 * service out of reach) stays set and is tried again next time; the rest still run. Returns who left.
 */
export const leaveDueLeavers = async (deps: LeaverDeps & { lifecycle: Pick<LifecycleStore, 'disabled' | 'left' | 'dueLeavers'> }, timeZone: string, at = new Date(), warn: (m: string) => void = () => undefined) => {
  const gone: string[] = [];
  for (const due of await deps.lifecycle.dueLeavers(todayIn(timeZone, at))) {
    try {
      await runLeaver(deps, due.person, { by: due.by, handOverTo: due.handOverTo, note: due.note, lastDay: due.on });
      gone.push(due.person);
    } catch (err) {
      warn(`The leaver flow set for ${due.person} after ${due.on} didn't run; identity tries again in five minutes (${(err as Error).message}).`);
    }
  }
  return gone;
};
