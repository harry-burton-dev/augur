import pg from 'pg';
import type { Migration, NewAuditEntry } from '@augur/service-kit';
import type { Directory } from './directory.ts';
import type { LifecycleStore } from './lifecycle.ts';

/**
 * Noticing what changed in Keycloak without AUGUR (PER-194 spec 4.7): someone's sign-in turned off or back on
 * in Keycloak's console, or later by Keycloak's own idle Workflow, which ends no sessions and tells nobody.
 * Every few minutes identity compares each account's sign-in with what it last knew, and for each change ends
 * their sessions (when turned off), keeps the change, and records it in Activity as Keycloak's doing, so
 * followers hear platform.person.disabled or platform.person.enabled as they do for an admin's change.
 *
 * A turn-off is put down to being idle when the person's last sign-in is as old as the organisation's turn-off
 * days, which is when Keycloak's idle-account Workflow turns them off.
 *
 * The first run only takes note: accounts already off then were turned off before identity kept why, so they
 * are kept as off with no cause and nothing is announced. A leaver turned back on in Keycloak's console is
 * left alone here: Admin still shows them as left.
 */

export const KEYCLOAK_ACTOR = { id: 'keycloak', kind: 'service' } as const;

export interface ReconcileStore {
  /** When identity first compared, if it has. */
  since(): Promise<string | undefined>;
  /** It has now compared for the first time. */
  started(at: string): Promise<void>;
  /** Runs fn unless another identity copy is already comparing; true if it ran. */
  alone(fn: () => Promise<void>): Promise<boolean>;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Why a sign-in went off in Keycloak: for being idle (its Workflow) when idle accounts are on and the last
 * sign-in is at least the turn-off days old, less a day for the Workflow's own timing; otherwise unknown.
 */
export const causeOf = (lastSignInAt: string | undefined, at: string, idle?: { on: boolean; turnOffDays: number }): 'idle' | undefined =>
  idle?.on && lastSignInAt && new Date(at).getTime() - new Date(lastSignInAt).getTime() >= (idle.turnOffDays - 1) * DAY ? 'idle' : undefined;

export interface ReconcileResult {
  disabled: string[];
  enabled: string[];
  /** Already off when identity first compared. */
  noted: string[];
}

export async function reconcile({
  directory,
  lifecycle,
  store,
  audit,
  idle,
  now = () => new Date().toISOString(),
}: {
  directory: Pick<Directory, 'people' | 'person' | 'endSessions'>;
  lifecycle: Pick<LifecycleStore, 'get' | 'disabled' | 'enabled'>;
  store: ReconcileStore;
  audit?: (entry: NewAuditEntry) => Promise<unknown>;
  /** The organisation's idle-account days, to tell a turn-off for being idle from one made by hand. */
  idle?: () => Promise<{ on: boolean; turnOffDays: number }>;
  now?: () => string;
}): Promise<ReconcileResult | undefined> {
  const result: ReconcileResult = { disabled: [], enabled: [], noted: [] };
  const ran = await store.alone(async () => {
    const first = !(await store.since());
    const people = await directory.people();
    const known = await lifecycle.get(people.map((p) => p.id));
    const offHere = (id: string) => !!known.get(id)?.disabledAt;
    const days = idle ? await idle().catch(() => undefined) : undefined;
    const changed = people.filter((p) => !known.get(p.id)?.left && p.enabled === offHere(p.id));
    for (const listed of changed) {
      // An admin's change in AUGUR writes Keycloak first and identity's record just after: look again, so a
      // change that is still landing isn't taken for one made outside.
      const [person, again] = await Promise.all([directory.person(listed.id), lifecycle.get([listed.id]).then((m) => m.get(listed.id))]);
      if (again?.left || person.enabled !== !!again?.disabledAt) continue;
      const at = now();
      const cause = first ? undefined : causeOf(again?.lastSignInAt, at, days);
      if (!person.enabled) {
        await lifecycle.disabled(person.id, cause, at);
        if (first) {
          result.noted.push(person.id);
          continue;
        }
        await directory.endSessions(person.id);
        result.disabled.push(person.id);
      } else {
        await lifecycle.enabled(person.id);
        if (first) continue;
        result.enabled.push(person.id);
      }
      await audit?.({
        actor: { ...KEYCLOAK_ACTOR },
        app: 'identity',
        action: person.enabled ? 'person.enabled' : 'person.disabled',
        target: person.id,
        detail: { username: person.username, outside: true, ...(!person.enabled && cause ? { cause, days: days!.turnOffDays } : {}) },
      });
    }
    if (first) await store.started(now());
  });
  return ran ? result : undefined;
}

export const reconcileMigrations: Migration[] = [
  {
    id: 'reconcile_001_since',
    sql: `
      -- When identity first compared each account's sign-in with Keycloak's (PER-194).
      create table identity.lifecycle_reconcile (
        only_row boolean primary key default true check (only_row),
        since timestamptz not null
      );`,
  },
];

/** On Postgres; the preference store runs the migrations. One identity copy compares at a time. */
export class PgReconcileStore implements ReconcileStore {
  constructor(private readonly pool: pg.Pool) {}

  async since() {
    const { rows } = await this.pool.query<{ since: Date }>('select since from identity.lifecycle_reconcile');
    return rows[0]?.since.toISOString();
  }

  async started(at: string) {
    await this.pool.query('insert into identity.lifecycle_reconcile (only_row, since) values (true, $1) on conflict (only_row) do nothing', [at]);
  }

  async alone(fn: () => Promise<void>) {
    const client = await this.pool.connect();
    try {
      const { rows } = await client.query<{ got: boolean }>("select pg_try_advisory_lock(hashtext('identity.reconcile')) as got");
      if (!rows[0]?.got) return false;
      try {
        await fn();
        return true;
      } finally {
        await client.query("select pg_advisory_unlock(hashtext('identity.reconcile'))");
      }
    } finally {
      client.release();
    }
  }
}
