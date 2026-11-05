import { describe, expect, it } from 'vitest';
import { ACTIVITY_KEEP_DAYS, policyKeepDays, pruneActivity, untilNight } from './retention.ts';
import { MemoryEventStore } from './store.ts';

const credentials = { name: 'events', getToken: async () => 't' };

describe('Activity retention', () => {
  it('removes entries older than the period, and records that it did', async () => {
    const store = new MemoryEventStore();
    const old = await store.appendAudit({ actor: { id: 'u-1', kind: 'user' }, app: 'library', action: 'document.published' });
    old.at = new Date(Date.now() - 10 * 86_400_000).toISOString();
    await store.appendAudit({ actor: { id: 'u-1', kind: 'user' }, app: 'library', action: 'document.updated' });
    expect(await pruneActivity(store, async () => ({ days: 7 }))).toMatchObject({ removed: 1, days: 7 });
    const left = await store.audit({ limit: 10 });
    expect(left.map((e) => e.action)).toEqual(['audit.pruned', 'document.updated']);
    expect(left[0]!.detail).toMatchObject({ removed: 1, keepDays: 7 });
    // Nothing old: nothing removed, nothing recorded.
    expect((await pruneActivity(store, async () => ({ days: 7 }))).removed).toBe(0);
    expect(await store.audit({ limit: 10 })).toHaveLength(2);
  });

  it('reads the period from the organisation’s policy, or uses the default and says why', async () => {
    const answer = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
    expect(await policyKeepDays({ identityUrl: 'http://identity', credentials, fetchImpl: answer(200, { activityRetentionDays: 90 }) })()).toEqual({ days: 90 });
    expect(await policyKeepDays({ identityUrl: 'http://identity', credentials, fetchImpl: answer(404, {}) })()).toEqual({ days: ACTIVITY_KEEP_DAYS, defaulted: 'identity answered 404' });
    expect((await policyKeepDays({ identityUrl: 'http://identity', credentials, fetchImpl: answer(200, { activityRetentionDays: 0 }) })()).days).toBe(ACTIVITY_KEEP_DAYS);
    expect((await policyKeepDays({ identityUrl: 'http://identity' })()).defaulted).toContain('no sign-in');
  });

  it('waits until the next night', () => {
    expect(untilNight(Date.parse('2026-11-05T01:00:00Z'))).toBe(2 * 3_600_000);
    expect(untilNight(Date.parse('2026-11-05T03:00:00Z'))).toBe(24 * 3_600_000);
  });
});
