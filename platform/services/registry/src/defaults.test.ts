// P8 (spec 9.7): default apps install from the feed on their first chance, their asks agreed by the deployment,
// and can't be removed while the deployment names them.
import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { AppUpdateChecker, type AppFeedRelease } from './app-updates.ts';
import { UpdateChecker } from './updates.ts';
import { DATABASE_URL, registryDb } from './db.testing.ts';
import { releaseOf } from './release3.testing.ts';
import { defaultsPlan, parseDefaultApps } from './defaults.ts';
import type { AppRelease } from './store.ts';

const db = registryDb();
const feedOf = (...releases: AppRelease[]): AppFeedRelease[] =>
  releases.map((r) => ({ app: r.id, version: r.version, channel: r.channel === 'stable' ? 'stable' : 'beta', release: r }));

describe('DEFAULT_APPS', () => {
  it('reads ids split by commas or spaces, and refuses one that isn’t an app’s', () => {
    expect(parseDefaultApps(' notes, maps  board ')).toEqual({ apps: ['notes', 'maps', 'board'], problems: [] });
    expect(parseDefaultApps(undefined)).toEqual({ apps: [], problems: [] });
    const bad = parseDefaultApps('Notes registry');
    expect(bad.apps).toEqual([]);
    expect(bad.problems).toEqual([expect.stringContaining('"Notes" in DEFAULT_APPS isn’t an app id'), expect.stringContaining('DEFAULT_APPS:')]);
  });

  it('says why a default app waits: no stable release yet, one that can’t install, or a setting it needs', () => {
    const base = { installed: [], asked: [], problemOf: () => undefined, hasValue: () => false, feedUsable: true };
    const beta = releaseOf('notes', '1.0.0-beta.1', { scopes: [] }, { channel: 'beta' });
    expect(defaultsPlan({ ...base, defaults: ['notes'], releases: feedOf(beta) })).toEqual({ install: [], states: [{ app: 'notes', state: 'waiting', problem: expect.stringContaining('no stable release of notes') }] });
    const stable = releaseOf('notes', '1.0.0', { scopes: [] });
    expect(defaultsPlan({ ...base, defaults: ['notes'], releases: feedOf(stable), problemOf: () => 'It’s halted.' }).states).toEqual([{ app: 'notes', state: 'waiting', problem: 'It’s halted.' }]);
    const needsKey = releaseOf('notes', '1.0.0', { scopes: [], contributes: { settings: [{ id: 'apiKey', label: 'API key', type: 'secret', required: true }] } } as never);
    expect(defaultsPlan({ ...base, defaults: ['notes'], releases: feedOf(needsKey) }).states[0]?.problem).toMatch(/needs API key/);
    expect(defaultsPlan({ ...base, defaults: ['notes'], releases: feedOf(needsKey), hasValue: () => true }).install).toHaveLength(1);
    expect(defaultsPlan({ ...base, defaults: ['notes'], releases: feedOf(stable), feedUsable: false }).states[0]?.state).toBe('waiting');
  });
});

describe.runIf(DATABASE_URL)('a default app', () => {
  const fresh = () => callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin', 'deployment-admin'], signedInAt: new Date().toISOString() });
  const verifyService = async (headers: Record<string, string | string[] | undefined>) =>
    headers.authorization === 'Bearer platform-updater' ? { kind: 'platform' as const, name: 'updater' } : undefined;
  const runner = { authorization: 'Bearer platform-updater' };

  it('installs from the feed on first start with its asks agreed by the deployment, once, and can’t be removed', async () => {
    let minutes = 0;
    const checker = new AppUpdateChecker(async () => feedOf(releaseOf('notes', '1.0.0', { scopes: ['audit:write'] })), () => new Date(Date.UTC(2026, 10, 9, 12, minutes++)));
    const entries: { action: string; target?: string; detail?: Record<string, unknown> }[] = [];
    const server = await db.app({ verifyService, appUpdates: checker, updates: new UpdateChecker({ running: { version: '0.9.0', channel: 'beta' } }), audit: async (e) => void entries.push(e), defaultApps: ['notes', 'maps'] });
    await checker.check();
    const view = async () => (await server.inject({ method: 'GET', url: '/v1/app-runner/apps', headers: fresh() })).json();
    expect((await view()).defaultApps).toEqual([
      { app: 'notes', state: 'asked' },
      { app: 'maps', state: 'waiting', problem: expect.stringContaining('no stable release of maps') },
    ]);
    const job = (await server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: runner })).json();
    expect(job).toMatchObject({ app: 'notes', action: 'install', requestedBy: 'deployment', release: { version: '1.0.0' } });
    expect(entries.find((e) => e.action === 'app.install-requested' && e.target === 'notes')?.detail).toMatchObject({ version: '1.0.0', default: true, agreedBy: 'this deployment' });
    await server.inject({ method: 'POST', url: `/v1/app-runner/jobs/${job.id}/progress`, headers: runner, payload: { step: 'switch', state: 'done', outcome: 'done' } });
    expect((await view()).installed).toEqual([expect.objectContaining({ app: 'notes', default: true })]);
    // Removed only by taking it out of DEFAULT_APPS first.
    const remove = await server.inject({ method: 'POST', url: '/v1/app-runner/jobs', headers: fresh(), payload: { action: 'remove', app: 'notes' } });
    expect(remove.statusCode).toBe(409);
    expect(remove.json().message).toMatch(/one of this deployment’s default apps \(DEFAULT_APPS\)/);
    // Asked for once: a later check asks for nothing more.
    await checker.check();
    expect((await server.inject({ method: 'GET', url: '/v1/app-runner/next', headers: runner })).statusCode).toBe(204);
  });
});
