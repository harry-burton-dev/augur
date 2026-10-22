import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { REQUEST_ID_HEADER, serviceLogging } from './logging.js';

describe('serviceLogging', () => {
  it('keeps the request id it is given, and makes one when there is none', async () => {
    const app = Fastify(serviceLogging({ NODE_ENV: 'test' }));
    app.get('/id', async (req) => ({ id: req.id }));
    const given = await app.inject({ method: 'GET', url: '/id', headers: { [REQUEST_ID_HEADER]: 'req-123' } });
    const made = await app.inject({ method: 'GET', url: '/id' });
    expect(given.json().id).toBe('req-123');
    expect(made.json().id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('logs only outside tests', () => {
    expect(serviceLogging({ NODE_ENV: 'test' }).logger).toBe(false);
    expect(serviceLogging({ NODE_ENV: 'production' }).logger).toBe(true);
  });
});
