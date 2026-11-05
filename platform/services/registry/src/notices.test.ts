import { describe, expect, it } from 'vitest';
import type { NewNotification } from '@augur/service-kit';
import type { Overview, UnitOverview } from './overview.ts';
import { noticesFrom, updateNotices } from './notices.ts';
import { MemoryAppStore } from './store.ts';

const now = new Date('2026-11-02T10:00:00Z');
const unit = (over: Partial<UnitOverview> & Pick<UnitOverview, 'unit' | 'name' | 'running'>): UnitOverview => ({
  desired: { unit: over.unit, channel: 'stable', policy: 'automatic', automaticUpTo: 'patch', windows: [], timeZone: 'UTC', setBy: '', setAt: '', isDefault: true },
  policy: 'Automatic: patch releases install by themselves at any time. Anything bigger waits for an admin.',
  window: { open: true },
  ...over,
});
const overview = (...units: UnitOverview[]): Overview => ({ ring: 'production', timeZone: 'UTC', feed: 'on', units, needsYou: [] });

describe('update notices', () => {
  it('tells deployment admins about a new release, once per version, saying whether it waits for them', () => {
    const [takes, waits] = noticesFrom(
      overview(
        unit({ unit: 'augur', name: 'AUGUR', running: '0.14.0', available: '0.14.1', automatic: { takes: '0.14.1' } }),
        unit({ unit: 'folio', name: 'Artifacts', running: '1.2.0', available: '1.3.0', automatic: { waits: '1.3.0 is a minor release, and Automatic takes patch releases only.' } }),
      ),
      now,
    );
    expect(takes).toMatchObject({ app: 'upgrades', audience: ['role:deployment-admin'], key: 'available:augur:0.14.1', level: 'info', title: 'AUGUR 0.14.1 is available', link: '/augur' });
    expect(waits).toMatchObject({ key: 'available:folio:1.3.0', level: 'needs', title: 'Artifacts 1.3.0 is ready to install', detail: expect.stringContaining('minor release'), link: '/apps/folio' });
  });

  it('offers nothing on hold, or while an upgrade is under way', () => {
    const held = unit({ unit: 'augur', name: 'AUGUR', running: '0.14.0', available: '0.15.0' });
    held.desired.policy = 'hold';
    const busy = unit({ unit: 'folio', name: 'Artifacts', running: '1.2.0', available: '1.2.1', open: { id: 'j1', state: 'running' } });
    expect(noticesFrom(overview(held, busy), now)).toEqual([]);
  });

  it('tells admins how an update ended while it is news', () => {
    const result = (state: 'done' | 'rolled-back' | 'failed' | 'cancelled', extra: object = {}, finishedAt = '2026-11-02T09:50:00Z') =>
      unit({ unit: 'augur', name: 'AUGUR', running: '0.15.0', lastResult: { kind: 'upgrade', id: `u-${state}`, from: '0.14.0', version: '0.15.0', state, finishedAt, ...extra } });
    const [done] = noticesFrom(overview(result('done')), now);
    expect(done).toMatchObject({ audience: ['role:deployment-admin', 'role:admin'], key: 'result:upgrade:u-done', level: 'done', title: 'AUGUR 0.15.0 is installed', detail: 'It was on 0.14.0.' });
    expect(noticesFrom(overview(result('rolled-back', { message: 'Sign-in stopped working.' })), now)[0]).toMatchObject({ level: 'failed', title: 'AUGUR went back to 0.14.0 by itself', detail: 'Sign-in stopped working.' });
    expect(noticesFrom(overview(result('failed')), now)[0]).toMatchObject({ level: 'failed', title: 'AUGUR 0.15.0 didn’t install' });
    expect(noticesFrom(overview(result('done', { from: '0.16.0' })), now)[0]).toMatchObject({ title: 'AUGUR went back to 0.15.0' });
    expect(noticesFrom(overview(result('failed', { from: '0.16.0' })), now)[0]).toMatchObject({ level: 'failed', urgent: true, title: 'AUGUR didn’t go back to 0.15.0' });
    expect(noticesFrom(overview(result('failed')), now)[0].urgent).toBeUndefined();
    expect(noticesFrom(overview(result('cancelled')), now)).toEqual([]);
    expect(noticesFrom(overview(result('done', {}, '2026-10-30T09:00:00Z')), now)).toEqual([]);
  });

  it('says a halted release is urgent: it stops work', () => {
    const halted = unit({ unit: 'augur', name: 'AUGUR', running: '0.15.0', halted: { reason: 'Sign-in fails.' } } as never);
    expect(noticesFrom(overview(halted), now)[0]).toMatchObject({ key: 'halted:augur:0.15.0', level: 'needs', urgent: true, title: 'AUGUR 0.15.0 was halted by its publisher' });
  });

  it('sends each piece of news once, and tries a failed send again', async () => {
    const sent: NewNotification[] = [];
    let fail = true;
    const updates = { ring: 'production', channel: 'stable', running: { version: '0.14.0' }, result: { releases: [] } } as never;
    const appUpdates = { result: { releases: [] } } as never;
    const store = new MemoryAppStore();
    await store.requestUpgrade({ id: 'u1', from: '0.13.0', version: '0.14.0', images: {}, requestedBy: 'automatic' });
    await store.progressUpgrade('u1', { step: 'verify', state: 'done' }, { state: 'done' });
    const loop = updateNotices({
      eventsUrl: 'http://events',
      credentials: {} as never,
      store,
      updates,
      appUpdates,
      timeZone: 'UTC',
      send: async (n) => {
        if (fail) throw new Error('events is down');
        sent.push(n);
      },
    });
    await loop.tick();
    fail = false;
    await loop.tick();
    await loop.tick();
    expect(sent.map((n) => n.title)).toEqual(['AUGUR 0.14.0 is installed']);
  });
});
