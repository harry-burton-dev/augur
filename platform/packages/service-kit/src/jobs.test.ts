import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createJobs, jobsSchemaFor, memoryJobs, type JobAuditEntry } from './jobs.js';
import { prepareJobsSchema } from './jobs-schema.js';

const quiet = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
const until = async (check: () => Promise<boolean>, ms = 15_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('timed out');
};

describe('jobsSchemaFor', () => {
  it('names the schema after the app', () => {
    expect(jobsSchemaFor('team-notes')).toBe('team_notes_jobs');
  });
});

describe('memoryJobs', () => {
  it('runs a started job, once per id, and records how it ended', async () => {
    const audited: JobAuditEntry[] = [];
    const jobs = memoryJobs({ app: 'notes', log: quiet, audit: async (e) => void audited.push(e) });
    const seen: number[] = [];
    const add = jobs.define<{ n: number; workspace: string }>('add', async ({ n }) => void seen.push(n), { floor: (i) => i.workspace });
    await jobs.launch();
    const id = await jobs.start(add, { n: 1, workspace: 'w1' }, { id: 'once' });
    expect(await jobs.start(add, { n: 2, workspace: 'w1' }, { id: 'once' })).toBe(id);
    await jobs.settled();
    expect(seen).toEqual([1]);
    expect(await jobs.status(id)).toMatchObject({ job: 'add', state: 'done' });
    expect(audited).toEqual([{ actor: 'notes', actorKind: 'service', action: 'job.add.done', target: id, workspace: 'w1' }]);
  });

  it('says why a job failed, and records it', async () => {
    const audited: JobAuditEntry[] = [];
    const jobs = memoryJobs({ app: 'notes', log: quiet, audit: async (e) => void audited.push(e) });
    const broken = jobs.define('broken', async () => {
      throw new Error('the bucket is full');
    });
    const id = await jobs.start(broken, undefined);
    await jobs.settled();
    expect(await jobs.status(id)).toMatchObject({ state: 'failed', error: 'the bucket is full' });
    expect(audited[0]).toMatchObject({ action: 'job.broken.failed', detail: { error: 'the bucket is full' } });
  });

  it("doesn't let a job's audit failure fail the job", async () => {
    const jobs = memoryJobs({ app: 'notes', log: quiet, audit: async () => Promise.reject(new Error('events is down')) });
    const fine = jobs.define('fine', async () => {});
    const id = await jobs.start(fine, undefined);
    await jobs.settled();
    expect((await jobs.status(id))?.state).toBe('done');
  });

  it('runs a scheduled job only when asked', async () => {
    const jobs = memoryJobs({ app: 'notes', log: quiet });
    const ticks: Date[] = [];
    jobs.schedule('tidy', '*/15 * * * *', async ({ scheduledAt }) => void ticks.push(scheduledAt!));
    await jobs.launch();
    expect(ticks).toEqual([]);
    const at = new Date('2026-11-03T10:15:00Z');
    await jobs.runScheduled('tidy', at);
    expect(ticks).toEqual([at]);
  });

  it('leaves a job another process runs waiting, and says so', async () => {
    const jobs = memoryJobs({ app: 'notes', log: quiet });
    const render = jobs.elsewhere<string>('render');
    const id = await jobs.start(render, 'v1');
    expect(await jobs.status(id)).toMatchObject({ state: 'queued' });
  });

  it('refuses two jobs with one name', () => {
    const jobs = memoryJobs({ app: 'notes', log: quiet });
    jobs.define('a', async () => {});
    expect(() => jobs.schedule('a', '* * * * *', async () => {})).toThrow(/already/);
  });
});

// Runs wherever DATABASE_URL points at a Postgres; CI starts one for it. DBOS is process-wide, so
// one set of jobs serves every test here.
describe.runIf(process.env.DATABASE_URL)('jobs on Postgres', () => {
  const app = `kit-jobs-${process.pid}`;
  const schema = jobsSchemaFor(app);
  const audited: JobAuditEntry[] = [];
  const jobs = createJobs({ app, databaseUrl: process.env.DATABASE_URL, log: quiet, audit: async (e) => void audited.push(e) });
  let admin: pg.Pool;
  const calls = { side: 0, ticks: 0 };
  let gate: () => void = () => {};
  const opened = new Promise<void>((r) => (gate = r));

  const twice = jobs.define<{ n: number }>('twice', async ({ n }, { step }) => {
    const doubled = await step('double', async () => {
      calls.side++;
      return n * 2;
    });
    await step('keep', async () => {
      await admin.query(`insert into ${schema}_results (n) values ($1)`, [doubled]);
    });
  });
  const failing = jobs.define('failing', async () => {
    throw new Error('the bucket is full');
  });
  const waiting = jobs.define('waiting', async (_input, { step }) => {
    await opened;
    await step('after', async () => {});
  });
  const render = jobs.elsewhere<{ version: string }>('render', { workerConcurrency: 1 });
  jobs.schedule('every-second', '* * * * * *', async () => {
    calls.ticks++;
  });

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query(`drop schema if exists ${schema} cascade`);
    await admin.query(`create table if not exists ${schema}_results (n int)`);
    await admin.query(`truncate ${schema}_results`);
    await jobs.launch();
  }, 30_000);

  afterAll(async () => {
    gate();
    await jobs.shutdown();
    await admin.query(`drop schema if exists ${schema} cascade`);
    await admin.query(`drop table if exists ${schema}_results`);
    await admin.end();
  }, 30_000);

  it('runs a queued job to the end, once per id, and records it', async () => {
    const id = await jobs.start(twice, { n: 21 }, { id: `${app}-once` });
    await until(async () => (await jobs.status(id))?.state === 'done');
    expect(await jobs.start(twice, { n: 21 }, { id: `${app}-once` })).toBe(id);
    await new Promise((r) => setTimeout(r, 300));
    expect(calls.side).toBe(1);
    expect((await admin.query(`select n from ${schema}_results`)).rows).toEqual([{ n: 42 }]);
    expect(audited).toContainEqual({ actor: app, actorKind: 'service', action: 'job.twice.done', target: id });
  });

  it('says why a job failed', async () => {
    const id = await jobs.start(failing, undefined);
    await until(async () => (await jobs.status(id))?.state === 'failed');
    expect(await jobs.status(id)).toMatchObject({ job: 'failing', error: expect.stringMatching(/bucket is full/) });
    expect(audited).toContainEqual(expect.objectContaining({ action: 'job.failing.failed', target: id }));
  });

  it('cancels a run that has not finished', async () => {
    const id = await jobs.start(waiting, undefined);
    await until(async () => (await jobs.status(id))?.state === 'running');
    await jobs.cancel(id);
    gate();
    await until(async () => (await jobs.status(id))?.state === 'cancelled');
  });

  it('runs a scheduled job on its schedule', async () => {
    await until(async () => calls.ticks >= 2, 10_000);
  });

  it('queues a job another process runs, and leaves it for that process', async () => {
    const id = await jobs.start(render, { version: 'v1' }, { id: `${app}-render-v1` });
    await new Promise((r) => setTimeout(r, 1500));
    expect(await jobs.status(id)).toMatchObject({ job: 'render', state: 'queued' });
    const { rows } = await admin.query(`select queue_name from ${schema}.workflow_status where workflow_uuid = $1`, [id]);
    expect(rows).toEqual([{ queue_name: `${app}.render` }]);
  });

  it('keeps its runs in the app’s own jobs schema', async () => {
    const { rows } = await admin.query('select 1 from information_schema.tables where table_schema = $1 and table_name = $2', [schema, 'workflow_status']);
    expect(rows).toHaveLength(1);
  });
});

// A server's login, made as the storage service makes it: it owns its jobs schema but can't create schemas.
describe.runIf(process.env.DATABASE_URL)('jobs with a login that cannot create schemas', () => {
  const role = `kit_jobs_login_${process.pid}`;
  const schema = jobsSchemaFor(`kit-login-${process.pid}`);
  let admin: pg.Pool;
  let url: string;

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await admin.query<{ db: string }>('select current_database() as db');
    await admin.query(`drop schema if exists ${schema} cascade`);
    await admin.query(`do $$ begin if exists (select 1 from pg_roles where rolname = '${role}') then drop owned by ${role}; drop role ${role}; end if; end $$`);
    await admin.query(`create role ${role} login nosuperuser nocreatedb nocreaterole noinherit password 'jobs'`);
    await admin.query(`grant connect on database ${pg.escapeIdentifier(rows[0].db)} to ${role}`);
    await admin.query(`create schema ${schema} authorization ${role}`);
    const u = new URL(process.env.DATABASE_URL!);
    u.username = role;
    u.password = 'jobs';
    url = u.toString();
  });

  afterAll(async () => {
    await admin.query(`drop schema if exists ${schema} cascade`);
    await admin.query(`drop owned by ${role}`);
    await admin.query(`drop role if exists ${role}`);
    await admin.end();
  });

  it('readies the schema storage made, so DBOS makes its tables in it', async () => {
    const login = new pg.Pool({ connectionString: url });
    await expect(login.query(`create schema if not exists ${schema}`)).rejects.toThrow(/permission denied/);
    await prepareJobsSchema(url, schema);
    await prepareJobsSchema(url, schema);
    const { ensureSystemDatabase } = await import('@dbos-inc/dbos-sdk/internal/system_database');
    await ensureSystemDatabase(url, { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as never, login as never, schema);
    const { rows } = await admin.query('select 1 from information_schema.tables where table_schema = $1 and table_name = $2', [schema, 'workflow_status']);
    expect(rows).toHaveLength(1);
    await login.end();
  });
});
