import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { HealthMonitor } from './status.ts';
import { Traffic } from './traffic.ts';

describe('traffic (ADR 0020, the watch after an upgrade)', () => {
  it('counts calls and server errors in the last minutes, and forgets older ones', () => {
    let at = Date.parse('2026-11-01T10:00:10Z');
    const traffic = new Traffic(() => at);
    traffic.record(200);
    traffic.record(502);
    at += 60_000;
    traffic.record(200);
    expect(traffic.snapshot(5)).toMatchObject({ minutes: 5, requests: 3, serverErrors: 1, countingSince: '2026-11-01T10:00:10.000Z' });
    expect(traffic.snapshot(1)).toMatchObject({ requests: 1, serverErrors: 0 });
    at += 20 * 60_000;
    expect(traffic.snapshot(15)).toMatchObject({ requests: 0, serverErrors: 0 });
  });

  it('answers GET /traffic without a sign-in, and counts what the gateway answers, not its own probes', async () => {
    const traffic = new Traffic();
    const app = await buildApp({ upstreams: {}, monitor: new HealthMonitor({ probes: [] }), traffic });
    await app.inject({ method: 'GET', url: '/healthz' });
    await app.inject({ method: 'GET', url: '/api/registry/v1/apps' });
    const res = await app.inject({ method: 'GET', url: '/traffic?minutes=5' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ minutes: 5, requests: 1 });
    await app.close();
  });
});
