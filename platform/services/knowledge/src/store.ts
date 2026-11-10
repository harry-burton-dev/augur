import pg from 'pg';
import { runMigrations, type Migration } from '@augur/service-kit';
import { sql as store } from './migrations/001-store.ts';
import { sql as baseOntology } from './migrations/002-base-ontology.ts';
import { sql as fence } from './migrations/003-fence.ts';
import { sql as service } from './migrations/004-service.ts';
import { sql as reads } from './migrations/005-reads.ts';
import { sql as queries } from './migrations/006-queries.ts';
import { sql as undo } from './migrations/007-undo.ts';

/** The knowledge service's schema in the platform database. */
export const SCHEMA = 'kg';

/** The login the service reads and acts as. Row security fences it; it owns nothing and writes only through act_* functions. */
export const APP_LOGIN = 'kg_app';

/**
 * The knowledge graph's schema, in order. Once a migration ships it never changes (`pnpm check:migrations`).
 * 001 and 002 are the store spec draft 4 proved; 003 hardens its floor fence (see fence.test.ts); 004 is what
 * the service needs: standing mirrored from identity, answers kept per Idempotency-Key, and the outbox; 005
 * is what the object reads need: your own action records, and the kind of floor of what isn't in sight; 006
 * is what the query reads need: your roles, the disputes waiting on you, and whether a belief stood then; 007
 * is undo and retire.
 */
export const migrations: Migration[] = [
  { id: '001-store', sql: store },
  { id: '002-base-ontology', sql: baseOntology },
  { id: '003-fence', sql: fence },
  { id: '004-service', sql: service },
  { id: '005-reads', sql: reads },
  { id: '006-queries', sql: queries },
  { id: '007-undo', sql: undo },
];

/**
 * Brings the kg schema up to date and lets the service's own login sign in with `password`. Runs as the
 * deployment's migrating login (the platform login), never as kg_app: kg_app can't create or alter anything.
 * The password comes from the deployment's settings, so it is set on every start and a changed one takes.
 */
export const migrate = async (admin: pg.Pool, { password }: { password: string }): Promise<void> => {
  if (!password) throw new Error(`The knowledge service needs a password for its own database login (${APP_LOGIN}): set it in the deployment's settings.`);
  await runMigrations(admin, { schema: SCHEMA, migrations });
  const { rows } = await admin.query<{ q: string }>(`select format('alter role ${APP_LOGIN} with login nosuperuser nobypassrls nocreatedb nocreaterole password %L', $1::text) as q`, [password]);
  await admin.query(rows[0]!.q);
  // Storage takes CONNECT on the database from public (each app login is granted its own), so kg_app needs its own grant too.
  const { rows: db } = await admin.query<{ db: string }>('select current_database() as db');
  await admin.query(`grant connect on database ${pg.escapeIdentifier(db[0]!.db)} to ${APP_LOGIN}`);
  // The owner of everything in kg must stay a plain role: its functions run as it (fence.test.ts, T1).
  await admin.query('alter role kg_owner with nologin nosuperuser nobypassrls');
};

/** Who is acting, and on which floor: set for one transaction, read by the fence as kg.person and kg.floor. */
export interface Acting {
  person: string;
  floor: string;
  app?: string;
}

/**
 * Runs `work` in one transaction on kg_app's pool, as `acting`. Every read and action inside it is fenced to
 * what that person may see from that floor. The settings last only for the transaction (`set_config(…, true)`).
 * With `keep: false` the work runs and is rolled back, for a dry run.
 */
export const asPerson = async <T>(pool: pg.Pool, acting: Acting, work: (client: pg.PoolClient) => Promise<T>, { keep = true }: { keep?: boolean } = {}): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('kg.person', $1, true), set_config('kg.floor', $2, true), set_config('kg.app', $3, true)`, [
      acting.person,
      acting.floor,
      acting.app ?? '',
    ]);
    const out = await work(client);
    // A dry run does everything, then keeps none of it.
    await client.query(keep ? 'commit' : 'rollback');
    return out;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
};
