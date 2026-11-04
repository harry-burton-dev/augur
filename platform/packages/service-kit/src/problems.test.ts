import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { PeopleUnavailable } from './people.js';
import { Problem, problemBody, problemDetails, sendProblem, serviceFastifyOptions, upgradeLegacyError } from './problems.js';

class StoreUnavailable extends Error {}

const build = async () => {
  const app = Fastify(serviceFastifyOptions({ NODE_ENV: 'test' }));
  await app.register(problemDetails());
  app.get('/problem', async () => {
    throw new Problem(403, 'forbidden', 'Only an admin can see this.', { whoCanChange: 'An admin, in Admin, People.' });
  });
  app.get('/sent', async (_req, reply) => sendProblem(reply, 409, 'conflict', 'It was changed meanwhile.', { extensions: { current: 3 } }));
  app.post('/claims', { schema: { body: { type: 'object', required: ['amount'], properties: { amount: { type: 'number' } } } } }, async () => ({ ok: true }));
  app.get('/people', async () => {
    throw new PeopleUnavailable('connect ECONNREFUSED 10.0.0.5:8081');
  });
  app.get('/store', async () => {
    throw new StoreUnavailable('pg: password authentication failed for user "platform"');
  });
  app.get('/boom', async () => {
    throw new Error('connect ECONNREFUSED 10.0.0.5:8081');
  });
  app.get('/legacy', async (_req, reply) => reply.code(403).send({ error: 'forbidden', message: 'Only an admin can manage people.', role: 'admin' }));
  app.get('/ok', async () => ({ error: 'not an error', message: 'a 200 is left alone' }));
  await app.register(async (child) => {
    child.setErrorHandler((_err, _req, reply) => reply.code(400).send({ error: 'bad_request', message: 'The directory said no.' }));
    child.get('/scoped', async () => {
      throw new Error('raw');
    });
  });
  return app;
};

describe('problemDetails', () => {
  it('answers a thrown Problem as it is, as application/problem+json', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/problem' });
    expect(res.statusCode).toBe(403);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.json()).toEqual({
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      detail: 'Only an admin can see this.',
      reason: 'forbidden',
      whoCanChange: 'An admin, in Admin, People.',
      error: 'forbidden',
      message: 'Only an admin can see this.',
    });
  });

  it('sends a problem from a reply, with its extensions', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/sent' });
    expect(res.statusCode).toBe(409);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.json()).toMatchObject({ status: 409, reason: 'conflict', detail: 'It was changed meanwhile.', current: 3 });
  });

  it('answers a request that fails its schema with a 400 saying what was wrong', async () => {
    const app = await build();
    const res = await app.inject({ method: 'POST', url: '/claims', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.json()).toMatchObject({ type: 'about:blank', title: 'Bad Request', status: 400, reason: 'bad_request', error: 'bad_request' });
    expect(res.json().detail).toContain('amount');
  });

  it('answers a part that can’t be reached with a 503, without its internal words', async () => {
    const app = await build();
    for (const [url, part] of [
      ['/people', 'people'],
      ['/store', 'store'],
    ]) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body).toMatchObject({ status: 503, reason: 'unavailable', error: 'unavailable' });
      expect(body.detail).toContain(part);
      expect(body.whoCanChange).toBeTruthy();
      expect(res.body).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|password/);
    }
  });

  it('answers any other error with a 500 that doesn’t leak it', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.json()).toMatchObject({ status: 500, title: 'Internal Server Error', reason: 'internal' });
    expect(res.body).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);
  });

  it('keeps the status of Fastify’s other client errors', async () => {
    const app = Fastify({ ...serviceFastifyOptions({ NODE_ENV: 'test' }), bodyLimit: 10 });
    await app.register(problemDetails());
    app.post('/claims', async () => ({ ok: true }));
    const big = await app.inject({ method: 'POST', url: '/claims', payload: { note: 'far more than ten bytes' } });
    expect(big.statusCode).toBe(413);
    expect(big.json()).toMatchObject({ status: 413, reason: 'too_large' });
    const media = await app.inject({ method: 'POST', url: '/claims', payload: 'x', headers: { 'content-type': 'application/x-unknown' } });
    expect(media.statusCode).toBe(415);
    expect(media.json()).toMatchObject({ status: 415, reason: 'unsupported_media_type' });
  });

  it('answers an unknown route with a 404 problem', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/nowhere?token=secret' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.json()).toMatchObject({ status: 404, title: 'Not Found', reason: 'not_found', error: 'not_found' });
    expect(res.body).not.toContain('secret');
  });

  it('makes a handler’s { error, message } answer a problem, keeping its fields', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/legacy' });
    expect(res.statusCode).toBe(403);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.json()).toEqual({
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      detail: 'Only an admin can manage people.',
      reason: 'forbidden',
      error: 'forbidden',
      message: 'Only an admin can manage people.',
      role: 'admin',
    });
  });

  it('leaves answers that aren’t errors alone', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/ok' });
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.json()).toEqual({ error: 'not an error', message: 'a 200 is left alone' });
  });

  it('lets a plugin keep its own error handler, and still makes its answers problems', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/scoped' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ status: 400, reason: 'bad_request', detail: 'The directory said no.', message: 'The directory said no.' });
  });
});

describe('problemBody and upgradeLegacyError', () => {
  it('never lets an extension overwrite a standard field', () => {
    expect(problemBody(404, 'not_found', 'Gone.', { extensions: { status: 200, reason: 'x' } })).toMatchObject({ status: 404, reason: 'not_found' });
  });

  it('only upgrades error bodies without a type', () => {
    expect(upgradeLegacyError(200, { error: 'x', message: 'y' })).toBeUndefined();
    expect(upgradeLegacyError(400, { type: 'about:blank', error: 'x' })).toBeUndefined();
    expect(upgradeLegacyError(400, 'text')).toBeUndefined();
    expect(upgradeLegacyError(400, [{ error: 'x' }])).toBeUndefined();
    expect(upgradeLegacyError(503, { error: 'unavailable' })).toMatchObject({ detail: 'Service Unavailable', message: 'Service Unavailable', reason: 'unavailable' });
  });
});
