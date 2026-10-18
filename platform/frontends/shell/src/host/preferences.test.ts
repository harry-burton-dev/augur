import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyPreferences, PreferenceSync } from './preferences.js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const token = async () => 't';

describe('PreferenceSync', () => {
  afterEach(() => vi.useRealTimers());

  it('loads what was saved, and starts from nothing when Identity is away', async () => {
    const saved = new PreferenceSync('/p', token, { fetchImpl: async () => json({ density: 'compact', recent: ['board'] }) });
    expect(await saved.load()).toEqual({ density: 'compact', recent: ['board'] });
    const away = new PreferenceSync('/p', token, { fetchImpl: async () => Promise.reject(new TypeError('offline')) });
    expect(await away.load()).toEqual({});
  });

  it('saves a burst of changes as one request, with everything chosen', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => json({}));
    const sync = new PreferenceSync('/p', token, { fetchImpl, delay: 100 });
    sync.set('reduceMotion', true);
    sync.set('density', 'compact');
    sync.opened('board');
    sync.opened('home');
    sync.opened('board');
    await vi.advanceTimersByTimeAsync(150);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/p');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ reduceMotion: true, density: 'compact', recent: ['board', 'home'] });
  });

  it('keeps only the few most recent apps, and does not save when nothing moved', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => json({}));
    const sync = new PreferenceSync('/p', token, { fetchImpl, delay: 10 });
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) sync.opened(id);
    expect(sync.current.recent).toEqual(['g', 'f', 'e', 'd', 'c', 'b']);
    await vi.advanceTimersByTimeAsync(20);
    sync.opened('g');
    await vi.advanceTimersByTimeAsync(20);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('says when a save failed, and keeps the choice', async () => {
    const onError = vi.fn();
    const sync = new PreferenceSync('/p', token, { fetchImpl: async () => json({}, 503), onError });
    sync.set('away', true);
    await sync.save();
    expect(onError).toHaveBeenCalledOnce();
    expect(sync.current.away).toBe(true);
  });
});

describe('applyPreferences', () => {
  it('marks <html> for reduced motion and compact density, and clears them', () => {
    const root = document.createElement('html');
    applyPreferences({ reduceMotion: true, density: 'compact' }, root);
    expect(root.dataset).toMatchObject({ motion: 'reduce', density: 'compact' });
    applyPreferences({}, root);
    expect(root.dataset.motion).toBeUndefined();
    expect(root.dataset.density).toBeUndefined();
  });
});
