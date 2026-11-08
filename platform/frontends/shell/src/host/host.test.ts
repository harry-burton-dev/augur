import { createEventBus, type AppManifestEntry, type MountContext } from '@augur/mfe-sdk';
import { describe, expect, it, vi } from 'vitest';
import { AppMounter, fromServer, hrefFor, incompatibility, IntentError, loadManifest, ManifestError, matchRoute, MountError, NotificationActions, routeIntent, toShellNotification } from './index.js';

const app = (id: string, route: string, extra: Partial<AppManifestEntry> = {}): AppManifestEntry => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  route,
  entry: `/apps/${id}/entry.js`,
  version: '0.1.0',
  sdk: '^1.0.0 || ^2.0.0',
  ...extra,
});
const manifest = [app('home', '/'), app('library', '/library', { handles: ['document.open'] }), app('admin', '/admin')];

const own = { id: 'w-me', kind: 'personal' as const, name: 'You', slug: 'me', path: [], role: 'lead' as const };
const ctx = (): MountContext => ({
  user: { id: 'u', name: 'U', departments: [], roles: [] },
  getToken: async () => 't',
  bus: createEventBus(),
  raise: vi.fn(),
  request: vi.fn(),
  notify: vi.fn(),
  workspace: own,
  getWorkspace: () => own,
  previewOn: () => false,
  fetch: vi.fn(),
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
    const apps = await loadManifest(fetchImpl, '/api/registry/v1/manifest', 'tok');
    expect(apps.map((a) => a.id)).toEqual(['home']);
    expect(fetchImpl).toHaveBeenCalledWith('/api/registry/v1/manifest', expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer tok' }) }));
  });

  it('asks for the catalogue of the floor the person is on', async () => {
    const fetchImpl = vi.fn(async () => new Response('[]')) as unknown as typeof fetch;
    await loadManifest(fetchImpl, '/api/registry/v1/manifest', 'tok', 'w 1');
    expect(fetchImpl).toHaveBeenCalledWith('/api/registry/v1/manifest?workspace=w%201', expect.objectContaining({ headers: expect.objectContaining({ 'x-workspace-id': 'w 1' }) }));
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

  it('keeps an app that follows the address mounted on a move inside it, and tells it the path', async () => {
    const follows = app('library', '/library', { followsAddress: true });
    const lib = { ...mfe(), navigated: vi.fn() };
    const m = new AppMounter(document.createElement('div'), vi.fn(async () => ({ default: lib })));
    expect(await m.mount(follows, ctx())).toBe('mounted');
    expect(await m.mount(follows, { ...ctx(), path: '/doc/7' })).toBe('kept');
    expect(lib.mount).toHaveBeenCalledOnce();
    expect(lib.unmount).not.toHaveBeenCalled();
    expect(lib.navigated).toHaveBeenCalledWith(expect.any(HTMLElement), '/doc/7');
  });

  it('mounts it again for an intent, on another floor, from a new catalogue, or without the flag', async () => {
    const follows = app('library', '/library', { followsAddress: true });
    const lib = { ...mfe(), navigated: vi.fn() };
    const m = new AppMounter(document.createElement('div'), vi.fn(async () => ({ default: lib })));
    await m.mount(follows, ctx());
    await m.mount(follows, { ...ctx(), intent: { type: 'document.open', payload: {} } });
    const team = { ...own, id: 'w-team', kind: 'team' as const, slug: 'team' };
    await m.mount(follows, { ...ctx(), workspace: team, getWorkspace: () => team });
    await m.mount({ ...follows }, { ...ctx(), workspace: team, getWorkspace: () => team });
    const plain = manifest[1];
    await m.mount(plain, ctx());
    await m.mount(plain, { ...ctx(), path: '/doc/7' });
    expect(lib.mount).toHaveBeenCalledTimes(6);
    expect(lib.navigated).not.toHaveBeenCalled();
  });

  it('mounts an app again that sets the flag but has no navigated to hear the path with', async () => {
    const follows = app('library', '/library', { followsAddress: true });
    const lib = mfe();
    const m = new AppMounter(document.createElement('div'), vi.fn(async () => ({ default: lib })));
    await m.mount(follows, ctx());
    expect(await m.mount(follows, { ...ctx(), path: '/doc/7' })).toBe('mounted');
    expect(lib.mount).toHaveBeenCalledTimes(2);
  });

  it('mounts an app again when it throws on being told the path', async () => {
    const follows = app('library', '/library', { followsAddress: true });
    const lib = {
      ...mfe(),
      navigated: vi.fn(() => {
        throw new Error('no');
      }),
    };
    const m = new AppMounter(document.createElement('div'), vi.fn(async () => ({ default: lib })));
    await m.mount(follows, ctx());
    expect(await m.mount(follows, { ...ctx(), path: '/doc/7' })).toBe('mounted');
    expect(lib.mount).toHaveBeenCalledTimes(2);
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

  it('refuses an app made for another version of the SDK, without loading it', async () => {
    const load = vi.fn(async () => ({ default: mfe() }));
    const m = new AppMounter(document.createElement('div'), load);
    await expect(m.mount(app('old', '/old', { sdk: '^0.1.0' }), ctx())).rejects.toThrow(/made for an older version/);
    await expect(m.mount(app('next', '/next', { sdk: '^99.0.0' }), ctx())).rejects.toThrow(/needs a newer version/);
    await expect(m.mount(app('vague', '/vague', { sdk: undefined as unknown as string }), ctx())).rejects.toThrow(/doesn't say which versions/);
    expect(load).not.toHaveBeenCalled();
  });

  it('knows which SDK ranges it satisfies', () => {
    expect(incompatibility(app('a', '/a', { sdk: '^1.0.0' }), '1.4.2')).toBeUndefined();
    expect(incompatibility(app('a', '/a', { sdk: '>=1.2.0 <3' }), '2.0.0')).toBeUndefined();
    expect(incompatibility(app('a', '/a', { sdk: '^1.5.0' }), '1.4.2')).toMatch(/newer/);
    expect(incompatibility(app('a', '/a', { sdk: '^1.0.0' }), '2.0.0')).toMatch(/older/);
  });

  it('opens the shell’s own frontends on SDK 3 and refuses an installed app made for SDK 2', async () => {
    const { devHome } = await import('../dev-app/standin.js');
    expect(incompatibility(devHome, '3.0.0')).toBeUndefined();
    expect(incompatibility(app('home', '/home', { sdk: '^2.0.0 || ^3.0.0' }), '3.0.0')).toBeUndefined();
    expect(incompatibility(app('notes', '/notes', { sdk: '^2.0.0' }), '3.0.0')).toMatch(/older/);
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

describe('notification actions', () => {
  const approve = { label: 'Approve', intent: { type: 'claim.approve', payload: { id: 'c1' } } };
  const open = { label: 'Open', intent: { type: 'claim.open', payload: {} } };

  it('gives the Shell only the labels, at most two', () => {
    const n = toShellNotification('claims', { title: 'Approve a claim', needsYou: true, actions: [approve, open, { label: 'Third', intent: { type: 'x.y', payload: {} } }] });
    expect(n.actions).toEqual([{ label: 'Approve' }, { label: 'Open' }]);
    expect(toShellNotification('claims', { title: 'None' }).actions).toBeUndefined();
    expect(fromServer({ id: 's1', app: 'claims', level: 'needs', title: 'T', createdAt: '2026-10-23T00:00:00Z', actions: [open] }).actions).toEqual([{ label: 'Open' }]);
  });

  it('keeps the intent behind each button until the notification is done with', () => {
    const kept = new NotificationActions();
    kept.remember('n1', [approve, open]);
    expect(kept.intentFor('n1', 0)).toEqual({ type: 'claim.approve', payload: { id: 'c1' } });
    expect(kept.intentFor('n1', 1)).toEqual({ type: 'claim.open', payload: {} });
    expect(kept.intentFor('n1', 2)).toBeUndefined();
    kept.forget('n1');
    expect(kept.intentFor('n1', 0)).toBeUndefined();
  });

  it('drops actions an app got wrong rather than showing a broken button', () => {
    const kept = new NotificationActions();
    kept.remember('n1', [{ label: '', intent: { type: 'a.b' } }, { label: 'No intent' }, 'nonsense', open]);
    expect(kept.intentFor('n1', 0)).toEqual({ type: 'claim.open', payload: {} });
    expect(toShellNotification('x', { title: 'T', actions: [{ label: 'Go' } as never] }).actions).toBeUndefined();
  });
});
