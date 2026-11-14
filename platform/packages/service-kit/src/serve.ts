import type { FastifyInstance, FastifySchema } from 'fastify';
import { sendProblem } from './problems.js';
import { FLUSH_TELEMETRY, SERVING, type ShutdownHooks } from './shutdown.js';

export { FLUSH_TELEMETRY, SERVING } from './shutdown.js';
const hooks = globalThis as ShutdownHooks;

/** Twenty seconds: longer than any call a person waits on, well inside Compose's stop_grace_period. */
export const DEFAULT_SHUTDOWN_GRACE_MS = 20_000;
/** How long one readiness check may take before it counts as not ready. */
export const READY_CHECK_TIMEOUT_MS = 2_000;
/** How long a stopping service waits for telemetry to send what it holds. */
const FLUSH_MS = 3_000;

/** How long a stopping service lets calls in flight finish: SHUTDOWN_GRACE_SECONDS, else 20 seconds. */
export const shutdownGraceMs = (env: Record<string, string | undefined> = process.env): number => {
  const seconds = Number(env.SHUTDOWN_GRACE_SECONDS?.trim());
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : DEFAULT_SHUTDOWN_GRACE_MS;
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

  app.get('/readyz', { schema: { hide: true } as FastifySchema }, async (_req, reply) => {
    if (stopped) return sendProblem(reply, 503, 'unavailable', 'This service is stopping.');
    const checks = Object.fromEntries(
      await Promise.all(ready.map(async ({ name, check }) => [name, await within(Promise.resolve().then(check), READY_CHECK_TIMEOUT_MS).then(() => 'ok', (err: Error) => err.message || 'not answering')] as const)),
    );
    const down = Object.entries(checks).filter(([, result]) => result !== 'ok');
    if (down.length) return sendProblem(reply, 503, 'unavailable', `Not ready: ${down.map(([name, why]) => `${name} (${why})`).join(', ')}.`, { extensions: { checks } });
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
      } finally {
        clearTimeout(cut);
      }
      for (const done of close) {
        try {
          await done();
        } catch (err) {
          app.log.warn({ err: String(err) }, 'closing failed');
        }
      }
      const flush = hooks[FLUSH_TELEMETRY];
      if (flush) await within(flush(), FLUSH_MS).catch(() => undefined);
      app.log.info('stopped');
      exit(0);
    })());

  for (const signal of signals) process.once(signal, () => void stop(signal));
  return {
    get stopping() {
      return stopped !== undefined;
    },
    stop,
  };
}
