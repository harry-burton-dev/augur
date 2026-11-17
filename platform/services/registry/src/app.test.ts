import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { callerCheckFor, callerHeaders, callerSigner, GATEWAY_CALLER, packFrontend, signedCallerHeaders, type FloorPlace } from '@augur/service-kit';
import { MemoryFrontendFiles, servedEntry } from './frontends.ts';
import type { AppEntry } from './manifest.ts';
import { DATABASE_URL, registryDb } from './db.testing.ts';

const db = registryDb();

const library = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.1.0', sdk: '^1.0.0 || ^2.0.0', handles: ['document.open'] };
const admin = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
/** The same person holding deployment-admin too, which removing apps, pinning and choosing origins need (ADR 0084). */
const deployAdmin = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin', 'deployment-admin'] });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });
// Stands in for Keycloak: "Bearer app-<id>" is that app's token, "Bearer platform-<name>" a platform service's.
const verifyService = async (headers: Record<string, string | string[] | undefined>) => {
  const m = /^Bearer (app|platform)-(\S+)$/.exec(String(headers.authorization ?? ''));
  return m ? (m[1] === 'app' ? { kind: 'app' as const, app: m[2] } : { kind: 'platform' as const, name: m[2] }) : undefined;
};
const as = (client: string) => ({ authorization: `Bearer ${client}` });
const service = as('app-library');

const ids = (body: { id: string }[]) => body.map((a) => a.id);

/** A gzipped tarball packed by GNU tar, not packFrontend, so it can hold what packFrontend refuses. */
const tarOf = (files: { path: string; data: Buffer }[]) => {
  const dir = mkdtempSync(join(tmpdir(), 'frontend-'));
  for (const f of files) writeFileSync(join(dir, f.path), f.data);
  return execFileSync('tar', ['czf', '-', '-C', dir, ...files.map((f) => f.path)]);
};

// The org, Finance with Payroll below it, Legal, and someone's own floor.
const places: Record<string, FloorPlace> = {
  o: { id: 'o', kind: 'org', path: ['o'], org: 'o' },
  f: { id: 'f', kind: 'team', path: ['o', 'f'], org: 'o' },
  p: { id: 'p', kind: 'team', path: ['o', 'f', 'p'], org: 'o' },
  l: { id: 'l', kind: 'team', path: ['o', 'l'], org: 'o' },
  w1: { id: 'w1', kind: 'team', path: ['o', 'w1'], org: 'o' },
  m: { id: 'm', kind: 'personal', path: ['m'], org: 'o' },
};
// Identity answers `org` with the organisation's floor.
const floors = async (id: string) => (id === 'org' ? places.o : places[id]);
/** Someone standing on a floor, as the gateway passes it on. */
const on = (id: string) => callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'], workspace: { id, kind: places[id].kind, role: 'member' } });

describe.runIf(DATABASE_URL)('registry', () => {
  it('reports healthy', async () => {
    const app = await db.app();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('refuses every contract 2 manifest, with a reason, and never marks one kept from before as loading into the shell’s page', async () => {
    const app = await db.app({ verifyService });
    for (const headers of [service, admin, as('platform-updater')]) {
      const refused = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers, payload: library });
      expect(refused.statusCode).toBe(403);
      expect(refused.json()).toMatchObject({ error: 'contract_2', reason: 'contract_2', message: 'Library 0.1.0 speaks contract 2, and this AUGUR serves 3; the app needs a release on contract 3.' });
    }
    // Who may register is checked first: no one else learns anything about the app.
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: editor, payload: library })).json().error).toBe('forbidden');
    expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: admin })).json())).not.toContain('library');

    // One registered before: still listed, so the shell can say why it won't open it.
    await db.seed(library);
    const served = (await app.inject({ method: 'GET', url: '/v1/manifest', headers: admin })).json() as { id: string; inPage?: boolean; contract?: number }[];
    expect(served.find((a) => a.id === 'library')).toMatchObject({ id: 'library' });
    expect(served.find((a) => a.id === 'library')?.inPage).toBeUndefined();
    expect(served.find((a) => a.id === 'home')?.inPage).toBe(true);
    expect(served.find((a) => a.id === 'admin')).toMatchObject({ contract: 3 });
    expect(served.find((a) => a.id === 'admin')?.inPage).toBeUndefined();
  });

  it('hides apps that need a role the caller lacks', async () => {
    const app = await db.app({ verifyService });
    await db.seed({ ...library, requiredRole: 'admin' });
    expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json())).toEqual(['home']);
    expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: admin })).json())).toEqual(['home', 'admin', 'upgrades', 'library']);
  });

  it('offers Admin, with its places, to admins only', async () => {
    const app = await db.app();
    const forAdmin = (await app.inject({ method: 'GET', url: '/v1/manifest', headers: admin })).json();
    expect(ids(forAdmin)).toContain('admin');
    const served = forAdmin.find((a: { id: string }) => a.id === 'admin');
    expect(served.contract).toBe(3);
    expect(served.contributes.places.map((p: { label: string }) => p.label)).toEqual(['People', 'Departments', 'Roles', 'Organisation', 'Apps', 'Activity']);
    expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json())).not.toContain('admin');
  });

  it('shows admins the whole catalogue, and lets them turn an app off and on', async () => {
    const entries: { action: string }[] = [];
    const app = await db.app({ verifyService, audit: async (e) => void entries.push(e) });
    await db.seed(library);
    const patch = (enabled: boolean, headers = admin, id = 'library') => app.inject({ method: 'PATCH', url: `/v1/apps/${id}`, headers, payload: { enabled } });
    expect((await patch(false, editor)).statusCode).toBe(403);
    expect((await patch(false)).json()).toMatchObject({ id: 'library', enabled: false, registeredBy: 'library' });
    expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: admin })).json())).not.toContain('library');
    // A new version leaves it off.
    await db.seed({ ...library, version: '0.2.0' });
    const catalogue = (await app.inject({ method: 'GET', url: '/v1/apps', headers: admin })).json();
    expect(catalogue).toContainEqual(expect.objectContaining({ id: 'library', version: '0.2.0', enabled: false, platform: false }));
    expect(catalogue).toContainEqual(expect.objectContaining({ id: 'admin', platform: true, enabled: true }));
    expect((await app.inject({ method: 'GET', url: '/v1/apps', headers: editor })).statusCode).toBe(403);
    await patch(true);
    expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json())).toContain('library');
    expect((await patch(false, admin, 'admin')).statusCode).toBe(409);
    expect((await patch(false, admin, 'nothing')).statusCode).toBe(404);
    expect(entries.map((e) => e.action)).toEqual(['app.disabled', 'app.enabled']);
  });

  it('tells the gateway how much an app may be sent, which only an admin can lower', async () => {
    const entries: { action: string; detail?: unknown }[] = [];
    const app = await db.app({ verifyService, audit: async (e) => void entries.push(e) });
    const served = async () => (await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json().find((a: { id: string }) => a.id === 'library');
    await db.seed(library);
    expect((await served()).maxUpload).toBe(10);
    await db.seed({ ...library, maxUpload: 200 });
    expect((await served()).maxUpload).toBe(200);
    const limit = (mb: number | null, headers = admin) => app.inject({ method: 'PUT', url: '/v1/apps/library/upload-limit', headers, payload: { mb } });
    expect((await limit(50, editor)).statusCode).toBe(403);
    expect((await limit(500)).statusCode).toBe(400);
    expect((await limit(50)).json()).toMatchObject({ id: 'library', maxUpload: 200, uploadLimit: 50, uploadLimitLowered: true });
    expect((await served()).maxUpload).toBe(50);
    // A new version keeps the admin's limit.
    await db.seed({ ...library, version: '0.2.0', maxUpload: 200 });
    expect((await served()).maxUpload).toBe(50);
    expect((await limit(null)).json().uploadLimit).toBe(200);
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/nothing/upload-limit', headers: admin, payload: { mb: 5 } })).statusCode).toBe(404);
    expect(entries.filter((e) => e.action === 'app.upload-limit-set').map((e) => e.detail)).toEqual([{ mb: 50 }, { mb: null }]);
  });

  it('trusts no service token when it has no way to check one', async () => {
    const app = await db.app();
    const res = await app.inject({ method: 'PUT', url: '/v1/apps/library', headers: service, payload: library });
    expect(res.statusCode).toBe(403);
  });

  it('turns away manifests it cannot use', async () => {
    const app = await db.app({ verifyService });
    const put = (url: string, payload: object) => app.inject({ method: 'PUT', url, headers: service, payload });
    expect((await put('/v1/apps/library', { ...library, route: 'library' })).statusCode).toBe(400);
    expect((await put('/v1/apps/library', { ...library, extra: true })).statusCode).toBe(400);
  });

  it('serves its API under /v1 only', async () => {
    const app = await db.app();
    expect((await app.inject({ method: 'GET', url: '/v1/manifest' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/manifest' })).statusCode).toBe(404);
  });

  it('records who changed the catalogue in the audit log', async () => {
    const entries: unknown[] = [];
    const app = await db.app({ verifyService, audit: async (e) => void entries.push(e) });
    await db.seed(library);
    await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: deployAdmin });
    expect(entries).toEqual([{ actor: { id: 'u-1', kind: 'user' }, app: 'registry', action: 'app.removed', target: 'library' }]);
  });

  it('lets admins see an app’s versions, roll it back and hold it there, then let it go', async () => {
    const entries: { action: string; detail?: unknown }[] = [];
    const app = await db.app({ verifyService, audit: async (e) => void entries.push(e) });
    const register = (version: string) => db.seed({ ...library, version });
    await register('0.1.0');
    await register('0.2.0');
    const versions = await app.inject({ method: 'GET', url: '/v1/apps/library/versions', headers: admin });
    expect(versions.json().map((v: { version: string; serving: boolean }) => [v.version, v.serving])).toEqual([
      ['0.2.0', true],
      ['0.1.0', false],
    ]);
    const back = await app.inject({ method: 'PUT', url: '/v1/apps/library/pin', headers: deployAdmin, payload: { version: '0.1.0' } });
    expect(back.json()).toMatchObject({ version: '0.1.0', pinnedVersion: '0.1.0', platform: false });
    await register('0.3.0');
    expect((await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json().find((a: { id: string }) => a.id === 'library').version).toBe('0.1.0');
    const free = await app.inject({ method: 'DELETE', url: '/v1/apps/library/pin', headers: deployAdmin });
    expect(free.json()).toMatchObject({ version: '0.3.0' });
    expect(free.json().pinnedVersion).toBeUndefined();
    expect(entries.map((e) => [e.action, e.detail])).toEqual([
      ['app.pinned', { version: '0.1.0' }],
      ['app.unpinned', { version: '0.3.0' }],
    ]);
  });

  it('keeps versions to admins, and platform apps out of it', async () => {
    const app = await db.app({ verifyService });
    await db.seed(library);
    expect((await app.inject({ method: 'GET', url: '/v1/apps/library/versions', headers: editor })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/library/pin', headers: editor, payload: { version: '0.1.0' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/library/pin', headers: deployAdmin, payload: { version: '7.0.0' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: '/v1/apps/home/pin', headers: deployAdmin, payload: { version: '0.1.0' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'GET', url: '/v1/apps/nothing/versions', headers: admin })).statusCode).toBe(404);
  });

  it('keeps removing apps, pinning and choosing origins to deployment admins, and says so to a plain admin (ADR 0084)', async () => {
    const app = await db.app({ verifyService });
    await db.seed(library);
    const origin = encodeURIComponent('https://apps.example.org');
    for (const call of [
      { method: 'DELETE', url: '/v1/apps/library' },
      { method: 'PUT', url: '/v1/apps/library/pin', payload: { version: '0.1.0' } },
      { method: 'DELETE', url: '/v1/apps/library/pin' },
      { method: 'POST', url: '/v1/origins', payload: { origin: 'https://apps.example.org' } },
      { method: 'DELETE', url: `/v1/origins/${origin}` },
    ] as const) {
      const res = await app.inject({ ...call, headers: admin });
      expect(res.statusCode, `${call.method} ${call.url}`).toBe(403);
      expect(res.json()).toMatchObject({ requiredRole: 'deployment-admin', message: expect.stringMatching(/^Only a deployment admin can/) });
    }
  });

  it('refuses a frontend from an app an admin removed, whose sign-in outlives it', async () => {
    const app = await db.app({ verifyService, frontendFiles: new MemoryFrontendFiles() });
    await db.seed(library);
    expect((await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: deployAdmin })).statusCode).toBe(204);
    const body = packFrontend([{ path: 'entry.js', data: Buffer.from('x') }]);
    const res = await app.inject({ method: 'PUT', url: '/v1/apps/library/versions/0.2.0/frontend', headers: { ...service, 'content-type': 'application/gzip' }, payload: body });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toMatch(/An admin removed library/);
  });

  it('tells only identity what it keeps about a person', async () => {
    const app = await db.app({ verifyService });
    await db.store.requestUpgrade({ id: 'up-1', from: '0.2.0', version: '0.3.0', images: {}, requestedBy: 'u-1', requestedByName: 'Alex' });
    const read = (headers: Record<string, string>) => app.inject({ method: 'GET', url: '/v1/people/u-1/data', headers });
    expect((await read(as('platform-events'))).statusCode).toBe(403);
    expect((await read(as('platform-identity'))).json().upgrades).toEqual([expect.objectContaining({ id: 'up-1', requestedByName: 'Alex' })]);
  });

  it('keeps each version’s frontend and points the shell at that version’s own copy', async () => {
    const entries: { action: string }[] = [];
    const frontendFiles = new MemoryFrontendFiles();
    const app = await db.app({ verifyService, frontendFiles, audit: async (e) => void entries.push(e) });
    const tarball = (text: string) => packFrontend([{ path: 'entry.js', data: Buffer.from(text) }, { path: 'assets/a.js', data: Buffer.from('export {};') }]);
    const give = (version: string, body: Buffer, headers: Record<string, string> = service, id = 'library') =>
      app.inject({ method: 'PUT', url: `/v1/apps/${id}/versions/${version}/frontend`, headers: { ...headers, 'content-type': 'application/gzip' }, payload: body });
    const served = async () => (await app.inject({ method: 'GET', url: '/v1/manifest', headers: editor })).json().find((a: { id: string }) => a.id === 'library');

    // Given before the version registers, so the shell never gets a version whose code isn't there.
    // Each build is in a folder of its own: the version and the start of its digest.
    const first = await give('0.1.0', tarball('one'));
    expect(first.statusCode).toBe(201);
    const one = `/apps/library/${first.json().folder}/`;
    expect(one).toMatch(/^\/apps\/library\/0\.1\.0_[0-9a-f]{12}\/$/);
    expect(frontendFiles.objects.get(`${one.slice(1)}entry.js`)?.toString()).toBe('one');
    await db.seed(library);
    expect((await served()).entry).toBe(`${one}entry.js`);

    // The same files again (every restart) change nothing. A new build of the same version (a dev
    // build, or a pillar rebuilt with a newer kit) takes its place, at an address no browser has kept.
    expect((await give('0.1.0', tarball('one'))).statusCode).toBe(200);
    const rebuilt = await give('0.1.0', tarball('changed'));
    expect(rebuilt.statusCode).toBe(201);
    const changed = `/apps/library/${rebuilt.json().folder}/`;
    expect(changed).not.toBe(one);
    expect(frontendFiles.objects.get(`${changed.slice(1)}entry.js`)?.toString()).toBe('changed');
    expect((await served()).entry).toBe(`${changed}entry.js`);
    expect((await give('0.1.0', tarball('one'), as('app-other'))).statusCode).toBe(403);
    expect((await give('0.1.0', tarball('one'), editor)).statusCode).toBe(403);
    expect((await give('next', tarball('one'))).statusCode).toBe(400);
    expect((await give('0.1.0', tarball('one'), admin, 'home')).statusCode).toBe(409);
    expect((await give('0.3.0', Buffer.from('not a tarball'))).statusCode).toBe(400);

    // A version without a kept frontend is served from its manifest's entry as before.
    await db.seed({ ...library, version: '0.2.0' });
    expect((await served()).entry).toBe('/apps/library/entry.js');
    const two = `/apps/library/${(await give('0.2.0', tarball('two'))).json().folder}/`;
    expect((await served()).entry).toBe(`${two}entry.js`);

    // Holding the app at an older version now holds its code too, and admins see each version's address.
    await app.inject({ method: 'PUT', url: '/v1/apps/library/pin', headers: deployAdmin, payload: { version: '0.1.0' } });
    expect((await served()).entry).toBe(`${changed}entry.js`);
    const versions = (await app.inject({ method: 'GET', url: '/v1/apps/library/versions', headers: admin })).json();
    expect(versions.map((v: { entry: { entry: string } }) => v.entry.entry)).toEqual([`${two}entry.js`, `${changed}entry.js`]);

    // An entry that isn't in the frontend it gave is served as registered.
    await app.inject({ method: 'DELETE', url: '/v1/apps/library/pin', headers: deployAdmin });
    await db.seed({ ...library, version: '0.2.0', entry: '/apps/library/main.js' });
    expect((await served()).entry).toBe('/apps/library/main.js');
    expect(entries.filter((e) => e.action === 'app.frontend-published')).toHaveLength(3);
  });

  it('refuses a frontend holding a page or an SVG, which could run as the shell’s own page, and keeps none of it', async () => {
    const frontendFiles = new MemoryFrontendFiles();
    const app = await db.app({ verifyService, frontendFiles });
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>fetch("/x?" + sessionStorage.length)</script></svg>');
    for (const [path, data] of [['icon.svg', svg], ['index.html', Buffer.from('<script>alert(1)</script>')]] as const) {
      // Packed by hand, as packFrontend now refuses it too.
      const res = await app.inject({ method: 'PUT', url: '/v1/apps/library/versions/0.1.0/frontend', headers: { ...service, 'content-type': 'application/gzip' }, payload: tarOf([{ path: 'entry.js', data: Buffer.from('') }, { path, data }]) });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(new RegExp(`"${path.replace('.', '\\.')}" is a \\.${path.split('.').pop()} file.*\\.js, \\.mjs, \\.css`));
    }
    expect(frontendFiles.objects.size).toBe(0);
  });

  it('still serves a frontend kept before builds had folders from its version’s own', () => {
    const kept = [{ app: 'library', version: '0.1.0', digest: 'sha256:a', files: ['entry.js'], bytes: 1, publishedBy: 'library', publishedAt: '' }];
    expect(servedEntry({ ...library, entry: '/apps/library/entry.js' }, kept).entry).toBe('/apps/library/0.1.0/entry.js');
  });

  it('says so when the deployment doesn’t keep frontends', async () => {
    const app = await db.app({ verifyService });
    const res = await app.inject({ method: 'PUT', url: '/v1/apps/library/versions/0.1.0/frontend', headers: { ...service, 'content-type': 'application/gzip' }, payload: packFrontend([{ path: 'entry.js', data: Buffer.from('x') }]) });
    expect(res.statusCode).toBe(501);
  });

  it('tells the gateway where each app’s service is, as set by what runs it or an admin', async () => {
    const entries: { action: string; actor: { id: string } }[] = [];
    const app = await db.app({ verifyService, audit: async (e) => void entries.push(e) });
    await db.seed(library);
    const set = (url: string | null, headers: Record<string, string> = as('platform-updater'), id = 'library') =>
      app.inject({ method: 'PUT', url: `/v1/apps/${id}/upstream`, headers, payload: { url } });
    const upstreams = (headers: Record<string, string> = callerHeaders(GATEWAY_CALLER)) => app.inject({ method: 'GET', url: '/v1/upstreams', headers });

    expect((await upstreams()).json()).toEqual({ apps: {}, previews: {} });
    expect((await set('http://app-library:8090/')).json()).toMatchObject({ id: 'library', upstream: 'http://app-library:8090' });
    expect((await upstreams()).json()).toEqual({ apps: { library: 'http://app-library:8090' }, previews: {} });
    expect((await upstreams(admin)).statusCode).toBe(200);
    expect((await upstreams(editor)).statusCode).toBe(403);

    // Never the app itself, nor anyone else; never the platform's own parts.
    expect((await set('http://evil:1', service)).statusCode).toBe(403);
    expect((await set('http://evil:1', editor)).statusCode).toBe(403);
    for (const bad of ['http://identity:8081', 'http://identity.:8081', 'http://platform-identity-1:8081', 'http://127.0.0.2:80', 'http://0.0.0.0:80', 'http://keycloak:8080', 'ftp://x:1', 'http://u:p@x:1', 'http://x:1/path', 'nonsense']) expect((await set(bad)).statusCode).toBe(400);
    expect((await set('http://app-x:1', admin, 'home')).statusCode).toBe(409);
    expect((await set('http://app-x:1', admin, 'nothing')).statusCode).toBe(404);

    // A new version keeps it; null forgets it.
    await db.seed({ ...library, version: '0.2.0' });
    expect((await upstreams()).json()).toEqual({ apps: { library: 'http://app-library:8090' }, previews: {} });
    await set(null, admin);
    expect((await upstreams()).json()).toEqual({ apps: {}, previews: {} });
    expect(entries.filter((e) => e.action.startsWith('app.upstream')).map((e) => [e.action, e.actor.id])).toEqual([
      ['app.upstream-set', 'updater'],
      ['app.upstream-cleared', 'u-1'],
    ]);
  });

  it('lets an admin remove an app', async () => {
    const app = await db.app({ verifyService });
    await db.seed(library);
    const byService = await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: service });
    const byAdmin = await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: deployAdmin });
    const gone = await app.inject({ method: 'DELETE', url: '/v1/apps/library', headers: deployAdmin });
    expect([byService.statusCode, byAdmin.statusCode, gone.statusCode]).toEqual([403, 204, 404]);
  });

  describe('where apps may load from', () => {
    const elsewhere = { ...library, entry: 'https://apps.example.org/library/entry.js' };
    const allow = (app: Awaited<ReturnType<typeof buildApp>>, origin: string, headers = deployAdmin) => app.inject({ method: 'POST', url: '/v1/origins', headers, payload: { origin } });

    it('lets a deployment admin allow an origin, and audits the choice', async () => {
      const entries: { action: string; target?: string }[] = [];
      const app = await db.app({ verifyService, audit: async (e) => void entries.push(e) });
      expect((await allow(app, 'https://apps.example.org', editor)).statusCode).toBe(403);
      expect((await allow(app, 'http://apps.example.org')).json().message).toMatch(/HTTPS/);
      expect((await allow(app, 'https://apps.example.org/library')).json().message).toMatch(/without a path/);
      const added = await allow(app, 'https://apps.example.org/');
      expect(added.statusCode).toBe(201);
      expect(added.json()).toMatchObject({ origin: 'https://apps.example.org', addedBy: 'u-1' });
      expect((await app.inject({ method: 'GET', url: '/v1/origins', headers: admin })).json().map((o: { origin: string }) => o.origin)).toEqual(['https://apps.example.org']);
      expect(entries.filter((e) => e.action.startsWith('origin.'))).toEqual([expect.objectContaining({ action: 'origin.allowed', target: 'https://apps.example.org' })]);
    });

    it('stops offering apps from an origin that is no longer allowed', async () => {
      const app = await db.app({ verifyService });
      await allow(app, 'https://apps.example.org');
      await db.seed(elsewhere);
      expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: admin })).json())).toContain('library');
      const removed = await app.inject({ method: 'DELETE', url: `/v1/origins/${encodeURIComponent('https://apps.example.org')}`, headers: deployAdmin });
      expect(removed.statusCode).toBe(204);
      expect(ids((await app.inject({ method: 'GET', url: '/v1/manifest', headers: admin })).json())).not.toContain('library');
      const catalogue = (await app.inject({ method: 'GET', url: '/v1/apps', headers: admin })).json();
      expect(catalogue.find((a: { id: string }) => a.id === 'library').blocked).toMatch(/isn't a place apps are allowed/);
      expect((await app.inject({ method: 'DELETE', url: `/v1/origins/${encodeURIComponent('https://apps.example.org')}`, headers: deployAdmin })).statusCode).toBe(404);
    });
  });

  describe('apps signed in as themselves', () => {
    it('lets an app register only itself', async () => {
      const app = await db.app({ verifyService });
      const other = await app.inject({ method: 'PUT', url: '/v1/apps/board', headers: as('app-library'), payload: { ...library, id: 'board', route: '/board' } });
      expect(other.statusCode).toBe(403);
      expect(other.json().message).toMatch(/library can only register itself/);
    });

    it('tells platform services which inbox kinds an app declares', async () => {
      const app = await db.app({ verifyService, floors });
      await db.seed({ ...library, scopes: ['inbox:write'], inbox: { kinds: [{ id: 'review', label: 'To review', icon: 'document' }] } });
      const grants = await app.inject({ method: 'GET', url: '/v1/apps/library/grants?workspace=w1', headers: as('platform-events') });
      expect(grants.json().inboxKinds).toEqual(['review']);
    });

    it('tells platform services which notification kinds an app declares', async () => {
      const app = await db.app({ verifyService, floors });
      await db.seed({ ...library, scopes: ['notifications:send'], notifications: { kinds: [{ id: 'comment', label: 'Comments on your documents', detail: 'When someone comments on one you own' }] } });
      const grants = await app.inject({ method: 'GET', url: '/v1/apps/library/grants?workspace=w1', headers: as('platform-events') });
      expect(grants.json().notificationKinds).toEqual(['comment']);
    });

    it('lists no entity links, now the binding events are gone (D6)', async () => {
      const app = await db.app({ verifyService });
      await db.seed({ ...library, links: { entities: true }, bindings: ['record'] });
      expect((await app.inject({ method: 'GET', url: '/v1/entity-links', headers: as('app-atlas') })).statusCode).toBe(404);
    });

    it('tells platform services which apps are granted a scope', async () => {
      const app = await db.app({ verifyService, floors });
      await db.seed({ ...library, scopes: ['events:subscribe'] });
      await db.seed({ ...library, id: 'atlas', name: 'Atlas', route: '/atlas', entry: '/apps/atlas/entry.js', scopes: ['notifications:send'] });
      const listed = (headers: Record<string, string>) => app.inject({ method: 'GET', url: '/v1/scopes/events:subscribe/apps', headers });
      expect((await listed(as('platform-events'))).json()).toEqual([{ app: 'library', name: library.name, enabled: true }]);
      expect((await listed(as('app-library'))).statusCode).toBe(403);
      expect((await listed(admin)).statusCode).toBe(403);
      // Turned off, it is still listed, so the events service keeps its place for when it is turned on again.
      await app.inject({ method: 'PATCH', url: '/v1/apps/library', headers: admin, payload: { enabled: false } });
      expect((await listed(as('platform-events'))).json()).toEqual([{ app: 'library', name: library.name, enabled: false }]);
      // The grant withdrawn, it is gone from the list.
      await app.inject({ method: 'PUT', url: '/v1/apps/library/scopes', headers: admin, payload: { scopes: [] } });
      expect((await listed(as('platform-events'))).json()).toEqual([]);
    });

    it('tells platform services what an app is granted, and nothing once it is off', async () => {
      const app = await db.app({ verifyService, floors });
      await db.seed({ ...library, scopes: ['notifications:send'] });
      const grants = (headers: Record<string, string>) => app.inject({ method: 'GET', url: '/v1/apps/library/grants?workspace=w1', headers });
      expect((await grants(as('platform-events'))).json()).toEqual({ app: 'library', name: library.name, workspace: 'w1', on: true, floorKind: 'team', scopes: ['notifications:send'], inboxKinds: [], notificationKinds: [], requiredRole: null });
      // The gateway asks as itself, to admit the app's own token (contract 3).
      expect((await grants(callerHeaders(GATEWAY_CALLER))).json()).toMatchObject({ app: 'library', on: true, scopes: ['notifications:send'] });
      expect((await grants(as('app-library'))).statusCode).toBe(403);
      expect((await grants(admin)).statusCode).toBe(403);
      await app.inject({ method: 'PATCH', url: '/v1/apps/library', headers: admin, payload: { enabled: false } });
      expect((await grants(as('platform-events'))).json()).toMatchObject({ on: false, scopes: [] });
      expect((await app.inject({ method: 'GET', url: '/v1/apps/nope/grants', headers: as('platform-events') })).statusCode).toBe(404);
    });

    it('gives AUGUR’s own frontends their platform scopes, and no app from anywhere else', async () => {
      const app = await db.app({ verifyService, floors });
      const grants = async (id: string) => (await app.inject({ method: 'GET', url: `/v1/apps/${id}/grants?workspace=w1`, headers: callerHeaders(GATEWAY_CALLER) })).json();
      expect(await grants('upgrades')).toMatchObject({ app: 'upgrades', on: true, scopes: ['people:read'], platformScopes: ['deployment:upgrade', 'deployment:apps', 'deployment:health', 'deployment:settings'] });
      expect((await grants('admin')).platformScopes).toEqual(['people:manage', 'apps:manage', 'org:manage', 'audit:read']);
      await db.seed({ ...library, scopes: ['notifications:send'] });
      expect(await grants('library')).not.toHaveProperty('platformScopes');
    });

    it('tells platform services the role an app needs, for the services a person reaches it through', async () => {
      const app = await db.app({ verifyService, floors });
      await db.seed({ ...library, requiredRole: 'analyst' });
      expect((await app.inject({ method: 'GET', url: '/v1/apps/library/grants?workspace=w1', headers: as('platform-models') })).json().requiredRole).toBe('analyst');
    });
  });

  describe('an app’s own settings', () => {
    const retention = { id: 'retentionDays', label: 'Keep deleted documents for', type: 'integer', unit: 'days', min: 1, max: 365, default: 30 };
    const withSettings = { ...library, settings: [retention] };

    it('lets admins set them and the app read them, with defaults until then, all on the record', async () => {
      const entries: { action: string; detail?: unknown }[] = [];
      const app = await db.app({ verifyService, audit: async (e) => void entries.push(e) });
      await db.seed(withSettings);
      const read = (headers: Record<string, string>) => app.inject({ method: 'GET', url: '/v1/apps/library/settings', headers });
      const set = (value: number | null, headers = admin, setting = 'retentionDays') => app.inject({ method: 'PUT', url: `/v1/apps/library/settings/${setting}`, headers, payload: { value } });

      expect((await read(service)).json()).toEqual({ settings: [{ ...retention, value: 30 }] });
      expect((await read(as('app-board'))).statusCode).toBe(403);
      expect((await read(editor)).statusCode).toBe(403);
      expect((await set(90, editor)).statusCode).toBe(403);
      expect((await set(900)).json().message).toBe('Keep deleted documents for is 1 to 365 days.');
      expect((await set(5, admin, 'nothing')).statusCode).toBe(404);
      expect((await set(90)).json().settings[0]).toMatchObject({ id: 'retentionDays', value: 90, setBy: 'u-1' });
      // A new version keeps it; one that narrows the range past it falls back to its default.
      await db.seed({ ...withSettings, version: '0.2.0' });
      expect((await read(service)).json().settings[0].value).toBe(90);
      await db.seed({ ...withSettings, version: '0.3.0', settings: [{ ...retention, max: 60 }] });
      expect((await read(admin)).json().settings[0]).toEqual({ ...retention, max: 60, value: 30 });
      expect((await set(null)).json().settings[0].value).toBe(30);
      expect(entries.filter((e) => e.action === 'app.setting-changed').map((e) => e.detail)).toEqual([
        { setting: 'retentionDays', label: 'Keep deleted documents for', value: 90, unit: 'days' },
        { setting: 'retentionDays', label: 'Keep deleted documents for', value: null, unit: 'days' },
      ]);
    });
  });

  describe('kinds of app (ADR 0077)', () => {
    const manifestFor = (id: string, name: string, category?: string) => ({ ...library, id, name, route: `/${id}`, entry: `/apps/${id}/entry.js`, handles: [], ...(category ? { category } : {}) });

    it('reports the kind in force: its own apps and feed apps’ claims, and no one else’s', async () => {
      const store = db.store;
      // Mandate came from the signed app feed, through the app runner.
      const release = { schema: 'augur.app-release/v1' as const, id: 'mandate', version: '0.1.0', channel: 'stable', manifest: manifestFor('mandate', 'Mandate', 'pillar') as AppEntry, service: null, frontend: null, signer: { repository: 'r', workflow: 'w' } };
      await store.requestAppJob({ id: 'j1', app: 'mandate', action: 'install', release, requestedBy: 'u-1' });
      await store.progressAppJob('j1', { step: 'switch', state: 'done' }, { state: 'done' });
      const app = await db.app({ verifyService, floors, store });
      await db.seed(manifestFor('mandate', 'Mandate', 'pillar'));
      await db.seed(manifestFor('rogue', 'Rogue', 'platform'));

      type Row = { id: string; category?: string; ships?: boolean; pillar?: boolean; categoryRefused?: { asked: string } };
      const kinds = (rows: Row[]) => Object.fromEntries(rows.map((a) => [a.id, a.category]));
      const manifest: Row[] = (await app.inject({ method: 'GET', url: '/v1/manifest', headers: admin })).json();
      expect(kinds(manifest)).toEqual({ home: 'platform', admin: 'platform', upgrades: 'platform', mandate: 'pillar', rogue: undefined });
      const mine: Row[] = (await app.inject({ method: 'GET', url: '/v1/me/apps?workspace=f', headers: on('f') })).json().apps;
      expect(kinds(mine)).toEqual({ home: 'platform', admin: 'platform', upgrades: 'platform', mandate: 'pillar', rogue: undefined });
      const catalogue: Row[] = (await app.inject({ method: 'GET', url: '/v1/apps', headers: admin })).json();
      expect(kinds(catalogue)).toEqual(kinds(manifest));
      expect(catalogue.find((a) => a.id === 'rogue')?.categoryRefused).toMatchObject({ asked: 'platform' });
      expect(catalogue.find((a) => a.id === 'mandate')?.categoryRefused).toBeUndefined();
      // No app ships with AUGUR (ADR 0075), so neither `ships` nor its old name `pillar` is ever set.
      for (const rows of [mine, catalogue]) expect(rows.filter((a) => a.ships || a.pillar)).toEqual([]);
    });
  });

  describe('floor by floor', () => {
    const setup = async (payload: object = library) => {
      const entries: { action: string; detail?: unknown }[] = [];
      const app = await db.app({ verifyService, floors, audit: async (e) => void entries.push(e) });
      await db.seed(payload);
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

    it('tells someone every app and why it is or isn’t theirs on their floor', async () => {
      const { app, set } = await setup();
      await db.seed({ ...library, id: 'notes', name: 'Notes', route: '/notes', entry: '/apps/notes/entry.js', floors: ['personal'] });
      await db.seed({ ...library, id: 'ledger', name: 'Ledger', route: '/ledger', entry: '/apps/ledger/entry.js', requiredRole: 'finance' });
      await set('f', 'blocked');
      const explain = async (workspace: string) => (await app.inject({ method: 'GET', url: `/v1/me/apps?workspace=${workspace}`, headers: on(workspace) })).json();
      const onP = await explain('p');
      const byId = Object.fromEntries(onP.apps.map((a: { id: string }) => [a.id, a]));
      expect(byId.library.state).toEqual({ on: false, why: 'blocked', by: 'f', setBy: 'u-1', setAt: expect.any(String) });
      expect(byId.notes.state).toEqual({ on: false, why: 'not-for-this-kind' });
      expect(byId.notes.floors).toEqual(['personal']);
      // A role keeps it from them, and it says so rather than vanishing.
      expect(byId.ledger).toMatchObject({ state: { on: true, why: 'approved' }, requiredRole: 'finance', hasRole: false });
      expect(byId.home.state).toEqual({ on: true, why: 'platform' });
      expect((await explain('l')).apps.find((a: { id: string }) => a.id === 'library').state).toEqual({ on: true, why: 'approved' });
      expect((await app.inject({ method: 'GET', url: '/v1/me/apps?workspace=l', headers: on('f') })).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: '/v1/me/apps?workspace=l' })).statusCode).toBe(401);
    });

    it('can’t answer for a floor without identity', async () => {
      const app = await db.app({ verifyService });
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

    it('checks a call that names no floor on the organisation’s', async () => {
      const { app, set } = await setup({ ...library, scopes: ['notifications:send'] });
      const unnamed = async () => (await app.inject({ method: 'GET', url: '/v1/apps/library/grants', headers: as('platform-events') })).json();
      // No `contract`: the gateway signs a plain call to a contract 2 app's part for its id, keyed on the absence.
      expect(await unnamed()).toEqual({ app: 'library', name: 'Library', on: true, workspace: 'o', floorKind: 'org', scopes: ['notifications:send'], inboxKinds: [], notificationKinds: [], requiredRole: null });
      // Off for the organisation but on for one team: naming no floor no longer gets it through.
      await set('o', 'off');
      await set('f', 'on');
      expect((await unnamed()).scopes).toEqual([]);
      expect((await app.inject({ method: 'GET', url: '/v1/apps/library/grants?workspace=f', headers: as('platform-events') })).json().scopes).toEqual(['notifications:send']);
    });

    it('holds back scopes a new version asks for until an admin grants them', async () => {
      const { app, entries } = await setup({ ...library, scopes: ['notifications:send'] });
      await db.seed({ ...library, version: '0.2.0', scopes: ['notifications:send', 'audit:write'] });
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

    it('refuses an admin’s call made for an app on what only an admin may do, unless it is one of AUGUR’s own frontends', async () => {
      const { app, set } = await setup({ ...library, scopes: ['notifications:send'] });
      const forApp = (app: string, scopes: string[]) => callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin', 'deployment-admin'], app, scopes });
      const asLibrary = forApp('library', ['notifications:send']);
      const tries = [
        { method: 'PUT', url: '/v1/apps/library/scopes', payload: { scopes: ['notifications:send', 'audit:write'] } },
        { method: 'PATCH', url: '/v1/apps/library', payload: { enabled: false } },
        { method: 'PUT', url: '/v1/apps/library/pin', payload: { version: '0.1.0' } },
        { method: 'PUT', url: '/v1/apps/library/upload-limit', payload: { mb: 1 } },
        { method: 'PUT', url: '/v1/apps/library/upstream', payload: { url: 'http://elsewhere:3000' } },
        { method: 'PUT', url: '/v1/apps/library', payload: { ...library, scopes: ['notifications:send', 'audit:write'] } },
        { method: 'DELETE', url: '/v1/apps/library' },
        { method: 'GET', url: '/v1/apps' },
      ] as const;
      for (const t of tries) expect((await app.inject({ ...t, headers: asLibrary })).statusCode, `${t.method} ${t.url}`).toBe(403);
      expect((await set('f', 'on', asLibrary)).statusCode).toBe(403);
      const ownFrontend = await app.inject({ method: 'PUT', url: '/v1/apps/library/scopes', headers: forApp('admin', ['apps:manage']), payload: { scopes: ['notifications:send'] } });
      expect(ownFrontend.statusCode).toBe(200);
    });

    it('believes no caller headers but the gateway’s signed caller, once it checks callers', async () => {
      const gateway = callerSigner();
      const app = await db.app({ verifyService, callers: callerCheckFor(gateway, 'registry') });
      const grant = (headers: Record<string, string>) => app.inject({ remoteAddress: '172.18.0.9', method: 'PUT', url: '/v1/apps/library/scopes', headers, payload: { scopes: [] } });
      expect((await grant(deployAdmin)).statusCode).toBe(403);
      const forged = await grant({ ...(await signedCallerHeaders(gateway, { id: 'u-1', name: 'Alex', departments: [], roles: ['admin'], app: 'library', scopes: [] }, 'registry')), 'x-augur-acting-scopes': 'apps:manage' });
      expect(forged.statusCode).toBe(403);
    });
  });
});
