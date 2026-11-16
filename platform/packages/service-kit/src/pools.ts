import { asSeconds, secondsSetting } from './seconds.js';

/** A pg.Pool, or anything else that reports a lost connection with an 'error' event and a new one with 'connect'. */
interface Pool {
  on(event: 'error', listener: (err: Error) => void): unknown;
  on(event: 'connect', listener: (client: { query(text: string): Promise<unknown> }) => void): unknown;
  /** A pg.Pool's options, which pg reads each time a connection is asked for. */
  options?: { connectionTimeoutMillis?: number | undefined };
}

/** Ten seconds: far longer than a free connection or a new one takes, and no caller is kept waiting for ever. */
export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

/**
 * How long a caller waits for a connection from the pool, a free one or a new one, before it is told the database is
 * unavailable: DATABASE_CONNECT_TIMEOUT_SECONDS (AUGUR’s docs, Limits and health), ten seconds when unset or empty,
 * and no limit at 0.
 */
export const connectTimeoutMs = (env: Record<string, string | undefined> = process.env): number =>
  secondsSetting(env.DATABASE_CONNECT_TIMEOUT_SECONDS, DEFAULT_CONNECT_TIMEOUT_MS);

/**
 * No database connection came in time: every one in the service's pool is in use, or Postgres isn't answering. A
 * request that meets it is answered 503, "can’t be reached right now" (its name ends Unavailable, as `problems` reads it).
 */
export class DatabaseUnavailable extends Error {
  override readonly name = 'DatabaseUnavailable';
  constructor(readonly timeoutMs: number, options?: ErrorOptions) {
    super(`No database connection came free within ${asSeconds(timeoutMs)} (DATABASE_CONNECT_TIMEOUT_SECONDS): every connection in this service's pool is in use, or Postgres isn't answering.`, options);
  }
}

/** What pg says when a connection doesn't come in time: from the pool, or while making a new one. */
const TIMED_OUT = new Set(['timeout exceeded when trying to connect', 'Connection terminated due to connection timeout']);

type Connected = (err: Error | undefined, ...rest: unknown[]) => void;

/** Has `pool.connect`, in both its forms (pg.Pool's own `query` uses the callback one), answer DatabaseUnavailable on a timeout. */
const nameTimeouts = (pool: { connect(cb?: Connected): unknown; options: { connectionTimeoutMillis?: number | undefined } }) => {
  const connect = pool.connect.bind(pool);
  const named = (err: Error) => (TIMED_OUT.has(err.message) ? new DatabaseUnavailable(pool.options.connectionTimeoutMillis ?? 0, { cause: err }) : err);
  pool.connect = (cb?: Connected) =>
    cb ? connect((err, ...rest) => cb(err && named(err), ...rest)) : (connect() as Promise<unknown>).catch((err: Error) => Promise.reject(named(err)));
};

/** One minute: far longer than any query a person waits on, short enough that a runaway one ends. */
export const DEFAULT_STATEMENT_TIMEOUT_MS = 60_000;

/**
 * How long one database statement may run before Postgres cancels it: DATABASE_STATEMENT_TIMEOUT_SECONDS
 * (AUGUR’s docs, Limits and health), a minute when unset or empty, and no limit at 0. Migrations lift it for themselves.
 */
export const statementTimeoutMs = (env: Record<string, string | undefined> = process.env): number =>
  secondsSetting(env.DATABASE_STATEMENT_TIMEOUT_SECONDS, DEFAULT_STATEMENT_TIMEOUT_MS);

/**
 * Keeps a service up when Postgres restarts or drops a connection it was keeping idle. pg reports
 * that on the pool, and an 'error' with no listener ends the process; the pool makes a new
 * connection the next time one is wanted, so a log line is all it needs.
 * Each new connection also gets a statement timeout (PER-213), so a query stuck on a lock or a bad plan
 * is cancelled and its request fails, rather than holding a connection until the pool runs dry.
 * A caller waits at most `connectTimeoutMs()` for a connection (PER-456), unless the pool was made with its own
 * `connectionTimeoutMillis`, and is then told `DatabaseUnavailable` rather than waiting for ever on a pool that ran dry.
 */
export const steadyPool = <P extends Pool>(pool: P, log: (message: string) => void = (m) => console.error(m), timeoutMs = statementTimeoutMs()): P => {
  pool.on('error', (err) => log(`A database connection was lost (${err.message}); the next query opens a new one.`));
  // pg runs a client's queries in order, so this comes before whatever the connection was opened for.
  if (timeoutMs > 0) pool.on('connect', (client) => void client.query(`set statement_timeout = ${Math.round(timeoutMs)}`).catch(() => undefined));
  const lends = pool as P & { connect?: unknown };
  if (pool.options && typeof lends.connect === 'function') {
    pool.options.connectionTimeoutMillis ??= connectTimeoutMs();
    nameTimeouts(lends as unknown as Parameters<typeof nameTimeouts>[0]);
  }
  return pool;
};
