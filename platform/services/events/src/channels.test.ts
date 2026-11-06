import { EventEmitter } from 'node:events';
import type pg from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { InboxSignal } from './inbox.ts';
import { PgEventStore, type DomainEvent, type Notification } from './store.ts';

/** A store on a pretend database: what's heard on the listening connection, and what it then reads back. */
const listening = async (rows: unknown[] = []) => {
  const client = Object.assign(new EventEmitter(), { query: vi.fn(async () => ({ rows: [] })), release: vi.fn() });
  const pool = { connect: async () => client, query: vi.fn(async () => ({ rows })) };
  const store = new PgEventStore(pool as unknown as pg.Pool);
  await store.listen();
  const notifications: Notification[] = [];
  const events: DomainEvent[] = [];
  const changes: InboxSignal[] = [];
  store.subscribe((n) => notifications.push(n));
  store.onEvent((e) => events.push(e));
  store.inbox.onChange((s) => changes.push(s));
  const hear = (channel: string, payload: string) => client.emit('notification', { channel, payload });
  return { pool, hear, notifications, events, changes };
};

const CHANNELS = ['events_notification', 'events_domain_event', 'events_inbox'];

describe('what any database login can send on the channels', () => {
  it('drops what isn’t a message of ours, and stays up', async () => {
    const { pool, hear, notifications, events, changes } = await listening();
    for (const channel of CHANNELS) {
      for (const payload of ['x', 'null', '7', '[]', '{}', '{"ref":7}', '{"ref":"1; drop table x"}', '{"ref":{"a":1}}']) expect(() => hear(channel, payload)).not.toThrow();
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(pool.query).not.toHaveBeenCalled();
    expect([notifications, events, changes]).toEqual([[], [], []]);
  });

  it('believes nothing a message says: a whole notification, event or signal reaches nobody', async () => {
    const { pool, hear, notifications, events, changes } = await listening();
    hear('events_notification', JSON.stringify({ id: 'n', recipient: 'u-1', urgent: true, title: 'Forged', createdAt: 'now' }));
    hear('events_domain_event', JSON.stringify({ seq: 1, topic: 'platform.person.left', id: 'e', publisher: 'identity', at: '2026-11-06T00:00:00Z', payload: {} }));
    hear('events_inbox', JSON.stringify({ id: 'i', change: 'added', principals: ['person:u-1'] }));
    await new Promise((r) => setTimeout(r, 0));
    expect(pool.query).not.toHaveBeenCalled();
    expect([notifications, events, changes]).toEqual([[], [], []]);
  });

  it('reads back what an id names, and a forged id finds nothing', async () => {
    const id = '11111111-2222-3333-4444-555555555555';
    const found = await listening([{ id, recipient: 'u-1', app: 'library', level: 'info', title: 'Kept', created_at: new Date() }]);
    found.hear('events_notification', JSON.stringify({ ref: id }));
    await expect.poll(() => found.notifications.map((n) => n.title)).toEqual(['Kept']);
    expect(found.pool.query).toHaveBeenCalledWith(expect.stringContaining('events.notifications'), [id]);

    const forged = await listening([]);
    forged.hear('events_notification', JSON.stringify({ ref: id }));
    forged.hear('events_domain_event', JSON.stringify({ ref: '12' }));
    forged.hear('events_inbox', JSON.stringify({ ref: '12' }));
    await expect.poll(() => forged.pool.query.mock.calls.length).toBe(3);
    expect([forged.notifications, forged.events, forged.changes]).toEqual([[], [], []]);
  });

  it('takes who may hear of an inbox change from its history line', async () => {
    const { hear, changes } = await listening([{ item_id: 'item-1', signal: { change: 'changed', principals: ['team:t-1'] } }]);
    hear('events_inbox', JSON.stringify({ ref: '12' }));
    await expect.poll(() => changes).toEqual([{ id: 'item-1', change: 'changed', principals: ['team:t-1'] }]);
  });
});
