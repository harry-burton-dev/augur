import type pg from 'pg';
import type { NewAuditEntry } from '@augur/service-kit';
import type { AuditEntry, EventFloor, NewDomainEvent } from './store.ts';

/**
 * The writes that go in someone else's transaction: an audit entry and the domain event that says the same
 * thing are kept together with the change they describe, or not at all.
 */

/** Tells every instance of each new domain event, by its seq. */
export const EVENT_CHANNEL = 'events_domain_event';

export const floorFrom = (id: string | null, path: string[] | null) => (id ? { workspace: { id, path: path ?? [id] } } : {});

/**
 * The id in a message heard on a channel, or undefined for anything else. Every login on the database can LISTEN
 * and NOTIFY on any channel, so a message carries only an id, and whatever it says is read back from the row:
 * a listener learns nothing, a forged id finds nothing, and a message that isn't ours is dropped.
 */
export const refIn = (payload: string, shape: RegExp) => {
  try {
    const { ref } = JSON.parse(payload) as { ref?: unknown };
    return typeof ref === 'string' && shape.test(ref) ? ref : undefined;
  } catch {
    return undefined;
  }
};

export type AuditRow = {
  id: string;
  at: Date;
  actor_id: string;
  actor_kind: 'user' | 'service';
  app: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  workspace_id: string | null;
  workspace_path: string[] | null;
  recorded_by: string | null;
};

export const fromAuditRow = (r: AuditRow): AuditEntry => ({
  id: String(r.id),
  at: r.at.toISOString(),
  actor: { id: r.actor_id, kind: r.actor_kind },
  app: r.app,
  action: r.action,
  ...(r.target ? { target: r.target } : {}),
  ...(r.detail ? { detail: r.detail } : {}),
  ...floorFrom(r.workspace_id, r.workspace_path),
  ...(r.recorded_by ? { recordedBy: r.recorded_by } : {}),
});

/** Adds an entry. With a key, what `recordedBy` already wrote under it is answered instead, and `added` is false. */
export const insertAudit = async (client: pg.ClientBase, e: NewAuditEntry, floor?: EventFloor, recordedBy?: string, key?: string): Promise<{ entry: AuditEntry; added: boolean }> => {
  const { rows } = await client.query<AuditRow>(
    `insert into events.audit (actor_id, actor_kind, app, action, target, detail, workspace_id, workspace_path, recorded_by, idempotency_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (recorded_by, idempotency_key) where idempotency_key is not null do nothing
     returning *`,
    [e.actor.id, e.actor.kind, e.app, e.action, e.target ?? null, e.detail ?? null, floor?.id ?? null, floor?.path ?? null, recordedBy ?? null, key ?? null],
  );
  if (rows[0]) return { entry: fromAuditRow(rows[0]), added: true };
  const { rows: had } = await client.query<AuditRow>('select * from events.audit where recorded_by = $1 and idempotency_key = $2', [recordedBy, key]);
  return { entry: fromAuditRow(had[0]!), added: false };
};

/**
 * Adds events in the caller's transaction, last thing before it commits; one already sent (same id) is skipped.
 * The lock makes seq order commit order: nobody gets a seq until whoever holds the turn has committed, so a
 * follower can never pass a seq that is still to appear. It stays held until then, so keep what follows short.
 * It's a table only the events login can touch, because an advisory lock could be held by any login on the database.
 */
export const insertEvents = async (client: pg.ClientBase, publisher: string, events: NewDomainEvent[]) => {
  await client.query('lock table events.publish_turn in exclusive mode');
  // Each event added is announced as the transaction commits; one already sent isn't.
  const { rows } = await client.query<{ added: number }>(
    `with added as (
       insert into events.domain_events (topic, id, publisher, workspace_id, workspace_path, payload)
       select e.topic, e.id, $1, e.workspace_id, e.workspace_path, coalesce(e.payload, 'null'::jsonb)
       from jsonb_to_recordset($2::jsonb) as e(topic text, id text, workspace_id text, workspace_path text[], payload jsonb)
       on conflict (publisher, id) do nothing
       returning seq
     ), told as (
       select pg_notify($3, json_build_object('ref', seq::text)::text) from added
     )
     select (select count(*) from added)::int as added, (select count(*) from told) as told`,
    [publisher, JSON.stringify(events.map((e) => ({ topic: e.topic, id: e.id, workspace_id: e.floor?.id ?? null, workspace_path: e.floor?.path ?? null, payload: e.payload ?? null }))), EVENT_CHANNEL],
  );
  const added = rows[0]?.added ?? 0;
  return { added, repeated: events.length - added };
};
