import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { appServer, auditFor, floorCaller, notifyFor, peopleFor, readManifest, standInPeople, startAppService, type AppAuditEntry, type AppNotice } from './app-service.js';
import { callerHeaders } from './caller.js';
import { createJobs } from './jobs.js';
import { registerApp } from './registration.js';
import { callerCheckFor, callerSigner, signedCallerHeaders } from './signed-caller.js';

vi.mock('./jobs.js', async (actual) => {
  const jobs = await actual<typeof import('./jobs.js')>();
  return { ...jobs, createJobs: vi.fn(jobs.createJobs) };
});
vi.mock('./registration.js', () => ({ registerApp: vi.fn(async () => true) }));

const manifest = { id: 'notes', name: 'Team notes', version: '1.2.3' };
const sam = { id: 'u1', name: 'Sam Okafor', departments: [], roles: [] };

const build = async (callers?: Parameters<typeof appServer>[1]['callers']) => {
  const app = Fastify({ logger: false });
  await appServer(app, { manifest, callers });
  const onFloor = floorCaller(manifest);
  app.get('/v1/here', async (req) => ({ floor: onFloor(req).workspace.id }));
  return app;
};

describe('appServer', () => {
  it('says what is running on /healthz', async () => {
    const res = await (await build()).inject({ method: 'GET', url: '/healthz' });
    expect(res.json()).toEqual({ status: 'ok', service: 'notes', version: '1.2.3', api: 'v1' });
  });

  it('refuses nobody signed in as a problem, named for the app', async () => {
    const res = await (await build()).inject({ method: 'GET', url: '/v1/here' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.json()).toMatchObject({ status: 401, reason: 'unauthenticated', detail: 'Sign in to use Team notes.' });
  });

  it('asks which floor when none was given', async () => {
    const res = await (await build()).inject({ method: 'GET', url: '/v1/here', headers: callerHeaders(sam) });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ reason: 'floor_needed' });
  });

  it('lets a caller on a floor through', async () => {
    const res = await (await build()).inject({ method: 'GET', url: '/v1/here', headers: callerHeaders({ ...sam, workspace: { id: 'w1', kind: 'team', role: 'member' } }) });
    expect(res.json()).toEqual({ floor: 'w1' });
  });

  it('believes only the caller the gateway signed for this app', async () => {
    const gateway = callerSigner();
    // The gateway signs for the app's client, app-<id>, which is what appServer checks for by default.
    const app = await build(callerCheckFor(gateway, 'app-notes'));
    const onFloor = { ...sam, workspace: { id: 'w1', kind: 'team' as const, role: 'member' as const } };
    const signed = await app.inject({ remoteAddress: '172.18.0.9', method: 'GET', url: '/v1/here', headers: await signedCallerHeaders(gateway, onFloor, 'app-notes') });
    expect(signed.json()).toEqual({ floor: 'w1' });
    const forOther = await app.inject({ remoteAddress: '172.18.0.9', method: 'GET', url: '/v1/here', headers: await signedCallerHeaders(gateway, onFloor, 'notes') });
    expect(forOther.statusCode).toBe(401);
    const forged = await app.inject({ remoteAddress: '172.18.0.9', method: 'GET', url: '/v1/here', headers: callerHeaders(onFloor) });
    expect(forged.statusCode).toBe(401);
  });
});

describe('readManifest', () => {
  it('reads APP_MANIFEST first, and wants an id, a name and a version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'manifest-'));
    writeFileSync(join(dir, 'm.json'), JSON.stringify(manifest));
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ id: 'notes' }));
    const here = pathToFileURL(join(dir, 'dist', 'index.js')).href;
    expect(readManifest(here, { APP_MANIFEST: join(dir, 'm.json') })).toEqual(manifest);
    expect(() => readManifest(here, { APP_MANIFEST: join(dir, 'bad.json') })).toThrow(/id, a name and a version/);
  });
});

describe('without the platform', () => {
  it('audits and notifies into the log, and makes do for people', async () => {
    const audited: AppAuditEntry[] = [];
    const told: AppNotice[] = [];
    await auditFor('notes', (e) => audited.push(e), {})({ actor: 'u1', action: 'note.made', target: 'n1', workspace: 'w1' });
    await notifyFor('notes', (n) => told.push(n), {})({ recipients: ['u2'], workspace: 'w1', title: 'A note for you' });
    expect(audited).toHaveLength(1);
    expect(told).toHaveLength(1);
    const people = peopleFor('notes', { env: {} });
    expect(people).toBe(standInPeople);
    expect(await people.principals('u1', { id: 't1', kind: 'team', role: 'member' })).toEqual(['person:u1', 'team:t1', 'tree:t1', 'org']);
  });
});

describe('startAppService', () => {
  it('builds, listens and runs its jobs', async () => {
    const ran: string[] = [];
    const app = await startAppService({
      manifest,
      port: 0,
      env: { NODE_ENV: 'test' },
      buildApp: async ({ jobs }) => {
        const app = Fastify({ logger: false });
        await appServer(app, { manifest });
        const hello = jobs.define<string>('hello', async (who) => void ran.push(who));
        app.post('/v1/hello', async () => ({ run: await jobs.start(hello, 'Sam') }));
        return app;
      },
    });
    try {
      const res = await app.inject({ method: 'POST', url: '/v1/hello' });
      expect(res.statusCode).toBe(200);
      await new Promise((r) => setTimeout(r, 20));
      expect(ran).toEqual(['Sam']);
    } finally {
      await app.close();
    }
  });

  it('registers the app itself on contract 2, and leaves that to the app runner on the app contract', async () => {
    const start = async (m: typeof manifest & { contract?: number }) => {
      const app = await startAppService({
        manifest: m,
        port: 0,
        env: { NODE_ENV: 'test', REGISTRY_URL: 'http://registry.test', SERVICE_CLIENT_SECRET: 's3cret' },
        buildApp: async () => {
          const app = Fastify({ logger: false });
          await appServer(app, { manifest: m });
          return app;
        },
      });
      await new Promise((r) => setTimeout(r, 10));
      await app.close();
    };
    vi.mocked(registerApp).mockClear();
    await start(manifest);
    expect(vi.mocked(registerApp)).toHaveBeenCalledTimes(1);
    await start({ ...manifest, contract: 3 });
    expect(vi.mocked(registerApp)).toHaveBeenCalledTimes(1);
  });

  it('keeps a preview’s jobs in the schema its login owns, not the app’s', async () => {
    const start = async (env: Record<string, string>) => {
      const teamNotes = { ...manifest, id: 'team-notes' };
      const app = await startAppService({
        manifest: teamNotes,
        port: 0,
        env: { NODE_ENV: 'test', ...env },
        buildApp: async () => {
          const app = Fastify({ logger: false });
          await appServer(app, { manifest: teamNotes });
          return app;
        },
      });
      await app.close();
      return vi.mocked(createJobs).mock.lastCall?.[0].schema;
    };
    expect(await start({})).toBe('team_notes_jobs');
    expect(await start({ APP_PREVIEW: 'pr-12' })).toBe('team_notes_pr12_jobs');
  });
});
