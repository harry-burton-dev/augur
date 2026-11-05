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
  /** What their away status says, and when it ends (ISO date-time); away ends then by itself. */
  awayMessage?: string;
  awayUntil?: string;
  /** Their time zone (IANA, such as Europe/London); without it, the organisation's, then the browser's. */
  timeZone?: string;
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

/** Where each person's preferences are kept. */
export interface PreferenceStore {
  /** A person's preferences; empty when they have chosen nothing. */
  get(person: string): Promise<Preferences>;
  /** Replaces a person's preferences. */
  put(person: string, prefs: Preferences): Promise<void>;
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

  close() {
    return this.pool.end();
  }
}
