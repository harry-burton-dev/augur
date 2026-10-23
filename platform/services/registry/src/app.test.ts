import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@platform/service-kit';
import { buildApp } from './app.ts';

const library = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.1.0', sdk: '^1.0.0', handles: ['document.open'] };
const admin = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });
// Stands in for Keycloak: "Bearer app-<id>" is that app's token, "Bearer platform-<name>" a platform service's.
const verifyService = async (headers: Record<string, string | string[] | undefined>) => {
  const m = /^Bearer (app|platform)-(\S+)$/.exec(String(headers.authorization ?? ''));
  return m ? (m[1] === 'app' ? { kind: 'app' as const, app: m[2] } : { kind: 'platform' as const, name: m[2] }) : undefined;
};
const as = (client: string) => ({ authorization: `Bearer ${client}` });
const service = as('app-library');

const ids = (body: { id: string }[]) => body.map((a) => a.id);

describe('registry', () => {
  it('reports healthy', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('hides apps that need a role the caller lacks', async () => {
    const app = await buildApp({ verifyService });
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
    const app = await buildApp({ verifyService, audit: async (e) => void entries.push(e) });
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

  it('lets an app’s service register it, signed in as itself', async () => {
    const app = await buildApp({ verifyService });
    const first = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    const again = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: { ...library, version: '0.2.0' } });
    expect([first.statusCode, again.statusCode]).toEqual([201, 200]);
    const manifest = (await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json();
    expect(manifest).toContainEqual({ ...library, version: '0.2.0' });
  });

  it('lets an admin register an app, but no one else', async () => {
    const app = await buildApp({ verifyService });
    const byAdmin = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: admin, payload: library });
    const byEditor = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: editor, payload: library });
    const notAToken = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: { authorization: 'Bearer guess' }, payload: library });
    expect([byAdmin.statusCode, byEditor.statusCode, notAToken.statusCode]).toEqual([201, 403, 403]);
  });

  it('trusts no service token when it has no way to check one', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    expect(res.statusCode).toBe(403);
  });

  it('turns away manifests it cannot use', async () => {
    const app = await buildApp({ verifyService });
    const put = (url: string, payload: object) => app.inject({ method: 'PUT', url, headers: service, payload });
    expect((await put('/v1/apps/library', { ...library, route: 'library' })).statusCode).toBe(400);
    expect((await put('/v1/apps/library', { ...library, extra: true })).statusCode).toBe(400);
    const mismatched = await app.inject({ method: 'PUT', url: '/v1/apps/other', headers: admin, payload: library });
    expect(mismatched.statusCode).toBe(400);
  });

  it('needs a semver version and the SDK range the app works with', async () => {
    const app = await buildApp({ verifyService });
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
    const app = await buildApp({ verifyService });
    const menu = [{ label: 'Documents', icon: 'folder', items: [{ label: 'Reports', path: '/reports', detail: 'Updated today' }] }];
    const put = (payload: object) => app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload });
    expect((await put({ ...library, ai: false, menu })).statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json()).toContainEqual({ ...library, ai: false, menu });
    expect((await put({ ...library, menu: [{ label: 'Documents', items: [{ label: 'All', path: '/' }] }] })).statusCode).toBe(400);
    expect((await put({ ...library, menu: [{ label: 'Empty', items: [] }] })).statusCode).toBe(400);
    expect((await put({ ...library, menu: [{ label: 'Documents', items: [{ label: 'Reports', path: '/r', colour: 'red' }] }] })).statusCode).toBe(400);
  });

  it('keeps platform apps and taken routes for their owners', async () => {
    const app = await buildApp({ verifyService });
    const put = (payload: object) => app.inject({ method: 'PUT', url: `/v1/apps/${(payload as { id: string }).id}`, headers: as(`app-${(payload as { id: string }).id}`), payload });
    const home = await put({ ...library, id: 'home', route: '/home' });
    const slash = await put({ ...library, route: '/admin' });
    await put(library);
    const clash = await put({ ...library, id: 'papers' });
    expect([home.statusCode, slash.statusCode, clash.statusCode]).toEqual([409, 409, 409]);
    expect(clash.json().message).toBe('Library already lives at /library.');
  });

  it('records who changed the catalogue in the audit log', async () => {
    const entries: unknown[] = [];
    const app = await buildApp({ verifyService, audit: async (e) => void entries.push(e) });
    await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: admin });
    expect(entries).toEqual([
      { actor: { id: 'library', kind: 'service' }, app: 'registry', action: 'app.registered', target: 'library', detail: { version: '0.1.0' } },
      { actor: { id: 'u-1', kind: 'user' }, app: 'registry', action: 'app.removed', target: 'library' },
    ]);
  });

  it('lets admins see an app’s versions, roll it back and hold it there, then let it go', async () => {
    const entries: { action: string; detail?: unknown }[] = [];
    const app = await buildApp({ verifyService, audit: async (e) => void entries.push(e) });
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
    const app = await buildApp({ verifyService });
    await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    expect((await app.inject({ method: 'GET', url: '/v1/apps/library/versions', headers: editor })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/library/pin', headers: editor, payload: { version: '0.1.0' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/library/pin', headers: admin, payload: { version: '7.0.0' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/home/pin', headers: admin, payload: { version: '0.1.0' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'GET', url: '/v1/apps/nothing/versions', headers: admin })).statusCode).toBe(404);
  });

  it('still registers the app when the audit log cannot be reached', async () => {
    const app = await buildApp({ verifyService, audit: async () => Promise.reject(new Error('events is down')) });
    const res = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    expect(res.statusCode).toBe(201);
  });

  it('lets an admin remove an app', async () => {
    const app = await buildApp({ verifyService });
    await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    const byService = await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: service });
    const byAdmin = await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: admin });
    const gone = await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: admin });
    expect([byService.statusCode, byAdmin.statusCode, gone.statusCode]).toEqual([403, 204, 404]);
  });

  describe('where apps may load from', () => {
    const elsewhere = { ...library, entry: 'https://apps.example.org/library/entry.js' };
    const register = (app: Awaited<ReturnType<typeof buildApp>>, payload: object) => app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload });
    const allow = (app: Awaited<ReturnType<typeof buildApp>>, origin: string, headers = admin) => app.inject({ method: 'POST', url: '/v1/origins', headers, payload: { origin } });

    it('takes an entry on the platform itself, and refuses one from an origin nobody allowed', async () => {
      const app = await buildApp({ verifyService });
      expect((await register(app, library)).statusCode).toBe(201);
      const refused = await register(app, elsewhere);
      expect(refused.statusCode).toBe(400);
      expect(refused.json().message).toMatch(/loads from https:\/\/apps\.example\.org, which isn't a place apps are allowed/);
      expect((await register(app, { ...library, entry: '//apps.example.org/x.js' })).statusCode).toBe(400);
      expect((await register(app, { ...library, entry: 'javascript:alert(1)' })).statusCode).toBe(400);
    });

    it('takes an entry from an origin an admin allowed, and audits the choice', async () => {
      const entries: { action: string; target?: string }[] = [];
      const app = await buildApp({ verifyService, audit: async (e) => void entries.push(e) });
      expect((await allow(app, 'https://apps.example.org', editor)).statusCode).toBe(403);
      expect((await allow(app, 'http://apps.example.org')).json().message).toMatch(/HTTPS/);
      expect((await allow(app, 'https://apps.example.org/library')).json().message).toMatch(/without a path/);
      const added = await allow(app, 'https://apps.example.org/');
      expect(added.statusCode).toBe(201);
      expect(added.json()).toMatchObject({ origin: 'https://apps.example.org', addedBy: 'u-1' });
      expect((await app.inject({ method: 'GET', url: '/v1/origins', headers: admin })).json().map((o: { origin: string }) => o.origin)).toEqual(['https://apps.example.org']);
      expect((await register(app, elsewhere)).statusCode).toBe(201);
      expect(entries.filter((e) => e.action.startsWith('origin.'))).toEqual([expect.objectContaining({ action: 'origin.allowed', target: 'https://apps.example.org' })]);
    });

    it('stops offering apps from an origin that is no longer allowed', async () => {
      const app = await buildApp({ verifyService });
      await allow(app, 'https://apps.example.org');
      await register(app, elsewhere);
      const removed = await app.inject({ method: 'DELETE', url: `/v1/origins/${encodeURIComponent('https://apps.example.org')}`, headers: admin });
      expect(removed.statusCode).toBe(204);
      expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: admin })).json())).not.toContain('library');
      const catalogue = (await app.inject({ method: 'GET', url: '/v1/apps', headers: admin })).json();
      expect(catalogue.find((a: { id: string }) => a.id === 'library').blocked).toMatch(/isn't a place apps are allowed/);
      expect((await app.inject({ method: 'DELETE', url: `/v1/origins/${encodeURIComponent('https://apps.example.org')}`, headers: admin })).statusCode).toBe(404);
    });
  });

  describe('apps signed in as themselves', () => {
    it('lets an app register itself, recorded as itself, and nothing else', async () => {
      const entries: { actor: { id: string } }[] = [];
      const app = await buildApp({ verifyService, audit: async (e) => void entries.push(e) });
      expect((await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: as('app-library'), payload: library })).statusCode).toBe(201);
      expect(entries.at(-1)?.actor).toEqual({ id: 'library', kind: 'service' });
      const other = await app.inject({ method: 'PUT', url: '/v1/apps/board', headers: as('app-library'), payload: { ...library, id: 'board', route: '/board' } });
      expect(other.statusCode).toBe(403);
      expect(other.json().message).toMatch(/library can only register itself/);
    });

    it('takes the scopes an app asks for, and refuses ones that don’t exist', async () => {
      const app = await buildApp({ verifyService });
      const bad = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: as('app-library'), payload: { ...library, scopes: ['people:delete'] } });
      expect(bad.statusCode).toBe(400);
      const res = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: as('app-library'), payload: { ...library, scopes: ['notifications:send'] } });
      expect(res.statusCode).toBe(201);
    });

    it('tells platform services what an app is granted, and nothing once it is off', async () => {
      const app = await buildApp({ verifyService });
      await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: as('app-library'), payload: { ...library, scopes: ['notifications:send'] } });
      const grants = (headers: Record<string, string>) => app.inject({ method: 'GET', url: '/v1/apps/library/grants?workspace=w-1', headers });
      expect((await grants(as('platform-events'))).json()).toEqual({ app: 'library', workspace: 'w-1', scopes: ['notifications:send'] });
      expect((await grants(as('app-library'))).statusCode).toBe(403);
      expect((await grants(admin)).statusCode).toBe(403);
      await app.inject({ method: 'PATCH', url: '/v1/apps/library', headers: admin, payload: { enabled: false } });
      expect((await grants(as('platform-events'))).json().scopes).toEqual([]);
      expect((await app.inject({ method: 'GET', url: '/v1/apps/nope/grants', headers: as('platform-events') })).statusCode).toBe(404);
    });
  });
});
