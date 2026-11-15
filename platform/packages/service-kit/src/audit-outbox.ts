import { randomUUID } from 'node:crypto';
import type { ConnectionPool, Queryable } from './domain-events.js';
import { postAudit, type NewAuditEntry } from './events.js';
import { LOCK_NAMESPACE } from './locks.js';
import { ServiceCallError, type ServiceCredentials } from './service.js';

/**
 * An outbox for a service's audit entries: each entry is written to the service's own database and a relay takes it
 * to the events service, so the entry, and the domain event the events service publishes for it, outlives the events
 * service being down or this one restarting. Pass `add` the transaction's client to keep an entry with a change in
 * the same database; a change made elsewhere (in Keycloak, say) is followed by its entry, not joined to it.
 *
 * The table is the service's own, made by its own migration. `AUDIT_OUTBOX_COLUMNS` is what a new one holds; a
 * migration keeps its own copy, since a shipped migration never changes.
 */
export const AUDIT_OUTBOX_COLUMNS = `
  id bigint generated always as identity primary key,
  key text not null unique,
  workspace_id text,
  entry jsonb not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  refused_at timestamptz,
  refused_why text`;

const TABLE = /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/;

/**
 * What the events service answers for an entry it will never take, however often it's sent: a bad entry or an unknown
 * floor. 401, 403, 408 and 429 aren't among them: a token, a grant or a limit can be put right, and the entry waits.
 */
const REFUSED = new Set([400, 404, 409, 410, 413, 422]);

/** How long an entry the events service refused is kept to look at, in days; then it goes, with what it says. */
const REFUSED_KEPT_DAYS = 30;

export interface AuditOutbox {
  /** Keeps an entry to be sent. Pass the transaction's client to keep it with the change it records. */
  add(entry: NewAuditEntry, workspace?: string, db?: Queryable): Promise<void>;
  /** Sends one batch, oldest first; answers how many rows it dealt with, sent or set aside, or 0 while another instance sends. */
  flush(): Promise<number>;
  /** Sends everything waiting, or throws saying why it couldn't: for a step that must come after every entry, such as a redaction. */
  drain(): Promise<void>;
  /** Forgets the entries set aside that name this person, as actor or target (deleting a leaver, ADR 0072). */
  forget(person: string): Promise<void>;
  start(): void;
  stop(): void;
}

/**
 * Audit entries kept in `table` (schema-qualified, e.g. `identity.audit_outbox`) and sent from there, oldest first,
 * each under the key it was given or one made for it, so a resend after a crash is still one entry in Activity. A sent
 * row is deleted. A row the events service can't take yet stops the round, to go again in `intervalMs`. A row it
 * refuses (`REFUSED`) is set aside, with `refused_at` and `refused_why`, kept 30 days, and goes to `onError`; to send
 * it again, clear `sent_at` and `refused_at`. Only one instance sends at a time (an advisory lock, `LOCK_NAMESPACE.auditOutbox`), so order holds
 * across instances, and no transaction stays open while it sends.
 */
export const auditOutbox = ({ pool, table, eventsUrl, credentials, fetchImpl, env, batch = 20, intervalMs = 1000, onError = console.error }: {
  pool: ConnectionPool & Queryable;
  table: string;
  eventsUrl: string;
  credentials: ServiceCredentials;
  fetchImpl?: typeof fetch;
  /** Where APP_PREVIEW is read from, as for recordAudit. */
  env?: Record<string, string | undefined>;
  batch?: number;
  intervalMs?: number;
  /** Told of each entry set aside, and of each round that stopped, with why. */
  onError?: (err: unknown) => void;
}): AuditOutbox => {
  if (!TABLE.test(table)) throw new Error(`"${table}" isn't a table auditOutbox can use: schema.table, lowercase letters, digits and underscores.`);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = async (): Promise<number> => {
    const client = await pool.connect();
    let locked = false;
    try {
      const { rows: got } = await client.query('select pg_try_advisory_lock($1, hashtext($2)) as locked', [LOCK_NAMESPACE.auditOutbox, table]);
      locked = got[0]?.locked === true;
      if (!locked) return 0;
      await client.query(`delete from ${table} where refused_at < now() - make_interval(days => $1)`, [REFUSED_KEPT_DAYS]);
      const { rows } = await client.query(`select id, key, workspace_id, entry from ${table} where sent_at is null order by id limit $1`, [batch]);
      let dealt = 0;
      for (const row of rows as { id: string; key: string; workspace_id: string | null; entry: NewAuditEntry }[]) {
        try {
          // Once each: the row itself is what's tried again, on the next round.
          await postAudit({ eventsUrl, credentials, entry: row.entry, key: row.key, attempts: 1, ...(row.workspace_id ? { workspace: row.workspace_id } : {}), ...(fetchImpl ? { fetchImpl } : {}), ...(env ? { env } : {}) });
          await client.query(`delete from ${table} where id = $1`, [row.id]);
        } catch (err) {
          if (!(err instanceof ServiceCallError && err.status !== undefined && REFUSED.has(err.status))) {
            throw new ServiceCallError(`${dealt ? `Sent ${dealt} audit entries, then stopped` : 'Audit entries are waiting to be sent'}: ${(err as Error).message}`);
          }
          const why = `Set aside audit entry ${row.key} (${row.entry.app} ${row.entry.action}); it won't be sent unless refused_at is cleared: ${err.message}`;
          await client.query(`update ${table} set sent_at = now(), refused_at = now(), refused_why = $2 where id = $1`, [row.id, why]);
          onError(new ServiceCallError(why, err.status));
        }
        dealt++;
      }
      return dealt;
    } finally {
      if (locked) await client.query('select pg_advisory_unlock($1, hashtext($2))', [LOCK_NAMESPACE.auditOutbox, table]).catch(() => {});
      client.release();
    }
  };
  const tick = async () => {
    try {
      // A full batch means there may be more: go again at once.
      while ((await flush()) === batch);
    } catch (err) {
      onError(err);
    }
    if (timer !== undefined) timer = setTimeout(tick, intervalMs);
  };
  return {
    async add({ key = randomUUID(), ...entry }, workspace, db = pool) {
      await db.query(`insert into ${table} (key, workspace_id, entry) values ($1, $2, $3) on conflict (key) do nothing`, [key, workspace ?? null, JSON.stringify(entry)]);
    },
    flush,
    async drain() {
      for (let round = 0; ; round++) {
        await flush();
        const { rows } = await pool.query(`select count(*)::int as waiting from ${table} where sent_at is null`);
        if (!rows[0]?.waiting) return;
        if (round >= 100) throw new ServiceCallError(`${rows[0].waiting} audit entries are still waiting to be sent: another instance is sending them and hasn't finished.`);
        // Another instance is sending: give it a moment.
        await new Promise((r) => setTimeout(r, 100));
      }
    },
    async forget(person) {
      await pool.query(`delete from ${table} where refused_at is not null and (entry->'actor'->>'id' = $1 or entry->>'target' = $1)`, [person]);
    },
    start() {
      if (timer === undefined) timer = setTimeout(tick, 0);
    },
    stop() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
};
