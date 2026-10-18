import { afterEach, describe, expect, it } from 'vitest';
import { callerHeaders, serviceHeaders } from '@platform/service-kit';
import { buildApp } from './app.ts';

const alex = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
const sam = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });
const library = serviceHeaders({ name: 'library', token: 'local-secret' });
const review = { app: 'library', recipients: ['u-1', 'u-2'], level: 'needs', title: 'Review the budget paper', link: '/doc/7' };

type App = Awaited<ReturnType<typeof buildApp>>;
let open: App | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

describe('events', () => {
  it('reports healthy', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.json()).toEqual({ status: 'ok', service: 'events' });
  });

  it('lets a service notify people, who each see only their own', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const sent = await app.inject({ method: 'POST', url: '/notifications', headers: library, payload: review });
    expect([sent.statusCode, sent.json()]).toEqual([202, { sent: 2 }]);
    const mine = (await app.inject({ method: 'GET', url: '/notifications', headers: sam })).json();
    expect(mine).toMatchObject([{ app: 'library', level: 'needs', title: 'Review the budget paper', link: '/doc/7' }]);
    expect(mine[0].recipient).toBeUndefined();
  });

  it('turns away notifications from anyone but a service, and ones it cannot use', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const post = (headers: Record<string, string>, payload: object) => app.inject({ method: 'POST', url: '/notifications', headers, payload });
    expect((await post(alex, review)).statusCode).toBe(403);
    expect((await post(library, { ...review, level: 'urgent' })).statusCode).toBe(400);
    expect((await post(library, { ...review, recipients: [] })).statusCode).toBe(400);
    expect((await post(library, { ...review, link: 'https://elsewhere.example' })).statusCode).toBe(400);
  });

  it('marks a notification read, and unread again', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    await app.inject({ method: 'POST', url: '/notifications', headers: library, payload: review });
    const [n] = (await app.inject({ method: 'GET', url: '/notifications', headers: sam })).json();
    expect((await app.inject({ method: 'POST', url: `/notifications/${n.id}/read`, headers: sam })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/notifications', headers: sam })).json()).toEqual([]);
    expect((await app.inject({ method: 'DELETE', url: `/notifications/${n.id}/read`, headers: sam })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/notifications', headers: sam })).json()).toHaveLength(1);
  });

  it('never lets someone touch another person’s notification', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    await app.inject({ method: 'POST', url: '/notifications', headers: library, payload: { ...review, recipients: ['u-1'] } });
    const [n] = (await app.inject({ method: 'GET', url: '/notifications', headers: alex })).json();
    expect((await app.inject({ method: 'POST', url: `/notifications/${n.id}/read`, headers: sam })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/notifications' })).statusCode).toBe(401);
  });

  it('streams each new notification to its recipient as it happens', async () => {
    const app = (open = await buildApp({ serviceToken: 'local-secret', heartbeatMs: 50 }));
    const url = await app.listen({ port: 0, host: '127.0.0.1' });
    const controller = new AbortController();
    const res = await fetch(`${url}/notifications/stream`, { headers: sam, signal: controller.signal });
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    expect((await reader.read()).value).toContain(': connected');

    await app.inject({ method: 'POST', url: '/notifications', headers: library, payload: { ...review, recipients: ['u-1'] } });
    await app.inject({ method: 'POST', url: '/notifications', headers: library, payload: { ...review, recipients: ['u-2'], title: 'For Sam' } });
    let text = '';
    while (!text.includes('event: notification')) text += (await reader.read()).value;
    expect(text).toContain('"title":"For Sam"');
    expect(text).not.toContain('Review the budget paper');
    controller.abort();
  });

  it('keeps an audit log that services write and only admins read', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const entry = { actor: { id: 'u-2', kind: 'user' }, app: 'library', action: 'document.published', target: 'doc-7' };
    expect((await app.inject({ method: 'POST', url: '/audit', headers: library, payload: entry })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/audit', headers: alex, payload: entry })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/audit', headers: library, payload: { ...entry, action: 'Published!' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/audit', headers: sam })).statusCode).toBe(403);
    const log = (await app.inject({ method: 'GET', url: '/audit?app=library', headers: alex })).json();
    expect(log).toMatchObject([entry]);
  });
});
