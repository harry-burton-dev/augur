import { serviceHeaders, type ServiceCredentials } from '@augur/service-kit';
import type { EventStore } from './store.ts';

/** The days reported when the organisation's policy can't be read; nothing is removed by them (`pruneActivity`). */
export const ACTIVITY_KEEP_DAYS = 365;

/** The days Activity keeps entries: the organisation's policy from identity, or the default and why it couldn't be read. */
export type KeepDays = () => Promise<{ days: number; defaulted?: string }>;

/** Reads `activityRetentionDays` from identity's organisation policy; any failure falls back to the default, saying why. */
export const policyKeepDays =
  ({ identityUrl, credentials, fetchImpl = fetch }: { identityUrl: string; credentials?: ServiceCredentials; fetchImpl?: typeof fetch }): KeepDays =>
  async () => {
    if (!credentials) return { days: ACTIVITY_KEEP_DAYS, defaulted: 'events has no sign-in of its own to ask identity with' };
    try {
      const res = await fetchImpl(`${identityUrl.replace(/\/$/, '')}/v1/organisation/policy`, { headers: await serviceHeaders(credentials), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return { days: ACTIVITY_KEEP_DAYS, defaulted: `identity answered ${res.status}` };
      const days = ((await res.json()) as { activityRetentionDays?: unknown }).activityRetentionDays;
      return typeof days === 'number' && Number.isInteger(days) && days >= 1 ? { days } : { days: ACTIVITY_KEEP_DAYS, defaulted: 'identity’s policy has no Activity retention' };
    } catch (err) {
      return { days: ACTIVITY_KEEP_DAYS, defaulted: `identity could not be reached (${(err as Error).message})` };
    }
  };

/**
 * Removes Activity entries older than the retention period, and records the removal in Activity when there was
 * one. With no policy to go by nothing goes, and it's tried again next night: the organisation's period can be
 * far longer than the default, and what's removed can't be brought back.
 */
export const pruneActivity = async (store: EventStore, keepDays: KeepDays, now = Date.now) => {
  const { days, defaulted } = await keepDays();
  if (defaulted) return { removed: 0, days, defaulted };
  const removed = await store.pruneAudit(days);
  if (removed) {
    const before = new Date(now() - days * 86_400_000).toISOString();
    await store.appendAudit({ actor: { id: 'events', kind: 'service' }, app: 'events', action: 'audit.pruned', detail: { removed, before, keepDays: days } }, undefined, 'events');
  }
  return { removed, days, defaulted };
};

/** Milliseconds until the next 03:00 UTC, when the nightly jobs run. */
export const untilNight = (now = Date.now()) => {
  const next = new Date(now);
  next.setUTCHours(3, 0, 0, 0);
  if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now;
};
