import type { ServerResponse } from 'node:http';
import type { FastifyInstance, FastifySchema } from 'fastify';
import { sendProblem } from './problems.js';
import { FLUSH_TELEMETRY, SERVING, type ShutdownHooks } from './shutdown.js';

export { FLUSH_TELEMETRY, SERVING } from './shutdown.js';
const hooks = globalThis as ShutdownHooks;

/** How long Docker waits for a service to stop before it kills it: Compose's stop_grace_period for AUGUR's services. */
export const STOP_BUDGET_MS = 30_000;
/** How long a stopping service waits for telemetry to send what it holds. */
export const TELEMETRY_FLUSH_MS = 3_000;
/** How long a stopping service gives everything it closes (pools, timers) once its calls have finished. */
export const CLOSE_BUDGET_MS = 3_000;
/** Twenty seconds: longer than any call a person waits on, well inside Compose's stop_grace_period. */
export const DEFAULT_SHUTDOWN_GRACE_MS = 20_000;
/** The longest grace a setting can ask for: what is left of Docker's wait once closing and telemetry have theirs, and a second spare. */
export const MAX_SHUTDOWN_GRACE_MS = STOP_BUDGET_MS - CLOSE_BUDGET_MS - TELEMETRY_FLUSH_MS - 1_000;
/** How long one readiness check may take before it counts as not ready. */
export const READY_CHECK_TIMEOUT_MS = 2_000;

/**
 * How long a stopping service lets calls in flight finish: SHUTDOWN_GRACE_SECONDS, else 20 seconds, and never so
 * long that Docker kills it before it has closed its pools and sent its telemetry.
 */
export const shutdownGraceMs = (env: Record<string, string | undefined> = process.env): number => {
  const seconds = Number(env.SHUTDOWN_GRACE_SECONDS?.trim());
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.round(seconds * 1000), MAX_SHUTDOWN_GRACE_MS) : DEFAULT_SHUTDOWN_GRACE_MS;
};

/**
 * Ends a service's open streams (server-sent events) as it stops, before it waits for its calls in flight:
 * a stream has no end of its own, and the browser opens it again on a service that is up. Call it once as
 * the app is built, and pass each stream's response to what it returns.
 */
export const endStreamsOnStop = (app: FastifyInstance): ((res: ServerResponse) => void) => {
  const open = new Set<ServerResponse>();
  app.addHook('preClose', async () => {
    for (const res of open) res.end();
  });
  return (res) => {
    open.add(res);
    res.on('close', () => open.delete(res));
  };
};

/** One thing a service needs before it can answer: a database pool, another store. */
export interface ReadyCheck {
  /** What it is, as /readyz names it: "database". */
  name: string;
  /** Resolves when the thing answers. */
  check: () => Promise<unknown>;
}

/** A readiness check that a database pool answers a query. */
export const poolCheck = (name: string, pool: { query(text: string): Promise<unknown> }): ReadyCheck => ({ name, check: () => pool.query('select 1') });

/** How serve() runs a service. */
export interface ServeOptions {
  /** The port it listens on. */
  port: number;
  /** The address it listens on; every address unless a test says otherwise. */
  host?: string;
  /** What must answer before this service is ready: each database pool. */
  ready?: ReadyCheck[];
  /** What to close once the calls in flight have finished, in order: pools, timers, subscriptions. */
  close?: Array<() => unknown>;
  /** How long calls in flight may take to finish once stopping starts. Defaults to shutdownGraceMs(). */
  graceMs?: number;
  /** The signals that stop it (SIGTERM and SIGINT); none in tests. */
  signals?: readonly NodeJS.Signals[];
  /** How the process ends once stopped; process.exit unless a test says otherwise. */
  exit?: (code: number) => void;
}

/** A service serve() is running. */
export interface Serving {
  /** True once stopping has started: /readyz says so, and no new call is taken. */
  readonly stopping: boolean;
  /** Stops as SIGTERM does. Calling it again returns the same stop. */
  stop(reason?: string): Promise<void>;
  /** Stops background work started after serve() (a relay, a follower, a timer) before what it uses is closed. */
  onStop(stop: () => unknown): void;
}

const within = <T>(work: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms);
    work.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });

/**
 * Runs a platform service the one way every one runs: GET /readyz says whether each thing it needs answers,
 * and on SIGTERM it stops being ready, refuses new calls, lets the calls in flight finish (for at most the
 * grace period), closes what it holds, then lets telemetry send what is left before it exits.
 * /healthz stays as it is: it says what is running, for the updater and the gateway's Status.
 */
export async function serve(app: FastifyInstance, { port, host = '0.0.0.0', ready = [], close = [], graceMs = shutdownGraceMs(), signals = ['SIGTERM', 'SIGINT'], exit = (code) => process.exit(code) }: ServeOptions): Promise<Serving> {
  let stopped: Promise<void> | undefined;
  /** Background work's stops, run once the calls in flight have finished and before `close`. */
  const background: Array<() => unknown> = [];

  app.get('/readyz', { schema: { hide: true } as FastifySchema }, async (_req, reply) => {
    if (stopped) return sendProblem(reply, 503, 'unavailable', 'This service is stopping.');
    // The answer names what isn't answering, never why: the reason (a login, a host name) goes to the log only.
    const checks = Object.fromEntries(
      await Promise.all(
        ready.map(async ({ name, check }) => {
          const result = await within(Promise.resolve().then(check), READY_CHECK_TIMEOUT_MS).then(
            () => 'ok' as const,
            (err: Error) => (app.log.warn({ check: name, err: err.message }, 'not ready'), 'not answering' as const),
          );
          return [name, result] as const;
        }),
      ),
    );
    const down = Object.entries(checks).filter(([, result]) => result !== 'ok');
    if (down.length) return sendProblem(reply, 503, 'unavailable', `Not ready: ${down.map(([name]) => name).join(', ')} not answering.`, { extensions: { checks } });
    return { ready: true, checks };
  });

  // While stopping, each answer closes its connection, so a kept-alive one doesn't hold the stop open.
  app.addHook('onSend', async (_req, reply) => {
    if (stopped) reply.header('connection', 'close');
  });

  await app.listen({ port, host });
  hooks[SERVING] = true;

  const stop = (reason = 'asked'): Promise<void> =>
    (stopped ??= (async () => {
      app.log.info({ reason, graceMs }, 'stopping: finishing the calls in flight');
      // Fastify answers 503 to any new call while it closes, and waits for those in flight. Past the grace
      // period whatever is still open (a stream, a stuck call) is cut, so a stop never hangs.
      const cut = setTimeout(() => app.server.closeAllConnections(), graceMs);
      try {
        await app.close();
      } catch (err) {
        app.log.warn({ err: String(err) }, 'stopping the server failed; closing the rest anyway');
      } finally {
        clearTimeout(cut);
      }
      // What it holds closes in order, all within the close budget, so a pool waiting on a busy client can't
      // keep it from exiting before Docker's wait is over.
      const closing = (async () => {
        for (const done of [...background, ...close]) {
          try {
            await done();
          } catch (err) {
            app.log.warn({ err: String(err) }, 'closing failed');
          }
        }
      })();
      await within(closing, CLOSE_BUDGET_MS).catch(() => app.log.warn({ budgetMs: CLOSE_BUDGET_MS }, 'closing took too long; stopping anyway'));
      const flush = hooks[FLUSH_TELEMETRY];
      if (flush) await within(flush(), TELEMETRY_FLUSH_MS).catch(() => undefined);
      app.log.info('stopped');
      exit(0);
    })());

  for (const signal of signals) process.once(signal, () => void stop(signal));
  return {
    get stopping() {
      return stopped !== undefined;
    },
    stop,
    onStop: (done) => void background.push(done),
  };
}
