import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';

describe('library', () => {
  it('reports healthy', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', service: 'library' });
  });
});
