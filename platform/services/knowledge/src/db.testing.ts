// The knowledge service's tests run on real Postgres, as the deployment's own two logins: the migrating
// (platform) login and the service's kg_app login, signed in with a password, not `set role` from a
// superuser. CI starts the same image the deployment runs (pgvector/pgvector, compose.yml). Locally, point
// DATABASE_URL at a database of its own: each file drops and rebuilds the kg schema.
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, beforeAll } from 'vitest';
import { APP_LOGIN, asPerson, migrate, type Acting } from './store.ts';

/** kg_app's password in tests only. */
export const TEST_PASSWORD = 'kg-test-only';

/** The same database, signed in as the service's own login. */
export const appUrl = (adminUrl: string) => {
  const u = new URL(adminUrl);
  u.username = APP_LOGIN;
  u.password = TEST_PASSWORD;
  return u.toString();
};

export interface KnowledgeDb {
  /** The migrating login (a superuser in Compose, as on a deployment). */
  admin: pg.Pool;
  /** kg_app, fenced by row security. */
  app: pg.Pool;
  /** Rebuilds the schema from nothing: drop, migrate, and `extra` SQL as the admin (used by the mutation tests). */
  rebuild: (extra?: string) => Promise<void>;
  /** Empties every table but the ontology, between generated worlds. */
  empty: () => Promise<void>;
  /** One read or action as a person on a floor, as kg_app; rolled back, so a test leaves nothing behind. */
  peek: <T = Record<string, unknown>>(acting: Acting, sql: string, params?: unknown[]) => Promise<T[]>;
  /** As `peek`, with each row as an array of its columns, in order. */
  peekRows: (acting: Acting, sql: string, params?: unknown[]) => Promise<unknown[][]>;
}

/**
 * The store on a fresh kg schema for one test file. `url` is the migrating login's database, from each test
 * file's DATABASE_URL (CI's Postgres service); without it the file's tests are skipped, saying so.
 */
export const knowledgeDb = (url: string | undefined): KnowledgeDb => {
  const db = {} as KnowledgeDb;
  if (!url) return db;
  const DATABASE_URL = url;
  beforeAll(async () => {
    const admin = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    const rebuild = async (extra?: string) => {
      await admin.query('drop schema if exists kg cascade');
      await migrate(admin, { password: TEST_PASSWORD });
      if (extra) await admin.query(extra);
    };
    await rebuild();
    const app = new pg.Pool({ connectionString: appUrl(DATABASE_URL), max: 2 });
    const empty = async () => {
      await admin.query(`truncate kg.floors, kg.floor_members, kg.floor_roles, kg.entities, kg.identity_keys, kg.entity_names, kg.sources,
        kg.observations, kg.mentions, kg.faithful_checks, kg.beliefs, kg.belief_evidence, kg.belief_reach, kg.disputes, kg.merges,
        kg.summaries, kg.actions, kg.outbox, kg.forget_ledger, kg.candidates restart identity cascade`);
    };
    const peekAs = async (acting: Acting, query: pg.QueryConfig & { rowMode?: 'array' }) => {
      const client = await app.connect();
      try {
        await client.query('begin');
        await client.query(`select set_config('kg.person', $1, true), set_config('kg.floor', $2, true), set_config('kg.app', $3, true)`, [
          acting.person,
          acting.floor,
          acting.app ?? 'test',
        ]);
        return (await client.query(query)).rows;
      } finally {
        await client.query('rollback');
        client.release();
      }
    };
    const peek = async (acting: Acting, text: string, values: unknown[] = []) => peekAs(acting, { text, values });
    const peekRows = async (acting: Acting, text: string, values: unknown[] = []) => peekAs(acting, { text, values, rowMode: 'array' });
    Object.assign(db, { admin, app, rebuild, empty, peek, peekRows });
  });
  afterAll(async () => {
    await db.app?.end();
    await db.admin?.end();
  });
  return db;
};

/** One step of the draft-4 corpus load: an identity-mirror insert (no `as`) or an action as a person on a floor. */
interface LoadStep {
  as?: [person: string, floor: string, app: string];
  sql: string;
  /** The token later steps use for the id this step returned. */
  id?: string;
}

/**
 * Loads the 26-report corpus the way draft 4's load.py did, replaying its recorded steps: floors, members and
 * roles as identity would mirror them (the migrating login), every other write as an action by kg_app, as the
 * person and floor the loader acted as. Ids are made fresh; `{{uN}}` in a step stands for the id step N made.
 *
 * The recording (fixtures/load-actions.json) came from load.py against the bench's Postgres image. That loader
 * took modality and valid time from the data scientist's gold where an observation matched it, standing in for
 * an extractor that emits them, so gold-30's modality and time columns are partly measured against themselves.
 */
export const loadCorpus = async (db: KnowledgeDb) => {
  const steps = JSON.parse(readFileSync(new URL('./fixtures/load-actions.json', import.meta.url), 'utf8')) as LoadStep[];
  const ids = new Map<string, string>();
  const bind = (sql: string) =>
    sql.replace(/\{\{(u\d+)\}\}/g, (_, t: string) => {
      const id = ids.get(t);
      if (!id) throw new Error(`The load refers to ${t} before any step made it.`);
      return id;
    });
  for (const [n, step] of steps.entries()) {
    const sql = bind(step.sql);
    const rows = await (step.as
      ? asPerson(db.app, { person: step.as[0], floor: step.as[1], app: step.as[2] }, async (c) => (await c.query(sql)).rows)
      : db.admin.query(sql).then((r) => r.rows)
    ).catch((err: Error) => {
      throw new Error(`Load step ${n} failed: ${err.message}\n${step.sql}`, { cause: err });
    });
    if (step.id) ids.set(step.id, String(Object.values(rows[0] as object)[0]));
  }
  return { steps: steps.length };
};
