import { publishEvents, type ServiceCredentials } from '@augur/service-kit';
import type pg from 'pg';

/** The store names its topics `kg.…`; on the events service they are AUGUR's own, `platform.knowledge.…`. */
export const topicOf = (stored: string) => `platform.knowledge.${stored.replace(/^kg\./, '')}`;

/**
 * Sends what the store's outbox holds to the events service, oldest first, and marks it sent, in one
 * transaction: an event is sent at least once, and only once its change committed. Each carries ids only
 * (an event about a personal floor carries the floor and nothing else), with the floor as its workspace.
 * Several instances can run at once: each takes rows the others haven't locked.
 */
export const outboxRelay = ({ pool, eventsUrl, credentials, fetchImpl, batch = 100, intervalMs = 1000, onError = console.error }: {
  pool: pg.Pool;
  eventsUrl: string;
  credentials: ServiceCredentials;
  fetchImpl?: typeof fetch;
  batch?: number;
  intervalMs?: number;
  onError?: (err: unknown) => void;
}) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = async (): Promise<number> => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query<{ id: string; topic: string; payload: { floor?: string } }>('select id::text, topic, payload from kg.outbox_take($1)', [batch]);
      if (rows.length) {
        await publishEvents({
          eventsUrl,
          credentials,
          fetchImpl,
          events: rows.map((r) => ({ topic: topicOf(r.topic), id: `knowledge-${r.id}`, payload: r.payload, ...(r.payload.floor ? { workspace: r.payload.floor } : {}) })),
        });
        await client.query('select kg.outbox_sent($1::bigint[])', [rows.map((r) => r.id)]);
      }
      await client.query('commit');
      return rows.length;
    } catch (err) {
      await client.query('rollback').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  };
  const tick = async () => {
    try {
      while ((await flush()) === batch);
    } catch (err) {
      onError(err);
    }
    if (timer !== undefined) timer = setTimeout(tick, intervalMs);
  };
  return {
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
