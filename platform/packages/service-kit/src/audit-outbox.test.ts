import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUDIT_OUTBOX_COLUMNS, auditOutbox } from './audit-outbox.js';

const credentials = { name: 'identity', getToken: async () => 'platform-identity' };

/** A stand-in events service: keeps one entry per key, answers `down` while it's down and `refuse` for those actions. */
const fakeAudit = () => {
  const kept = new Map<string, { workspace: string | null; entry: Record<string, unknown> }>();
  const state = { down: false, refuse: new Set<string>() };
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    const entry = JSON.parse(String(init.body)) as Record<string, unknown>;
    if (state.down) return new Response(JSON.stringify({ message: 'down' }), { status: 503 });
    if (state.refuse.has(String(entry.action))) return new Response(JSON.stringify({ message: 'unknown floor' }), { status: 400 });
    kept.set(headers['idempotency-key']!, { workspace: headers['x-workspace-id'] ?? null, entry });
    return new Response(JSON.stringify({ id: 1 }), { status: 201 });
  }) as typeof fetch;
  return { kept, state, fetchImpl };
};

it('refuses a table that isn’t schema.table', () => {
  expect(() => auditOutbox({ pool: new pg.Pool(), table: 'audit_outbox; drop', eventsUrl: 'http://events', credentials })).toThrow(/schema\.table/);
});

// Runs wherever DATABASE_URL points at a Postgres; CI starts one for it.
describe.runIf(process.env.DATABASE_URL)('the audit outbox', () => {
  const schema = `audit_outbox_test_${process.pid}`;
  const table = `${schema}.audit_outbox`;
  let pool: pg.Pool;
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`create schema ${schema}`);
    await pool.query(`create table ${table} (${AUDIT_OUTBOX_COLUMNS})`);
  });
  afterAll(async () => {
    await pool.query(`drop schema ${schema} cascade`);
    await pool.end();
  });

  it('keeps entries through an outage and sends them in order, once each, setting aside one the events service refuses', async () => {
    const events = fakeAudit();
    const errors: unknown[] = [];
    const outbox = auditOutbox({ pool, table, eventsUrl: 'http://events:8084', credentials, fetchImpl: events.fetchImpl, onError: (err) => errors.push(err) });
    // One kept with its change, one with a change that rolled back, so neither is.
    const client = await pool.connect();
    await client.query('begin');
    await outbox.add({ actor: { id: 'u-admin', kind: 'user' }, app: 'identity', action: 'person.added', target: 'u-1' }, 'w-finance', client);
    await client.query('commit');
    await client.query('begin');
    await outbox.add({ actor: { id: 'u-admin', kind: 'user' }, app: 'identity', action: 'person.added', target: 'u-rolled-back' }, undefined, client);
    await client.query('rollback');
    client.release();
    await outbox.add({ actor: { id: 'u-admin', kind: 'user' }, app: 'identity', action: 'department.renamed', target: 't-1', key: 'mine' });
    await outbox.add({ actor: { id: 'u-admin', kind: 'user' }, app: 'identity', action: 'department.renamed', target: 't-1', key: 'mine' });
    await outbox.add({ actor: { id: 'u-admin', kind: 'user' }, app: 'identity', action: 'person.updated', target: 'u-2' });

    events.state.down = true;
    await expect(outbox.flush()).rejects.toThrow(/answered 503/);
    expect(events.kept.size).toBe(0);

    events.state.down = false;
    events.state.refuse.add('department.renamed');
    expect(await outbox.flush()).toBe(3);
    expect([...events.kept.values()].map((k) => [k.entry.target, k.workspace])).toEqual([['u-1', 'w-finance'], ['u-2', null]]);
    expect(events.kept.has('mine')).toBe(false);
    expect(errors).toEqual([expect.objectContaining({ message: expect.stringMatching(/Set aside audit entry mine \(identity department\.renamed\).*400/) })]);
    const { rows } = await pool.query(`select key, sent_at, refused_why from ${table} order by id`);
    expect(rows.map((r) => [r.key, !!r.sent_at, !!r.refused_why])).toEqual([[expect.any(String), true, false], ['mine', true, true], [expect.any(String), true, false]]);
    expect(await outbox.flush()).toBe(0);
  });

  it('stops at the first entry it can’t send yet, keeping the ones before it sent', async () => {
    await pool.query(`delete from ${table}`);
    const events = fakeAudit();
    let calls = 0;
    const flaky = (async (url: string, init: RequestInit) => (++calls === 2 ? new Response('{}', { status: 502 }) : events.fetchImpl(url, init))) as typeof fetch;
    const outbox = auditOutbox({ pool, table, eventsUrl: 'http://events:8084', credentials, fetchImpl: flaky });
    for (const target of ['a', 'b', 'c']) await outbox.add({ actor: { id: 'registry', kind: 'service' }, app: 'registry', action: 'app.updated', target });
    await expect(outbox.flush()).rejects.toThrow(/502/);
    expect([...events.kept.values()].map((k) => k.entry.target)).toEqual(['a']);
    expect(await outbox.flush()).toBe(2);
    expect([...events.kept.values()].map((k) => k.entry.target)).toEqual(['a', 'b', 'c']);
  });
});
