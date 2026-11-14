import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLOSE_BUDGET_MS, DEFAULT_SHUTDOWN_GRACE_MS, endStreamsOnStop, FLUSH_TELEMETRY, MAX_SHUTDOWN_GRACE_MS, poolCheck, serve, shutdownGraceMs, STOP_BUDGET_MS, TELEMETRY_FLUSH_MS, type Serving } from './serve.js';

const hooks = globalThis as { [FLUSH_TELEMETRY]?: () => Promise<unknown> };

describe('serve', () => {
  const running: Serving[] = [];
  afterEach(async () => {
    delete hooks[FLUSH_TELEMETRY];
    await Promise.all(running.splice(0).map((s) => s.stop('test over')));
  });

  const start = async (options: Partial<Parameters<typeof serve>[1]> = {}, setUp: (app: ReturnType<typeof Fastify>) => void = () => undefined) => {
    const app = Fastify({ logger: false });
    setUp(app);
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

  it('reads the grace period, falling back to twenty seconds, and never past what Docker waits', () => {
    expect(shutdownGraceMs({})).toBe(DEFAULT_SHUTDOWN_GRACE_MS);
    expect(shutdownGraceMs({ SHUTDOWN_GRACE_SECONDS: '5' })).toBe(5_000);
    expect(shutdownGraceMs({ SHUTDOWN_GRACE_SECONDS: 'soon' })).toBe(DEFAULT_SHUTDOWN_GRACE_MS);
    expect(shutdownGraceMs({ SHUTDOWN_GRACE_SECONDS: '45' })).toBe(MAX_SHUTDOWN_GRACE_MS);
    expect(MAX_SHUTDOWN_GRACE_MS + CLOSE_BUDGET_MS + TELEMETRY_FLUSH_MS).toBeLessThan(STOP_BUDGET_MS);
    expect(DEFAULT_SHUTDOWN_GRACE_MS).toBeLessThanOrEqual(MAX_SHUTDOWN_GRACE_MS);
  });

  it('is ready when every pool answers, and names the one that doesn’t without saying why', async () => {
    let up = true;
    const pool = { query: async () => (up ? { rows: [] } : Promise.reject(new Error('password authentication failed for user "platform_identity"'))) };
    const { url } = await start({ ready: [poolCheck('database', pool)] });
    const ok = await fetch(`${url}/readyz`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ready: true, checks: { database: 'ok' } });
    up = false;
    const down = await fetch(`${url}/readyz`);
    expect(down.status).toBe(503);
    const body = await down.text();
    expect(JSON.parse(body)).toMatchObject({ detail: 'Not ready: database not answering.', checks: { database: 'not answering' } });
    expect(body).not.toContain('platform_identity');
  });

  it('on stop, finishes a call in flight, refuses new calls, then stops its background work, closes its pools and flushes telemetry', async () => {
    const order: string[] = [];
    hooks[FLUSH_TELEMETRY] = async () => void order.push('telemetry');
    const { url, serving, exit, started, finish } = await start({ close: [() => void order.push('pool')] });
    serving.onStop(() => void order.push('relay'));
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
    expect(order).toEqual(['relay', 'pool', 'telemetry']);
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

  it('closes and exits even when stopping the server fails or a pool never finishes closing', async () => {
    const { serving, exit } = await start({ close: [() => new Promise(() => undefined)] }, (app) =>
      app.addHook('onClose', async () => {
        throw new Error('a hook failed');
      }),
    );
    const began = performance.now();
    await serving.stop('SIGTERM');
    expect(performance.now() - began).toBeLessThan(CLOSE_BUDGET_MS + 1_000);
    expect(exit).toHaveBeenCalledWith(0);
  }, 10_000);

  it('ends the streams it holds open as it stops, so stopping never waits on them', async () => {
    const app = Fastify({ logger: false });
    const holdOpen = endStreamsOnStop(app);
    app.get('/v1/stream', (_req, reply) => {
      reply.hijack();
      reply.raw.writeHead(200, { 'content-type': 'text/event-stream' });
      reply.raw.write(': open\n\n');
      holdOpen(reply.raw);
    });
    const serving = await serve(app, { port: 0, host: '127.0.0.1', signals: [], exit: vi.fn() });
    const { port } = app.server.address() as { port: number };
    const reader = (await fetch(`http://127.0.0.1:${port}/v1/stream`)).body!.getReader();
    await reader.read();
    const began = performance.now();
    await serving.stop('SIGTERM');
    expect(performance.now() - began).toBeLessThan(1_000);
    expect((await reader.read()).done).toBe(true);
  });
});
