import { describe, expect, it, vi } from 'vitest';
import { createEventBus, IntentCancelled, IntentError, isIntentCancelled, resolveIntent, type AppManifestEntry } from './index.js';

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
