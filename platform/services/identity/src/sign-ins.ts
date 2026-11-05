import pg from 'pg';
import type { Migration, NewAuditEntry } from '@augur/service-kit';

/**
 * Sign-ins in Activity (ADR 0040, PER-194 spec 4.4). Keycloak records each sign-in, failed sign-in and change to how
 * someone signs in, and keeps them for REALM_SIGN_IN_EVENT_DAYS. Identity copies them into Activity as they happen,
 * so Activity, its download and its retention cover them like every other change. Each entry carries
 * `detail.kind = 'sign-in'`, which Activity's Sign-ins filter uses. Only new ones are copied: a deployment's first
 * run starts from now, not from what Keycloak already holds.
 */

/** What Keycloak's admin API gives for one event (`GET /admin/realms/{realm}/events`). */
export interface KcEvent {
  id?: string;
  time: number;
  type: string;
  userId?: string;
  sessionId?: string;
  clientId?: string;
  ipAddress?: string;
  error?: string;
  details?: Record<string, string>;
}

/** Where copying has got to: the newest event's time, and which events at that time are already in. */
export interface SignInCursor {
  time: number;
  seen: string[];
}

export interface SignInCursorStore {
  load(): Promise<SignInCursor | undefined>;
  save(cursor: SignInCursor): Promise<void>;
  /** Runs `fn` only if no other identity is copying right now; false when one is. */
  alone(fn: () => Promise<void>): Promise<boolean>;
}

/** Which Keycloak events are copied, and the action Activity records for each. */
export const SIGN_IN_ACTIONS: Record<string, string> = {
  LOGIN: 'sign-in.succeeded',
  LOGIN_ERROR: 'sign-in.failed',
  USER_DISABLED_BY_TEMPORARY_LOCKOUT: 'sign-in.locked',
  LOGOUT: 'sign-in.signed-out',
  UPDATE_PASSWORD: 'account.password-changed',
  UPDATE_CREDENTIAL: 'account.two-step-added',
  UPDATE_TOTP: 'account.two-step-added',
  REMOVE_CREDENTIAL: 'account.two-step-removed',
  REMOVE_TOTP: 'account.two-step-removed',
  UPDATE_EMAIL: 'account.email-changed',
  VERIFY_EMAIL: 'account.email-verified',
  IDENTITY_PROVIDER_FIRST_LOGIN: 'sign-in.federated-first',
  FEDERATED_IDENTITY_LINK: 'sign-in.linked',
};

/** A failed sign-in for a name nobody has: counted per hour in one entry, not copied one by one. */
export const UNKNOWN_FAILURES = 'sign-in.failed-unknown';
/** At most this many addresses are kept on one hour's count of unknown-name failures. */
const UNKNOWN_IPS = 20;

/** Events read per page, and the most pages one run reads back before it gives up on reaching the cursor. */
const PAGE = 100;
const PAGES = 500;
const HOUR = 3_600_000;

/** Keycloak's id for an event, or what stands in for it on a Keycloak that gives none. */
const keyOf = (e: KcEvent) => e.id ?? `${e.time}:${e.type}:${e.userId ?? ''}:${e.sessionId ?? ''}`;

const isUnknownFailure = (e: KcEvent) => e.type === 'LOGIN_ERROR' && !e.userId;

/** A password changed through UPDATE_CREDENTIAL is a password change, not a second step. */
const actionOf = (e: KcEvent) => (e.type === 'UPDATE_CREDENTIAL' && e.details?.credential_type === 'password' ? 'account.password-changed' : SIGN_IN_ACTIONS[e.type]!);

/** How someone signed in: a passkey, through the organisation's sign-in, or a password. */
const methodOf = (e: KcEvent): string | undefined => {
  if (e.type !== 'LOGIN') return undefined;
  if (e.details?.identity_provider) return 'federated';
  if (e.details?.auth_method === 'webauthn' || e.details?.credential_type?.startsWith('webauthn')) return 'passkey';
  return 'password';
};

/** One event as an Activity entry, under the person it happened to. */
export const signInEntry = (e: KcEvent): NewAuditEntry => {
  const method = methodOf(e);
  const credential = /two-step/.test(actionOf(e)) ? e.details?.credential_type : undefined;
  const provider = e.details?.identity_provider;
  const email = e.type === 'UPDATE_EMAIL' && (e.details?.previous_email || e.details?.updated_email) ? { from: e.details.previous_email, to: e.details.updated_email } : undefined;
  const detail = {
    kind: 'sign-in',
    at: new Date(e.time).toISOString(),
    keycloakEvent: keyOf(e),
    ...(e.clientId ? { client: e.clientId } : {}),
    ...(e.ipAddress ? { ip: e.ipAddress } : {}),
    ...(e.error ? { error: e.error } : {}),
    ...(method ? { method } : {}),
    ...(credential ? { credential } : {}),
    ...(provider && e.type !== 'LOGIN' ? { provider } : {}),
    ...(email ? { email } : {}),
  };
  return { actor: { id: e.userId ?? 'unknown', kind: 'user' }, app: 'identity', action: actionOf(e), ...(e.userId ? { target: e.userId } : {}), detail };
};

/** One hour's failed sign-ins for names nobody has, as one entry by identity itself. */
export const unknownFailuresEntry = (hour: number, failures: KcEvent[]): NewAuditEntry => {
  const ips = [...new Set(failures.map((e) => e.ipAddress).filter((ip): ip is string => !!ip))].slice(0, UNKNOWN_IPS);
  return {
    actor: { id: 'identity', kind: 'service' },
    app: 'identity',
    action: UNKNOWN_FAILURES,
    detail: { kind: 'sign-in', at: new Date(hour).toISOString(), count: failures.length, ...(ips.length ? { ips } : {}) },
  };
};

export interface SignInCopier {
  /** Reads Keycloak's events (a path under the realm's admin API, such as `/events?type=LOGIN`). */
  events: (path: string) => Promise<KcEvent[]>;
  store: SignInCursorStore;
  audit: (entry: NewAuditEntry) => Promise<void>;
  now?: () => number;
  /** Told each time someone signs in, with when, so their last sign-in is kept. */
  signedIn?: (person: string, at: string) => Promise<void>;
  /** Told when more events arrived since the last run than one run reads, so the oldest of them were not copied. */
  warn?: (message: string) => void;
}

/** Copies the sign-ins since the last run into the audit log, oldest first; returns how many. */
export const copySignIns = async ({ events, store, audit, now = Date.now, warn = console.warn, signedIn }: SignInCopier): Promise<number> => {
  let copied = 0;
  await store.alone(async () => {
    const cursor = await store.load();
    if (!cursor) {
      await store.save({ time: now(), seen: [] });
      return;
    }
    // Keycloak filters by day and answers newest first: read back until the cursor.
    const day = new Date(cursor.time).toISOString().slice(0, 10);
    const types = Object.keys(SIGN_IN_ACTIONS).map((t) => `type=${t}`).join('&');
    const fresh: KcEvent[] = [];
    // An event arriving while pages are read pushes the rest down a place, so one can show up twice.
    const got = new Set<string>();
    let reached = false;
    read: for (let page = 0; page < PAGES; page++) {
      const batch = await events(`/events?${types}&dateFrom=${day}&first=${page * PAGE}&max=${PAGE}`);
      for (const e of batch) {
        if (e.time < cursor.time) {
          reached = true;
          break read;
        }
        if ((e.time === cursor.time && cursor.seen.includes(keyOf(e))) || got.has(keyOf(e))) continue;
        got.add(keyOf(e));
        fresh.push(e);
      }
      if (batch.length < PAGE) {
        reached = true;
        break;
      }
    }
    if (!reached) warn(`More than ${PAGES * PAGE} sign-in events arrived since the last copy: Activity has the newest ${fresh.length}, not the ones before them.`);
    // Oldest first. Failures for unknown names wait in their hour, written as one count when the hour moves on
    // or this run ends; the cursor only passes them once that count is in.
    let at = cursor;
    const advance = (e: KcEvent) => {
      at = e.time === at.time ? { time: at.time, seen: [...at.seen, keyOf(e)] } : { time: e.time, seen: [keyOf(e)] };
    };
    let hour: { start: number; failures: KcEvent[] } | undefined;
    const flushHour = async () => {
      if (!hour) return;
      await audit(unknownFailuresEntry(hour.start, hour.failures));
      for (const f of hour.failures) advance(f);
      await store.save(at);
      copied += hour.failures.length;
      hour = undefined;
    };
    for (const e of fresh.reverse()) {
      if (isUnknownFailure(e)) {
        const start = Math.floor(e.time / HOUR) * HOUR;
        if (hour && hour.start !== start) await flushHour();
        hour ??= { start, failures: [] };
        hour.failures.push(e);
        continue;
      }
      // A known event after a waiting hour: that hour is written first, so the cursor never skips it.
      await flushHour();
      await audit(signInEntry(e));
      if (e.userId && (e.type === 'LOGIN' || e.type === 'IDENTITY_PROVIDER_FIRST_LOGIN')) await signedIn?.(e.userId, new Date(e.time).toISOString());
      advance(e);
      // Kept after each one, so a failure part way never copies one twice.
      await store.save(at);
      copied++;
    }
    await flushHour();
  });
  return copied;
};

export class MemorySignInCursorStore implements SignInCursorStore {
  private cursor?: SignInCursor;
  private busy = false;
  async load() {
    return this.cursor && { ...this.cursor, seen: [...this.cursor.seen] };
  }
  async save(cursor: SignInCursor) {
    this.cursor = { ...cursor, seen: [...cursor.seen] };
  }
  async alone(fn: () => Promise<void>) {
    if (this.busy) return false;
    this.busy = true;
    try {
      await fn();
      return true;
    } finally {
      this.busy = false;
    }
  }
}

export const signInMigrations: Migration[] = [
  {
    id: 'signins_001_cursor',
    sql: `
      -- How far identity has copied Keycloak's sign-in events into Activity (ADR 0040).
      create table identity.sign_in_cursor (
        only_row boolean primary key default true check (only_row),
        at_ms bigint not null,
        seen text[] not null default '{}'
      );`,
  },
];

/** On Postgres; the preference store runs the migrations. One identity copies at a time, by an advisory lock. */
export class PgSignInCursorStore implements SignInCursorStore {
  constructor(private readonly pool: pg.Pool) {}

  async load() {
    const { rows } = await this.pool.query<{ at_ms: string; seen: string[] }>('select at_ms, seen from identity.sign_in_cursor');
    return rows[0] ? { time: Number(rows[0].at_ms), seen: rows[0].seen } : undefined;
  }

  async save({ time, seen }: SignInCursor) {
    await this.pool.query(
      `insert into identity.sign_in_cursor (only_row, at_ms, seen) values (true, $1, $2)
       on conflict (only_row) do update set at_ms = excluded.at_ms, seen = excluded.seen`,
      [time, seen],
    );
  }

  async alone(fn: () => Promise<void>) {
    const client = await this.pool.connect();
    try {
      const { rows } = await client.query<{ got: boolean }>("select pg_try_advisory_lock(hashtext('identity.sign-in-copy')) as got");
      if (!rows[0]?.got) return false;
      try {
        await fn();
        return true;
      } finally {
        await client.query("select pg_advisory_unlock(hashtext('identity.sign-in-copy'))");
      }
    } finally {
      client.release();
    }
  }
}
