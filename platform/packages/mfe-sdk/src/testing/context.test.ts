import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { IntentCancelled, isIntentCancelled, WORKSPACE_HEADER } from '../index.js';
import { fakeContext, TEST_BASE } from './index.js';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fakeContext', () => {
  it('is a whole mount context on the person’s own floor', async () => {
    const ctx = fakeContext();
    expect(ctx.user).toMatchObject({ id: expect.any(String), name: expect.any(String), roles: [] });
    expect(ctx.workspace).toMatchObject({ kind: 'personal', slug: 'me', role: 'lead' });
    expect(ctx.workspace.path).toEqual([{ id: ctx.workspace.id, kind: 'personal', name: ctx.workspace.name, slug: 'me' }]);
    expect(ctx.getWorkspace()).toBe(ctx.workspace);
    expect(ctx.path).toBe('/');
    expect(await ctx.getToken()).toBe('test-token');
    expect(ctx.reply).toBeUndefined();
    expect(ctx.intent).toBeUndefined();
  });

  it('takes a user, a floor and a path', () => {
    const team = { id: 't-ops', kind: 'team' as const, name: 'Operations', slug: 'ops', level: 'Department', role: 'member' as const };
    const ctx = fakeContext({ user: { roles: ['publisher'] }, workspace: team, path: '/doc/7' });
    expect(ctx.user.roles).toEqual(['publisher']);
    expect(ctx.workspace.path).toEqual([{ id: 't-ops', kind: 'team', name: 'Operations', slug: 'ops', level: 'Department' }]);
    expect(ctx.path).toBe('/doc/7');
  });

  it('has a real event bus', () => {
    const ctx = fakeContext();
    const seen = vi.fn();
    ctx.bus.on('document.published', seen);
    ctx.bus.emit('document.published', { id: 'd1' });
    expect(seen).toHaveBeenCalledWith({ id: 'd1' });
  });

  it('fetches against the base with the token and the floor, as the shell does', async () => {
    const seen = vi.fn();
    server.use(
      http.get(`${TEST_BASE}/api/library/v1/docs`, ({ request }) => {
        seen(request.headers.get('authorization'), request.headers.get(WORKSPACE_HEADER));
        return HttpResponse.json([{ id: 'd1' }]);
      }),
    );
    const ctx = fakeContext({ token: 'tok' });
    const res = await ctx.fetch('/api/library/v1/docs');
    expect(await res.json()).toEqual([{ id: 'd1' }]);
    expect(seen).toHaveBeenCalledWith('Bearer tok', 'ws-me');
  });

  it('follows the floor it is moved to, and another base', async () => {
    const seen = vi.fn();
    server.use(http.get('https://other.test/api/x', ({ request }) => (seen(request.headers.get(WORKSPACE_HEADER)), new HttpResponse(null, { status: 204 }))));
    const ctx = fakeContext({ base: 'https://other.test/' });
    ctx.moveTo({ id: 't-1', kind: 'team', name: 'One', slug: 'one', role: 'member' });
    await ctx.fetch('api/x');
    expect(seen).toHaveBeenCalledWith('t-1');
    expect(ctx.getWorkspace().id).toBe('t-1');
    expect(ctx.workspace.id).toBe('ws-me');
  });

  it('records what the app raised and notified', async () => {
    const ctx = fakeContext();
    await ctx.raise({ type: 'document.open', payload: { id: 'd1' } });
    ctx.notify({ title: 'Saved' });
    expect(ctx.raised).toEqual([{ type: 'document.open', payload: { id: 'd1' } }]);
    expect(ctx.notified).toEqual([{ title: 'Saved' }]);
  });

  it('answers requests from its answers, by value or function', async () => {
    const ctx = fakeContext({ answers: { 'document.pick': { id: 'd1' }, 'entity.pick': (intent) => [intent.payload] } });
    await expect(ctx.request({ type: 'document.pick', payload: {} })).resolves.toEqual({ id: 'd1' });
    await expect(ctx.request({ type: 'entity.pick', payload: 'ship' })).resolves.toEqual(['ship']);
    expect(ctx.requested.map((i) => i.type)).toEqual(['document.pick', 'entity.pick']);
  });

  it('rejects a request nobody answers with an IntentError, and passes on a cancel', async () => {
    const ctx = fakeContext({
      answers: {
        'document.pick': () => {
          throw new IntentCancelled();
        },
      },
    });
    const unanswered = await ctx.request({ type: 'unit.pick', payload: {} }).catch((err: unknown) => err);
    expect(unanswered).toMatchObject({ name: 'IntentError', message: expect.stringContaining('unit.pick') });
    expect(isIntentCancelled(unanswered)).toBe(false);
    const closed = await ctx.request({ type: 'document.pick', payload: {} }).catch((err: unknown) => err);
    expect(isIntentCancelled(closed)).toBe(true);
    expect(ctx.requested).toHaveLength(2);
  });

  it('mounts a picker with a reply that records its answer', () => {
    const ctx = fakeContext({ intent: { type: 'document.pick', payload: {} }, reply: true });
    ctx.reply?.respond({ id: 'd1' });
    ctx.reply?.cancel();
    expect(ctx.intent?.type).toBe('document.pick');
    expect(ctx.reply?.responses).toEqual([{ id: 'd1' }]);
    expect(ctx.reply?.cancels).toBe(1);
  });

  it('says which previews are on', () => {
    const ctx = fakeContext({ previews: ['board-view'] });
    expect(ctx.previewOn('board-view')).toBe(true);
    expect(ctx.previewOn('other')).toBe(false);
  });
});
