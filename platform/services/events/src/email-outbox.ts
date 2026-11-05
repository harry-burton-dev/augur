import type pg from 'pg';

/**
 * The notifications waiting to be emailed (ADR 0044, D7). A notification that needs someone (`needs`) is due to be
 * emailed the moment it is added; the notice-emails job sends what is due once a minute, after asking identity how
 * each person wants their notices. Each one ends sent or skipped, with why; one put off by quiet hours waits until
 * they end. The state lives on the notification itself, so a person's notifications go with it when they're deleted.
 */

/** A notification due to be emailed, with what the email needs. */
export interface DueEmail {
  id: string;
  recipient: string;
  app: string;
  kind?: string;
  title: string;
  detail?: string;
  /** Read in AUGUR already: no email is needed. */
  read: boolean;
  createdAt: string;
  /** Sends that failed so far. */
  tries: number;
}

export interface EmailOutbox {
  /** Up to `limit` notifications due by `now`, oldest first. */
  due(limit: number, now?: Date): Promise<DueEmail[]>;
  sent(id: string): Promise<void>;
  /** It won't be emailed, and why (kept for anyone looking into a missing email). */
  skipped(id: string, why: string): Promise<void>;
  /** Due again at `at`: after quiet hours, or after a failed send (`failed`, counted). */
  later(id: string, at: Date, failed?: boolean): Promise<void>;
}

/** Added after the inbox's (007) and kinds (008, 009). */
export const emailMigration = {
  id: '010_notice_emails',
  sql: `
    -- When a notification is due to be emailed (ADR 0044, D7), and how that ended: sent, or skipped and why.
    alter table events.notifications
      add column email_due timestamptz,
      add column email_tries int not null default 0,
      add column emailed_at timestamptz,
      add column email_skipped text;
    create index notifications_email_due on events.notifications (email_due) where email_due is not null and emailed_at is null and email_skipped is null;`,
};

type DueRow = { id: string; recipient: string; app: string; kind: string | null; title: string; detail: string | null; read_at: Date | null; created_at: Date; email_tries: number };

export class PgEmailOutbox implements EmailOutbox {
  constructor(private readonly pool: pg.Pool) {}

  async due(limit: number, now = new Date()) {
    const { rows } = await this.pool.query<DueRow>(
      `select id, recipient, app, kind, title, detail, read_at, created_at, email_tries from events.notifications
       where email_due <= $1 and emailed_at is null and email_skipped is null
       order by email_due, id limit $2`,
      [now, limit],
    );
    return rows.map(
      (r): DueEmail => ({
        id: r.id,
        recipient: r.recipient,
        app: r.app,
        ...(r.kind ? { kind: r.kind } : {}),
        title: r.title,
        ...(r.detail ? { detail: r.detail } : {}),
        read: !!r.read_at,
        createdAt: r.created_at.toISOString(),
        tries: r.email_tries,
      }),
    );
  }

  async sent(id: string) {
    await this.pool.query('update events.notifications set emailed_at = now() where id = $1', [id]);
  }

  async skipped(id: string, why: string) {
    await this.pool.query('update events.notifications set email_skipped = $2 where id = $1', [id, why]);
  }

  async later(id: string, at: Date, failed = false) {
    await this.pool.query(`update events.notifications set email_due = $2, email_tries = email_tries + $3 where id = $1`, [id, at, failed ? 1 : 0]);
  }
}
