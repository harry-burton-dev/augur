import pg from 'pg';
import type { Migration } from '@augur/service-kit';
import type { Person } from './directory.ts';

/**
 * Where each person is in their account's life (ADR 0040, PER-194 spec 4.1 and 4.2). Keycloak holds whether
 * their sign-in is on and whether they still have to choose a password; identity keeps what Keycloak doesn't:
 * when they first and last signed in, why their sign-in went off, and that they left. A person's `state` is
 * worked out from both, so people added before this existed need no backfill.
 */

export type PersonState = 'invited' | 'active' | 'disabled' | 'left';
export type DisabledCause = 'admin' | 'idle' | 'leaver' | 'outside';

export interface Lifecycle {
  joinedAt?: string;
  lastSignInAt?: string;
  disabledAt?: string;
  disabledCause?: DisabledCause;
  left?: { at: string; by: string; handOverTo?: string };
}

export interface LifecycleStore {
  /** What is kept about these people (all of them when no ids are given). */
  get(ids?: string[]): Promise<Map<string, Lifecycle>>;
  /** They signed in at `at`: the first one also makes them joined. */
  signedIn(person: string, at: string): Promise<void>;
  /** Their sign-in went off, and why. */
  disabled(person: string, cause: DisabledCause, at: string): Promise<void>;
  /** Their sign-in came back on. */
  enabled(person: string): Promise<void>;
  /** They left. */
  left(person: string, left: { at: string; by: string; handOverTo?: string }): Promise<void>;
}

/** A person's state: left is for good; then off, invited (no sign-in yet), or active. */
export const stateOf = (p: Pick<Person, 'enabled' | 'invited'>, l: Lifecycle = {}): PersonState => {
  if (l.left) return 'left';
  if (!p.enabled) return 'disabled';
  if (p.invited && !l.lastSignInAt) return 'invited';
  return 'active';
};

/** A person with their state and what is kept about their account's life. */
export const withLifecycle = <P extends Person>(p: P, l: Lifecycle = {}) => ({
  ...p,
  state: stateOf(p, l),
  ...(l.lastSignInAt ? { lastSignInAt: l.lastSignInAt } : {}),
  ...(l.joinedAt ? { joinedAt: l.joinedAt } : {}),
  ...(!p.enabled && !l.left && l.disabledCause ? { disabledCause: l.disabledCause } : {}),
  ...(l.left ? { left: l.left } : {}),
});

export class MemoryLifecycleStore implements LifecycleStore {
  private readonly rows = new Map<string, Lifecycle>();
  private row(person: string) {
    let r = this.rows.get(person);
    if (!r) this.rows.set(person, (r = {}));
    return r;
  }
  async get(ids?: string[]) {
    const out = new Map<string, Lifecycle>();
    for (const [id, r] of this.rows) if (!ids || ids.includes(id)) out.set(id, structuredClone(r));
    return out;
  }
  async signedIn(person: string, at: string) {
    const r = this.row(person);
    r.joinedAt ??= at;
    if (!r.lastSignInAt || r.lastSignInAt < at) r.lastSignInAt = at;
  }
  async disabled(person: string, cause: DisabledCause, at: string) {
    Object.assign(this.row(person), { disabledAt: at, disabledCause: cause });
  }
  async enabled(person: string) {
    const r = this.row(person);
    delete r.disabledAt;
    delete r.disabledCause;
  }
  async left(person: string, left: { at: string; by: string; handOverTo?: string }) {
    this.row(person).left = { ...left };
  }
}

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
];

interface Row {
  person: string;
  joined_at: Date | null;
  last_sign_in_at: Date | null;
  disabled_at: Date | null;
  disabled_cause: DisabledCause | null;
  left_at: Date | null;
  left_by: string | null;
  handover_to: string | null;
}

const iso = (d: Date | null) => (d ? d.toISOString() : undefined);

/** On Postgres; the preference store runs the migrations. */
export class PgLifecycleStore implements LifecycleStore {
  constructor(private readonly pool: pg.Pool) {}

  async get(ids?: string[]) {
    const { rows } = ids
      ? await this.pool.query<Row>('select * from identity.person_lifecycle where person = any($1)', [ids])
      : await this.pool.query<Row>('select * from identity.person_lifecycle');
    return new Map(
      rows.map((r): [string, Lifecycle] => [
        r.person,
        {
          ...(r.joined_at ? { joinedAt: iso(r.joined_at) } : {}),
          ...(r.last_sign_in_at ? { lastSignInAt: iso(r.last_sign_in_at) } : {}),
          ...(r.disabled_at ? { disabledAt: iso(r.disabled_at) } : {}),
          ...(r.disabled_cause ? { disabledCause: r.disabled_cause } : {}),
          ...(r.left_at ? { left: { at: iso(r.left_at)!, by: r.left_by ?? '', ...(r.handover_to ? { handOverTo: r.handover_to } : {}) } } : {}),
        },
      ]),
    );
  }

  async signedIn(person: string, at: string) {
    await this.pool.query(
      `insert into identity.person_lifecycle (person, joined_at, last_sign_in_at) values ($1, $2, $2)
       on conflict (person) do update set
         joined_at = coalesce(person_lifecycle.joined_at, excluded.joined_at),
         last_sign_in_at = greatest(person_lifecycle.last_sign_in_at, excluded.last_sign_in_at),
         updated_at = now()`,
      [person, at],
    );
  }

  async disabled(person: string, cause: DisabledCause, at: string) {
    await this.pool.query(
      `insert into identity.person_lifecycle (person, disabled_at, disabled_cause) values ($1, $2, $3)
       on conflict (person) do update set disabled_at = excluded.disabled_at, disabled_cause = excluded.disabled_cause, updated_at = now()`,
      [person, at, cause],
    );
  }

  async enabled(person: string) {
    await this.pool.query('update identity.person_lifecycle set disabled_at = null, disabled_cause = null, updated_at = now() where person = $1', [person]);
  }

  async left(person: string, { at, by, handOverTo }: { at: string; by: string; handOverTo?: string }) {
    await this.pool.query(
      `insert into identity.person_lifecycle (person, left_at, left_by, handover_to) values ($1, $2, $3, $4)
       on conflict (person) do update set left_at = excluded.left_at, left_by = excluded.left_by, handover_to = excluded.handover_to, updated_at = now()`,
      [person, at, by, handOverTo ?? null],
    );
  }
}
