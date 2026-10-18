import { createEventBus, type AppManifestEntry, type MountContext } from '@platform/mfe-sdk';
import { describe, expect, it, vi } from 'vitest';
import { AppMounter, hrefFor, IntentError, loadManifest, ManifestError, matchRoute, MountError, routeIntent, toShellNotification } from './index.js';

const app = (id: string, route: string, extra: Partial<AppManifestEntry> = {}): AppManifestEntry => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  route,
  entry: `/apps/${id}/entry.js`,
  version: '0.1.0',
  ...extra,
});
const manifest = [app('home', '/'), app('library', '/library', { handles: ['document.open'] }), app('admin', '/admin')];

const ctx = (): MountContext => ({
  user: { id: 'u', name: 'U', departments: [], roles: [] },
  getToken: async () => 't',
  bus: createEventBus(),
  raise: vi.fn(),
  notify: vi.fn(),
  path: '/',
});

describe('matchRoute', () => {
  it('picks the longest route prefix and the path inside it', () => {
    expect(matchRoute(manifest, '/library/doc/1')).toMatchObject({ app: { id: 'library' }, path: '/doc/1' });
    expect(matchRoute(manifest, '/library')).toMatchObject({ app: { id: 'library' }, path: '/' });
    expect(matchRoute(manifest, '/')).toMatchObject({ app: { id: 'home' }, path: '/' });
  });

  it('does not treat a longer word as the same route', () => {
    expect(matchRoute(manifest, '/libraryish')).toMatchObject({ app: { id: 'home' }, path: '/libraryish' });
  });

  it('finds nothing when no route fits and there is no home', () => {
    expect(matchRoute([app('library', '/library')], '/elsewhere')).toBeUndefined();
  });

  it('builds hrefs back from an app and a path', () => {
    expect(hrefFor(manifest[1], '/doc/1')).toBe('/library/doc/1');
    expect(hrefFor(manifest[1])).toBe('/library');
    expect(hrefFor(manifest[0])).toBe('/');
  });
});

describe('loadManifest', () => {
  it('sends the token and keeps only well-formed entries', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([manifest[0], { id: 'broken' }]))) as unknown as typeof fetch;
    const apps = await loadManifest(fetchImpl, '/api/registry/manifest', 'tok');
    expect(apps.map((a) => a.id)).toEqual(['home']);
    expect(fetchImpl).toHaveBeenCalledWith('/api/registry/manifest', expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer tok' }) }));
  });

  it('says plainly when the catalogue is unreachable or refuses', async () => {
    const down = vi.fn(async () => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch;
    await expect(loadManifest(down, '/m', 't')).rejects.toThrow(ManifestError);
    const refused = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    await expect(loadManifest(refused, '/m', 't')).rejects.toThrow(/503/);
  });
});

describe('AppMounter', () => {
  const mfe = () => ({ mount: vi.fn((el: HTMLElement) => void (el.textContent = 'hi')), unmount: vi.fn() });

  it('mounts one app at a time, unmounting the last', async () => {
    const stage = document.createElement('div');
    const a = mfe();
    const b = mfe();
    const load = vi.fn(async (url: string) => ({ default: url.includes('home') ? a : b }));
    const m = new AppMounter(stage, load);
    await m.mount(manifest[0], ctx());
    expect(stage.querySelector('[data-app="home"]')!.textContent).toBe('hi');
    await m.mount(manifest[1], ctx());
    expect(a.unmount).toHaveBeenCalledOnce();
    expect(stage.querySelectorAll('[data-app]')).toHaveLength(1);
    expect(m.mounted?.id).toBe('library');
  });

  it('loads each entry once', async () => {
    const load = vi.fn(async () => ({ default: mfe() }));
    const m = new AppMounter(document.createElement('div'), load);
    await m.mount(manifest[0], ctx());
    await m.mount(manifest[1], ctx());
    await m.mount(manifest[0], ctx());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('lets a newer mount win over a slower older one', async () => {
    const stage = document.createElement('div');
    let release!: () => void;
    const slow = new Promise<void>((r) => (release = r));
    const load = vi.fn(async (url: string) => {
      if (url.includes('home')) await slow;
      return { default: mfe() };
    });
    const m = new AppMounter(stage, load);
    const first = m.mount(manifest[0], ctx());
    await m.mount(manifest[1], ctx());
    release();
    await first;
    expect(m.mounted?.id).toBe('library');
    expect(stage.querySelectorAll('[data-app]')).toHaveLength(1);
  });

  it('reports an app that will not load, and tries again next time', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce({ default: mfe() });
    const m = new AppMounter(document.createElement('div'), load);
    await expect(m.mount(manifest[1], ctx())).rejects.toThrow(MountError);
    await m.mount(manifest[1], ctx());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('closes the open app when the next one fails to load', async () => {
    const stage = document.createElement('div');
    const load = vi.fn(async (url: string) => {
      if (url.includes('library')) throw new Error('404');
      return { default: mfe() };
    });
    const m = new AppMounter(stage, load);
    await m.mount(manifest[0], ctx());
    await expect(m.mount(manifest[1], ctx())).rejects.toThrow(MountError);
    expect(stage.children).toHaveLength(0);
    expect(m.mounted).toBeNull();
  });

  it('refuses a module that is not an app', async () => {
    const m = new AppMounter(document.createElement('div'), async () => ({ default: { hello: true } }));
    await expect(m.mount(manifest[1], ctx())).rejects.toThrow(/didn't load as an app/);
  });

  it('cleans up when an app throws while mounting', async () => {
    const stage = document.createElement('div');
    const m = new AppMounter(stage, async () => ({ default: { mount: () => Promise.reject(new Error('boom')) } }));
    await expect(m.mount(manifest[1], ctx())).rejects.toThrow(/couldn't open/);
    expect(stage.children).toHaveLength(0);
    expect(m.mounted).toBeNull();
  });
});

describe('routeIntent', () => {
  it('opens the app that handles the intent with the intent', () => {
    const open = vi.fn();
    const intent = { type: 'document.open', payload: { id: 'd1' } };
    expect(routeIntent(manifest, intent, open).id).toBe('library');
    expect(open).toHaveBeenCalledWith(manifest[1], intent);
  });

  it('says so when nothing handles it', () => {
    expect(() => routeIntent(manifest, { type: 'entity.open', payload: {} }, vi.fn())).toThrow(IntentError);
  });
});

describe('toShellNotification', () => {
  it('marks needs-you notifications and keeps ids unique', () => {
    const a = toShellNotification('home', { title: 'Check this', needsYou: true }, 1000);
    const b = toShellNotification('home', { title: 'FYI' }, 1000);
    expect(a.level).toBe('needs');
    expect(b.level).toBe('info');
    expect(a.id).not.toBe(b.id);
  });
});
