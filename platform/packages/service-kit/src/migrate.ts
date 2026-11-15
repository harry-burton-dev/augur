import { LOCK_NAMESPACE } from './locks.js';
import { asSeconds, secondsSetting } from './seconds.js';

/** One step in a service's schema. Once it has shipped it never changes (`pnpm check:migrations`). */
export interface Migration {
  /** Its name, kept in `<schema>.migrations` once applied. Migrations run in the order given, not by id. */
  id: string;
  sql: string;
}

/** A pg.Pool, or anything else that lends a client for one transaction. */
interface Pool {
  connect(): Promise<{
    query(text: string, values?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
    release(): void;
  }>;
}
type Client = Awaited<ReturnType<Pool['connect']>>;

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/** Thirty seconds: far longer than another instance's ordinary migrations take, short enough that a stuck one is named in the logs within a minute. */
export const DEFAULT_MIGRATION_LOCK_TIMEOUT_MS = 30_000;
/** A minute: the runner never pauses inside its transaction, so this only ends one whose process hung or vanished, freeing its locks. */
export const DEFAULT_MIGRATION_IDLE_TIMEOUT_MS = 60_000;

/**
 * How long a migration waits for a lock, the schema's migration lock or a table's, before it gives up and is rolled
 * back: DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS (AUGUR’s docs, Limits and health), 30 seconds when unset or empty,
 * and no limit at 0.
 */
export const migrationLockTimeoutMs = (env: Record<string, string | undefined> = process.env): number =>
  secondsSetting(env.DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS, DEFAULT_MIGRATION_LOCK_TIMEOUT_MS);

/**
 * How long a migration's transaction may sit idle before Postgres ends it: DATABASE_MIGRATION_IDLE_TIMEOUT_SECONDS,
 * a minute when unset or empty, and no limit at 0.
 */
export const migrationIdleTimeoutMs = (env: Record<string, string | undefined> = process.env): number =>
  secondsSetting(env.DATABASE_MIGRATION_IDLE_TIMEOUT_SECONDS, DEFAULT_MIGRATION_IDLE_TIMEOUT_MS);

/** A migration waited longer than DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS for a lock and was rolled back; its message says what held it. */
export class MigrationLockTimeout extends Error {
  override readonly name = 'MigrationLockTimeout';
  constructor(
    readonly schema: string,
    /** The migration that waited, or undefined when it was waiting for the schema's migration lock. */
    readonly migration: string | undefined,
    readonly timeoutMs: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** Postgres's lock_not_available: lock_timeout ran out. */
const LOCK_NOT_AVAILABLE = '55P03';

/**
 * The sessions holding the schema's migration lock or a lock on one of its tables, as a person reads them. A login may
 * see only its own sessions' details in pg_stat_activity (an app's or a service's own login), so another role's
 * session is named by its pid alone. Never the session's query: it can hold a password or a person's data.
 */
const holders = async (client: Client, schema: string): Promise<string> => {
  try {
    const { rows } = await client.query(
      `select distinct l.pid, a.usename, a.application_name, a.state, extract(epoch from now() - a.xact_start)::int as open_for
       from pg_locks l left join pg_stat_activity a on a.pid = l.pid
       where l.granted and l.pid is not null and l.pid <> pg_backend_pid()
         and l.database = (select oid from pg_database where datname = current_database())
         and ((l.locktype = 'advisory' and l.objsubid = 2 and l.classid = $1::bigint::oid and l.objid = (hashtext($2)::bigint & 4294967295)::oid)
           or l.relation in (select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = $2))
       order by l.pid`,
      [LOCK_NAMESPACE.migrations, schema],
    );
    const said = (rows as { pid: number; usename: string | null; application_name: string | null; state: string | null; open_for: number | null }[]).map((r) =>
      r.state === null
        ? `pid ${r.pid} (not visible to this role)`
        : `pid ${r.pid} (${[r.usename, r.application_name && `"${r.application_name}"`, r.state, r.open_for !== null && `its transaction open ${r.open_for}s`].filter(Boolean).join(', ')})`,
    );
    return said.length ? `Held by ${said.join('; ')}.` : `No session holding a lock on ${schema} can be seen now; it may have ended.`;
  } catch (err) {
    return `Who holds it couldn't be looked up (${(err as Error).message}).`;
  }
};

/**
 * Brings a service's schema up to date: runs, in order, each migration not yet recorded in
 * `<schema>.migrations`, all in one transaction, so a failing one leaves the schema as it was.
 * Safe to run from several instances at once: they queue on an advisory lock named after the
 * schema (`LOCK_NAMESPACE.migrations`), and the later ones find nothing left to do.
 *
 * It waits at most `lockTimeoutMs` (DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS) for any one lock, that one or a table's
 * another session is using, and then throws `MigrationLockTimeout`, rolled back, naming the migration, the lock and
 * who holds it, so a service that can't migrate stops and says why rather than waiting for ever.
 * A migration itself has no statement timeout: building an index or rewriting a big table can rightly take longer
 * than any fixed limit, and cancelling it halfway would only start it again on the next start.
 *
 * Makes the schema when it is missing. On a server the storage job makes it for the service's own
 * login, which may not be allowed to create schemas, so it is only created when it isn't there.
 */
export const runMigrations = async (
  pool: Pool,
  { schema, migrations, lockTimeoutMs = migrationLockTimeoutMs(), idleTimeoutMs = migrationIdleTimeoutMs() }: { schema: string; migrations: readonly Migration[]; lockTimeoutMs?: number; idleTimeoutMs?: number },
): Promise<void> => {
  if (!IDENTIFIER.test(schema)) throw new Error(`"${schema}" isn't a schema name runMigrations can use: lowercase letters, digits and underscores only.`);
  const client = await pool.connect();
  let running: string | undefined;
  try {
    await client.query('begin');
    await client.query('set local statement_timeout = 0');
    await client.query(`set local lock_timeout = ${Math.round(lockTimeoutMs)}`);
    await client.query(`set local idle_in_transaction_session_timeout = ${Math.round(idleTimeoutMs)}`);
    await client.query('select pg_advisory_xact_lock($1, hashtext($2))', [LOCK_NAMESPACE.migrations, schema]);
    const { rowCount: hasSchema } = await client.query('select 1 from pg_namespace where nspname = $1', [schema]);
    if (!hasSchema) await client.query(`create schema ${schema}`);
    await client.query(`create table if not exists ${schema}.migrations (id text primary key, applied_at timestamptz not null default now())`);
    const { rows } = await client.query(`select id from ${schema}.migrations`);
    const applied = new Set((rows as { id: string }[]).map((r) => r.id));
    for (const m of migrations.filter((m) => !applied.has(m.id))) {
      running = m.id;
      await client.query(m.sql);
      await client.query(`insert into ${schema}.migrations (id) values ($1)`, [m.id]);
    }
    running = undefined;
    await client.query('commit');
  } catch (err) {
    // A session Postgres ended (idle too long) is rolled back already; the error that ended it is the one to tell.
    await client.query('rollback').catch(() => undefined);
    if ((err as { code?: string }).code !== LOCK_NOT_AVAILABLE) throw err;
    const what = running ? `Migration ${running} of ${schema}` : `${schema}'s migrations (up to ${migrations.at(-1)?.id ?? 'none'})`;
    const lock = `advisory lock (${LOCK_NAMESPACE.migrations}, hashtext('${schema}'))`;
    const where = running
      ? `It held the ${lock} and waited for a table lock that migration needs.`
      : `It waited for the ${lock}, which one session at a time holds while it migrates ${schema}.`;
    throw new MigrationLockTimeout(
      schema,
      running,
      lockTimeoutMs,
      `${what} gave up after ${asSeconds(lockTimeoutMs)} (DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS) waiting for a lock, and rolled back: nothing changed. ${where} ${await holders(client, schema)} Once that session ends, start the service again; if it is another instance's long migration, raise DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS.`,
      { cause: err },
    );
  } finally {
    client.release();
  }
};
