import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { DEV_BUILDS_PREVIEW_ONLY, ringProblem } from './app-runner.ts';
import { DATABASE_URL, registryDb } from './db.testing.ts';
import { PRODUCTION_ONLY } from './ring.ts';
import type { AppRelease } from './store.ts';
import { exampleRelease, releaseOf } from './release3.testing.ts';

const db = registryDb();

const digest = (c: string) => `sha256:${c.repeat(64)}`;
const release = releaseOf('notes', '1.2.0');
/** A contract 2 file, which this AUGUR refuses (spec 11.6). */
const v1Release = {
  schema: 'augur.app-release/v1',
  id: 'notes',
  version: '1.2.0',
  channel: 'stable',
  manifest: { id: 'notes', name: 'Notes', route: '/notes', entry: '/apps/notes/entry.js', version: '1.2.0', sdk: '^1.3.0' },
  service: { image: `ghcr.io/o/r/apps/notes@${digest('a')}` },
  frontend: { artifact: `ghcr.io/o/r/apps/notes-frontend@${digest('b')}`, digest: digest('c'), mediaType: 'application/vnd.augur.frontend.v1.tar+gzip' },
  signer: { repository: 'o/r', workflow: '.github/workflows/release.yml' },
};
const fresh = (at = new Date()) => callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin', 'deployment-admin'], signedInAt: at.toISOString() });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });
const verifyService = async (headers: Record<string, string | string[] | undefined>) => {
  const m = /^Bearer platform-(\S+)$/.exec(String(headers.authorization ?? ''));
  return m ? { kind: 'platform' as const, name: m[1] } : undefined;
};
const runner = { authorization: 'Bearer platform-updater' };

const setup = async () => {
  const entries: { action: string; target?: string }[] = [];
  const server = await db.app({ verifyService, audit: async (e) => void entries.push(e) });
  const ask = (payload: unknown, headers = fresh()) => server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers, payload: payload as object });
  return { server, entries, ask };
};

describe('what a server’s ring installs', () => {
  const at = (version: string, channel = 'stable') => ({ ...release, version, channel }) as AppRelease;

  it('on a production server, takes only what’s promoted, whatever the file says of itself', () => {
    expect(ringProblem(at('1.2.0'), 'production', 'stable')).toBeUndefined();
    expect(ringProblem(at('1.2.0'), 'production')).toBeUndefined();
    expect(ringProblem(at('1.2.0'), 'production', 'beta')).toBe(PRODUCTION_ONLY);
    expect(ringProblem(at('1.2.0', 'beta'), 'production')).toBe(PRODUCTION_ONLY);
    expect(ringProblem(at('1.3.0-beta.1'), 'production')).toBe(PRODUCTION_ONLY);
    expect(ringProblem(at('1.3.0-beta.1'), 'production', 'beta')).toBe(PRODUCTION_ONLY);
    expect(ringProblem(at('1.2.1-dev.40'), 'production')).toBe(DEV_BUILDS_PREVIEW_ONLY);
  });

  it('takes a beta promoted as it was: the feed’s label is what changes', () => {
    expect(ringProblem(at('1.3.0-beta.1', 'beta'), 'production', 'stable')).toBeUndefined();
  });

  it('leaves a dev or preview server to install them', () => {
    expect(ringProblem(at('1.3.0-beta.1', 'beta'), 'preview')).toBeUndefined();
    expect(ringProblem(at('1.2.1-dev.40', 'dev'), 'dev', 'dev')).toBeUndefined();
  });
});

describe.runIf(DATABASE_URL)('the app runner', () => {
  it('installs only for a deployment admin who has just entered their password', async () => {
    const { ask } = await setup();
    expect((await ask({ action: 'install', release }, editor)).statusCode).toBe(403);
    // Installing changes what the server runs: an organisation admin alone can't (ADR 0022).
    const orgAdmin = callerHeaders({ id: 'u-3', name: 'Sam', departments: [], roles: ['admin'], signedInAt: new Date().toISOString() });
    expect((await ask({ action: 'install', release }, orgAdmin)).json()).toMatchObject({ error: 'forbidden', requiredRole: 'deployment-admin' });
    expect((await ask({ action: 'install', release }, fresh(new Date(Date.now() - 11 * 60_000)))).json()).toMatchObject({ error: 'sign_in_again' });
    const asked = await ask({ action: 'install', release });
    expect(asked.statusCode).toBe(202);
    expect(asked.json()).toMatchObject({ app: 'notes', action: 'install', state: 'requested', requestedBy: 'u-1', release: { version: '1.2.0' } });
  });

  it('refuses releases it can’t run', async () => {
    const { ask } = await setup();
    const tagged = structuredClone(release);
    tagged.parts[0]!.containers.web!.image = 'ghcr.io/o/r/apps/notes:1.2.0';
    expect((await ask({ action: 'install', release: tagged })).json().message).toMatch(/\/parts\/0\/containers\/web\/image/);
    expect((await ask({ action: 'install', release: { ...release, schema: 'something/v2' } })).json().message).toMatch(/something\/v2/);
    expect((await ask({ action: 'install', release: { ...release, version: '1.3.0' } })).json().message).toMatch(/id and version must be its manifest’s/);
    // An id a part of AUGUR answers to: its schema, its /api/ path and its Compose service would be the platform's.
    const events = releaseOf('events', '1.2.0');
    expect((await ask({ action: 'install', release: events })).json().message).toBe('"events" is kept for the events service, a part of AUGUR. Choose another id for the app.');
  });

  it('keeps one job open per app, and lets an admin take back one that hasn’t started', async () => {
    const { server, ask, entries } = await setup();
    const first = (await ask({ action: 'install', release })).json();
    expect((await ask({ action: 'remove', app: 'notes' })).json().message).toBe('Something is already waiting or under way for notes.');
    expect((await server.inject({ method: 'DELETE', url: `/v1/app-runner/jobs/${first.id}`, headers: fresh() })).statusCode).toBe(204);
    expect((await ask({ action: 'remove', app: 'notes' })).statusCode).toBe(202);
    expect(entries.map((e) => e.action)).toEqual(['app.install-requested', 'app.job-cancelled', 'app.uninstall-requested']);
  });

  it('gives the runner the oldest open job, and records how it went', async () => {
    const { server, ask, entries } = await setup();
    const next = () => server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: runner });
    expect((await next()).statusCode).toBe(204);
    const job = (await ask({ action: 'install', release })).json();
    expect((await server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: { authorization: 'Bearer platform-gateway' } })).statusCode).toBe(403);
    expect((await next()).json()).toMatchObject({ id: job.id, release: { parts: release.parts } });
    const report = (payload: object) => server.inject({ method: 'POST', url: `/v1/app-runner/jobs/${job.id}/progress`, headers: runner, payload });
    expect((await report({ step: 'verify', state: 'done' })).json()).toMatchObject({ state: 'running', steps: [{ step: 'verify', state: 'done' }] });
    expect((await server.inject({ method: 'DELETE', url: `/v1/app-runner/jobs/${job.id}`, headers: fresh() })).statusCode).toBe(409);
    expect((await report({ step: 'health', state: 'failed', message: 'It didn’t answer.', outcome: 'failed' })).json()).toMatchObject({ state: 'failed', message: 'It didn’t answer.' });
    expect((await report({ step: 'switch', state: 'done' })).statusCode).toBe(404);
    expect((await next()).statusCode).toBe(204);
    expect(entries.map((e) => e.action)).toEqual(['app.install-requested', 'app.install-failed']);
    const listed = (await server.inject({ method: 'GET', url: '/v1/app-runner/jobs?app=notes', headers: fresh() })).json();
    expect(listed.jobs).toHaveLength(1);
    expect(listed.runnerSeenAt).toBeDefined();
  });
});

// P2's acceptance (spec 3.7, 9.4, 11.6): what a later contract 3 version asks for, and the v1 refusal.
describe('a contract 3 release in the app runner', async () => {
  const { updateNeeds } = await import('./app-updates.ts');

  it('holds a later version that adds a scope, a resource, a setting or a place for review', async () => {
    const from = await exampleRelease();
    const later = (change: (r: AppRelease & { manifest: { scopes: string[]; contributes: { settings: object[]; places: object[] } } }) => void) => {
      const r = structuredClone(from) as Parameters<typeof change>[0];
      r.version = r.manifest.version = '1.1.0';
      change(r);
      return r;
    };
    expect(updateNeeds(from, later(() => undefined))).toEqual([]);
    expect(updateNeeds(from, later((r) => r.manifest.scopes.push('models:use'))).join()).toMatch(/models:use/);
    expect(updateNeeds(from, later((r) => r.asks.resources.push({ part: 'web', type: 'augur-outbound', params: { hosts: ['x.example.org'] } }))).join()).toMatch(/augur-outbound|internet/);
    expect(updateNeeds(from, later((r) => (r.asks.limits.web.memory = '1Gi'))).join()).toMatch(/web.*1Gi|1Gi/);
    expect(updateNeeds(from, later((r) => r.manifest.contributes.settings.push({ id: 'colour', label: 'Colour', type: 'string', default: 'red' }))).join()).toMatch(/Colour|colour/);
    expect(updateNeeds(from, later((r) => r.manifest.contributes.places.push({ id: 'tags', label: 'Tags', icon: 'tag', path: '/tags' }))).join()).toMatch(/Tags/);
    // Taking something away asks for nothing.
    expect(updateNeeds(from, later((r) => r.manifest.scopes.pop()))).toEqual([]);
  });

  it.runIf(DATABASE_URL)('installs a v2 release and refuses a v1 one with the contract message', async () => {
    const { ask } = await setup();
    expect((await ask({ action: 'install', release: await exampleRelease() })).statusCode).toBe(202);
    const v1 = await ask({ action: 'install', release: v1Release });
    expect(v1.statusCode).toBe(400);
    expect(v1.json().message).toBe('This release is on contract 2; this AUGUR serves 3.');
  });
});

describe.runIf(DATABASE_URL)('the deployment’s own networks and contract (9.8, 11.1)', () => {
  it('takes its own networks from the runner alone, and refuses a preview answering on one', async () => {
    const { server, ask } = await setup();
    const say = (networks: string[], headers: Record<string, string> = runner) => server.inject({ method: 'PUT', url: '/v1/runner/networks', headers, payload: { networks } });
    expect((await say(['10.20.0.0/16'], { authorization: 'Bearer platform-gateway' })).statusCode).toBe(403);
    expect((await say(['not a network'])).statusCode).toBe(400);
    expect((await say(['10.20.0.0/16', 'fd00:a::/64'])).json()).toMatchObject({ networks: ['10.20.0.0/16', 'fd00:a::/64'] });
    const job = (await ask({ action: 'install', release })).json();
    const report = (upstream: string) =>
      server.inject({ method: 'POST', url: `/v1/app-runner/jobs/${job.id}/progress`, headers: runner, payload: { step: 'switch', state: 'done', outcome: 'done', upstream } });
    expect((await report('http://10.20.3.4:8080')).json().message).toMatch(/10\.20\.0\.0\/16/);
    expect((await report('http://10.30.3.4:8080')).statusCode).toBe(200);
  });

  it('says which contract majors it serves', async () => {
    const { server } = await setup();
    expect((await server.inject({ method: 'GET', url: '/v1/contract' })).json()).toEqual({ majors: [3] });
  });
});
