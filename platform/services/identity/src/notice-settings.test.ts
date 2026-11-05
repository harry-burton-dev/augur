import { describe, expect, it } from 'vitest';
import { MemoryAccounts } from './me.ts';
import { settingsFrom } from './notice-settings.ts';
import { DATABASE_URL, identityDb } from './db.testing.ts';

const db = identityDb();

const verifyService = async (headers: Record<string, string | string[] | undefined>) =>
  ({ 'Bearer events': { kind: 'platform', name: 'events' } as const, 'Bearer registry': { kind: 'platform', name: 'registry' } as const })[String(headers.authorization)];

describe('notice settings', () => {
  it('sends only to a confirmed address, in their language and time zone, else the deployment’s and the organisation’s', () => {
    expect(settingsFrom('u-1', {}, { email: 'a@x.org', emailVerified: false }, 'Europe/Paris', ['fr', 'en'])).toEqual({
      person: 'u-1',
      language: 'fr',
      timeZone: 'Europe/Paris',
      emailOn: true,
      digest: 'off',
      quietKinds: [],
      muted: [],
    });
    expect(
      settingsFrom(
        'u-1',
        { timeZone: 'Asia/Tokyo', quietKinds: ['mandate:asks'], notifications: { email: false, digest: 'weekly', quietHours: { from: '19:00', to: '08:00' } } },
        { email: 'a@x.org', emailVerified: true, locale: 'de' },
        'Europe/Paris',
        ['en'],
      ),
    ).toMatchObject({ email: 'a@x.org', language: 'de', timeZone: 'Asia/Tokyo', emailOn: false, digest: 'weekly', quietHours: { from: '19:00', to: '08:00' }, quietKinds: ['mandate:asks'] });
  });
});

describe.runIf(DATABASE_URL)('GET /v1/notice-settings', () => {
  it('answers the events service only, for the people named or everyone with a digest', async () => {
    const accounts = new MemoryAccounts();
    accounts.add('u-1', { username: 'alex', email: 'alex@example.org', emailVerified: true });
    accounts.add('u-2', { username: 'sam' });
    await db.store.put('u-1', { notifications: { digest: 'daily' } });
    await db.store.put('u-2', { notifications: { digest: 'weekly' } });
    await db.store.put('u-gone', { notifications: { digest: 'daily' } });
    await db.organisation.put({ timeZone: 'Europe/London' });
    const app = await db.app({ accounts, verifyService });
    const ask = (query: string, as = 'events') => app.inject({ method: 'GET', url: `/v1/notice-settings?${query}`, headers: { authorization: `Bearer ${as}` } });
    expect((await ask('ids=u-1', 'registry')).statusCode).toBe(403);
    expect((await ask('')).statusCode).toBe(400);
    const named = (await ask('ids=u-1,u-2,u-1')).json().people;
    expect(named).toEqual([expect.objectContaining({ person: 'u-1', email: 'alex@example.org', timeZone: 'Europe/London', digest: 'daily' }), expect.objectContaining({ person: 'u-2', digest: 'weekly' })]);
    expect(named[1].email).toBeUndefined();
    // Someone whose account is gone isn't emailed.
    expect((await ask('digest=daily')).json().people.map((p: { person: string }) => p.person)).toEqual(['u-1']);
  });
});
