import { randomUUID } from 'node:crypto';
import type { ConnectionPool, Queryable } from './domain-events.js';
import type { NewAuditEntry } from './events.js';
import { callService, ServiceCallError, type ServiceCredentials } from './service.js';

/**
 * An outbox for a service's audit entries: the entry is written to the service's own database, with the change when
 * that change is in the same database, and a relay takes it to the events service. So an entry, and the domain event
 * the events service publishes for it, outlives the events service being down or this one restarting.
 *
 * The table is the service's own, made by its own migration (columns as `AUDIT_OUTBOX_COLUMNS` says).
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

/** What the events service answers for an entry it will never take, however often it's sent. */
const refused = (err: unknown) => err instanceof ServiceCallError && /it answered (400|413)\b/.test(err.message);

export interface AuditOutbox {
  /** Keeps an entry to be sent. Pass the transaction's client to keep it with the change it records. */
  add(entry: NewAuditEntry, workspace?: string, db?: Queryable): Promise<void>;
  /** Sends one batch, oldest first; answers how many rows it dealt with, sent or set aside. */
  flush(): Promise<number>;
  start(): void;
  stop(): void;
}

/**
 * Audit entries kept in `table` (schema-qualified, e.g. `identity.audit_outbox`) and sent from there. Each row keeps
 * the key it was given or one made for it, so a resend after a crash is still one entry in Activity. Rows go in
 * order and a row the events service can't take yet stops the batch, to go again in `intervalMs`. A row it refuses
 * (400, 413) is set aside, marked sent with `refused_at` and `refused_why`, and goes to `onError`.
 * Several instances can run at once: each takes rows the others haven't locked.
 */
export const auditOutbox = ({ pool, table, eventsUrl, credentials, fetchImpl, batch = 50, intervalMs = 1000, onError = console.error }: {
  pool: ConnectionPool & Queryable;
  table: string;
  eventsUrl: string;
  credentials: ServiceCredentials;
  fetchImpl?: typeof fetch;
  batch?: number;
  intervalMs?: number;
  onError?: (err: unknown) => void;
}): AuditOutbox => {
  if (!TABLE.test(table)) throw new Error(`"${table}" isn't a table auditOutbox can use: schema.table, lowercase letters, digits and underscores.`);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = async (): Promise<number> => {
    const client = await pool.connect();
    const setAside: Error[] = [];
    let dealt = 0;
    try {
      await client.query('begin');
      const { rows } = await client.query(`select id, key, workspace_id, entry from ${table} where sent_at is null order by id limit $1 for update skip locked`, [batch]);
      let failed: unknown;
      for (const row of rows as { id: string; key: string; workspace_id: string | null; entry: NewAuditEntry }[]) {
        try {
          // Once each: the row itself is what's tried again, on the next round.
          await callService({
            method: 'POST',
            url: `${eventsUrl.replace(/\/$/, '')}/v1/audit`,
            credentials,
            body: row.entry,
            what: `record ${row.entry.action} in the audit log`,
            headers: { 'idempotency-key': row.key },
            ...(row.workspace_id ? { workspace: row.workspace_id } : {}),
            ...(fetchImpl ? { fetchImpl } : {}),
          });
          await client.query(`update ${table} set sent_at = now() where id = $1`, [row.id]);
        } catch (err) {
          if (!refused(err)) {
            failed = err;
            break;
          }
          const why = `Set aside audit entry ${row.key} (${row.entry.app} ${row.entry.action}): ${(err as Error).message}`;
          await client.query(`update ${table} set sent_at = now(), refused_at = now(), refused_why = $2 where id = $1`, [row.id, why]);
          setAside.push(new ServiceCallError(why));
        }
        dealt++;
      }
      await client.query('commit');
      for (const err of setAside) onError(err);
      if (failed) throw failed;
      return dealt;
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
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
    start() {
      if (timer === undefined) timer = setTimeout(tick, 0);
    },
    stop() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
};
