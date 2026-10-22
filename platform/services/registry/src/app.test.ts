import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@platform/service-kit';
import { buildApp } from './app.ts';

const library = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.1.0', sdk: '^1.0.0', handles: ['document.open'] };
const admin = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });
const service = { 'x-service-token': 'local-secret', 'x-service-name': 'library' };

const ids = (body: { id: string }[]) => body.map((a) => a.id);

describe('registry', () => {
  it('reports healthy', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('hides apps that need a role the caller lacks', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: { ...library, requiredRole: 'admin' } });
    expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json())).toEqual(['home']);
    expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: admin })).json())).toEqual(['home', 'admin', 'library']);
  });

  it('offers Admin, with its menu, to admins only', async () => {
    const app = await buildApp();
    const forAdmin = (await app.inject({ method: 'GET', url: '/v1/manifest', headers: admin })).json();
    expect(ids(forAdmin)).toContain('admin');
    expect(forAdmin.find((a: { id: string }) => a.id === 'admin').menu.map((c: { label: string }) => c.label)).toEqual(['People', 'Departments', 'Apps', 'Platform']);
    expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json())).not.toContain('admin');
  });

  it('shows admins the whole catalogue, and lets them turn an app off and on', async () => {
    const entries: { action: string }[] = [];
    const app = await buildApp({ serviceToken: 'local-secret', audit: async (e) => void entries.push(e) });
    await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    const patch = (enabled: boolean, headers = admin, id = 'library') => app.inject({ method: 'PATCH', url: `/v1/apps/${id}`, headers, payload: { enabled } });
    expect((await patch(false, editor)).statusCode).toBe(403);
    expect((await patch(false)).json()).toMatchObject({ id: 'library', enabled: false, registeredBy: 'library' });
    expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: admin })).json())).not.toContain('library');
    // Registering again (as the app's service does on every start) leaves it off.
    await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: { ...library, version: '0.2.0' } });
    const catalogue = (await app.inject({ method: 'GET', url: '/v1/apps', headers: admin })).json();
    expect(catalogue).toContainEqual(expect.objectContaining({ id: 'library', version: '0.2.0', enabled: false, platform: false }));
    expect(catalogue).toContainEqual(expect.objectContaining({ id: 'admin', platform: true, enabled: true }));
    expect((await app.inject({ method: 'GET', url: '/v1/apps', headers: editor })).statusCode).toBe(403);
    await patch(true);
    expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json())).toContain('library');
    expect((await patch(false, admin, 'admin')).statusCode).toBe(409);
    expect((await patch(false, admin, 'nothing')).statusCode).toBe(404);
    expect(entries.map((e) => e.action)).toEqual(['app.registered', 'app.disabled', 'app.updated', 'app.enabled']);
  });

  it('lets an app’s service register it with the service token', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const first = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    const again = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: { ...library, version: '0.2.0' } });
    expect([first.statusCode, again.statusCode]).toEqual([201, 200]);
    const manifest = (await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json();
    expect(manifest).toContainEqual({ ...library, version: '0.2.0' });
  });

  it('lets an admin register an app, but no one else', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const byAdmin = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: admin, payload: library });
    const byEditor = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: editor, payload: library });
    const wrongToken = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: { 'x-service-token': 'guess' }, payload: library });
    expect([byAdmin.statusCode, byEditor.statusCode, wrongToken.statusCode]).toEqual([201, 403, 403]);
  });

  it('refuses the token when none is configured', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: { 'x-service-token': '' }, payload: library });
    expect(res.statusCode).toBe(403);
  });

  it('turns away manifests it cannot use', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const put = (url: string, payload: object) => app.inject({ method: 'PUT', url, headers: service, payload });
    expect((await put('/v1/apps/library', { ...library, route: 'library' })).statusCode).toBe(400);
    expect((await put('/v1/apps/library', { ...library, extra: true })).statusCode).toBe(400);
    expect((await put('/v1/apps/other', library)).statusCode).toBe(400);
  });

  it('needs a semver version and the SDK range the app works with', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const put = (payload: object) => app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload });
    const { sdk: _, ...noSdk } = library;
    expect((await put(noSdk)).statusCode).toBe(400);
    expect((await put({ ...library, version: 'latest' })).json().message).toMatch(/not a semver version/);
    expect((await put({ ...library, sdk: 'whatever' })).json().message).toMatch(/not a semver range/);
    expect((await put({ ...library, version: '1.4.0-rc.1', sdk: '>=1.2.0 <3' })).statusCode).toBe(201);
  });

  it('serves its API under /v1 only', async () => {
    const app = await buildApp();
    expect((await app.inject({ method: 'GET', url: '/v1/manifest' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/manifest' })).statusCode).toBe(404);
  });

  it('keeps an app’s menu, and turns away items that would open its root', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const menu = [{ label: 'Documents', icon: 'folder', items: [{ label: 'Reports', path: '/reports', detail: 'Updated today' }] }];
    const put = (payload: object) => app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload });
    expect((await put({ ...library, ai: false, menu })).statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json()).toContainEqual({ ...library, ai: false, menu });
    expect((await put({ ...library, menu: [{ label: 'Documents', items: [{ label: 'All', path: '/' }] }] })).statusCode).toBe(400);
    expect((await put({ ...library, menu: [{ label: 'Empty', items: [] }] })).statusCode).toBe(400);
    expect((await put({ ...library, menu: [{ label: 'Documents', items: [{ label: 'Reports', path: '/r', colour: 'red' }] }] })).statusCode).toBe(400);
  });

  it('keeps platform apps and taken routes for their owners', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const put = (payload: object) => app.inject({ method: 'PUT', url: `/v1/apps/${(payload as { id: string }).id}`, headers: service, payload });
    const home = await put({ ...library, id: 'home', route: '/home' });
    const slash = await put({ ...library, route: '/admin' });
    await put(library);
    const clash = await put({ ...library, id: 'papers' });
    expect([home.statusCode, slash.statusCode, clash.statusCode]).toEqual([409, 409, 409]);
    expect(clash.json().message).toBe('Library already lives at /library.');
  });

  it('records who changed the catalogue in the audit log', async () => {
    const entries: unknown[] = [];
    const app = await buildApp({ serviceToken: 'local-secret', audit: async (e) => void entries.push(e) });
    await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: admin });
    expect(entries).toEqual([
      { actor: { id: 'library', kind: 'service' }, app: 'registry', action: 'app.registered', target: 'library', detail: { version: '0.1.0' } },
      { actor: { id: 'u-1', kind: 'user' }, app: 'registry', action: 'app.removed', target: 'library' },
    ]);
  });

  it('lets admins see an app’s versions, roll it back and hold it there, then let it go', async () => {
    const entries: { action: string; detail?: unknown }[] = [];
    const app = await buildApp({ serviceToken: 'local-secret', audit: async (e) => void entries.push(e) });
    const register = (version: string) => app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: { ...library, version } });
    await register('0.1.0');
    await register('0.2.0');
    const versions = await app.inject({ method: 'GET', url: '/v1/apps/library/versions', headers: admin });
    expect(versions.json().map((v: { version: string; serving: boolean }) => [v.version, v.serving])).toEqual([
      ['0.2.0', true],
      ['0.1.0', false],
    ]);
    const back = await app.inject({ method: 'PUT', url: '/v1/apps/library/pin', headers: admin, payload: { version: '0.1.0' } });
    expect(back.json()).toMatchObject({ version: '0.1.0', pinnedVersion: '0.1.0', platform: false });
    await register('0.3.0');
    expect((await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json().find((a: { id: string }) => a.id === 'library').version).toBe('0.1.0');
    const free = await app.inject({ method: 'DELETE', url: '/v1/apps/library/pin', headers: admin });
    expect(free.json()).toMatchObject({ version: '0.3.0' });
    expect(free.json().pinnedVersion).toBeUndefined();
    expect(entries.map((e) => [e.action, e.detail])).toEqual([
      ['app.registered', { version: '0.1.0' }],
      ['app.updated', { version: '0.2.0' }],
      ['app.pinned', { version: '0.1.0' }],
      ['app.updated', { version: '0.3.0', heldAt: '0.1.0' }],
      ['app.unpinned', { version: '0.3.0' }],
    ]);
  });

  it('keeps versions to admins, and platform apps out of it', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    expect((await app.inject({ method: 'GET', url: '/v1/apps/library/versions', headers: editor })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/library/pin', headers: editor, payload: { version: '0.1.0' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/library/pin', headers: admin, payload: { version: '7.0.0' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/home/pin', headers: admin, payload: { version: '0.1.0' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'GET', url: '/v1/apps/nothing/versions', headers: admin })).statusCode).toBe(404);
  });

  it('still registers the app when the audit log cannot be reached', async () => {
    const app = await buildApp({ serviceToken: 'local-secret', audit: async () => Promise.reject(new Error('events is down')) });
    const res = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    expect(res.statusCode).toBe(201);
  });

  it('lets an admin remove an app', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    const byService = await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: service });
    const byAdmin = await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: admin });
    const gone = await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: admin });
    expect([byService.statusCode, byAdmin.statusCode, gone.statusCode]).toEqual([403, 204, 404]);
  });
});
