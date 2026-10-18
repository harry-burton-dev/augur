import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@platform/service-kit';
import { buildApp } from './app.ts';

describe('identity', () => {
  it('reports healthy', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'identity', version: expect.stringMatching(/^\d+\.\d+\.\d+/), api: 'v1' });
  });

  it('says who the caller is', async () => {
    const app = await buildApp();
    const caller = { id: 'u-1', name: 'Alex Rivera', departments: ['Finance'], roles: ['admin'] };
    const res = await app.inject({ method: 'GET', url: '/v1/me', headers: callerHeaders(caller) });
    expect(res.json()).toEqual(caller);
  });

  it('turns away a request that reached it without a caller', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(res.statusCode).toBe(401);
  });

  it('keeps each person’s preferences, refusing what it does not know', async () => {
    const app = await buildApp();
    const alex = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: [] });
    const sam = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: [] });
    expect((await app.inject({ method: 'GET', url: '/v1/me/preferences', headers: alex })).json()).toEqual({});
    const prefs = { reduceMotion: true, density: 'compact', away: false, recent: ['board', 'home'] };
    expect((await app.inject({ method: 'PUT', url: '/v1/me/preferences', headers: alex, payload: prefs })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/v1/me/preferences', headers: alex })).json()).toEqual(prefs);
    expect((await app.inject({ method: 'GET', url: '/v1/me/preferences', headers: sam })).json()).toEqual({});
    expect((await app.inject({ method: 'PUT', url: '/v1/me/preferences', headers: alex, payload: { theme: 'pink' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/v1/me/preferences', headers: alex, payload: { density: 'tiny' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/v1/me/preferences' })).statusCode).toBe(401);
  });
});
