import { describe, expect, it } from 'vitest';
import { callerHeaders, type FloorPlace } from '@augur/service-kit';
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

// The org, Finance with Payroll below it, Legal, and someone's own floor.
const places: Record<string, FloorPlace> = {
  o: { id: 'o', kind: 'org', path: ['o'], org: 'o' },
  f: { id: 'f', kind: 'team', path: ['o', 'f'], org: 'o' },
  p: { id: 'p', kind: 'team', path: ['o', 'f', 'p'], org: 'o' },
  l: { id: 'l', kind: 'team', path: ['o', 'l'], org: 'o' },
  w1: { id: 'w1', kind: 'team', path: ['o', 'w1'], org: 'o' },
  m: { id: 'm', kind: 'personal', path: ['m'], org: 'o' },
};
const floors = async (id: string) => places[id];
/** Someone standing on a floor, as the gateway passes it on. */
const on = (id: string) => callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'], workspace: { id, kind: places[id].kind, role: 'member' } });

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
    expect(forAdmin.find((a: { id: string }) => a.id === 'admin').menu.map((c: { label: string }) => c.label)).toEqual(['People', 'Departments', 'Apps', 'AUGUR']);
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

  it('tells the gateway how much an app may be sent, which only an admin can lower', async () => {
    const entries: { action: string; detail?: unknown }[] = [];
    const app = await buildApp({ verifyService, audit: async (e) => void entries.push(e) });
    const served = async () => (await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json().find((a: { id: string }) => a.id === 'library');
    await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    expect((await served()).maxUpload).toBe(10);
    await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: { ...library, maxUpload: 200 } });
    expect((await served()).maxUpload).toBe(200);
    const limit = (mb: number | null, headers = admin) => app.inject({ method: 'PUT', url: '/v1/apps/library/upload-limit', headers, payload: { mb } });
    expect((await limit(50, editor)).statusCode).toBe(403);
    expect((await limit(500)).statusCode).toBe(400);
    expect((await limit(50)).json()).toMatchObject({ id: 'library', maxUpload: 200, uploadLimit: 50, uploadLimitLowered: true });
    expect((await served()).maxUpload).toBe(50);
    // A new version keeps the admin's limit.
    await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: { ...library, version: '0.2.0', maxUpload: 200 } });
    expect((await served()).maxUpload).toBe(50);
    expect((await limit(null)).json().uploadLimit).toBe(200);
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/nothing/upload-limit', headers: admin, payload: { mb: 5 } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: { ...library, maxUpload: 5000 } })).statusCode).toBe(400);
    expect(entries.filter((e) => e.action === 'app.upload-limit-set').map((e) => e.detail)).toEqual([{ mb: 50 }, { mb: null }]);
  });

  it('lets an app’s service register it, signed in as itself', async () => {
    const app = await buildApp({ verifyService });
    const first = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    const again = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: { ...library, version: '0.2.0' } });
    expect([first.statusCode, again.statusCode]).toEqual([201, 200]);
    const manifest = (await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json();
    expect(manifest).toContainEqual({ ...library, version: '0.2.0', maxUpload: 10 });
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
    expect((await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json()).toContainEqual({ ...library, ai: false, menu, maxUpload: 10 });
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

  it('keeps an app out of another app’s pages, the platform’s included', async () => {
    const app = await buildApp({ verifyService });
    const put = (payload: object) => app.inject({ method: 'PUT', url: `/v1/apps/${(payload as { id: string }).id}`, headers: as(`app-${(payload as { id: string }).id}`), payload });
    await put(library);
    const underAdmin = await put({ ...library, id: 'people', route: '/admin/people' });
    const underLibrary = await put({ ...library, id: 'papers', route: '/library/papers' });
    const aroundLibrary = await put({ ...library, id: 'lib', route: '/lib' });
    const trailing = await put({ ...library, id: 'copy', route: '/library/' });
    expect([underAdmin.statusCode, underLibrary.statusCode, trailing.statusCode]).toEqual([409, 409, 409]);
    expect(underAdmin.json().message).toBe("/admin/people is inside Admin's pages at /admin. Choose a route of its own.");
    // Only whole segments count: /lib is beside /library, not around it.
    expect(aroundLibrary.statusCode).toBe(201);
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
      const app = await buildApp({ verifyService, floors });
      await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: as('app-library'), payload: { ...library, scopes: ['notifications:send'] } });
      const grants = (headers: Record<string, string>) => app.inject({ method: 'GET', url: '/v1/apps/library/grants?workspace=w1', headers });
      expect((await grants(as('platform-events'))).json()).toEqual({ app: 'library', workspace: 'w1', scopes: ['notifications:send'] });
      expect((await grants(as('app-library'))).statusCode).toBe(403);
      expect((await grants(admin)).statusCode).toBe(403);
      await app.inject({ method: 'PATCH', url: '/v1/apps/library', headers: admin, payload: { enabled: false } });
      expect((await grants(as('platform-events'))).json().scopes).toEqual([]);
      expect((await app.inject({ method: 'GET', url: '/v1/apps/nope/grants', headers: as('platform-events') })).statusCode).toBe(404);
    });
  });

  describe('floor by floor', () => {
    const setup = async (payload: object = library) => {
      const entries: { action: string; detail?: unknown }[] = [];
      const app = await buildApp({ verifyService, floors, audit: async (e) => void entries.push(e) });
      await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload });
      const set = (workspace: string, state: string, headers = admin, carriesOn?: boolean) =>
        app.inject({ method: 'PUT', url: `/v1/apps/library/floors/${workspace}`, headers, payload: { state, ...(carriesOn === undefined ? {} : { carriesOn }) } });
      const offered = async (workspace: string) => ids((await app.inject({ method: 'GET', url: `/v1/manifest?workspace=${workspace}`, headers: on(workspace) })).json()).includes('library');
      return { app, entries, set, offered };
    };

    it('can be on for Finance and off for Legal', async () => {
      const { set, offered, entries } = await setup();
      expect((await set('l', 'off')).json().state).toEqual({ on: false, why: 'set-here', by: 'l' });
      expect(await offered('f')).toBe(true);
      expect(await offered('p')).toBe(true);
      expect(await offered('l')).toBe(false);
      expect(await offered('o')).toBe(true);
      expect(entries.at(-1)).toMatchObject({ action: 'app.disabled', target: 'library', detail: { workspace: 'l', carriesOn: true } });
    });

    it('carries an install on to the teams below unless one says otherwise', async () => {
      const { set, offered } = await setup();
      await set('o', 'off');
      await set('f', 'on');
      expect([await offered('o'), await offered('f'), await offered('p'), await offered('l'), await offered('m')]).toEqual([false, true, true, false, false]);
      await set('f', 'on', admin, false);
      expect([await offered('f'), await offered('p')]).toEqual([true, false]);
      await set('p', 'on');
      await set('f', 'inherit');
      expect([await offered('f'), await offered('p')]).toEqual([false, true]);
    });

    it('lets a block above win over anything below it', async () => {
      const { set, offered, entries } = await setup();
      await set('p', 'on');
      await set('f', 'blocked');
      expect([await offered('f'), await offered('p'), await offered('l')]).toEqual([false, false, true]);
      await set('o', 'blocked');
      expect([await offered('l'), await offered('m')]).toEqual([false, false]);
      expect(entries.map((e) => e.action)).toContain('app.blocked');
    });

    it('offers an app only on the kinds of floor it says it works on', async () => {
      const { offered } = await setup({ ...library, floors: ['team'] });
      expect([await offered('f'), await offered('o'), await offered('m')]).toEqual([true, false, false]);
    });

    it('answers only for the floor the gateway checked, and only admins set rules', async () => {
      const { app, set } = await setup();
      expect((await app.inject({ method: 'GET', url: '/v1/manifest?workspace=l', headers: on('f') })).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: '/v1/manifest?workspace=gone', headers: callerHeaders({ id: 'u', name: 'U', departments: [], roles: [], workspace: { id: 'gone', kind: 'team', role: 'member' } }) })).statusCode).toBe(404);
      expect((await set('f', 'off', editor)).statusCode).toBe(403);
      expect((await set('m', 'off')).statusCode).toBe(400);
      expect((await set('gone', 'off')).statusCode).toBe(404);
      expect((await app.inject({ method: 'PUT', url: '/v1/apps/admin/floors/f', headers: admin, payload: { state: 'off' } })).statusCode).toBe(409);
      expect((await app.inject({ method: 'GET', url: '/v1/apps/library/floors', headers: editor })).statusCode).toBe(403);
      await set('f', 'off');
      expect((await app.inject({ method: 'GET', url: '/v1/apps/library/floors', headers: admin })).json()).toEqual([expect.objectContaining({ workspace: 'f', state: 'off', setBy: 'u-1' })]);
    });

    it('can’t answer for a floor without identity', async () => {
      const app = await buildApp({ verifyService });
      expect((await app.inject({ method: 'GET', url: '/v1/manifest?workspace=f', headers: on('f') })).statusCode).toBe(503);
    });

    it('grants scopes only where the app is on', async () => {
      const { app, set } = await setup({ ...library, scopes: ['notifications:send'] });
      await set('l', 'off');
      const grants = async (workspace: string) => (await app.inject({ method: 'GET', url: `/v1/apps/library/grants?workspace=${workspace}`, headers: as('platform-events') })).json().scopes;
      expect(await grants('f')).toEqual(['notifications:send']);
      expect(await grants('l')).toEqual([]);
      expect(await grants('gone')).toEqual([]);
    });

    it('holds back scopes a new version asks for until an admin grants them', async () => {
      const { app, entries } = await setup({ ...library, scopes: ['notifications:send'] });
      await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: { ...library, version: '0.2.0', scopes: ['notifications:send', 'audit:write'] } });
      const grants = async () => (await app.inject({ method: 'GET', url: '/v1/apps/library/grants?workspace=f', headers: as('platform-events') })).json().scopes;
      expect(await grants()).toEqual(['notifications:send']);
      const catalogue = (await app.inject({ method: 'GET', url: '/v1/apps', headers: admin })).json();
      expect(catalogue.find((a: { id: string }) => a.id === 'library')).toMatchObject({ version: '0.2.0', grantedScopes: ['notifications:send'], awaitingScopes: ['audit:write'] });
      const grant = (headers: Record<string, string>) => app.inject({ method: 'PUT', url: '/v1/apps/library/scopes', headers, payload: { scopes: ['notifications:send', 'audit:write'] } });
      expect((await grant(editor)).statusCode).toBe(403);
      expect((await grant(admin)).json()).not.toHaveProperty('awaitingScopes');
      expect(await grants()).toEqual(['notifications:send', 'audit:write']);
      expect(entries.at(-1)).toMatchObject({ action: 'app.scopes-granted', detail: { scopes: ['notifications:send', 'audit:write'] } });
    });

    it('checks that each surface is for a floor the app works on', async () => {
      const app = await buildApp({ verifyService });
      const put = (payload: object) => app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: { ...library, ...payload } });
      expect((await put({ floors: ['team'], surfaces: [{ floor: 'org', slot: 'card', module: './Card' }] })).statusCode).toBe(400);
      expect((await put({ surfaces: [{ floor: 'team', slot: 'shelf', module: './Card' }] })).statusCode).toBe(400);
      const ok = await put({ floors: ['team', 'org'], surfaces: [{ floor: 'team', slot: 'card', module: './Card', rollup: true }, { floor: 'org', slot: 'page', module: './Page', role: 'lead' }] });
      expect(ok.statusCode).toBe(201);
    });

    it('takes the storage an app keeps, and nothing else under it', async () => {
      const app = await buildApp({ verifyService });
      const put = (payload: object) => app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: { ...library, ...payload } });
      expect((await put({ storage: { database: true, bucket: true } })).statusCode).toBe(201);
      expect((await put({ storage: { disk: true } })).statusCode).toBe(400);
    });
  });
});
