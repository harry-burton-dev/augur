import pg from 'pg';
import type { Migration, NewAuditEntry } from '@augur/service-kit';
import { DEPLOYMENT_ADMIN_ROLE, type Directory, type Person } from './directory.ts';
import { BRUTE_FORCE_POLICY } from './realm.ts';

/**
 * Where each person is in their account's life (ADR 0040, PER-194 spec 4.1 and 4.2). Keycloak holds whether
 * their sign-in is on and whether they still have to choose a password; identity keeps what Keycloak doesn't:
 * when they first and last signed in, why their sign-in went off, and that they left. A person's `state` is
 * worked out from both, so people added before this existed need no backfill.
 */

export type PersonState = 'invited' | 'active' | 'disabled' | 'left';
export type DisabledCause = 'admin' | 'idle' | 'leaver' | 'outside';

export type InviteMethod = 'email' | 'temporary-password';

export interface Invite {
  method: InviteMethod;
  /** When the last invite email went; none for a one-time password, or when the email couldn't be sent. */
  sentAt?: string;
  expiresAt?: string;
  /** Invite emails sent. */
  count: number;
}

export interface Lifecycle {
  invite?: Invite;
  joinedAt?: string;
  lastSignInAt?: string;
  disabledAt?: string;
  disabledCause?: DisabledCause;
  left?: { at: string; by: string; handOverTo?: string };
  /** When the sign-in service last locked them out for wrong passwords (a copied lockout event). */
  lockedAt?: string;
  /** A leaver flow set for after their last day (`YYYY-MM-DD` in the organisation's time zone), not yet run. */
  leaving?: Leaving;
  /** When they first signed in through the organisation's sign-in (Entra), which they sign in with since. */
  federatedAt?: string;
}

/** A leaver flow an admin set for later: it runs once `on`, their last day, is over. */
export interface Leaving {
  on: string;
  by: string;
  handOverTo?: string;
  note?: string;
}

export interface LifecycleStore {
  /** What is kept about these people (all of them when no ids are given). */
  get(ids?: string[]): Promise<Map<string, Lifecycle>>;
  /** How they were asked to start; with `sent`, an invite email went (again) and lasts until `expiresAt`. */
  invited(person: string, method: InviteMethod, sent?: { at: string; expiresAt: string }): Promise<void>;
  /** They signed in at `at`: the first one also makes them joined. */
  signedIn(person: string, at: string): Promise<void>;
  /** Their sign-in went off, and why (no cause: it was already off when identity started noticing). */
  disabled(person: string, cause: DisabledCause | undefined, at: string): Promise<void>;
  /** Their sign-in came back on. */
  enabled(person: string): Promise<void>;
  /** They left. */
  left(person: string, left: { at: string; by: string; handOverTo?: string }): Promise<void>;
  /** The sign-in service locked them out at `at`; a later sign-in or an unlock clears it. */
  locked(person: string, at: string): Promise<void>;
  /** An admin lifted the lockout. */
  unlocked(person: string): Promise<void>;
  /** Sets (or moves) their leaver flow for after their last day. */
  scheduleLeave(person: string, leaving: Leaving): Promise<void>;
  /** Cancels a leaver flow set for later; false when none was set. */
  cancelLeave(person: string): Promise<boolean>;
  /** Everyone whose last day is before `today` (`YYYY-MM-DD`) and who hasn't left yet. */
  dueLeavers(today: string): Promise<(Leaving & { person: string })[]>;
  /** They signed in through the organisation's sign-in for the first time; false if that was already known. */
  federated(person: string, at: string): Promise<boolean>;
}

/** The organisation's idle-account days, and whether the sign-in service can warn anyone (email works). */
export interface IdlePolicy {
  on: boolean;
  warningDays: number;
  turnOffDays: number;
  canEmail: boolean;
}

/** When someone's sign-in turns off for being idle, or why it doesn't (PER-194 spec 3.2 and 4.7). */
export type Idle =
  | { warnsAt: string; turnsOffAt: string; warned: boolean }
  | { exempt: 'off' | 'no-email' | 'deployment-admin' | 'not-tracked' };

const DAY = 24 * 60 * 60 * 1000;

/**
 * Keycloak's idle-account Workflow counts from each sign-in, warns after the warning days and turns the
 * sign-in off at the turn-off days (realm.ts `idleWorkflow`). It leaves deployment admins out, isn't made
 * without email, and only counts from a sign-in, so someone AUGUR hasn't seen sign in isn't counted yet.
 */
export const idleOf = (p: Pick<Person, 'roles'>, l: Lifecycle, policy: IdlePolicy, now = new Date()): Idle => {
  if (!policy.on) return { exempt: 'off' };
  if (!policy.canEmail) return { exempt: 'no-email' };
  if (p.roles.includes(DEPLOYMENT_ADMIN_ROLE.name)) return { exempt: 'deployment-admin' };
  if (!l.lastSignInAt) return { exempt: 'not-tracked' };
  const from = new Date(l.lastSignInAt).getTime();
  const warnsAt = new Date(from + policy.warningDays * DAY);
  return { warnsAt: warnsAt.toISOString(), turnsOffAt: new Date(from + policy.turnOffDays * DAY).toISOString(), warned: warnsAt <= now };
};

/**
 * Locked out for wrong passwords: a lockout copied from the sign-in service since their last sign-in, recent
 * enough that the realm's longest wait hasn't passed. Admin asks the sign-in service itself for one person.
 */
export const lockedOf = (l: Lifecycle, now = new Date()) =>
  !!l.lockedAt &&
  (!l.lastSignInAt || new Date(l.lockedAt) > new Date(l.lastSignInAt)) &&
  now.getTime() - new Date(l.lockedAt).getTime() < BRUTE_FORCE_POLICY.maxFailureWaitSeconds * 1000;

/** A person's state: left is for good; then off, invited (no sign-in yet), or active. */
export const stateOf = (p: Pick<Person, 'enabled' | 'invited'>, l: Lifecycle = {}): PersonState => {
  if (l.left) return 'left';
  if (!p.enabled) return 'disabled';
  if (p.invited && !l.lastSignInAt) return 'invited';
  return 'active';
};

/** A person with their state and what is kept about their account's life. */
export const withLifecycle = <P extends Person>(p: P, l: Lifecycle = {}, now = new Date(), policy?: IdlePolicy) => ({
  ...p,
  state: stateOf(p, l),
  ...(l.invite ? { invite: { ...l.invite, expired: stateOf(p, l) === 'invited' && !!l.invite.expiresAt && new Date(l.invite.expiresAt) < now } } : {}),
  ...(l.lastSignInAt ? { lastSignInAt: l.lastSignInAt } : {}),
  ...(l.joinedAt ? { joinedAt: l.joinedAt } : {}),
  ...(!p.enabled && !l.left && l.disabledCause ? { disabledCause: l.disabledCause } : {}),
  ...(l.left ? { left: l.left } : {}),
  ...(stateOf(p, l) === 'active' && lockedOf(l, now) ? { locked: true } : {}),
  ...(!l.left && l.leaving ? { leaving: { on: l.leaving.on, ...(l.leaving.handOverTo ? { handOverTo: l.leaving.handOverTo } : {}) } } : {}),
  ...(policy && stateOf(p, l) === 'active' ? { idle: idleOf(p, l, policy, now) } : {}),
  source: l.federatedAt ? ('federated' as const) : ('local' as const),
});

export const lifecycleMigrations: Migration[] = [
  {
    id: 'lifecycle_001_people',
    sql: `
      -- What identity keeps about each account's life that Keycloak doesn't (ADR 0040, PER-194).
      create table identity.person_lifecycle (
        person text primary key,
        joined_at timestamptz,
        last_sign_in_at timestamptz,
        disabled_at timestamptz,
        disabled_cause text check (disabled_cause in ('admin', 'idle', 'leaver', 'outside')),
        left_at timestamptz,
        left_by text,
        handover_to text,
        updated_at timestamptz not null default now()
      );`,
  },
  {
    id: 'lifecycle_002_invites',
    sql: `
      -- How each person was asked to start: an invite email (and when it runs out), or a one-time password.
      alter table identity.person_lifecycle
        add column invite_method text check (invite_method in ('email', 'temporary-password')),
        add column invite_sent_at timestamptz,
        add column invite_expires_at timestamptz,
        add column invite_count int not null default 0;`,
  },
];

/** Added after identity's released migrations, so it runs after them. */
export const lifecycleLeavingMigrations: Migration[] = [
  {
    id: 'lifecycle_003_locked_leaving',
    sql: `
      -- A lockout for wrong passwords, and a leaver flow set for after someone's last day (PER-194).
      alter table identity.person_lifecycle
        add column locked_at timestamptz,
        add column leave_on date,
        add column leave_by text,
        add column leave_handover_to text,
        add column leave_note text;
      create index person_lifecycle_leaving on identity.person_lifecycle (leave_on) where leave_on is not null and left_at is null;`,
  },
  {
    id: 'lifecycle_004_federated',
    sql: `
      -- When someone first signed in through the organisation's sign-in (Entra), which they sign in with since (PER-194).
      alter table identity.person_lifecycle add column federated_at timestamptz;`,
  },
];

interface Row {
  person: string;
  invite_method: InviteMethod | null;
  invite_sent_at: Date | null;
  invite_expires_at: Date | null;
  invite_count: number;
  joined_at: Date | null;
  last_sign_in_at: Date | null;
  disabled_at: Date | null;
  disabled_cause: DisabledCause | null;
  left_at: Date | null;
  left_by: string | null;
  handover_to: string | null;
  locked_at: Date | null;
  leave_day: string | null;
  leave_by: string | null;
  leave_handover_to: string | null;
  leave_note: string | null;
  federated_at: Date | null;
}

const iso = (d: Date | null) => (d ? d.toISOString() : undefined);
const leavingOf = (r: Pick<Row, 'leave_day' | 'leave_by' | 'leave_handover_to' | 'leave_note'>): Leaving => ({
  on: r.leave_day!,
  by: r.leave_by ?? '',
  ...(r.leave_handover_to ? { handOverTo: r.leave_handover_to } : {}),
  ...(r.leave_note ? { note: r.leave_note } : {}),
});
// A date column read as its 'YYYY-MM-DD' text, not as a Date at the server's midnight.
const LEAVE_ON = "to_char(leave_on, 'YYYY-MM-DD') as leave_day";

/** On Postgres; the preference store runs the migrations. */
export class PgLifecycleStore implements LifecycleStore {
  constructor(private readonly pool: pg.Pool) {}

  async get(ids?: string[]) {
    const { rows } = ids
      ? await this.pool.query<Row>(`select *, ${LEAVE_ON} from identity.person_lifecycle where person = any($1)`, [ids])
      : await this.pool.query<Row>(`select *, ${LEAVE_ON} from identity.person_lifecycle`);
    return new Map(
      rows.map((r): [string, Lifecycle] => [
        r.person,
        {
          ...(r.invite_method
            ? { invite: { method: r.invite_method, count: r.invite_count, ...(r.invite_sent_at ? { sentAt: iso(r.invite_sent_at), expiresAt: iso(r.invite_expires_at) } : {}) } }
            : {}),
          ...(r.joined_at ? { joinedAt: iso(r.joined_at) } : {}),
          ...(r.last_sign_in_at ? { lastSignInAt: iso(r.last_sign_in_at) } : {}),
          ...(r.disabled_at ? { disabledAt: iso(r.disabled_at) } : {}),
          ...(r.disabled_cause ? { disabledCause: r.disabled_cause } : {}),
          ...(r.left_at ? { left: { at: iso(r.left_at)!, by: r.left_by ?? '', ...(r.handover_to ? { handOverTo: r.handover_to } : {}) } } : {}),
          ...(r.locked_at ? { lockedAt: iso(r.locked_at) } : {}),
          ...(r.leave_day ? { leaving: leavingOf(r) } : {}),
          ...(r.federated_at ? { federatedAt: iso(r.federated_at) } : {}),
        },
      ]),
    );
  }

  async invited(person: string, method: InviteMethod, sent?: { at: string; expiresAt: string }) {
    await this.pool.query(
      `insert into identity.person_lifecycle (person, invite_method, invite_sent_at, invite_expires_at, invite_count) values ($1, $2, $3, $4, $5)
       on conflict (person) do update set
         invite_method = excluded.invite_method,
         invite_sent_at = coalesce(excluded.invite_sent_at, person_lifecycle.invite_sent_at),
         invite_expires_at = coalesce(excluded.invite_expires_at, person_lifecycle.invite_expires_at),
         invite_count = person_lifecycle.invite_count + excluded.invite_count,
         updated_at = now()`,
      [person, method, sent?.at ?? null, sent?.expiresAt ?? null, sent ? 1 : 0],
    );
  }

  async signedIn(person: string, at: string) {
    await this.pool.query(
      `insert into identity.person_lifecycle (person, joined_at, last_sign_in_at) values ($1, $2, $2)
       on conflict (person) do update set
         joined_at = coalesce(person_lifecycle.joined_at, excluded.joined_at),
         last_sign_in_at = greatest(person_lifecycle.last_sign_in_at, excluded.last_sign_in_at),
         locked_at = case when person_lifecycle.locked_at <= excluded.last_sign_in_at then null else person_lifecycle.locked_at end,
         updated_at = now()`,
      [person, at],
    );
  }

  async disabled(person: string, cause: DisabledCause | undefined, at: string) {
    await this.pool.query(
      `insert into identity.person_lifecycle (person, disabled_at, disabled_cause) values ($1, $2, $3)
       on conflict (person) do update set disabled_at = excluded.disabled_at, disabled_cause = excluded.disabled_cause, updated_at = now()`,
      [person, at, cause ?? null],
    );
  }

  async enabled(person: string) {
    await this.pool.query('update identity.person_lifecycle set disabled_at = null, disabled_cause = null, updated_at = now() where person = $1', [person]);
  }

  async left(person: string, { at, by, handOverTo }: { at: string; by: string; handOverTo?: string }) {
    await this.pool.query(
      `insert into identity.person_lifecycle (person, left_at, left_by, handover_to) values ($1, $2, $3, $4)
       on conflict (person) do update set left_at = excluded.left_at, left_by = excluded.left_by, handover_to = excluded.handover_to,
         leave_on = null, leave_by = null, leave_handover_to = null, leave_note = null, updated_at = now()`,
      [person, at, by, handOverTo ?? null],
    );
  }

  async locked(person: string, at: string) {
    await this.pool.query(
      `insert into identity.person_lifecycle (person, locked_at) values ($1, $2)
       on conflict (person) do update set locked_at = greatest(person_lifecycle.locked_at, excluded.locked_at), updated_at = now()`,
      [person, at],
    );
  }

  async unlocked(person: string) {
    await this.pool.query('update identity.person_lifecycle set locked_at = null, updated_at = now() where person = $1', [person]);
  }

  async scheduleLeave(person: string, { on, by, handOverTo, note }: Leaving) {
    await this.pool.query(
      `insert into identity.person_lifecycle (person, leave_on, leave_by, leave_handover_to, leave_note) values ($1, $2, $3, $4, $5)
       on conflict (person) do update set leave_on = excluded.leave_on, leave_by = excluded.leave_by,
         leave_handover_to = excluded.leave_handover_to, leave_note = excluded.leave_note, updated_at = now()`,
      [person, on, by, handOverTo ?? null, note ?? null],
    );
  }

  async cancelLeave(person: string) {
    const { rowCount } = await this.pool.query(
      `update identity.person_lifecycle set leave_on = null, leave_by = null, leave_handover_to = null, leave_note = null, updated_at = now()
       where person = $1 and leave_on is not null and left_at is null`,
      [person],
    );
    return (rowCount ?? 0) > 0;
  }

  async federated(person: string, at: string) {
    const { rowCount } = await this.pool.query(
      `insert into identity.person_lifecycle (person, federated_at) values ($1, $2)
       on conflict (person) do update set federated_at = excluded.federated_at, updated_at = now() where person_lifecycle.federated_at is null`,
      [person, at],
    );
    return (rowCount ?? 0) > 0;
  }

  async dueLeavers(today: string) {
    const { rows } = await this.pool.query<Row>(
      `select person, ${LEAVE_ON}, leave_by, leave_handover_to, leave_note from identity.person_lifecycle
       where leave_on is not null and left_at is null and leave_on < $1::date order by leave_on, person`,
      [today],
    );
    return rows.map((r) => ({ person: r.person, ...leavingOf(r) }));
  }
}

/** How long after an account was made its first sign-in through Entra counts as having made it. */
const MADE_BY_SIGN_IN_MS = 2 * 60_000;

/**
 * Someone's first sign-in through the organisation's sign-in (ADR 0040, PER-194 spec 4.8): kept, so Admin says
 * they sign in with it, and when the sign-in made their account (nobody had their email), Activity records
 * `person.added` with `method: 'federated'`, which followers hear as `platform.person.joined`. An account that
 * was linked had its own `person.added` when an admin added it.
 */
export const federatedFirstSignIn = async (
  { lifecycle, directory, audit }: { lifecycle: Pick<LifecycleStore, 'federated' | 'get'>; directory: Pick<Directory, 'person'>; audit?: (entry: NewAuditEntry) => Promise<unknown> },
  person: string,
  at: string,
) => {
  const before = (await lifecycle.get([person])).get(person);
  if (!(await lifecycle.federated(person, at))) return;
  const p = await directory.person(person);
  const made = !before?.invite && !!p.createdAt && Math.abs(Date.parse(p.createdAt) - Date.parse(at)) <= MADE_BY_SIGN_IN_MS;
  if (made) await audit?.({ actor: { id: 'keycloak', kind: 'service' }, app: 'identity', action: 'person.added', target: person, detail: { username: p.username, roles: p.roles, departments: p.departments, method: 'federated' } });
};
