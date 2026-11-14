import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHUTDOWN_GRACE_MS, FLUSH_TELEMETRY, poolCheck, serve, shutdownGraceMs, type Serving } from './serve.js';

const hooks = globalThis as { [FLUSH_TELEMETRY]?: () => Promise<unknown> };

describe('serve', () => {
  const running: Serving[] = [];
  afterEach(async () => {
    delete hooks[FLUSH_TELEMETRY];
    await Promise.all(running.splice(0).map((s) => s.stop('test over')));
  });

  const start = async (options: Partial<Parameters<typeof serve>[1]> = {}) => {
    const app = Fastify({ logger: false });
    let finish: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      app.get('/v1/slow', async () => {
        resolve();
        await new Promise<void>((done) => (finish = done));
        return { done: true };
      });
    });
    app.get('/v1/quick', async () => ({ quick: true }));
    const exit = vi.fn();
    const serving = await serve(app, { port: 0, host: '127.0.0.1', signals: [], exit, ...options });
    running.push(serving);
    const { port } = app.server.address() as { port: number };
    return { app, serving, exit, url: `http://127.0.0.1:${port}`, started, finish: () => finish?.() };
  };

  it('reads the grace period, falling back to twenty seconds', () => {
    expect(shutdownGraceMs({})).toBe(DEFAULT_SHUTDOWN_GRACE_MS);
    expect(shutdownGraceMs({ SHUTDOWN_GRACE_SECONDS: '5' })).toBe(5_000);
    expect(shutdownGraceMs({ SHUTDOWN_GRACE_SECONDS: 'soon' })).toBe(DEFAULT_SHUTDOWN_GRACE_MS);
  });

  it('is ready when every pool answers, and says which one doesn’t', async () => {
    let up = true;
    const pool = { query: async () => (up ? { rows: [] } : Promise.reject(new Error('connection refused'))) };
    const { url } = await start({ ready: [poolCheck('database', pool)] });
    const ok = await fetch(`${url}/readyz`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ready: true, checks: { database: 'ok' } });
    up = false;
    const down = await fetch(`${url}/readyz`);
    expect(down.status).toBe(503);
    expect(await down.json()).toMatchObject({ detail: 'Not ready: database (connection refused).', checks: { database: 'connection refused' } });
  });

  it('on stop, finishes a call in flight, refuses new calls, then closes its pools and flushes telemetry', async () => {
    const order: string[] = [];
    hooks[FLUSH_TELEMETRY] = async () => void order.push('telemetry');
    const { url, serving, exit, started, finish } = await start({ close: [() => void order.push('pool')] });
    const inFlight = fetch(`${url}/v1/slow`);
    await started;

    const stopped = serving.stop('SIGTERM');
    expect(serving.stopping).toBe(true);
    // A new call is refused while the one in flight is still running.
    const fresh = await fetch(`${url}/v1/quick`, { signal: AbortSignal.timeout(1500) }).then((r) => r.status, () => 'refused');
    expect(fresh).not.toBe(200);
    expect(order).toEqual([]);

    finish();
    const res = await inFlight;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ done: true });
    await stopped;
    expect(order).toEqual(['pool', 'telemetry']);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('cuts what is still open once the grace period is over, so a stop never hangs', async () => {
    const { url, serving, exit, started } = await start({ graceMs: 200 });
    const stuck = fetch(`${url}/v1/slow`).then(
      () => 'answered',
      () => 'cut',
    );
    await started;
    const began = performance.now();
    await serving.stop('SIGTERM');
    expect(performance.now() - began).toBeLessThan(2_000);
    expect(await stuck).toBe('cut');
    expect(exit).toHaveBeenCalledWith(0);
  });
});
