import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { buildApp } from './app.ts';

const digest = (c: string) => `sha256:${c.repeat(64)}`;
const manifest = { id: 'notes', name: 'Notes', route: '/notes', entry: '/apps/notes/entry.js', version: '1.2.0', sdk: '^1.3.0', storage: { database: true } };
const release = {
  schema: 'augur.app-release/v1',
  id: 'notes',
  version: '1.2.0',
  channel: 'stable',
  manifest,
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
  const server = await buildApp({ verifyService, pillars: ['folio'], audit: async (e) => void entries.push(e) });
  const ask = (payload: unknown, headers = fresh()) => server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers, payload: payload as object });
  return { server, entries, ask };
};

describe('the app runner', () => {
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
    expect((await ask({ action: 'install', release: { ...release, service: { image: 'ghcr.io/o/r/apps/notes:1.2.0' } } })).statusCode).toBe(400);
    expect((await ask({ action: 'install', release: { ...release, schema: 'something/v2' } })).statusCode).toBe(400);
    expect((await ask({ action: 'install', release: { ...release, version: '1.3.0' } })).json().message).toMatch(/id and version must be its manifest’s/);
    expect((await ask({ action: 'install', release: { ...release, service: null } })).json().message).toMatch(/frontend-only/);
    const folio = { ...release, id: 'folio', manifest: { ...manifest, id: 'folio', route: '/folio' } };
    expect((await ask({ action: 'install', release: folio })).json().message).toMatch(/ships with AUGUR/);
    expect((await ask({ action: 'remove', app: 'folio' })).statusCode).toBe(409);
    // An id a part of AUGUR answers to: its schema, its /api/ path and its Compose service would be the platform's.
    const events = { ...release, id: 'events', manifest: { ...manifest, id: 'events', route: '/events' } };
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
    expect((await next()).json()).toMatchObject({ id: job.id, release: { service: release.service } });
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
