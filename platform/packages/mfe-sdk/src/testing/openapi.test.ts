import { readFileSync } from 'node:fs';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { contractHandlers, fakeContext, type OpenApiDocument } from './index.js';

const registry = parse(readFileSync(new URL('../../../../../contracts/registry.openapi.yaml', import.meta.url), 'utf8')) as OpenApiDocument;
const base = 'http://augur.test/api/registry';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const operations = (doc: OpenApiDocument) =>
  Object.values(doc.paths ?? {}).flatMap((item) => Object.keys(item ?? {}).filter((k) => ['get', 'put', 'post', 'delete', 'options', 'head', 'patch'].includes(k)));

describe('contractHandlers against the registry contract', () => {
  it('makes one handler per operation', () => {
    expect(contractHandlers(registry, { base })).toHaveLength(operations(registry).length);
  });

  it('answers an operation without an example with a 501 problem that says which', async () => {
    server.use(...contractHandlers(registry, { base }));
    const res = await fakeContext().fetch('/api/registry/v1/me/apps?workspace=ws-me');
    expect(res.status).toBe(501);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({
      type: 'about:blank',
      title: 'Not Implemented',
      status: 501,
      detail: expect.stringContaining('GET /me/apps'),
      reason: expect.stringContaining('no example'),
      whoCanChange: expect.any(String),
    });
  });

  it('answers from answers, by METHOD /path, with path params', async () => {
    server.use(
      ...contractHandlers(registry, {
        base,
        answers: {
          'GET /me/apps': { workspace: 'ws-me', apps: [] },
          'PATCH /apps/{id}': ({ params, operation }) => ({ id: params.id, operation }),
        },
      }),
    );
    const ctx = fakeContext();
    const apps = await ctx.fetch('/api/registry/v1/me/apps?workspace=ws-me');
    expect(apps.status).toBe(200);
    expect(await apps.json()).toEqual({ workspace: 'ws-me', apps: [] });
    const patched = await ctx.fetch('/api/registry/v1/apps/folio', { method: 'PATCH', body: '{}' });
    expect(await patched.json()).toEqual({ id: 'folio', operation: 'PATCH /apps/{id}' });
  });

  it('sends a documented 2xx without content as it is', async () => {
    server.use(...contractHandlers(registry, { base }));
    const res = await fakeContext().fetch('/api/registry/v1/apps/folio', { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('refuses an answer for an operation the contract does not have', () => {
    expect(() => contractHandlers(registry, { answers: { 'GET /nope': {} } })).toThrow(/GET \/nope/);
  });
});

describe('contractHandlers with examples', () => {
  const doc: OpenApiDocument = {
    openapi: '3.1.0',
    servers: [{ url: 'https://{host}/v2', variables: { host: { default: 'example.org' } } }],
    paths: {
      '/things/{thing-id}': {
        get: {
          operationId: 'getThing',
          responses: { '200': { content: { 'application/json': { example: { id: 't1' } } } } },
        },
      },
      '/things/mine': {
        get: { responses: { '200': { $ref: '#/components/responses/Things' } } },
      },
      '/things': {
        post: {
          operationId: 'makeThing',
          responses: { '400': { description: 'Bad' }, '201': { content: { 'application/json': { examples: { one: { $ref: '#/components/examples/Made' } } } } } },
        },
      },
    },
    components: {
      responses: { Things: { content: { 'application/json': { examples: { a: { value: [{ id: 'mine' }] } } } } } },
      examples: { Made: { value: { id: 'new' } } },
    },
  };

  it('answers with the first 2xx example, following $refs, literal paths first', async () => {
    server.use(...contractHandlers(doc));
    const get = async (path: string, init?: RequestInit) => {
      const res = await fakeContext().fetch(path, init);
      return [res.status, await res.json()];
    };
    expect(await get('/v2/things/t1')).toEqual([200, { id: 't1' }]);
    expect(await get('/v2/things/mine')).toEqual([200, [{ id: 'mine' }]]);
    expect(await get('/v2/things', { method: 'POST' })).toEqual([201, { id: 'new' }]);
  });

  it('lets an operationId answer override the example, with a Response if need be', async () => {
    server.use(...contractHandlers(doc, { answers: { getThing: new Response('gone', { status: 410 }), makeThing: { id: 'over' } } }));
    const ctx = fakeContext();
    expect((await ctx.fetch('/v2/things/t1')).status).toBe(410);
    const made = await ctx.fetch('/v2/things', { method: 'POST' });
    expect([made.status, await made.json()]).toEqual([201, { id: 'over' }]);
  });
});
