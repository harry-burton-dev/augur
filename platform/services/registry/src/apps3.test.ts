// P2b's acceptance (spec 3.3, 9.4, 9.6): the registry takes a contract 3 manifest only from a release it handed
// the runner, serves it to the shell as the manifest in force, and reads a release file an admin pastes.
import { describe, expect, it } from 'vitest';
import { callerHeaders, frontendDigest, packFrontend, type FloorPlace } from '@augur/service-kit';
import { DATABASE_URL, registryDb } from './db.testing.ts';
import type { ReleaseFetch } from './release-fetch.ts';
import { addressProblem } from './upstreams.ts';
import { frontendHandedOver, manifest3Problems, ownServed } from './apps3.ts';
import { checkRelease } from './release-check.ts';
import { platformApps, platformManifests3 } from './manifest.ts';
import { MemoryFrontendFiles } from './frontends.ts';
import { exampleRelease, releaseOf } from './release3.testing.ts';

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

  it('takes the version it goes back to, the last it installed, but never one an admin has since replaced', async () => {
    const t = await setup();
    const oldest = releaseOf('notes', '1.0.0');
    const old = releaseOf('notes', '1.1.0');
    await t.install(oldest, 'done');
    await t.install(old, 'done');
    await t.install(releaseOf('notes', '1.2.0'));
    expect((await t.register(old.manifest)).statusCode).toBe(201);
    expect((await t.register(oldest.manifest)).statusCode).toBe(403);
  });

  it('never goes back to a contract 2 manifest, which would run its code outside the sandbox', async () => {
    const t = await setup();
    const release = releaseOf('notes', '1.2.0');
    await t.install(release);
    await t.register(release.manifest);
    const v2 = { id: 'notes', name: 'Notes', route: '/notes', entry: '/apps/notes/x/evil.js', version: '1.2.1', sdk: '^2.0.0' };
    const res = await t.register(v2);
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe('Notes is installed on the app contract: it registers only as the release the app runner installs, never as a contract 2 manifest.');
    expect((await t.register(v2, fresh())).statusCode).toBe(403);
  });

  it('stays removed when an admin removed it, though its install once finished', async () => {
    const t = await setup();
    const release = releaseOf('notes', '1.2.0');
    await t.install(release, 'done');
    await t.register(release.manifest);
    expect((await t.server.inject({ method: 'DELETE', url: '/v1/apps/notes', headers: fresh() })).statusCode).toBeLessThan(300);
    expect((await t.register(release.manifest)).json().message).toBe('An admin removed Notes, so it can’t register itself again. An admin has to install it again.');
  });

  it('is granted the scopes a later version adds once an admin has had it installed', async () => {
    const t = await setup();
    const first = releaseOf('notes', '1.1.0');
    await t.install(first, 'done');
    await t.register(first.manifest);
    const later = releaseOf('notes', '1.2.0', { scopes: [...first.manifest.scopes!, 'models:use'] });
    await t.install(later);
    await t.register(later.manifest);
    const admins = (await t.server.inject({ method: 'GET', url: '/v1/apps', headers: fresh() })).json();
    expect(admins.find((a: { id: string }) => a.id === 'notes').grantedScopes).toContain('models:use');
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
    expect(grants).toMatchObject({ app: 'notes', name: 'Notes', on: true, scopes: release.manifest.scopes, notificationKinds: ['shared'], inboxKinds: [], contract: 3 });
    expect(grants.events).toBeUndefined();
    expect((await t.server.inject({ method: 'GET', url: '/v1/apps/notes/events', headers: as('platform-events') })).json()).toEqual({ app: 'notes', contract: 3 });
    const admins = (await t.server.inject({ method: 'GET', url: '/v1/apps', headers: fresh() })).json();
    expect(admins).toContainEqual(expect.objectContaining({ id: 'notes', contract: 3, grantedScopes: release.manifest.scopes }));
  });

  it('tells AUGUR’s services the events its manifest declares, and holds each type to its version (ADR 0104)', async () => {
    const t = await setup();
    const base = releaseOf('notes', '1.2.0');
    const added = { topic: 'notes.note.added', version: 1, description: 'A note was added.', schema: { type: 'object', properties: { note: { type: 'string' } } } };
    const scopes = [...new Set([...base.manifest.scopes!, 'events:subscribe', 'events:publish'])];
    const release = releaseOf('notes', '1.2.0', { scopes, contributes: { ...base.manifest.contributes, events: { reads: ['folio.*'], publishes: [added] } } });
    await t.install(release, 'done');
    expect((await t.register(release.manifest)).statusCode).toBe(201);
    const declared = await t.server.inject({ method: 'GET', url: '/v1/apps/notes/events', headers: as('platform-events') });
    expect(declared.json()).toEqual({ app: 'notes', contract: 3, events: { reads: ['folio.*'], publishes: [{ topic: 'notes.note.added', version: 1, schema: added.schema }] } });
    // Only AUGUR's own services ask.
    expect((await t.server.inject({ method: 'GET', url: '/v1/apps/notes/events', headers: as('app-notes') })).statusCode).toBe(403);
    // A later release may add an optional field to version 1, but not change one: that is version 2.
    const next = (schema: object) => releaseOf('notes', '1.3.0', { scopes, contributes: { ...base.manifest.contributes, events: { publishes: [{ ...added, schema }] } } });
    const ask = (release: object) => t.server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fresh(), payload: { action: 'install', release } });
    const changed = await ask(next({ type: 'object', properties: { note: { type: 'integer' } } }));
    expect([changed.statusCode, changed.json().message]).toEqual([400, expect.stringMatching(/notes\.note\.added version 1 changes note from 1\.2\.0's: .* needs version 2/)]);
    expect((await ask(next({ type: 'object', properties: { note: { type: 'string' }, by: { type: 'string' } } }))).statusCode).toBe(202);
  });
});

describe.runIf(DATABASE_URL)('fields contract 3 hasn’t frozen, under provisional', () => {
  const finance = callerHeaders({ id: 'u-3', name: 'Kim', departments: [], roles: ['finance'] });

  it('installs a manifest with a provisional field this registry doesn’t know, on the rules it has', async () => {
    const t = await setup();
    const release = releaseOf('notes', '1.2.0', { provisional: { requiredRole: 'finance', notYetInvented: { any: 'thing' } } });
    const asked = await t.server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fresh(), payload: { action: 'install', release } });
    expect(asked.statusCode).toBe(202);
    await t.server.inject({ method: 'POST', url: `/v1/app-runner/jobs/${asked.json().id}/progress`, headers: runner, payload: { step: 'verify', state: 'done' } });
    expect((await t.register(release.manifest)).statusCode).toBe(201);
    // The role it knows is held, from under provisional; the field it doesn't is left alone.
    expect((await t.catalogue()).some((a) => a.id === 'notes')).toBe(false);
    expect((await t.catalogue(finance)).find((a) => a.id === 'notes')).toMatchObject({ requiredRole: 'finance' });
    // Ignored, but said, so a misspelt one isn't missed.
    expect(checkRelease(release).warnings).toContain('Notes sets provisional.notYetInvented, which this AUGUR doesn’t know: it installs without it. If it is a misspelling, Notes’s publisher needs to fix it.');
    // A newer release may give a known field more than this one knows of.
    expect(checkRelease(releaseOf('notes', '1.2.0', { provisional: { links: { entities: true, documents: true } } })).refusals).toEqual([]);
  });

  it('still reads one at the top of the manifest for this release, and says it moves', async () => {
    const t = await setup();
    const release = releaseOf('notes', '1.2.0', { requiredRole: 'finance' });
    expect(checkRelease(release).warnings).toContain('Notes sets requiredRole at the top of its manifest. Contract 3 reads it under provisional, and from the next release only there.');
    await t.install(release);
    await t.register(release.manifest);
    expect((await t.catalogue()).some((a) => a.id === 'notes')).toBe(false);
    expect((await t.catalogue(finance)).find((a) => a.id === 'notes')).toMatchObject({ requiredRole: 'finance' });
  });

  it('refuses one set in both places rather than guess', () => {
    const both = checkRelease(releaseOf('notes', '1.2.0', { requiredRole: 'finance', provisional: { requiredRole: 'admin' } }));
    expect(both.refusals).toEqual(['The manifest sets requiredRole both at its top and under provisional: keep the one under provisional.']);
    expect(both.warnings.join(' ')).not.toMatch(/requiredRole/);
    expect(manifest3Problems({ ...releaseOf('notes', '1.2.0').manifest, provisional: { requiredRole: '' } }).join(' ')).toMatch(/requiredRole/);
  });

  it('knows no bindings, now the binding events are gone (D6): ignored under provisional, refused at the top', () => {
    const under = checkRelease(releaseOf('notes', '1.2.0', { provisional: { links: { entities: true }, bindings: ['claim'] } }));
    expect(under.refusals).toEqual([]);
    expect(under.warnings).toContain('Notes sets provisional.bindings, which this AUGUR doesn’t know: it installs without it. If it is a misspelling, Notes’s publisher needs to fix it.');
    expect(manifest3Problems({ ...releaseOf('notes', '1.2.0').manifest, bindings: ['claim'] }).join(' ')).toMatch(/bindings/);
  });
});

describe.runIf(DATABASE_URL)('a release file an admin pastes the address of', () => {
  const release = releaseOf('maps', '2.0.0', { name: 'Maps' });
  const fetchImpl = (async (url: string) => {
    if (url === 'https://apps.example.org/maps/app-release.json') return json(release);
    if (url === 'https://apps.example.org/old/app-release.json') return json({ schema: 'augur.app-release/v1', id: 'old', version: '1.0.0', manifest: { id: 'old', name: 'Old' } });
    if (url === 'https://apps.example.org/page') return new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
    if (url === 'https://apps.example.org/other.json') return json({ secret: 'something else' });
    return json({ message: 'Not Found' }, 404);
  }) as ReleaseFetch;
  const read = async (url: string, headers = fresh()) => {
    const { server } = await setup({ releaseFetch: fetchImpl });
    return server.inject({ method: 'POST', url: '/v1/app-runner/releases/read', headers, payload: { url } });
  };

  it('is read, checked and shown with what it asks for, for an admin to install', async () => {
    const res = await read('https://apps.example.org/maps/app-release.json');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ release: { id: 'maps', version: '2.0.0' }, refusals: [], asks: release.asks, signer: release.signer });
    // What the asks don't say, from the manifest and parts, so the review reads no Score (spec 5.6, 9.4).
    expect(res.json().review).toEqual({
      kinds: { web: 'service', worker: 'worker', migrate: 'job' },
      settings: [
        { id: 'retentionDays', label: 'Keep archived notes for', type: 'number', required: false, unit: 'days', min: 7, max: 3650, default: 365 },
        { id: 'allowSharing', label: 'Notes can be shared outside the floor', type: 'boolean', required: false, default: false },
        { id: 'defaultNotebook', label: 'Default notebook name', type: 'string', required: false, default: 'General' },
        { id: 'theme', label: 'Note colour', type: 'enum', required: false, options: ['plain', 'warm', 'cool'], default: 'plain' },
        // A form for it, but never a default: a secret has none.
        { id: 'exportKey', label: 'Export service key', type: 'secret', required: false, detail: 'The key used when notes are exported to the archive service' },
      ],
    });
    expect(res.json().warnings).toEqual(expect.any(Array));
  });

  it('says why a file can’t install: on contract 2, not a release file, or not there', async () => {
    expect((await read('https://apps.example.org/old/app-release.json')).json()).toMatchObject({ refusals: ['Old 1.0.0 speaks contract 2, and this AUGUR serves 3; the app needs a release on contract 3.'] });
    expect((await read('https://apps.example.org/page')).json().message).toBe('https://apps.example.org/page isn’t a release file: it isn’t JSON.');
    expect((await read('https://apps.example.org/gone')).json().message).toBe('https://apps.example.org/gone couldn’t be read: it answered 404.');
    // Any other JSON isn't echoed back: the route reads release files and nothing else.
    expect((await read('https://apps.example.org/other.json')).json()).toMatchObject({ message: 'https://apps.example.org/other.json isn’t a release file.' });
  });

  it('is only an https address, read for a deployment admin', async () => {
    expect((await read('http://apps.example.org/maps/app-release.json')).statusCode).toBe(400);
    expect((await read('https://127.0.0.1/app-release.json')).statusCode).toBe(400);
    expect((await read('https://apps.example.org/maps/app-release.json', editor)).statusCode).toBe(403);
  });

  it('is never read from an address its name resolves to on this machine or the deployment’s own networks', () => {
    expect(addressProblem('127.0.0.1')).toMatch(/this machine/);
    expect(addressProblem('::1')).toMatch(/this machine/);
    expect(addressProblem('::ffff:127.0.0.1')).toMatch(/this machine/);
    expect(addressProblem('172.18.0.4')).toMatch(/own networks/);
    expect(addressProblem('10.1.2.3', { networks: ['10.1.0.0/16'], setAt: '2026-11-09T00:00:00Z' })).toMatch(/own networks/);
    expect(addressProblem('10.20.30.40', { networks: ['10.1.0.0/16'], setAt: '2026-11-09T00:00:00Z' })).toBeUndefined();
    expect(addressProblem('140.82.121.4')).toBeUndefined();
  });
});

describe.runIf(DATABASE_URL)('a frontend bundle on contract 3', () => {
  it('is kept at /apps/<id>/<version>/, where the shell loads it from, once its digest is the one a release the runner has names', async () => {
    const frontendFiles = new MemoryFrontendFiles();
    const t = await setup({ frontendFiles });
    const bundle = packFrontend([{ path: 'sandbox.js', data: Buffer.from('export default function start() {}') }]);
    const release = releaseOf('notes', '1.2.0', {}, { frontend: { ...exampleRelease().frontend!, digest: frontendDigest(bundle) } });
    const give = (body: Buffer) =>
      t.server.inject({ method: 'PUT', url: '/v1/apps/notes/versions/1.2.0/frontend', headers: { ...runner, 'content-type': 'application/gzip' }, payload: body });
    const own = /^1\.2\.0_[0-9a-f]{12}$/;
    // Until the runner has the release, it is a build like any other, in a folder of its own.
    expect((await give(packFrontend([{ path: 'sandbox.js', data: Buffer.from('other') }]))).json().folder).toMatch(own);
    // Kept before the runner had the release (an admin's upload, say), it sits in a folder of its own, and the
    // runner's upload of the same bundle then puts it where the shell loads from.
    expect((await give(bundle)).json().folder).toMatch(own);
    await t.install(release, 'done');
    const kept = await give(bundle);
    expect(kept.statusCode).toBe(201);
    expect(kept.json().folder).toBe('1.2.0');
    expect(frontendFiles.objects.get('apps/notes/1.2.0/sandbox.js')?.toString()).toBe('export default function start() {}');
    // The same bundle again changes nothing; any other build of the version isn't the release's, and never takes that folder.
    expect((await give(bundle)).statusCode).toBe(200);
    const other = await give(packFrontend([{ path: 'sandbox.js', data: Buffer.from('else') }]));
    expect(other.statusCode).toBe(201);
    expect(other.json().folder).toMatch(own);
    expect(frontendFiles.objects.get('apps/notes/1.2.0/sandbox.js')?.toString()).toBe('export default function start() {}');
    // A second release cut as the same version, with another bundle, is refused: browsers keep the folder's files for good.
    const recut = packFrontend([{ path: 'sandbox.js', data: Buffer.from('recut') }]);
    await t.install(releaseOf('notes', '1.2.0', {}, { frontend: { ...exampleRelease().frontend!, digest: frontendDigest(recut) } }));
    const refused = await give(recut);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().message).toBe(`notes 1.2.0 was released with another frontend bundle (${frontendDigest(bundle).slice(0, 19)}); a version is never cut again. Release it as a new version.`);
  });

  it('is a preview’s too, at the preview’s own version, but never a job that failed or was cancelled', () => {
    const job = (version: string, action: 'install' | 'preview', state: 'running' | 'done' | 'failed' | 'cancelled', digest = 'sha256:' + 'f'.repeat(64)) =>
      ({ id: `j-${version}`, app: 'notes', action, state, release: releaseOf('notes', version, {}, { frontend: { ...exampleRelease().frontend!, digest } }), requestedBy: 'u-1', requestedAt: '', steps: [] }) as never;
    const d = 'sha256:' + 'f'.repeat(64);
    expect(frontendHandedOver([job('1.3.0-pr.7.1', 'preview', 'running')], 'notes', '1.3.0-pr.7.1', d)?.id).toBe('j-1.3.0-pr.7.1');
    expect(frontendHandedOver([job('1.3.0', 'install', 'done')], 'notes', '1.3.0', d)?.id).toBe('j-1.3.0');
    expect(frontendHandedOver([job('1.3.0', 'install', 'failed'), job('1.3.0', 'install', 'cancelled')], 'notes', '1.3.0', d)).toBeUndefined();
    expect(frontendHandedOver([job('1.3.0', 'install', 'done')], 'notes', '1.3.0', 'sha256:' + 'e'.repeat(64))).toBeUndefined();
    expect(frontendHandedOver([job('1.3.0', 'install', 'done')], 'other', '1.3.0', d)).toBeUndefined();
  });
});

describe('AUGUR’s own apps on contract 3 (ADR 0083)', () => {
  const own = platformApps.find((a) => a.id === 'upgrades')!;
  const manifest = { id: own.id, name: own.name, version: own.version, contract: 3, frontend: { entry: 'entry.js' }, contributes: { places: [{ id: 'overview', label: 'Overview', path: '/' }] } } as const;

  it('are sent as their manifest, with their role, their kind and the gauge resting', () => {
    expect(ownServed(own, manifest as never, { maxUpload: 10 })).toEqual({ ...manifest, maxUpload: 10, requiredRole: own.requiredRole, category: 'platform', sameOnEveryFloor: true });
  });

  it('each have a manifest the contract takes, at the version and name of their entry', () => {
    for (const [id, m] of Object.entries(platformManifests3)) {
      expect(manifest3Problems(m), id).toEqual([]);
      const entry = platformApps.find((a) => a.id === id)!;
      expect({ id: m.id, name: m.name, version: m.version }).toEqual({ id: entry.id, name: entry.name, version: entry.version });
    }
  });

  it('are sent as their entry while they have no manifest, as before', () => {
    expect(ownServed(own, undefined, { maxUpload: 10 })).toBe(own);
    expect(ownServed(own, undefined, { maxUpload: 10, previewsOn: ['urgent-letterbox'] })).toEqual({ ...own, previewsOn: ['urgent-letterbox'] });
  });
});
