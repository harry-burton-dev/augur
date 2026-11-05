import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyPreferences, PreferenceSync, type Preferences } from './preferences.js';

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
    await sync.load();
    fetchImpl.mockClear();
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
    await sync.load();
    fetchImpl.mockClear();
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) sync.opened(id);
    expect(sync.current.recent).toEqual(['g', 'f', 'e', 'd', 'c', 'b']);
    await vi.advanceTimersByTimeAsync(20);
    sync.opened('g');
    await vi.advanceTimersByTimeAsync(20);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('says when a save failed, and keeps the choice', async () => {
    const onError = vi.fn();
    const sync = new PreferenceSync('/p', token, { fetchImpl: async (_url, init) => json({}, init?.method === 'PUT' ? 503 : 200), onError });
    await sync.load();
    sync.set('away', true);
    await sync.save();
    expect(onError).toHaveBeenCalledOnce();
    expect(sync.current.away).toBe(true);
  });

  /** A stand-in for Identity whose GET answers only when told to, and whose PUT is kept. */
  const identity = () => {
    let waiting: ((res: Response) => void) | undefined;
    const puts: Preferences[] = [];
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== 'PUT') return new Promise<Response>((r) => (waiting = r));
      puts.push(JSON.parse(init.body as string) as Preferences);
      return json({});
    });
    const answer = async (res: Response) => {
      await vi.waitFor(() => expect(waiting).toBeDefined());
      waiting?.(res);
      waiting = undefined;
    };
    return { fetchImpl, puts, answer };
  };

  it('holds a change made before the load has answered, then saves it merged with what was saved', async () => {
    vi.useFakeTimers();
    const { fetchImpl, puts, answer } = identity();
    const sync = new PreferenceSync('/p', token, { fetchImpl, delay: 10 });
    const loading = sync.load();
    sync.opened('board');
    sync.set('density', 'compact');
    await vi.advanceTimersByTimeAsync(50);
    expect(puts).toEqual([]);
    await answer(json({ density: 'comfortable', pinned: ['mail'], recent: ['mail', 'board', 'home'] }));
    await loading;
    await vi.advanceTimersByTimeAsync(50);
    expect(puts).toEqual([{ density: 'compact', pinned: ['mail'], recent: ['board', 'mail', 'home'] }]);
    expect(sync.current.recent).toEqual(['board', 'mail', 'home']);
  });

  it('never replaces what Identity holds after a failed load: it loads again first, at the next save', async () => {
    const { fetchImpl, puts, answer } = identity();
    const onError = vi.fn();
    const sync = new PreferenceSync('/p', token, { fetchImpl, delay: 10, onError });
    const loading = sync.load();
    await answer(json({}, 503));
    await loading;
    sync.opened('board');
    const saving = sync.save();
    await answer(json({}, 503));
    await saving;
    expect(puts).toEqual([]);
    expect(onError).toHaveBeenCalledOnce();
    expect(sync.current.recent).toEqual(['board']);

    const again = sync.save();
    await answer(json({ muted: ['mail'], recent: ['home'] }));
    await again;
    expect(puts).toEqual([{ muted: ['mail'], recent: ['board', 'home'] }]);
  });

  it('saves nothing when asked to as it closes with no change, loaded or not', async () => {
    const { fetchImpl, puts, answer } = identity();
    const sync = new PreferenceSync('/p', token, { fetchImpl });
    const loading = sync.load();
    await sync.save();
    await answer(json({ recent: ['home'] }));
    await loading;
    await sync.save();
    expect(puts).toEqual([]);
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
