import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@platform/service-kit';
import { buildApp } from './app.ts';

describe('identity', () => {
  it('reports healthy', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'identity' });
  });

  it('says who the caller is', async () => {
    const app = await buildApp();
    const caller = { id: 'u-1', name: 'Alex Rivera', departments: ['Finance'], roles: ['admin'] };
    const res = await app.inject({ method: 'GET', url: '/me', headers: callerHeaders(caller) });
    expect(res.json()).toEqual(caller);
  });

  it('turns away a request that reached it without a caller', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });
});
