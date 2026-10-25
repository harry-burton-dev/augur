import type { AppManifestEntry } from '@augur/mfe-sdk';
import { describe, expect, it, vi } from 'vitest';
import { devHome, devUser, standInFetch } from './standin.js';

const app: AppManifestEntry = { id: 'hello', name: 'Hello', route: '/hello', entry: '/@fs/apps/hello/frontend/src/entry.ts', version: '0.0.0', sdk: '^1.0.0', requiredRole: 'editor' };

describe('the stand-in platform', () => {
  it('signs in a person who has the role the app needs, and any extra', () => {
    expect(devUser(app, ['admin']).roles).toEqual(['admin', 'editor']);
    expect(devUser({ ...app, requiredRole: undefined }).roles).toEqual([]);
  });

  it('lists Home and the app being developed', async () => {
    const res = await standInFetch(app)('/api/registry/v1/manifest');
    expect(await res.json()).toEqual([devHome, app]);
    expect(await (await standInFetch(devHome)('/api/registry/v1/manifest')).json()).toEqual([devHome]);
  });

  it('lists the other apps it was given beside them', async () => {
    const folio: AppManifestEntry = { id: 'folio', name: 'Folio', route: '/folio', entry: '/apps/folio/entry.js', version: '0.1.0', sdk: '^1.1.0' };
    const res = await standInFetch(app, undefined, [folio, app])('/api/registry/v1/manifest');
    expect(await res.json()).toEqual([devHome, app, folio]);
  });

  it('keeps preferences until the page reloads', async () => {
    const f = standInFetch(app);
    await f('/api/identity/v1/me/preferences', { method: 'PUT', body: JSON.stringify({ away: true }) });
    expect(await (await f('/api/identity/v1/me/preferences')).json()).toEqual({ away: true });
  });

  it('holds the notification stream open until the shell stops listening', async () => {
    const stop = new AbortController();
    const res = await standInFetch(app)('/api/events/v1/notifications/stream', { signal: stop.signal });
    const read = res.body!.getReader().read();
    stop.abort();
    await expect(read).rejects.toThrow('Aborted');
  });

  it("sends anything else on, such as the app's own service", async () => {
    const real = vi.fn(async () => new Response('ok'));
    await standInFetch(app, real)('/api/hello/v1/greeting');
    expect(real).toHaveBeenCalledWith('/api/hello/v1/greeting', undefined);
  });
});
