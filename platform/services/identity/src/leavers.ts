import { leaveNoticeKey, type NewAuditEntry, type NewNotification } from '@augur/service-kit';
import { DirectoryError, type Directory } from './directory.ts';
import type { LifecycleStore } from './lifecycle.ts';
import type { PreferenceStore } from './store.ts';

/**
 * The leaver flow itself (ADR 0040), run by an admin at once or, after a last day an admin set, by identity's
 * own sweep: their sign-in goes off, they're signed out everywhere, their request to leave is closed, and
 * `person.left` is recorded, which followers hear as `platform.person.left` so apps hand on what they own.
 */

export interface LeaverDeps {
  directory: Pick<Directory, 'person' | 'updatePerson' | 'endSessions'>;
  lifecycle?: Pick<LifecycleStore, 'get' | 'disabled' | 'left'>;
  store?: Pick<PreferenceStore, 'withdrawLeave'>;
  /** Records in Activity. It must throw when it can't: followers hear of a leaver only from these entries, and a throw stops the flow to run again. */
  audit?: (entry: NewAuditEntry) => Promise<unknown>;
  /** Tells admins when the person named to take on the work can't any more. */
  tell?: (notification: NewNotification) => Promise<unknown>;
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

/** Who admins are told through when a leaver's work has nobody to go to. */
export const ADMINS = ['role:admin'];

/** Whether someone can take work on now: a flow may run up to 90 days after they were named. */
const canTakeOn = async (directory: LeaverDeps['directory'], heir: string) => {
  const found = await directory.person(heir).catch((err: unknown) => {
    if (err instanceof DirectoryError && err.status === 404) return undefined;
    throw err;
  });
  return !!found?.enabled;
};

export const runLeaver = async ({ directory, lifecycle, store, audit, tell, now = () => new Date().toISOString() }: LeaverDeps, id: string, run: LeaverRun) => {
  const actor = { id: run.by, kind: 'user' as const };
  // Named so a later run saying it again keeps one entry, even when the first answer never came back. A leaver leaves once.
  const record = (action: string, detail: Record<string, unknown>) => audit?.({ actor, app: 'identity', action, target: id, detail, key: `leaver:${action}:${id}` });
  const before = await directory.person(id);
  const handOverTo = run.handOverTo && (await canTakeOn(directory, run.handOverTo)) ? run.handOverTo : undefined;
  const kept = (await lifecycle?.get([id]))?.get(id);
  const after = before.enabled ? await directory.updatePerson(id, { enabled: false }) : before;
  // The audit entries are what followers hear, so each goes before the state that stops the flow running again:
  // when one fails, the sweep tries again and says it then. Off in Keycloak but not kept as off is that retry.
  if (before.enabled || (lifecycle && !kept?.disabledAt)) {
    await record('person.disabled', { username: after.username });
    await lifecycle?.disabled(id, 'leaver', now());
  }
  await directory.endSessions(id);
  const asked = store ? await store.withdrawLeave(id) : false;
  await record('person.left', {
    username: after.username,
    asked,
    ...(handOverTo ? { handOverTo } : {}),
    ...(run.handOverTo && !handOverTo ? { handOverLost: run.handOverTo } : {}),
    ...(run.note ? { note: run.note } : {}),
    ...(run.lastDay ? { lastDay: run.lastDay } : {}),
  });
  await lifecycle?.left(id, { at: now(), by: run.by, ...(handOverTo ? { handOverTo } : {}) });
  // Apps keep what the leaver owned for someone to hand on; an admin needs to know it's waiting.
  if (run.handOverTo && !handOverTo) {
    await tell?.({
      app: 'admin',
      recipients: [],
      audience: ADMINS,
      key: leaveNoticeKey(id, 'nobody-to-hand-over-to'),
      level: 'needs',
      title: `${after.firstName} ${after.lastName} left, and their work has nobody to go to`,
      detail: 'The person named to take it on can’t sign in any more. Apps keep it until someone hands it on.',
      link: '/people',
    }).catch(() => undefined);
  }
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
export const leaveDueLeavers = async (deps: LeaverDeps & { lifecycle: Pick<LifecycleStore, 'get' | 'disabled' | 'left' | 'dueLeavers'> }, timeZone: string, at = new Date(), warn: (m: string) => void = () => undefined) => {
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
