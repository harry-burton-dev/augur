import { describe, expect, it } from 'vitest';
import { eventsClient, services, throughPathFetch, type events } from './index.js';

/** A fetch that records what it was sent and answers with `body`. */
const fakeFetch = (status: number, body?: unknown) => {
  const sent: Request[] = [];
  const fetch = async (request: Request) => {
    sent.push(request);
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, sent };
};

describe('generated clients', () => {
  it('names every contract with the path its routes are under', () => {
    expect(services.events).toMatchObject({ title: 'Events', prefix: '/v1' });
    expect(Object.keys(services)).toEqual(expect.arrayContaining(['events', 'gateway', 'identity', 'models', 'registry']));
  });

  it('builds a typed request under /api/<service>/v1 on the gateway it is given', async () => {
    const { fetch, sent } = fakeFetch(202, { sent: 1 });
    const client = eventsClient({ gateway: 'https://augur.test/api/', fetch, headers: { authorization: 'Bearer t' } });
    const notice: events.components['schemas']['NewNotification'] = { app: 'demo', recipients: ['u1'], level: 'info', title: 'Hello' };
    const { data, error } = await client.POST('/notifications', { body: notice });
    expect(error).toBeUndefined();
    expect(data?.sent).toBe(1);
    expect(sent[0].method).toBe('POST');
    expect(sent[0].url).toBe('https://augur.test/api/events/v1/notifications');
    expect(sent[0].headers.get('authorization')).toBe('Bearer t');
    expect(await sent[0].json()).toEqual(notice);
  });

  it('fills path parameters, and a refusal comes back as error', async () => {
    const { fetch, sent } = fakeFetch(404, { error: 'not_found', message: 'No such notification' });
    const client = eventsClient({ baseUrl: 'https://elsewhere.test/v1', fetch });
    const { data, error } = await client.POST('/notifications/{id}/read', { params: { path: { id: 'n 1' } } });
    expect(data).toBeUndefined();
    expect(error).toMatchObject({ error: 'not_found' });
    expect(sent[0].url).toBe('https://elsewhere.test/v1/notifications/n%201/read');
  });

  it('sends through a path-taking fetch such as ctx.fetch', async () => {
    const calls: { path: string; init?: RequestInit }[] = [];
    const ctxFetch = async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      return new Response(JSON.stringify({ sent: 2 }), { status: 202, headers: { 'content-type': 'application/json' } });
    };
    const client = eventsClient({ gateway: 'https://augur.test/api', fetch: throughPathFetch(ctxFetch) });
    const { data } = await client.POST('/notifications', { body: { app: 'demo', recipients: ['u1', 'u2'], level: 'info', title: 'Hi' } });
    expect(data?.sent).toBe(2);
    expect(calls[0].path).toBe('https://augur.test/api/events/v1/notifications');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(new TextDecoder().decode(calls[0].init?.body as ArrayBuffer))).toMatchObject({ title: 'Hi' });
  });
});
