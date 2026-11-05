import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backupStatus, HealthMonitor, probesFor, publicAccess } from './status.ts';

const gateway = { version: '0.2.0', api: 'v1' };

/** A fetch that answers each URL from the table after `ms` of real time, moving the test clock on 10 ms. */
const fakeFetch = (clock: { t: number }, answers: Record<string, { status?: number; body?: unknown; ms?: number } | 'unreachable'>) =>
  (async (url: string | URL | Request) => {
    const a = answers[String(url)];
    await new Promise((resolve) => setTimeout(resolve, typeof a === 'object' ? (a.ms ?? 0) : 0));
    if (!a || a === 'unreachable') throw new TypeError('fetch failed');
    clock.t += 10;
    return new Response(JSON.stringify(a.body ?? {}), { status: a.status ?? 200 });
  }) as typeof fetch;

describe('probesFor', () => {
  it('checks each upstream’s /healthz, telling platform services from apps, and the sign-in keys', () => {
    expect(probesFor({ registry: 'http://registry:8082/', library: 'http://library:8083' }, ['registry'], 'http://kc/certs')).toEqual([
      { name: 'registry', kind: 'service', url: 'http://registry:8082/healthz' },
      { name: 'library', kind: 'app', url: 'http://library:8083/healthz' },
      { name: 'sign-in', kind: 'sign-in', url: 'http://kc/certs' },
    ]);
  });
});

describe('HealthMonitor', () => {
  const probes = probesFor({ registry: 'http://registry', events: 'http://events', library: 'http://library' }, ['registry', 'events']);

  it('reads every component from its last answer, the gateway first', async () => {
    const clock = { t: 1_000_000 };
    const monitor = new HealthMonitor({
      probes,
      slowMs: 500,
      fetchImpl: fakeFetch(clock, {
        'http://registry/healthz': { body: { status: 'ok', version: '0.4.0', api: 'v1' } },
        'http://events/healthz': { body: { version: '0.3.0' }, ms: 1_000 },
        'http://library/healthz': 'unreachable',
      }),
    });
    await monitor.checkAll();
    const rows = monitor.snapshot(gateway);
    expect(rows.map((r) => [r.name, r.state])).toEqual([
      ['gateway', 'up'],
      ['registry', 'up'],
      ['events', 'slow'],
      ['library', 'down'],
    ]);
    expect(rows[1]).toMatchObject({ kind: 'service', version: '0.4.0', api: 'v1' });
    expect(rows[3]).toMatchObject({ kind: 'app', problem: 'It can’t be reached.' });
    expect(rows[3].seenAt).toBeUndefined();
  });

  it('checks apps found each round too, keeping the last ones found when they can’t be', async () => {
    const clock = { t: 0 };
    let found: () => Promise<{ name: string; kind: 'app'; url: string }[]> = async () => [{ name: 'notes', kind: 'app', url: 'http://notes/healthz' }, { name: 'registry', kind: 'app', url: 'http://elsewhere/healthz' }];
    const monitor = new HealthMonitor({
      probes: probes.slice(0, 1),
      moreProbes: () => found(),
      now: () => clock.t,
      fetchImpl: fakeFetch(clock, { 'http://registry/healthz': { body: { version: '0.4.0' } }, 'http://notes/healthz': { body: { version: '1.0.0' } } }),
    });
    await monitor.checkAll();
    found = async () => Promise.reject(new Error('registry down'));
    await monitor.checkAll();
    expect(monitor.snapshot(gateway).map((c) => [c.name, c.kind, c.version])).toEqual([
      ['gateway', 'gateway', '0.2.0'],
      ['registry', 'service', '0.4.0'],
      ['notes', 'app', '1.0.0'],
    ]);
  });

  it('says what an error answer was, and keeps when it was last seen', async () => {
    const clock = { t: 0 };
    const answers: Parameters<typeof fakeFetch>[1] = { 'http://registry/healthz': { body: { version: '1.0.0' } } };
    const monitor = new HealthMonitor({ probes: probes.slice(0, 1), now: () => clock.t, fetchImpl: fakeFetch(clock, answers) });
    await monitor.checkAll();
    answers['http://registry/healthz'] = { status: 503 };
    await monitor.checkAll();
    const [, registry] = monitor.snapshot(gateway);
    expect(registry).toMatchObject({ state: 'down', problem: 'It answered 503.', version: '1.0.0' });
    expect(registry.seenAt).toBe(new Date(10).toISOString());
  });

  it('shows checking before the first answer, and down once two minutes pass with none', () => {
    const clock = { t: 0 };
    const monitor = new HealthMonitor({ probes: probes.slice(0, 1), now: () => clock.t, fetchImpl: fakeFetch(clock, {}) });
    expect(monitor.snapshot(gateway)[1].state).toBe('checking');
    clock.t = 120_000;
    expect(monitor.snapshot(gateway)[1]).toMatchObject({ state: 'down', problem: 'It hasn’t answered for 2 minutes.' });
  });

  it('turns a component down when it goes quiet, even while a check hangs', async () => {
    const clock = { t: 0 };
    const monitor = new HealthMonitor({ probes: probes.slice(0, 1), now: () => clock.t, fetchImpl: fakeFetch(clock, { 'http://registry/healthz': {} }) });
    await monitor.checkAll();
    clock.t += 119_000;
    expect(monitor.snapshot(gateway)[1].state).toBe('up');
    clock.t += 2_000;
    expect(monitor.snapshot(gateway)[1].state).toBe('down');
  });
});

describe('backupStatus', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');
  const folder = async (files: Record<string, object>) => {
    const dir = await mkdtemp(join(tmpdir(), 'backups-'));
    for (const [name, body] of Object.entries(files)) await writeFile(join(dir, name), JSON.stringify(body));
    return dir;
  };
  const backup = { at: '2026-10-22T02:00:00Z', ok: true, file: 'platform-2026-10-22.sql.gz', bytes: 52_000 };
  const restored = { at: '2026-10-19T02:01:00Z', from: 'offsite', ok: true, file: 'platform-2026-10-19.sql.gz', seconds: 4, people: 3, apps: 1, auditEntries: 120 };
  const offsite = { at: '2026-10-22T02:01:00Z', ok: true, snapshot: '83ebc741', keepDays: 30 };
  const all = { 'last-backup.json': backup, 'offsite.json': offsite, 'restore-test.json': restored };

  it('is fine with last night’s backup copied off the server and a restore from that copy this week', async () => {
    const status = await backupStatus(await folder(all), now);
    expect(status).toEqual({ state: 'ok', lastBackup: backup, offsite, lastRestoreTest: restored });
  });

  it('needs a look while backups stay on the server, and when the copy off it fails, is stale or isn’t restored from', async () => {
    const problem = async (files: Record<string, object>) => (await backupStatus(await folder({ ...all, ...files }), now)).problem;
    const only = await backupStatus(await folder({ 'last-backup.json': backup, 'restore-test.json': { ...restored, from: 'local' } }), now);
    expect(only.state).toBe('attention');
    expect(only.problem).toMatch(/on this server only.*OFFSITE_REPOSITORY/);
    expect(await problem({ 'offsite.json': { ...offsite, ok: false, problem: 'Backups could not be copied off this server: wrong password.' } })).toMatch(/wrong password/);
    expect(await problem({ 'offsite.json': { ...offsite, at: '2026-10-20T02:01:00Z' } })).toMatch(/off the server is more than a day old/);
    expect(await problem({ 'restore-test.json': { ...restored, from: 'local' } })).toMatch(/restored from the off-server copy yet/);
  });

  it('can go back to a point in time when Postgres archives, base backups are taken and this week’s replay worked', async () => {
    const pitr = { at: '2026-10-22T11:00:00Z', ok: true, bases: 7, earliest: '2026-10-16T02:01:00Z', archivedAt: '2026-10-22T10:58:00Z' };
    const test = { at: '2026-10-19T02:03:00Z', ok: true, base: 'base-2026-10-19', seconds: 12, mark: '2026-10-19T02:02:50Z', reached: '2026-10-19T02:02:51Z' };
    const fine = await backupStatus(await folder({ ...all, 'pitr.json': pitr, 'pitr-test.json': test }), now);
    expect(fine).toEqual({ state: 'ok', lastBackup: backup, offsite, pointInTime: { ...pitr, lastTest: test }, lastRestoreTest: restored });
    const problem = async (files: Record<string, object>) => (await backupStatus(await folder({ ...all, 'pitr-test.json': test, ...files }), now)).problem;
    expect(await problem({ 'pitr.json': { ...pitr, ok: false, problem: 'Postgres is not archiving its changes yet.' } })).toMatch(/not archiving/);
    expect(await problem({ 'pitr.json': { ...pitr, at: '2026-10-22T08:00:00Z' } })).toMatch(/over three hours/);
    expect(await problem({ 'pitr.json': pitr, 'pitr-test.json': { ...test, ok: false, problem: 'Some archived WAL is missing.' } })).toBe(
      'The last point-in-time restore test failed: Some archived WAL is missing.',
    );
    expect(await problem({ 'pitr.json': pitr, 'pitr-test.json': { ...test, at: '2026-10-12T02:00:00Z' } })).toMatch(/over a week/);
    expect((await backupStatus(await folder({ ...all, 'pitr.json': pitr }), now)).problem).toMatch(/not been tested yet/);
  });

  it('needs a look with no backup, a failed or stale one, or no recent good restore', async () => {
    const problem = async (files: Record<string, object>) => (await backupStatus(await folder(files), now)).problem;
    expect(await problem({})).toBe('No backup has been taken yet.');
    expect(await problem({ 'last-backup.json': { ...backup, ok: false, problem: 'The database could not be dumped. Earlier backups are kept.' } })).toMatch(/could not be dumped/);
    expect(await problem({ 'last-backup.json': { ...backup, at: '2026-10-20T02:00:00Z' }, 'restore-test.json': restored })).toMatch(/more than a day old/);
    expect(await problem({ 'last-backup.json': backup })).toBe('No backup has been test-restored yet.');
    expect(await problem({ 'last-backup.json': backup, 'restore-test.json': { ...restored, ok: false, problem: 'Sign-in came back with nobody in it.' } })).toBe(
      'The last restore test failed: Sign-in came back with nobody in it.',
    );
    expect(await problem({ 'last-backup.json': backup, 'restore-test.json': { ...restored, at: '2026-10-12T02:00:00Z' } })).toMatch(/over a week/);
  });
});

describe('publicAccess', () => {
  const now = Date.parse('2026-10-28T16:00:00Z');
  const file = async (body?: string) => {
    const path = join(await mkdtemp(join(tmpdir(), 'public-')), 'public-until');
    if (body !== undefined) await writeFile(path, body);
    return path;
  };

  it('is open until the time public.sh wrote, while it is still to come', async () => {
    expect(await publicAccess(await file(`${Date.parse('2026-10-28T18:00:00Z') / 1000}\n`), now)).toEqual({ open: true, until: '2026-10-28T18:00:00.000Z' });
  });

  it('is private with no file, an empty one, or a time gone by', async () => {
    expect(await publicAccess(await file(), now)).toEqual({ open: false });
    expect(await publicAccess(await file(''), now)).toEqual({ open: false });
    expect(await publicAccess(await file(`${Date.parse('2026-10-28T15:00:00Z') / 1000}`), now)).toEqual({ open: false });
  });
});
