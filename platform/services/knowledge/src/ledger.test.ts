// The forget ledger outside Postgres (plan PR 6, requirement 15): a forgotten observation stays forgotten
// after a restore from a backup taken before it was forgotten. The restore is played by Postgres's admin
// login putting the rows back as that backup held them, then the migrate job's step runs, as on every `up`.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { knowledgeDb } from './db.testing.ts';
import { client, type Client, own, people, report } from './http.testing.ts';
import { fileLedger, type ForgetLedger, LEDGER_FILE, reapplyForgets } from './ledger.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const db = knowledgeDb(DATABASE_URL);
const { reset, standing } = people();

let dir: string;
let ledger: ForgetLedger;
let svc: Client;
const act = (...a: Parameters<Client['act']>) => svc.act(...a).then((r) => ({ status: r.statusCode, body: r.json() }));
const words = async (observation: string) =>
  (await db.admin.query('select value, quote, forgotten_at is not null as gone from kg.observations where id = $1', [observation])).rows[0];

/** What a restore from a backup taken before the forget does to the rows: the words, unforgotten, and no ledger row. */
const restoredFromBefore = async (observation: string, was: { value: unknown; quote: string }) => {
  const c = await db.admin.connect();
  try {
    await c.query('begin');
    // A restore loads rows; it doesn't run the store's triggers, which never let words come back.
    await c.query('set local session_replication_role = replica');
    await c.query('update kg.observations set forgotten_at = null, value = $2, quote = $3 where id = $1', [observation, JSON.stringify(was.value), was.quote]);
    await c.query('delete from kg.forget_ledger where observation = $1', [observation]);
    await c.query('commit');
  } finally {
    c.release();
  }
};

describe('the forget ledger file', () => {
  it('reads back what it was given, once each, and nothing from a line cut short', async () => {
    const own = await mkdtemp(join(tmpdir(), 'kg-ledger-'));
    const l = fileLedger(join(own, 'made'));
    expect(await l.read()).toEqual([]);
    const a = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
    const b = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c';
    await l.append([a]);
    // A crash halfway through a line: the next one starts on a line of its own.
    await writeFile(l.file, `${await readFile(l.file, 'utf8')}{"observation":"0190`, { flag: 'w' });
    await l.append([b, a]);
    expect(await l.read()).toEqual([a, b]);
    expect((await readFile(l.file, 'utf8')).split('\n').filter(Boolean)).toHaveLength(4);
    await rm(own, { recursive: true, force: true });
  });
});

describe.skipIf(!DATABASE_URL)('a forgotten observation, after a restore', () => {
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'kg-ledger-'));
    ledger = fileLedger(dir);
    svc = await client({ store: db.app, standing, ledger });
  });
  beforeEach(async () => {
    reset();
    await db.empty();
    await rm(join(dir, LEDGER_FILE), { force: true });
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('stays forgotten: the migrate job forgets it again from the file', async () => {
    const retained = await act('alice', own.alice, 'retain', report('F1'));
    const [observation] = retained.body.effects.observations;
    const was = (await db.admin.query('select value, quote from kg.observations where id = $1', [observation])).rows[0];
    expect(was.quote).not.toBe('');

    // A dry run forgets nothing, and writes nothing.
    expect((await act('alice', own.alice, 'forget', { observation }, { dryRun: true })).body).toMatchObject({ wouldSucceed: true });
    expect(await ledger.read()).toEqual([]);
    expect((await act('alice', own.alice, 'forget', { observation })).status).toBe(200);
    expect(await ledger.read()).toEqual([observation]);

    await restoredFromBefore(observation, was);
    expect(await words(observation)).toMatchObject({ gone: false, quote: was.quote });

    expect(await reapplyForgets(db.admin, ledger)).toEqual({ forgottenAgain: [observation], written: [] });
    expect(await words(observation)).toEqual({ value: null, quote: '', gone: true });
    // Every later start finds them in step.
    expect(await reapplyForgets(db.admin, ledger)).toEqual({ forgottenAgain: [], written: [] });
  });

  it('writes the file again from the database when the volume was lost', async () => {
    const [observation] = (await act('alice', own.alice, 'retain', report('F2'))).body.effects.observations;
    expect((await act('alice', own.alice, 'forget', { observation })).status).toBe(200);
    await rm(ledger.file);
    expect(await reapplyForgets(db.admin, ledger)).toEqual({ forgottenAgain: [], written: [observation] });
    expect(await ledger.read()).toEqual([observation]);
  });

  it('leaves alone an id the restored database never held, and refuses kg_app the step', async () => {
    await ledger.append(['0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b']);
    expect(await reapplyForgets(db.admin, ledger)).toEqual({ forgottenAgain: [], written: [] });
    await expect(db.app.query('select kg.reapply_forgets($1::uuid[])', [[]])).rejects.toThrow(/permission denied/);
    await expect(db.app.query('select kg.forgotten_ids()')).rejects.toThrow(/permission denied/);
  });
});
