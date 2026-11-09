// P2b's acceptance (spec 3.3, 9.4, 9.6): the registry takes a contract 3 manifest only from a release it handed
// the runner, serves it to the shell as the manifest in force, and reads a release file an admin pastes.
import { describe, expect, it } from 'vitest';
import { callerHeaders, type FloorPlace } from '@augur/service-kit';
import { DATABASE_URL, registryDb } from './db.testing.ts';
import { releaseOf } from './release3.testing.ts';

const db = registryDb();

const verifyService = async (headers: Record<string, string | string[] | undefined>) => {
  const m = /^Bearer (app|platform)-(\S+)$/.exec(String(headers.authorization ?? ''));
  return m ? (m[1] === 'app' ? { kind: 'app' as const, app: m[2] } : { kind: 'platform' as const, name: m[2] }) : undefined;
};
const as = (client: string) => ({ authorization: `Bearer ${client}` });
const runner = as('platform-updater');
const fresh = () => callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin', 'deployment-admin'], signedInAt: new Date().toISOString() });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });
const places: Record<string, FloorPlace> = {
  o: { id: 'o', kind: 'org', path: ['o'], org: 'o' },
  t: { id: 't', kind: 'team', path: ['o', 't'], org: 'o' },
};
const floors = async (id: string) => (id === 'org' ? places.o : places[id]);
const onTeam = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'], workspace: { id: 't', kind: 'team', role: 'member' } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const setup = async (more: Parameters<typeof db.app>[0] = {}) => {
  const server = await db.app({ verifyService, floors, ...more });
  /** An admin asks for `release`; the runner takes the job and starts it, as it does before it registers. */
  const install = async (release: ReturnType<typeof releaseOf>, outcome?: 'done') => {
    const job = (await server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fresh(), payload: { action: 'install', release } })).json();
    await server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: runner });
    await server.inject({ method: 'POST', url: `/v1/app-runner/jobs/${job.id}/progress`, headers: runner, payload: { step: 'verify', state: 'done', ...(outcome ? { outcome } : {}) } });
    return job;
  };
  const register = (manifest: object, headers: Record<string, string> = as('app-notes')) => server.inject({ method: 'PUT', url: '/v1/apps/notes', headers, payload: manifest });
  const catalogue = async (headers = editor) => (await server.inject({ method: 'GET', url: '/v1/manifest', headers })).json() as Record<string, unknown>[];
  return { server, install, register, catalogue };
};

describe.runIf(DATABASE_URL)('an app on contract 3 in the catalogue', () => {
  it('is taken only as the manifest of a release this registry handed the runner', async () => {
    const t = await setup();
    const release = releaseOf('notes', '1.2.0');
    const before = await t.register(release.manifest);
    expect(before.statusCode).toBe(403);
    expect(before.json().message).toBe('Notes 1.2.0 is installed from the app feed, through Admin → Apps: only a release the app runner was given can register it.');
    await t.install(release);
    // Anything else in it, such as one more scope, is not what an admin agreed to.
    expect((await t.register({ ...release.manifest, scopes: [...release.manifest.scopes!, 'models:use'] })).statusCode).toBe(403);
    expect((await t.register(release.manifest, as('app-other'))).statusCode).toBe(403);
    expect((await t.register(release.manifest)).statusCode).toBe(201);
    expect((await t.register(release.manifest)).statusCode).toBe(200);
  });

  it('takes the version it goes back to, which it installed before', async () => {
    const t = await setup();
    const old = releaseOf('notes', '1.1.0');
    await t.install(old, 'done');
    await t.install(releaseOf('notes', '1.2.0'));
    expect((await t.register(old.manifest)).statusCode).toBe(201);
  });

  it('refuses a manifest that fails its schema, saying where', async () => {
    const t = await setup();
    const res = await t.register({ ...releaseOf('notes', '1.2.0').manifest, colour: 'red' });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/colour/);
  });

  it('serves the shell the manifest in force, filled in with maxUpload, previewsOn and its contract', async () => {
    const t = await setup();
    const release = releaseOf('notes', '1.2.0');
    await t.install(release);
    await t.register(release.manifest);
    const notes = (await t.catalogue()).find((a) => a.id === 'notes')!;
    expect(notes).toMatchObject({ contract: 3, id: 'notes', name: 'Notes', version: '1.2.0', maxUpload: 25, frontend: { entry: 'sandbox.js' }, floors: ['personal', 'team', 'org'] });
    expect(notes.contributes).toEqual(release.manifest.contributes);
    // Nothing of contract 2's: the shell draws it from the manifest alone.
    expect(notes).not.toHaveProperty('route');
    expect(notes).not.toHaveProperty('sdk');
    // An admin's lower upload limit is the one in force.
    await t.server.inject({ method: 'PUT', url: '/v1/apps/notes/upload-limit', headers: fresh(), payload: { mb: 5 } });
    expect((await t.catalogue()).find((a) => a.id === 'notes')!.maxUpload).toBe(5);
  });

  it('is on only on the kinds of floor its manifest names', async () => {
    const t = await setup();
    const release = releaseOf('notes', '1.2.0', { floors: ['personal'] });
    await t.install(release);
    await t.register(release.manifest);
    const res = await t.server.inject({ method: 'GET', url: '/v1/manifest?workspace=t', headers: onTeam });
    expect(res.json().map((a: { id: string }) => a.id)).not.toContain('notes');
  });

  it('answers its grants and kinds to AUGUR’s services, from the manifest', async () => {
    const t = await setup();
    const release = releaseOf('notes', '1.2.0');
    await t.install(release);
    await t.register(release.manifest);
    const grants = (await t.server.inject({ method: 'GET', url: '/v1/apps/notes/grants', headers: as('platform-events') })).json();
    expect(grants).toMatchObject({ app: 'notes', name: 'Notes', on: true, scopes: release.manifest.scopes, notificationKinds: ['shared'], inboxKinds: [] });
    const admins = (await t.server.inject({ method: 'GET', url: '/v1/apps', headers: fresh() })).json();
    expect(admins).toContainEqual(expect.objectContaining({ id: 'notes', contract: 3, grantedScopes: release.manifest.scopes }));
  });
});

describe.runIf(DATABASE_URL)('a release file an admin pastes the address of', () => {
  const release = releaseOf('maps', '2.0.0', { name: 'Maps' });
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === 'https://apps.example.org/maps/app-release.json') return json(release);
    if (url === 'https://apps.example.org/old/app-release.json') return json({ schema: 'augur.app-release/v1', id: 'old', version: '1.0.0', manifest: { id: 'old', name: 'Old' } });
    if (url === 'https://apps.example.org/page') return new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
    return json({ message: 'Not Found' }, 404);
  }) as typeof fetch;
  const read = async (url: string, headers = fresh()) => {
    const { server } = await setup({ releaseFetch: fetchImpl });
    return server.inject({ method: 'POST', url: '/v1/app-runner/releases/read', headers, payload: { url } });
  };

  it('is read, checked and shown with what it asks for, for an admin to install', async () => {
    const res = await read('https://apps.example.org/maps/app-release.json');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ release: { id: 'maps', version: '2.0.0' }, refusals: [], asks: release.asks, signer: release.signer });
    expect(res.json().warnings).toEqual(expect.any(Array));
  });

  it('says why a file can’t install: on contract 2, not a release file, or not there', async () => {
    expect((await read('https://apps.example.org/old/app-release.json')).json()).toMatchObject({ refusals: ['This release is on contract 2; this AUGUR serves 3.'] });
    expect((await read('https://apps.example.org/page')).json().message).toBe('https://apps.example.org/page isn’t a release file: it isn’t JSON.');
    expect((await read('https://apps.example.org/gone')).json().message).toBe('https://apps.example.org/gone couldn’t be read: it answered 404.');
  });

  it('is only an https address, read for a deployment admin', async () => {
    expect((await read('http://apps.example.org/maps/app-release.json')).statusCode).toBe(400);
    expect((await read('https://127.0.0.1/app-release.json')).statusCode).toBe(400);
    expect((await read('https://apps.example.org/maps/app-release.json', editor)).statusCode).toBe(403);
  });
});
