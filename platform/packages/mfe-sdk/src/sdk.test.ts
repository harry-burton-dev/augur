import { describe, expect, it, vi } from 'vitest';
import { createEventBus, floorFetch, IntentCancelled, IntentError, isIntentCancelled, resolveIntent, type AppManifestEntry, type Workspace } from './index.js';

describe('event bus', () => {
  it('delivers to subscribers until they unsubscribe', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const off = bus.on('document.published', handler);
    bus.emit('document.published', { id: 'd1' });
    off();
    bus.emit('document.published', { id: 'd2' });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ id: 'd1' });
  });
});

describe('resolveIntent', () => {
  const manifest: AppManifestEntry[] = [
    { id: 'home', name: 'Home', route: '/', entry: '/home.js', version: '0.1.0' },
    { id: 'library', name: 'Library', route: '/library', entry: '/library.js', version: '0.1.0', handles: ['document.open'] },
  ];

  it('routes to the app that handles the intent type', () => {
    expect(resolveIntent(manifest, { type: 'document.open', payload: { id: 'd1' } })?.id).toBe('library');
  });

  it('returns undefined when nothing handles it', () => {
    expect(resolveIntent(manifest, { type: 'entity.open', payload: {} })).toBeUndefined();
  });
});

describe('isIntentCancelled', () => {
  it('recognises a cancellation by name, even from another copy of the SDK', () => {
    const fromAnotherBundle = Object.assign(new Error('closed'), { name: 'IntentCancelled' });
    expect(isIntentCancelled(new IntentCancelled())).toBe(true);
    expect(isIntentCancelled(fromAnotherBundle)).toBe(true);
    expect(isIntentCancelled(new IntentError('No app handles it'))).toBe(false);
    expect(isIntentCancelled('IntentCancelled')).toBe(false);
  });
});

describe('floorFetch', () => {
  const finance: Workspace = { id: 'w-fin', kind: 'team', name: 'Finance', slug: 'finance', path: [], role: 'member' };

  it('adds the token and the current floor, read at call time', async () => {
    let floor = finance;
    const fetchImpl = vi.fn(async () => new Response('ok'));
    const call = floorFetch(async () => 'tok', () => floor, fetchImpl as unknown as typeof fetch);
    await call('/api/library/v1/docs', { method: 'POST' });
    floor = { ...finance, id: 'w-org' };
    await call('/api/library/v1/docs');
    const sent = fetchImpl.mock.calls.map((c) => (c as unknown as [string, RequestInit])[1]);
    expect(sent[0].method).toBe('POST');
    expect(new Headers(sent[0].headers).get('authorization')).toBe('Bearer tok');
    expect(new Headers(sent[0].headers).get('x-workspace-id')).toBe('w-fin');
    expect(new Headers(sent[1].headers).get('x-workspace-id')).toBe('w-org');
  });

  it('leaves headers the app set itself', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok'));
    await floorFetch(async () => 'tok', () => finance, fetchImpl as unknown as typeof fetch)('/x', { headers: { 'X-Workspace-Id': 'w-other', Authorization: 'Bearer mine' } });
    const headers = new Headers((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].headers);
    expect([headers.get('x-workspace-id'), headers.get('authorization')]).toEqual(['w-other', 'Bearer mine']);
  });
});
