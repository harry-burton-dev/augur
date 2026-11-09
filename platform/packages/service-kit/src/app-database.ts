/**
 * An app's own database, as the app runner hands it to a part on the app contract (the `augur-database`
 * resource in its Score file, spec 4.3): DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER,
 * DATABASE_SCHEMA, DATABASE_CONNECTIONS, and the password only as a file, DATABASE_PASSWORD_FILE. The login
 * `app_<id>` has the app's schema as its search_path, so unqualified tables land there.
 */
import pg from 'pg';
import { loadConfig } from './config.js';
import { statementTimeoutMs, steadyPool } from './pools.js';

/** A row's shape: column names to values. */
export type DatabaseRow = Record<string, unknown>;

/** What a query answers. */
export interface DatabaseResult<R extends DatabaseRow = DatabaseRow> {
  rows: R[];
  rowCount: number | null;
}

/** A connection taken from the pool, to be given back with `release`. */
export interface DatabaseClient {
  query<R extends DatabaseRow = DatabaseRow>(text: string, values?: unknown[]): Promise<DatabaseResult<R>>;
  release(err?: Error | boolean): void;
}

/** The app's connection pool (a pg.Pool, in our own words so the kit's API names no pg type). */
export interface DatabasePool {
  query<R extends DatabaseRow = DatabaseRow>(text: string, values?: unknown[]): Promise<DatabaseResult<R>>;
  connect(): Promise<DatabaseClient>;
  end(): Promise<void>;
}

export interface AppDatabase {
  pool: DatabasePool;
  /** The app's schema, which the login's search_path already names. */
  schema: string;
}

/** The database the runner gave this part, or undefined without DATABASE_HOST (as under `pnpm dev:app`). */
export const appDatabaseFromEnv = (service: string, env: NodeJS.ProcessEnv = process.env): AppDatabase | undefined => {
  if (!env.DATABASE_HOST) return undefined;
  loadConfig(service, [{ name: 'DATABASE_PASSWORD', about: 'the app’s database password, as a file', required: true, secret: true }], env);
  const schema = env.DATABASE_SCHEMA;
  if (!schema) throw new Error('DATABASE_SCHEMA is not set: the app runner gives it with the database.');
  const pool = steadyPool(
    new pg.Pool({
      host: env.DATABASE_HOST,
      port: Number(env.DATABASE_PORT || 5432),
      database: env.DATABASE_NAME,
      user: env.DATABASE_USER,
      password: env.DATABASE_PASSWORD,
      max: Number(env.DATABASE_CONNECTIONS || 0) || undefined,
    }),
    undefined,
    statementTimeoutMs(env),
  );
  return { pool: pool as unknown as DatabasePool, schema };
};
