import { describe, expect, it } from 'vitest';
import { callerHeaders } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { MemoryAppStore } from './store.ts';
import { UpdateChecker, type FeedRelease, type ReleaseManifest } from './updates.ts';

const admin = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });
const deployer = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin', 'deployment-admin'] });
const updater = { authorization: 'Bearer platform-updater' };
const verifyService = async (headers: Record<string, string | string[] | undefined>) => {
  const m = /^Bearer platform-(\S+)$/.exec(String(headers.authorization ?? ''));
  return m ? { kind: 'platform' as const, name: m[1] } : undefined;
};
const images = { registry: 'ghcr.io/o/r/registry@sha256:aa' };
const manifest = (version: string): ReleaseManifest => ({
  version,
  channel: 'stable',
  upgradeFrom: '>=0.1.0',
  changed: ['@augur/registry'],
  breaking: [],
  settings: { all: ['PLATFORM_URL'], required: ['PLATFORM_URL'], added: [], removed: [] },
  parts: { '@augur/registry': { version } },
  images,
});
const release = (version: string): FeedRelease => ({ version, channel: 'stable', manifest: manifest(version) });

/** A production server on 0.13.0, with `releases` out, at `at`. */
const server = async (releases: FeedRelease[], at: string, store = new MemoryAppStore()) => {
  const updates = new UpdateChecker({ feed: async () => releases, running: { version: '0.13.0', channel: 'stable' }, channel: 'stable', ring: 'production' });
  await updates.check();
  const entries: { action: string; target?: string; detail?: Record<string, unknown> }[] = [];
  const app = await buildApp({ verifyService, store, updates, timeZone: 'Europe/London', now: () => new Date(at), audit: async (e) => void entries.push(e) });
  return { app, store, entries };
};
const SUNDAY_2AM = '2026-11-01T02:30:00Z';
const MONDAY = '2026-11-02T12:00:00Z';

describe('the Upgrade Centre overview (ADR 0020)', () => {
  it('shows AUGUR with its default record, in a sentence, and what Automatic does with the next release', async () => {
    const { app } = await server([release('0.13.1'), release('0.13.0')], MONDAY);
    expect((await app.inject({ method: 'GET', url: '/v1/platform/overview', headers: editor })).statusCode).toBe(403);
    const view = (await app.inject({ method: 'GET', url: '/v1/platform/overview', headers: admin })).json();
    expect(view).toMatchObject({ ring: 'production', timeZone: 'Europe/London', needsYou: [] });
    expect(view.units[0]).toMatchObject({
      unit: 'augur',
      running: '0.13.0',
      available: '0.13.1',
      desired: { policy: 'automatic', automaticUpTo: 'patch', windows: [{ day: 0, start: '02:00', hours: 2 }], timeZone: 'Europe/London', isDefault: true },
      policy: 'Automatic: patch releases install by themselves in Sunday 02:00 for 2 hours (Europe/London). Anything bigger waits for an admin.',
      window: { open: false, nextAt: '2026-11-08T02:00:00.000Z' },
      automatic: { takes: '0.13.1' },
    });
  });

  it('upgrades AUGUR by itself only inside its window, and only as far as its record reaches', async () => {
    const outside = await server([release('0.13.1'), release('0.13.0')], MONDAY);
    expect((await outside.app.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: updater })).statusCode).toBe(204);

    const inside = await server([release('0.13.1'), release('0.13.0')], SUNDAY_2AM);
    const target = (await inside.app.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: updater })).json();
    expect(target).toMatchObject({ from: '0.13.0', version: '0.13.1', images });
    expect(inside.entries.map((e) => `${e.action} ${e.target} ${e.detail?.automatic}`)).toEqual(['platform.upgrade-requested 0.13.1 true']);

    const minor = await server([release('0.14.0'), release('0.13.0')], SUNDAY_2AM);
    expect((await minor.app.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: updater })).statusCode).toBe(204);
    const view = (await minor.app.inject({ method: 'GET', url: '/v1/platform/overview', headers: admin })).json();
    expect(view.units[0].automatic).toEqual({ waits: '0.14.0 is a minor release, and Automatic takes patch releases only.' });
  });

  it('lets a deployment admin change AUGUR’s record, refuses a bad one, keeps the history and audits it', async () => {
    const { app, entries } = await server([release('0.14.0'), release('0.13.0')], SUNDAY_2AM);
    const set = (payload: Record<string, unknown>, headers = deployer) => app.inject({ method: 'PUT', url: '/v1/platform/units/augur/desired-state', headers, payload });
    const record = { channel: 'stable', policy: 'automatic', automaticUpTo: 'minor', windows: [{ day: 0, start: '02:00', hours: 3 }], pin: '0.x' };
    expect((await set(record, editor)).statusCode).toBe(403);
    // An organisation admin alone doesn't decide what the server runs (ADR 0022).
    expect((await set(record, admin)).json()).toMatchObject({ error: 'forbidden', requiredRole: 'deployment-admin' });
    expect((await set({ ...record, channel: 'beta' })).json().message).toBe('AUGUR follows stable releases, set by RELEASE_CHANNEL in .env (docs/upgrade.md). Change it there.');
    expect((await set({ ...record, pin: 'latest' })).json().message).toBe('“latest” isn’t a version range. Use one such as 0.13.x or ^1.2.0.');
    expect((await app.inject({ method: 'PUT', url: '/v1/platform/units/nothing/desired-state', headers: deployer, payload: record })).statusCode).toBe(404);

    const view = (await set(record)).json();
    expect(view.units[0]).toMatchObject({ desired: { automaticUpTo: 'minor', pin: '0.x', setBy: 'u-1', isDefault: false }, automatic: { takes: '0.14.0' } });
    expect(entries.at(-1)).toMatchObject({ action: 'platform.desired-state-set', target: 'augur' });
    await set({ ...record, policy: 'hold' });
    const history = (await app.inject({ method: 'GET', url: '/v1/platform/units/augur/desired-state/history', headers: admin })).json().history;
    expect(history.map((h: { policy: string }) => h.policy)).toEqual(['hold', 'automatic']);
    // On hold nothing starts by itself, even inside the window.
    expect((await app.inject({ method: 'GET', url: '/v1/platform/upgrade/target', headers: updater })).statusCode).toBe(204);
  });

  it('keeps a go-back in Needs you until an admin marks it looked at, for every admin', async () => {
    const { app, store } = await server([release('0.13.1'), release('0.13.0')], MONDAY);
    await store.requestUpgrade({ id: 'up-1', from: '0.13.0', version: '0.13.1', images, requestedBy: 'u-1' });
    await store.progressUpgrade('up-1', { step: 'roll-back', state: 'done' }, { state: 'rolled-back', message: 'identity didn’t get ready in 120 s' });
    const view = (await app.inject({ method: 'GET', url: '/v1/platform/overview', headers: admin })).json();
    expect(view.needsYou).toEqual([{ kind: 'went-back', unit: 'augur', message: 'AUGUR went back to 0.13.0 by itself: identity didn’t get ready in 120 s', result: { kind: 'upgrade', id: 'up-1' } }]);
    expect((await app.inject({ method: 'POST', url: '/v1/platform/results/upgrade/nope/seen', headers: admin })).statusCode).toBe(404);
    const seen = (await app.inject({ method: 'POST', url: '/v1/platform/results/upgrade/up-1/seen', headers: admin })).json();
    expect(seen.needsYou).toEqual([]);
    expect(seen.units[0].lastResult).toMatchObject({ id: 'up-1', state: 'rolled-back', seenBy: 'u-1' });
  });
});
