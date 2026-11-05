import pg from 'pg';
import { runMigrations, type Migration } from '@augur/service-kit';
import { workspaceMigrations } from './workspaces.ts';

/** What someone has chosen for the shell. Every field is optional: what's missing takes the shell's default. */
export interface Preferences {
  reduceMotion?: boolean;
  density?: 'comfortable' | 'compact';
  /** Whether area title cards show on arriving at a floor or opening an app; on unless false. */
  areaTitles?: boolean;
  /** Whether each new notification is also said once as a toast at the bottom of the screen; off unless true. */
  toasts?: boolean;
  away?: boolean;
  /** App ids, most recent first. */
  recent?: string[];
  /** App ids whose notifications land in the stream silently and never on Home. */
  muted?: string[];
  /** Kinds of notification, as "<app>:<kind>", that land silently. */
  quietKinds?: string[];
  /** App ids kept first on Home and in the list of apps. */
  pinned?: string[];
  /** The floor id AUGUR opens on when an address names none. */
  startFloor?: string;
  /** What their away status says, and when it ends (ISO date-time); away ends then by itself. */
  awayMessage?: string;
  awayUntil?: string;
  /** Their time zone (IANA, such as Europe/London); without it, the organisation's, then the browser's. */
  timeZone?: string;
  /** The region whose way of writing dates, times and numbers they want (a language tag such as en-GB); without it, their language's, then the browser's. */
  dateFormat?: string;
  /** A 12- or 24-hour clock; without it, as their date format writes it. */
  clock?: '12' | '24';
  /** How AUGUR reaches them beyond the shell. */
  notifications?: NotificationChoices;
}

/** How a person wants to hear about things (ADR 0036, Notifications). */
export interface NotificationChoices {
  /** An email for each thing that needs them; on unless false. */
  email?: boolean;
  /** One email gathering the rest; none unless chosen. */
  digest?: 'off' | 'daily' | 'weekly';
  /** Hours (HH:MM, their time zone) when nothing is said out loud: no toast, no email. */
  quietHours?: { from: string; to: string };
}

/** Someone has asked to leave (ADR 0040): an admin's leaver flow acts on it; they may take it back until then. */
export interface LeaveRequest {
  requestedAt: string;
  /** What they said, for the admin who acts on it. */
  note?: string;
}

/** Where each person's preferences are kept, and whether they have asked to leave. */
export interface PreferenceStore {
  /** A person's preferences; empty when they have chosen nothing. */
  get(person: string): Promise<Preferences>;
  /** Replaces a person's preferences. */
  put(person: string, prefs: Preferences): Promise<void>;
  /** Their request to leave, if they have one open. */
  leaveRequest(person: string): Promise<LeaveRequest | undefined>;
  /** Records a request to leave, keeping the first one's time when they ask again. */
  requestLeave(person: string, note?: string): Promise<LeaveRequest>;
  /** Takes a request back; false when there was none. */
  withdrawLeave(person: string): Promise<boolean>;
}

/** For tests, and for running identity locally without Postgres. Forgets everything on restart. */
export class MemoryPreferenceStore implements PreferenceStore {
  private prefs = new Map<string, Preferences>();

  async get(person: string) {
    return structuredClone(this.prefs.get(person) ?? {});
  }

  async put(person: string, prefs: Preferences) {
    this.prefs.set(person, structuredClone(prefs));
  }

  private leaving = new Map<string, LeaveRequest>();

  async leaveRequest(person: string) {
    const r = this.leaving.get(person);
    return r ? { ...r } : undefined;
  }

  async requestLeave(person: string, note?: string) {
    const r = { requestedAt: this.leaving.get(person)?.requestedAt ?? new Date().toISOString(), ...(note ? { note } : {}) };
    this.leaving.set(person, r);
    return { ...r };
  }

  async withdrawLeave(person: string) {
    return this.leaving.delete(person);
  }
}

/**
 * Schema changes, applied in order and recorded so each runs once. Identity
 * owns the `identity` schema; no other service reads or writes it.
 */
export const migrations: Migration[] = [
  {
    id: '001_preferences',
    sql: `
      create table identity.preferences (
        person text primary key,
        prefs jsonb not null,
        updated_at timestamptz not null default now()
      );`,
  },
  ...workspaceMigrations,
  {
    id: '004_leave_requests',
    sql: `
      -- Someone asking to leave (ADR 0040), until an admin's leaver flow acts on it or they take it back.
      create table identity.leave_requests (
        person text primary key,
        note text,
        requested_at timestamptz not null default now()
      );`,
  },
];

export class PgPreferenceStore implements PreferenceStore {
  constructor(private readonly pool: pg.Pool) {}

  static async connect(connectionString: string) {
    const store = new PgPreferenceStore(new pg.Pool({ connectionString }));
    await store.migrate();
    return store;
  }

  /** Brings the schema up to date. Safe to run from several instances at once. */
  async migrate() {
    await runMigrations(this.pool, { schema: 'identity', migrations });
  }

  async get(person: string) {
    const { rows } = await this.pool.query<{ prefs: Preferences }>('select prefs from identity.preferences where person = $1', [person]);
    return rows[0]?.prefs ?? {};
  }

  async put(person: string, prefs: Preferences) {
    await this.pool.query(
      `insert into identity.preferences (person, prefs) values ($1, $2)
       on conflict (person) do update set prefs = excluded.prefs, updated_at = now()`,
      [person, prefs],
    );
  }

  async leaveRequest(person: string) {
    const { rows } = await this.pool.query<{ note: string | null; requested_at: Date }>('select note, requested_at from identity.leave_requests where person = $1', [person]);
    const r = rows[0];
    return r ? { requestedAt: r.requested_at.toISOString(), ...(r.note ? { note: r.note } : {}) } : undefined;
  }

  async requestLeave(person: string, note?: string) {
    const { rows } = await this.pool.query<{ note: string | null; requested_at: Date }>(
      `insert into identity.leave_requests (person, note) values ($1, $2)
       on conflict (person) do update set note = excluded.note
       returning note, requested_at`,
      [person, note ?? null],
    );
    const r = rows[0]!;
    return { requestedAt: r.requested_at.toISOString(), ...(r.note ? { note: r.note } : {}) };
  }

  async withdrawLeave(person: string) {
    const { rowCount } = await this.pool.query('delete from identity.leave_requests where person = $1', [person]);
    return (rowCount ?? 0) > 0;
  }

  close() {
    return this.pool.end();
  }
}
