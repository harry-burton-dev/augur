import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, parseUpstreams } from './app.ts';

describe('gateway', () => {
  let upstream: FastifyInstance;
  let url: string;

  beforeAll(async () => {
    upstream = Fastify();
    upstream.get('/manifest', async () => [{ id: 'home' }]);
    url = await upstream.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(() => upstream.close());

  it('reports healthy', async () => {
    const app = await buildApp({});
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('forwards /api/<service>/* to that service', async () => {
    const app = await buildApp({ registry: url });
    const res = await app.inject({ method: 'GET', url: '/api/registry/manifest' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id: 'home' }]);
  });

  it('reads app services from a name=url list', () => {
    expect(parseUpstreams('library=http://library:8083, sample=http://sample:8090')).toEqual({
      library: 'http://library:8083',
      sample: 'http://sample:8090',
    });
    expect(parseUpstreams('')).toEqual({});
  });
});
