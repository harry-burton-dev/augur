import dbos from '@dbos-inc/dbos-sdk';

const { DBOS } = dbos;

/**
 * Background and scheduled jobs for a service (ADR 0014: DBOS Transact is the jobs engine).
 *
 * A job is a durable workflow kept in the service's own Postgres: when the service stops halfway
 * through one, it carries on from its last finished step when it starts again. So a job's steps must
 * be safe to run twice (DBOS may run the step it was in again), and anything that isn't, such as
 * sending mail, goes in its own `step`. Started jobs wait in the app's queue, so with several
 * instances each runs once, on whichever instance takes it. A scheduled job runs once per tick
 * across every instance. Every run that ends, well or badly, is recorded in the audit log.
 *
 * DBOS stays behind this interface: nothing of it is exported, so it can be swapped without
 * changing an app.
 */

/** What a job's own code gets. */
export interface JobContext {
  /** This run's id, the one `start` returned. */
  runId: string;
  /** A scheduled job's tick: when this run was due. */
  scheduledAt?: Date;
  /** Runs `fn` once and keeps its result, so a run resumed after a restart doesn't do it again. Results must be JSON. */
  step<T>(name: string, fn: () => Promise<T>): Promise<T>;
  log: JobLogger;
}

export type JobRun<Input> = (input: Input, ctx: JobContext) => Promise<void>;

/** A job `define` made, to `start` by. */
export interface Job<Input = void> {
  readonly name: string;
  /** Only for typing `start`'s input. */
  readonly input?: Input;
}

export interface JobOptions<Input> {
  /** At most this many runs of the job at once, across every instance. Unset: the app's queue decides. */
  concurrency?: number;
  /** The floor a run is on, for its audit entry. */
  floor?: (input: Input) => string | undefined;
}

export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface JobStatus {
  runId: string;
  job: string;
  state: JobState;
  /** Why it failed, when it did. */
  error?: string;
}

/** What a run that ended puts in the audit log: the app, as itself, did `job.<name>.done` or `.failed`. */
export interface JobAuditEntry {
  actor: string;
  actorKind: 'service';
  action: string;
  target: string;
  workspace?: string;
  detail?: Record<string, unknown>;
}

/** The logger a service already has (Fastify's pino); console works too. */
export interface JobLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  debug?(obj: unknown, msg?: string): void;
}

export interface Jobs {
  /** A job, defined before `launch`. */
  define<Input = void>(name: string, run: JobRun<Input>, options?: JobOptions<Input>): Job<Input>;
  /** A job that runs on a cron schedule (`m h dom mon dow`, or with seconds first), defined before `launch`. */
  schedule(name: string, cron: string, run: (ctx: JobContext) => Promise<void>): Job<never>;
  /** Queues a run and returns its id. Given an `id`, starting it again returns the same run. */
  start<Input>(job: Job<Input>, input: Input, options?: { id?: string }): Promise<string>;
  /** Stops a run that hasn't finished. It stops at its next step. */
  cancel(runId: string): Promise<void>;
  status(runId: string): Promise<JobStatus | undefined>;
  /** Starts running jobs: resumes what was interrupted, then takes queued runs and schedules. */
  launch(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface JobsOptions {
  /** The app or service id, from its manifest. It names the queue, the schedules and the audit actor. */
  app: string;
  /** The service's own database. Unset (as under `pnpm dev:app`), jobs run in memory and schedules don't run. */
  databaseUrl?: string;
  /**
   * The schema jobs are kept in: `<app's schema>_jobs` by default ("team-notes" → team_notes_jobs).
   * On a server the storage service makes it for the app's login, which may not create schemas.
   */
  schema?: string;
  log?: JobLogger;
  audit?: (entry: JobAuditEntry) => Promise<void>;
}

/** The schema an app's jobs are kept in: "team-notes" → team_notes_jobs. */
export const jobsSchemaFor = (app: string) => `${app.replace(/-/g, '_')}_jobs`;

/**
 * Every version of a service shares this, so a run interrupted by an upgrade is resumed by the new
 * version (DBOS resumes only runs of its own application version). That is safe because steps are
 * idempotent; a job whose steps change order between versions should get a new name.
 */
const JOBS_VERSION = 'augur-jobs-1';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

const STATES: Record<string, JobState> = {
  ENQUEUED: 'queued',
  DELAYED: 'queued',
  PENDING: 'running',
  SUCCESS: 'done',
  ERROR: 'failed',
  MAX_RECOVERY_ATTEMPTS_EXCEEDED: 'failed',
  CANCELLED: 'cancelled',
};

/** Records how a run ended. A failure to record is logged, never the job's failure. */
const recorder = (app: string, log: JobLogger, audit: JobsOptions['audit']) => async (name: string, runId: string, workspace: string | undefined, outcome: 'done' | 'failed', error?: string) => {
  if (!audit) return;
  try {
    await audit({ actor: app, actorKind: 'service', action: `job.${name}.${outcome}`, target: runId, ...(workspace ? { workspace } : {}), ...(error ? { detail: { error } } : {}) });
  } catch (err) {
    log.error({ err: message(err), job: name, runId }, 'could not record the job in the audit log');
  }
};

/** DBOS's own log lines, into the service's log. */
const dbosLogger = (log: JobLogger) => ({
  info: (entry: unknown) => log.info({ jobs: 'dbos' }, String(entry)),
  debug: (entry: unknown) => log.debug?.({ jobs: 'dbos' }, String(entry)),
  warn: (entry: unknown) => log.warn({ jobs: 'dbos' }, String(entry)),
  error: (entry: unknown) => log.error({ jobs: 'dbos', err: message(entry) }, 'jobs engine error'),
});

/** Jobs kept in Postgres, through DBOS Transact. One per process: DBOS is process-wide. */
const durableJobs = ({ app, databaseUrl, schema = jobsSchemaFor(app), log = console, audit }: JobsOptions & { databaseUrl: string }): Jobs => {
  const record = recorder(app, log, audit);
  const workflows = new Map<string, (input: unknown) => Promise<void>>();
  const queues = new Map<string, number | undefined>();
  const schedules: { name: string; cron: string; workflow: (at: Date) => Promise<void> }[] = [];
  let launching: Promise<void> | undefined;
  const queueOf = (name: string) => (queues.get(name) === undefined ? app : `${app}.${name}`);

  const contextFor = (scheduledAt?: Date): JobContext => ({
    runId: DBOS.workflowID ?? '',
    scheduledAt,
    step: (name, fn) => DBOS.runStep(fn, { name }),
    log,
  });

  const register = <Input>(name: string, body: (input: Input, scheduledAt?: Date) => Promise<void>, floor?: (input: Input) => string | undefined) => {
    if (launching) throw new Error(`The job ${name} must be defined before the jobs are launched.`);
    if (workflows.has(name)) throw new Error(`There's already a job called ${name}.`);
    const workflow = DBOS.registerWorkflow(
      async (input: Input, scheduledAt?: Date) => {
        const runId = DBOS.workflowID ?? '';
        const workspace = floor?.(input);
        try {
          await body(input, scheduledAt);
        } catch (err) {
          await DBOS.runStep(() => record(name, runId, workspace, 'failed', message(err)), { name: 'audit' });
          throw err;
        }
        await DBOS.runStep(() => record(name, runId, workspace, 'done'), { name: 'audit' });
      },
      { name },
    );
    workflows.set(name, workflow as (input: unknown) => Promise<void>);
    return workflow;
  };

  return {
    define<Input = void>(name: string, run: JobRun<Input>, { concurrency, floor }: JobOptions<Input> = {}) {
      register<Input>(name, (input) => run(input, contextFor()), floor);
      if (concurrency !== undefined) queues.set(name, concurrency);
      return { name };
    },

    schedule(name, cron, run) {
      const workflow = register<Date>(name, (scheduledAt) => run(contextFor(scheduledAt)));
      // DBOS calls the registered workflow itself, with the tick as its input.
      schedules.push({ name, cron, workflow });
      return { name } as Job<never>;
    },

    async start(job, input, { id } = {}) {
      await this.launch();
      const workflow = workflows.get(job.name);
      if (!workflow) throw new Error(`There's no job called ${job.name}.`);
      const handle = await DBOS.startWorkflow(workflow, { queueName: queueOf(job.name), ...(id ? { workflowID: id } : {}) })(input);
      return handle.workflowID;
    },

    async cancel(runId) {
      await DBOS.cancelWorkflow(runId);
    },

    async status(runId) {
      const status = await DBOS.getWorkflowStatus(runId);
      if (!status) return undefined;
      return {
        runId,
        job: status.workflowName,
        state: STATES[status.status] ?? 'running',
        ...(status.error ? { error: message(status.error) } : {}),
      };
    },

    launch() {
      launching ??= (async () => {
        DBOS.setConfig({
          name: app,
          systemDatabaseUrl: databaseUrl,
          systemDatabaseSchemaName: schema,
          applicationVersion: JOBS_VERSION,
          logger: dbosLogger(log),
        });
        try {
          await DBOS.launch();
        } catch (err) {
          throw new Error(
            `${app}'s jobs couldn't start (${message(err)}). They're kept in the schema ${schema}: on a server the storage service makes it for the app's login; elsewhere the login must be able to create it.`,
            { cause: err },
          );
        }
        await DBOS.registerQueue(app);
        for (const [name, concurrency] of queues) if (concurrency !== undefined) await DBOS.registerQueue(`${app}.${name}`, { concurrency });
        await DBOS.applySchedules(schedules.map(({ name, cron, workflow }) => ({ scheduleName: name, workflowFn: workflow, schedule: cron })));
        // A schedule whose job is gone stops with it.
        const ours = new Set(schedules.map((s) => s.name));
        for (const s of await DBOS.listSchedules()) if (!ours.has(s.scheduleName)) await DBOS.deleteSchedule(s.scheduleName);
        log.info({ jobs: [...workflows.keys()], schedules: [...ours] }, 'jobs running');
      })();
      return launching;
    },

    async shutdown() {
      if (!launching) return;
      await launching.catch(() => undefined);
      await DBOS.shutdown();
      launching = undefined;
    },
  };
};

/**
 * Jobs with no database, as under `pnpm dev:app` and in tests: a started job runs at once in this
 * process and isn't resumed after a restart; scheduled jobs don't run, and say so, but `runScheduled`
 * runs one by hand.
 */
export interface MemoryJobs extends Jobs {
  runScheduled(name: string, at?: Date): Promise<void>;
  /** Waits for every started run to end. */
  settled(): Promise<void>;
}

export const memoryJobs = ({ app, log = console, audit }: Omit<JobsOptions, 'databaseUrl' | 'schema'>): MemoryJobs => {
  const record = recorder(app, log, audit);
  const runs = new Map<string, { job: string; state: JobState; error?: string; done: Promise<void> }>();
  const defined = new Map<string, { run: (input: unknown, ctx: JobContext) => Promise<void>; floor?: (input: unknown) => string | undefined }>();
  const scheduled = new Map<string, (ctx: JobContext) => Promise<void>>();
  let launched = false;
  let next = 0;

  const execute = async (name: string, runId: string, body: (ctx: JobContext) => Promise<void>, workspace?: string, scheduledAt?: Date) => {
    const steps = new Map<string, unknown>();
    const ctx: JobContext = {
      runId,
      scheduledAt,
      log,
      async step(stepName, fn) {
        if (!steps.has(stepName)) steps.set(stepName, await fn());
        return steps.get(stepName) as never;
      },
    };
    const run = runs.get(runId);
    try {
      await body(ctx);
      if (run?.state === 'cancelled') return;
      if (run) run.state = 'done';
      await record(name, runId, workspace, 'done');
    } catch (err) {
      if (run) Object.assign(run, { state: 'failed', error: message(err) });
      log.error({ err: message(err), job: name, runId }, 'job failed');
      await record(name, runId, workspace, 'failed', message(err));
    }
  };

  return {
    define(name, run, { floor } = {}) {
      if (defined.has(name) || scheduled.has(name)) throw new Error(`There's already a job called ${name}.`);
      defined.set(name, { run: run as (input: unknown, ctx: JobContext) => Promise<void>, floor: floor as ((input: unknown) => string | undefined) | undefined });
      return { name };
    },
    schedule(name, cron, run) {
      if (defined.has(name) || scheduled.has(name)) throw new Error(`There's already a job called ${name}.`);
      scheduled.set(name, run);
      return { name } as Job<never>;
    },
    async start(job, input, { id } = {}) {
      const found = defined.get(job.name);
      if (!found) throw new Error(`There's no job called ${job.name}.`);
      const runId = id ?? `${job.name}-${++next}`;
      if (runs.has(runId)) return runId;
      const entry = { job: job.name, state: 'running' as JobState, done: Promise.resolve() };
      runs.set(runId, entry);
      entry.done = execute(job.name, runId, (ctx) => found.run(input, ctx), found.floor?.(input));
      return runId;
    },
    async cancel(runId) {
      const run = runs.get(runId);
      if (run && run.state === 'running') run.state = 'cancelled';
    },
    async status(runId) {
      const run = runs.get(runId);
      return run && { runId, job: run.job, state: run.state, ...(run.error ? { error: run.error } : {}) };
    },
    async launch() {
      if (launched) return;
      launched = true;
      if (scheduled.size) log.info({ schedules: [...scheduled.keys()] }, `${app}'s scheduled jobs don't run without a database (DATABASE_URL)`);
    },
    async shutdown() {
      await this.settled();
    },
    async runScheduled(name, at = new Date()) {
      const run = scheduled.get(name);
      if (!run) throw new Error(`There's no scheduled job called ${name}.`);
      const runId = `${name}-${at.toISOString()}`;
      runs.set(runId, { job: name, state: 'running', done: Promise.resolve() });
      await execute(name, runId, run, undefined, at);
    },
    async settled() {
      await Promise.all([...runs.values()].map((r) => r.done));
    },
  };
};

/** The service's jobs: kept in its database when it has one (DATABASE_URL), else in memory. */
export const createJobs = (options: JobsOptions): Jobs => (options.databaseUrl ? durableJobs({ ...options, databaseUrl: options.databaseUrl }) : memoryJobs(options));
