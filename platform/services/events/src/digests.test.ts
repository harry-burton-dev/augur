import { describe, expect, it } from 'vitest';
import { DATABASE_URL, eventsDb } from './db.testing.ts';
import { dayIn, digestPeriod, sendDigests, type DigestKind } from './digests.ts';
import type { NoticeMailer, NoticeSettings } from './notice-emails.ts';

const db = eventsDb();

const settings = (person: string, more: Partial<NoticeSettings> = {}): NoticeSettings => ({
  person,
  email: `${person}@example.org`,
  language: 'en',
  timeZone: 'Europe/London',
  emailOn: true,
  digest: 'daily',
  quietKinds: [],
  muted: [],
  ...more,
});

describe('when a digest is due', () => {
  it('is 08:00 in the person’s time zone, on Mondays for weekly', () => {
    // Monday 9 November 2026.
    expect(digestPeriod('daily', new Date('2026-11-09T07:59:00Z'), 'Europe/London')).toBeUndefined();
    expect(digestPeriod('daily', new Date('2026-11-09T08:00:00Z'), 'Europe/London')).toBe('2026-11-09');
    expect(digestPeriod('weekly', new Date('2026-11-09T09:00:00Z'), 'Europe/London')).toBe('2026-11-09');
    expect(digestPeriod('weekly', new Date('2026-11-10T09:00:00Z'), 'Europe/London')).toBeUndefined();
    // 23:30 UTC on Sunday is 08:30 on Monday in Tokyo.
    expect(digestPeriod('weekly', new Date('2026-11-08T23:30:00Z'), 'Asia/Tokyo')).toBe('2026-11-09');
    expect(dayIn(new Date('2026-11-08T23:30:00Z'), 'Not/AZone')).toEqual({ date: '2026-11-08', weekday: 7 });
  });
});

describe.runIf(DATABASE_URL)('sending digests', () => {
  const monday = new Date('2026-11-09T09:30:00Z');
  const mailer = () => {
    const sent: { to: string; subject: string; lines: string[]; url?: string }[] = [];
    const m: NoticeMailer = {
      configured: true,
      productName: 'Skein',
      async sendNotice(to, n) {
        sent.push({ to, subject: n.subject, lines: n.lines, url: n.action?.url });
        return { sent: true, id: 'm' };
      },
    };
    return { m, sent };
  };
  /** Notifications for a person, made an hour before Monday morning, a second apart in the order given. */
  const add = async (person: string, titles: string[]) => {
    const made = [];
    for (const title of titles) made.push(...(await db.store.addNotifications({ app: 'folio', recipients: [person], level: 'info', title })));
    // Distinct times, so newest first is one order (the same time left it to the ids, which are random).
    for (const [i, n] of made.entries()) await db.pool.query('update events.notifications set created_at = $1 where id = $2', [new Date(monday.getTime() - 3_600_000 + i * 1000), n.id]);
    return made;
  };
  const run = (kind: DigestKind, people: NoticeSettings[], m: NoticeMailer, at = monday) =>
    sendDigests({ kind, people: async () => people, store: db.store.digests, mailer: m, platformUrl: 'https://augur.example.org', now: () => at });

  it('gathers what they haven’t read and weren’t emailed, once a morning', async () => {
    const [, read, emailed] = await add('u-1', ['Budget paper shared', 'Read already', 'Emailed already', 'Agenda updated']);
    await db.store.setRead('u-1', read.id, true);
    await db.store.emails.sent(emailed.id);
    const people = [settings('u-1'), settings('u-2'), settings('u-3', { email: undefined }), settings('u-4', { quietHours: { from: '09:00', to: '10:00' } })];
    const { m, sent } = mailer();
    expect(await run('daily', people, m)).toEqual({ sent: 1, empty: 1, notYet: 2, failed: 0 });
    expect(sent).toEqual([{ to: 'u-1@example.org', subject: 'Your day in Skein: 2 unread', lines: ['Agenda updated', 'Budget paper shared'], url: 'https://augur.example.org/' }]);
    // The same morning again: nothing more.
    expect(await run('daily', people, m)).toEqual({ sent: 0, empty: 0, notYet: 2, failed: 0 });
    expect(sent).toHaveLength(1);
  });

  it('waits for Monday for the weekly one, and links straight to a lone notification', async () => {
    const [only] = await add('u-1', ['Budget paper shared']);
    const { m, sent } = mailer();
    expect(await run('weekly', [settings('u-1', { digest: 'weekly' })], m, new Date('2026-11-10T09:30:00Z'))).toMatchObject({ sent: 0, notYet: 1 });
    expect(await run('weekly', [settings('u-1', { digest: 'weekly' })], m)).toMatchObject({ sent: 1 });
    expect(sent[0]).toMatchObject({ subject: 'Your week in Skein: 1 unread', url: `https://augur.example.org/?notice=${only.id}` });
  });

  it('sends nothing without a relay', async () => {
    await add('u-1', ['Budget paper shared']);
    const off: NoticeMailer = { configured: false, productName: 'AUGUR', sendNotice: async () => ({ sent: false, reason: 'off' }) };
    expect(await run('daily', [settings('u-1')], off)).toEqual({ sent: 0, empty: 0, notYet: 0, failed: 0 });
  });
});
