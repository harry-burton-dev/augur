// The fleet's machine client (ADR 0100): it changes what the server runs with nobody signed in, within the
// server's ring, and every change it makes is recorded under platform-fleet.
import { describe, expect, it } from 'vitest';
import { callerHeaders, FLEET_CALLER } from '@augur/service-kit';
import { AppUpdateChecker, type AppFeedRelease } from './app-updates.ts';
import { DATABASE_URL, registryDb } from './db.testing.ts';
import { fleetRingProblem } from './fleet.ts';
import { releaseOf } from './release3.testing.ts';
import { UpdateChecker, type FeedRelease, type ReleaseManifest } from './updates.ts';

const db = registryDb();

const fleet = callerHeaders(FLEET_CALLER);
/** A person with no role: what the fleet's caller would be without the registry knowing it. */
const nobody = callerHeaders({ id: 'u-9', name: 'Pat', departments: [], roles: [] });
const images = { registry: 'ghcr.io/o/r/registry@sha256:aa' };
const manifest = (version: string, channel: FeedRelease['channel']): ReleaseManifest => ({
  version,
  channel,
  upgradeFrom: '>=0.1.0',
  changed: ['@augur/registry'],
  breaking: [],
  settings: { all: ['PLATFORM_URL'], required: ['PLATFORM_URL'], added: [], removed: [] },
  parts: { '@augur/registry': { version } },
  images,
});
const augur = (version: string, channel: FeedRelease['channel'] = 'stable'): FeedRelease => ({ version, channel, manifest: manifest(version, channel) });
const app = (version: string, channel: AppFeedRelease['channel']): AppFeedRelease => ({ app: 'notes', version, channel, release: { ...releaseOf('notes', version), channel } as AppFeedRelease['release'] });

/** A server on `ring` running AUGUR 0.13.0, with AUGUR and app releases out, and the audit it writes. */
const server = async (ring: 'production' | 'preview', releases: FeedRelease[], apps: AppFeedRelease[] = []) => {
  await db.reset();
  const channel = ring === 'production' ? 'stable' : 'beta';
  const updates = new UpdateChecker({ feed: async () => releases, running: { version: '0.13.0', channel }, channel, ring });
  await updates.check();
  const appUpdates = new AppUpdateChecker(async () => apps);
  await appUpdates.check();
  const entries: { actor: { id: string; kind: string }; action: string; target?: string }[] = [];
  const registry = await db.app({ updates, appUpdates, timeZone: 'Europe/London', audit: async (e) => void entries.push(e) });
  return { registry, entries };
};

describe('the fleet’s ring limits (ADR 0100)', () => {
  it('lets a dev or preview server take any release, and production only a stable one nobody halted', () => {
    expect(fleetRingProblem('preview', { what: 'AUGUR', version: '0.14.0-beta.1', channel: 'beta' })).toBeUndefined();
    expect(fleetRingProblem('dev', { what: 'AUGUR', version: '0.14.0-dev.3', channel: 'dev', halted: { reason: 'x' } })).toBeUndefined();
    expect(fleetRingProblem('production', { what: 'AUGUR', version: '0.14.0', channel: 'stable' })).toBeUndefined();
    expect(fleetRingProblem('production', { what: 'AUGUR', version: '0.14.0-beta.1', channel: 'beta' })).toMatch(/isn’t promoted to stable/);
    expect(fleetRingProblem('production', { what: 'notes', version: '1.2.0', channel: undefined })).toMatch(/isn’t promoted to stable/);
    expect(fleetRingProblem('production', { what: 'AUGUR', version: '0.14.0', channel: 'stable', halted: { reason: 'x' } })).toMatch(/halted by its publisher/);
  });
});

describe.runIf(DATABASE_URL)('the fleet’s client at the registry (ADR 0100)', () => {
  it('upgrades a production server to the next stable release with nobody signed in, recorded under platform-fleet', async () => {
    const { registry, entries } = await server('production', [augur('0.13.1'), augur('0.13.0')]);
    expect((await registry.inject({ method: 'PUT', url: '/v1/platform/upgrade', headers: nobody, payload: { version: '0.13.1' } })).statusCode).toBe(403);
    const asked = await registry.inject({ method: 'PUT', url: '/v1/platform/upgrade', headers: fleet, payload: { version: '0.13.1' } });
    expect(asked.statusCode).toBe(202);
    expect(asked.json().upgrade).toMatchObject({ version: '0.13.1', requestedBy: 'platform-fleet' });
    expect(entries.at(-1)).toMatchObject({ actor: { id: 'platform-fleet', kind: 'service' }, action: 'platform.upgrade-requested', target: '0.13.1' });
    // It follows the upgrade it asked for on the overview, not the updates page, which names the admins who upgraded before.
    expect((await registry.inject({ method: 'GET', url: '/v1/platform/updates', headers: fleet })).statusCode).toBe(403);
    expect((await registry.inject({ method: 'GET', url: '/v1/platform/overview', headers: fleet })).json().units[0].open).toMatchObject({ version: '0.13.1' });
  });

  it('takes a beta release to a preview server', async () => {
    const { registry } = await server('preview', [augur('0.13.1-beta.1', 'beta'), augur('0.13.0')]);
    expect((await registry.inject({ method: 'PUT', url: '/v1/platform/upgrade', headers: fleet, payload: { version: '0.13.1-beta.1' } })).statusCode).toBe(202);
  });

  it('sets a unit’s desired state with nobody signed in, recorded under platform-fleet', async () => {
    const { registry, entries } = await server('production', [augur('0.13.0')]);
    const record = { channel: 'stable', policy: 'hold', automaticUpTo: 'patch', windows: [] };
    expect((await registry.inject({ method: 'PUT', url: '/v1/platform/units/augur/desired-state', headers: nobody, payload: record })).statusCode).toBe(403);
    const set = await registry.inject({ method: 'PUT', url: '/v1/platform/units/augur/desired-state', headers: fleet, payload: record });
    expect(set.statusCode).toBe(200);
    expect(set.json().units[0].desired).toMatchObject({ policy: 'hold', setBy: 'platform-fleet' });
    expect(entries.at(-1)).toMatchObject({ actor: { id: 'platform-fleet', kind: 'service' }, action: 'platform.desired-state-set', target: 'augur' });
  });

  it('installs an app release the feed lists, on production only a stable one, and never a pasted file', async () => {
    const { registry, entries } = await server('production', [augur('0.13.0')], [app('1.2.0', 'stable'), app('1.3.0-beta.1', 'beta')]);
    const ask = (payload: object) => registry.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fleet, payload });
    expect((await ask({ action: 'install', release: releaseOf('notes', '1.2.0') })).json().message).toBe('The fleet’s client installs only a release the app feed lists: name the app and its version.');
    expect((await ask({ action: 'install', app: 'notes', version: '1.3.0-beta.1' })).statusCode).toBe(400);
    const job = await ask({ action: 'install', app: 'notes', version: '1.2.0' });
    expect(job.statusCode).toBe(202);
    expect(job.json()).toMatchObject({ app: 'notes', requestedBy: 'platform-fleet', release: { version: '1.2.0' } });
    expect(entries.at(-1)).toMatchObject({ actor: { id: 'platform-fleet', kind: 'service' }, action: 'app.install-requested', target: 'notes' });
    expect((await registry.inject({ method: 'GET', url: '/v1/app-runner/jobs?app=notes', headers: fleet })).json().jobs).toHaveLength(1);
    expect((await registry.inject({ method: 'GET', url: '/v1/app-runner/apps', headers: fleet })).statusCode).toBe(200);
  });

  it('gets nothing else a deployment admin may do', async () => {
    const { registry } = await server('preview', [augur('0.13.0')]);
    expect((await registry.inject({ method: 'PUT', url: '/v1/platform/go-back', headers: fleet, payload: { version: '0.12.0' } })).statusCode).toBe(403);
    expect((await registry.inject({ method: 'POST', url: '/v1/platform/updates/check', headers: fleet })).statusCode).toBe(403);
  });
});
