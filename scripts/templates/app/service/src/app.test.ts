import { callerHeaders } from '@augur/service-kit';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';

describe('__ID__', () => {
  it('reports healthy', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: '__ID__', version: expect.stringMatching(/^\d+\.\d+\.\d+/), api: 'v1' });
  });

  it('greets the person the gateway passed on', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/greeting',
      headers: callerHeaders({ id: 'u1', name: 'Sam Okafor', departments: [], roles: [] }),
    });
    expect(res.json().message).toMatch(/Sam Okafor/);
  });

  it('refuses a call with no one signed in', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/v1/greeting' });
    expect(res.statusCode).toBe(401);
  });
});
