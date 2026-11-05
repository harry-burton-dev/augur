/** A pg.Pool, or anything else that reports a lost connection with an 'error' event and a new one with 'connect'. */
interface Pool {
  on(event: 'error', listener: (err: Error) => void): unknown;
  on(event: 'connect', listener: (client: { query(text: string): Promise<unknown> }) => void): unknown;
}

/** One minute: far longer than any query a person waits on, short enough that a runaway one ends. */
export const DEFAULT_STATEMENT_TIMEOUT_MS = 60_000;

/**
 * How long one database statement may run before Postgres cancels it: DATABASE_STATEMENT_TIMEOUT_SECONDS
 * (docs/deploy.md), a minute when unset or empty, and no limit at 0. Migrations lift it for themselves.
 */
export const statementTimeoutMs = (env: Record<string, string | undefined> = process.env): number => {
  const raw = env.DATABASE_STATEMENT_TIMEOUT_SECONDS?.trim();
  const seconds = Number(raw);
  return raw && Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : DEFAULT_STATEMENT_TIMEOUT_MS;
};

/**
 * Keeps a service up when Postgres restarts or drops a connection it was keeping idle. pg reports
 * that on the pool, and an 'error' with no listener ends the process; the pool makes a new
 * connection the next time one is wanted, so a log line is all it needs.
 * Each new connection also gets a statement timeout (PER-213), so a query stuck on a lock or a bad plan
 * is cancelled and its request fails, rather than holding a connection until the pool runs dry.
 */
export const steadyPool = <P extends Pool>(pool: P, log: (message: string) => void = (m) => console.error(m), timeoutMs = statementTimeoutMs()): P => {
  pool.on('error', (err) => log(`A database connection was lost (${err.message}); the next query opens a new one.`));
  // pg runs a client's queries in order, so this comes before whatever the connection was opened for.
  if (timeoutMs > 0) pool.on('connect', (client) => void client.query(`set statement_timeout = ${Math.round(timeoutMs)}`).catch(() => undefined));
  return pool;
};
