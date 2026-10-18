import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@platform/service-kit';
import { buildApp } from './app.ts';

const library = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.1.0', handles: ['document.open'] };
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
    const app = await buildApp();
    expect(ids((await app.inject({ method: 'GET', url: '/manifest', headers: editor })).json())).toEqual(['home']);
    expect(ids((await app.inject({ method: 'GET', url: '/manifest', headers: admin })).json())).toEqual(['home', 'admin']);
  });

  it('lets an app’s service register it with the service token', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const first = await app.inject({ method: 'PUT', url: '/apps/library', headers: service, payload: library });
    const again = await app.inject({ method: 'PUT', url: '/apps/library', headers: service, payload: { ...library, version: '0.2.0' } });
    expect([first.statusCode, again.statusCode]).toEqual([201, 200]);
    const manifest = (await app.inject({ method: 'GET', url: '/manifest', headers: editor })).json();
    expect(manifest).toContainEqual({ ...library, version: '0.2.0' });
  });

  it('lets an admin register an app, but no one else', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const byAdmin = await app.inject({ method: 'PUT', url: '/apps/library', headers: admin, payload: library });
    const byEditor = await app.inject({ method: 'PUT', url: '/apps/library', headers: editor, payload: library });
    const wrongToken = await app.inject({ method: 'PUT', url: '/apps/library', headers: { 'x-service-token': 'guess' }, payload: library });
    expect([byAdmin.statusCode, byEditor.statusCode, wrongToken.statusCode]).toEqual([201, 403, 403]);
  });

  it('refuses the token when none is configured', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'PUT', url: '/apps/library', headers: { 'x-service-token': '' }, payload: library });
    expect(res.statusCode).toBe(403);
  });

  it('turns away manifests it cannot use', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const put = (url: string, payload: object) => app.inject({ method: 'PUT', url, headers: service, payload });
    expect((await put('/apps/library', { ...library, route: 'library' })).statusCode).toBe(400);
    expect((await put('/apps/library', { ...library, extra: true })).statusCode).toBe(400);
    expect((await put('/apps/other', library)).statusCode).toBe(400);
  });

  it('keeps an app’s menu, and turns away items that would open its root', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const menu = [{ label: 'Documents', icon: 'folder', items: [{ label: 'Reports', path: '/reports', detail: 'Updated today' }] }];
    const put = (payload: object) => app.inject({ method: 'PUT', url: '/apps/library', headers: service, payload });
    expect((await put({ ...library, ai: false, menu })).statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: '/manifest', headers: editor })).json()).toContainEqual({ ...library, ai: false, menu });
    expect((await put({ ...library, menu: [{ label: 'Documents', items: [{ label: 'All', path: '/' }] }] })).statusCode).toBe(400);
    expect((await put({ ...library, menu: [{ label: 'Empty', items: [] }] })).statusCode).toBe(400);
    expect((await put({ ...library, menu: [{ label: 'Documents', items: [{ label: 'Reports', path: '/r', colour: 'red' }] }] })).statusCode).toBe(400);
  });

  it('keeps platform apps and taken routes for their owners', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    const put = (payload: object) => app.inject({ method: 'PUT', url: `/apps/${(payload as { id: string }).id}`, headers: service, payload });
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
    await app.inject({ method: 'PUT', url: '/apps/library', headers: service, payload: library });
    await app.inject({ method: 'DELETE', url: '/apps/library', headers: admin });
    expect(entries).toEqual([
      { actor: { id: 'library', kind: 'service' }, app: 'registry', action: 'app.registered', target: 'library', detail: { version: '0.1.0' } },
      { actor: { id: 'u-1', kind: 'user' }, app: 'registry', action: 'app.removed', target: 'library' },
    ]);
  });

  it('still registers the app when the audit log cannot be reached', async () => {
    const app = await buildApp({ serviceToken: 'local-secret', audit: async () => Promise.reject(new Error('events is down')) });
    const res = await app.inject({ method: 'PUT', url: '/apps/library', headers: service, payload: library });
    expect(res.statusCode).toBe(201);
  });

  it('lets an admin remove an app', async () => {
    const app = await buildApp({ serviceToken: 'local-secret' });
    await app.inject({ method: 'PUT', url: '/apps/library', headers: service, payload: library });
    const byService = await app.inject({ method: 'DELETE', url: '/apps/library', headers: service });
    const byAdmin = await app.inject({ method: 'DELETE', url: '/apps/library', headers: admin });
    const gone = await app.inject({ method: 'DELETE', url: '/apps/library', headers: admin });
    expect([byService.statusCode, byAdmin.statusCode, gone.statusCode]).toEqual([403, 204, 404]);
  });
});
