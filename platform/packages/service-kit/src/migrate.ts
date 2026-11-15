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
    /** Given an error or true, the client is thrown away rather than lent again. */
    release(err?: Error | boolean): void;
  }>;
}
type Client = Awaited<ReturnType<Pool['connect']>>;

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/**
 * Five minutes: longer than a service's own transaction ordinarily holds a lock, and a backup's or another instance's
 * long migration often ends within it. Who holds the lock is in the logs after the first try, a few seconds in.
 */
export const DEFAULT_MIGRATION_LOCK_TIMEOUT_MS = 300_000;
/**
 * How long one try waits for a lock. While a migration waits for a table's lock, new queries on that table queue
 * behind it, so each try is short and the migration tries again, rather than holding them up for the whole wait.
 */
const LOCK_TRY_MS = 5_000;
/** The pause between tries doubles from a second, to at most this. */
const MOST_PAUSE_MS = 15_000;
/** A minute: the runner never pauses inside its transaction, so this only ends one whose process hung or vanished, freeing its locks. */
export const DEFAULT_MIGRATION_IDLE_TIMEOUT_MS = 60_000;

/**
 * How long a migration keeps trying for its locks, the schema's migration lock or a table's, before it gives up:
 * DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS (AUGUR’s docs, Limits and health), five minutes when unset or empty, and
 * no limit at 0. An AUGUR service reads it from the deployment's settings; an app's part, from its own.
 */
export const migrationLockTimeoutMs = (env: Record<string, string | undefined> = process.env): number =>
  secondsSetting(env.DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS, DEFAULT_MIGRATION_LOCK_TIMEOUT_MS);

/**
 * How long a migration's transaction may sit idle before Postgres ends it: DATABASE_MIGRATION_IDLE_TIMEOUT_SECONDS,
 * a minute when unset or empty, and no limit at 0.
 */
export const migrationIdleTimeoutMs = (env: Record<string, string | undefined> = process.env): number =>
  secondsSetting(env.DATABASE_MIGRATION_IDLE_TIMEOUT_SECONDS, DEFAULT_MIGRATION_IDLE_TIMEOUT_MS);

/** A migration tried for longer than DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS to get its locks and was rolled back; its message says what held them. */
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

/** Where a migration run was when a lock wait ran out: the schema's migration lock, its own setup, or one migration. */
type Stage = { at: 'lock' } | { at: 'setup' } | { at: 'migration'; id: string };

/**
 * The sessions holding what the run was waiting for, as a person reads them: the schema's migration lock, or a lock on
 * one of its tables. A login may see only its own sessions' details in pg_stat_activity (an app's or a service's own
 * login), so for another role's session it says who and which app, but not what it is doing. Never the session's
 * query: it can hold a password or a person's data.
 */
const holders = async (client: Client, schema: string, stage: Stage): Promise<string> => {
  const [what, values] =
    stage.at === 'lock'
      ? [`l.locktype = 'advisory' and l.objsubid = 2 and l.classid = $1::bigint::oid and l.objid = (hashtext($2)::bigint & 4294967295)::oid`, [LOCK_NAMESPACE.migrations, schema]]
      : [`l.relation in (select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = $1)`, [schema]];
  try {
    const { rows } = await client.query(
      `select distinct l.pid, a.usename, a.application_name, a.state, extract(epoch from now() - a.xact_start)::int as open_for
       from pg_locks l left join pg_stat_activity a on a.pid = l.pid
       where l.granted and l.pid is not null and l.pid <> pg_backend_pid()
         and l.database = (select oid from pg_database where datname = current_database())
         and ${what}
       order by l.pid`,
      values,
    );
    const said = (rows as { pid: number; usename: string | null; application_name: string | null; state: string | null; open_for: number | null }[]).map((r) =>
      `pid ${r.pid} (${[
        r.usename,
        r.application_name && `"${r.application_name}"`,
        ...(r.state === null ? ['its state not visible to this role'] : [r.state, r.open_for !== null && `its transaction open ${r.open_for}s`]),
      ]
        .filter(Boolean)
        .join(', ')})`,
    );
    if (said.length) return `Held by ${said.join('; ')}.`;
    return stage.at === 'lock'
      ? `No session holding it can be seen now; it may have ended.`
      : `No session holding a lock on ${schema}'s tables can be seen now: it may have ended, or the lock is on another schema's table.`;
  } catch (err) {
    return `Who holds it couldn't be looked up (${(err as Error).message}).`;
  }
};

/** One try at the whole run, in one transaction: nothing when it is done, or where it was when a lock wait ran out and who held that lock. */
const tryOnce = async (
  pool: Pool,
  schema: string,
  migrations: readonly Migration[],
  lockTimeoutMs: number,
  idleTimeoutMs: number,
): Promise<{ stage: Stage; held: string; err: unknown } | undefined> => {
  const client = await pool.connect();
  let stage: Stage = { at: 'lock' };
  let broken = false;
  try {
    await client.query('begin');
    await client.query('set local statement_timeout = 0');
    await client.query(`set local lock_timeout = ${Math.round(lockTimeoutMs)}`);
    await client.query(`set local idle_in_transaction_session_timeout = ${Math.round(idleTimeoutMs)}`);
    await client.query('select pg_advisory_xact_lock($1, hashtext($2))', [LOCK_NAMESPACE.migrations, schema]);
    stage = { at: 'setup' };
    const { rowCount: hasSchema } = await client.query('select 1 from pg_namespace where nspname = $1', [schema]);
    if (!hasSchema) await client.query(`create schema ${schema}`);
    await client.query(`create table if not exists ${schema}.migrations (id text primary key, applied_at timestamptz not null default now())`);
    const { rows } = await client.query(`select id from ${schema}.migrations`);
    const applied = new Set((rows as { id: string }[]).map((r) => r.id));
    for (const m of migrations.filter((m) => !applied.has(m.id))) {
      stage = { at: 'migration', id: m.id };
      await client.query(m.sql);
      await client.query(`insert into ${schema}.migrations (id) values ($1)`, [m.id]);
    }
    await client.query('commit');
    return undefined;
  } catch (err) {
    // A session Postgres ended (idle too long) is gone already; the error that ended it is the one to tell, and the
    // client is thrown away rather than lent again.
    broken = await client.query('rollback').then(
      () => false,
      () => true,
    );
    if ((err as { code?: string }).code !== LOCK_NOT_AVAILABLE) throw err;
    return { stage, held: await holders(client, schema, stage), err };
  } finally {
    client.release(broken || undefined);
  }
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Brings a service's schema up to date: runs, in order, each migration not yet recorded in
 * `<schema>.migrations`, all in one transaction, so a failing one leaves the schema as it was.
 * Several instances may run it at once: they queue on an advisory lock named after the schema
 * (`LOCK_NAMESPACE.migrations`), and the later ones find nothing left to do, so long as the first finishes within
 * `lockTimeoutMs`.
 *
 * It waits for a lock another session is using, that one or a table's, a few seconds at a time
 * (`lockTryMs`), rolling back and trying again, and logs who holds it after each try. After
 * `lockTimeoutMs` (DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS) it throws `MigrationLockTimeout`, naming the migration,
 * the lock and who holds it, so a service that can't migrate stops and says why rather than waiting for ever. At 0
 * it waits for ever in one try.
 * A migration itself has no statement timeout: building an index or rewriting a big table can rightly take longer
 * than any fixed limit, and cancelling it halfway would only start it again on the next start.
 *
 * Makes the schema when it is missing. On a server the storage job makes it for the service's own
 * login, which may not be allowed to create schemas, so it is only created when it isn't there.
 */
export const runMigrations = async (
  pool: Pool,
  {
    schema,
    migrations,
    lockTimeoutMs = migrationLockTimeoutMs(),
    idleTimeoutMs = migrationIdleTimeoutMs(),
    lockTryMs = LOCK_TRY_MS,
    log = (message: string) => console.error(message),
  }: { schema: string; migrations: readonly Migration[]; lockTimeoutMs?: number; idleTimeoutMs?: number; lockTryMs?: number; log?: (message: string) => void },
): Promise<void> => {
  if (!IDENTIFIER.test(schema)) throw new Error(`"${schema}" isn't a schema name runMigrations can use: lowercase letters, digits and underscores only.`);
  const lock = `advisory lock (${LOCK_NAMESPACE.migrations}, hashtext('${schema}'))`;
  const describe = (stage: Stage) =>
    stage.at === 'migration'
      ? { what: `Migration ${stage.id} of ${schema}`, where: `It held the ${lock} and waited for a table lock that migration needs.` }
      : stage.at === 'setup'
        ? { what: `${schema}'s migrations (up to ${migrations.at(-1)?.id ?? 'none'})`, where: `It held the ${lock} and waited for a lock on ${schema} or its migrations table.` }
        : { what: `${schema}'s migrations (up to ${migrations.at(-1)?.id ?? 'none'})`, where: `It waited for the ${lock}, which one session at a time holds while it migrates ${schema}.` };
  const started = Date.now();
  for (let tries = 1; ; tries++) {
    const left = lockTimeoutMs > 0 ? started + lockTimeoutMs - Date.now() : 0;
    const failed = await tryOnce(pool, schema, migrations, lockTimeoutMs > 0 ? Math.max(1, Math.min(lockTryMs, left)) : 0, idleTimeoutMs);
    if (!failed) return;
    const { what, where } = describe(failed.stage);
    const wait = Math.min(1_000 * 2 ** (tries - 1), MOST_PAUSE_MS, started + lockTimeoutMs - Date.now());
    if (wait <= 0) {
      throw new MigrationLockTimeout(
        schema,
        failed.stage.at === 'migration' ? failed.stage.id : undefined,
        lockTimeoutMs,
        `${what} gave up after ${asSeconds(lockTimeoutMs)} (DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS) waiting for a lock, and rolled back: nothing changed. ${where} ${failed.held} Once that session ends, start the service again; if it is another instance's long migration, raise DATABASE_MIGRATION_LOCK_TIMEOUT_SECONDS where this service reads its settings.`,
        { cause: failed.err },
      );
    }
    log(`${what} is waiting for a lock and rolled back to try again in ${asSeconds(wait)} (try ${tries}, giving up after ${asSeconds(lockTimeoutMs)}). ${where} ${failed.held}`);
    await pause(wait);
  }
};
