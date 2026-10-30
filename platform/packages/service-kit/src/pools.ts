/** A pg.Pool, or anything else that reports a lost connection with an 'error' event. */
interface Pool {
  on(event: 'error', listener: (err: Error) => void): unknown;
}

/**
 * Keeps a service up when Postgres restarts or drops a connection it was keeping idle. pg reports
 * that on the pool, and an 'error' with no listener ends the process; the pool makes a new
 * connection the next time one is wanted, so a log line is all it needs.
 */
export const steadyPool = <P extends Pool>(pool: P, log: (message: string) => void = (m) => console.error(m)): P => {
  pool.on('error', (err) => log(`A database connection was lost (${err.message}); the next query opens a new one.`));
  return pool;
};
