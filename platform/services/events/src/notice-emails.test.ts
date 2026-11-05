import { describe, expect, it } from 'vitest';
import { DATABASE_URL, eventsDb } from './db.testing.ts';
import { EMAIL_TRIES, identityNoticeSettings, noticeUrl, quietUntil, sendDueEmails, wordsFor, type NoticeMailer, type NoticeSettings } from './notice-emails.ts';

const db = eventsDb();

const settings = (person: string, more: Partial<NoticeSettings> = {}): NoticeSettings => ({
  person,
  email: `${person}@example.org`,
  language: 'en',
  timeZone: 'Europe/London',
  emailOn: true,
  digest: 'off',
  quietKinds: [],
  muted: [],
  ...more,
});

const fakeMailer = (fail = false) => {
  const sent: { to: string; subject: string; lang?: string; url?: string; why?: string }[] = [];
  const mailer: NoticeMailer = {
    configured: true,
    productName: 'Skein',
    async sendNotice(to, n) {
      if (fail) return { sent: false, reason: 'The relay didn’t answer in time.' };
      sent.push({ to, subject: n.subject, lang: n.lang, url: n.action?.url, why: n.why });
      return { sent: true, id: `m-${sent.length}` };
    },
  };
  return { mailer, sent };
};

describe('quiet hours', () => {
  const at = (iso: string) => new Date(iso);
  it('puts an email off until they end, past midnight too, in the person’s time zone', () => {
    const quiet = { from: '19:00', to: '08:00' };
    // 22:30 in London in winter is 22:30 UTC: quiet until 08:00.
    expect(quietUntil(at('2026-11-05T22:30:00Z'), 'Europe/London', quiet)?.toISOString()).toBe('2026-11-06T08:00:00.000Z');
    // 06:00 UTC is 15:00 in Tokyo: not quiet.
    expect(quietUntil(at('2026-11-05T06:00:00Z'), 'Asia/Tokyo', quiet)).toBeUndefined();
    // 12:00 UTC is 21:00 in Tokyo: quiet until 08:00 Tokyo, 23:00 UTC.
    expect(quietUntil(at('2026-11-05T12:00:00Z'), 'Asia/Tokyo', quiet)?.toISOString()).toBe('2026-11-05T23:00:00.000Z');
    expect(quietUntil(at('2026-11-05T13:00:00Z'), 'Europe/London', { from: '12:00', to: '14:00' })?.toISOString()).toBe('2026-11-05T14:00:00.000Z');
    expect(quietUntil(at('2026-11-05T13:00:00Z'), 'Europe/London', { from: '12:00', to: '12:00' })).toBeUndefined();
    expect(quietUntil(at('2026-11-05T13:00:00Z'), 'Europe/London')).toBeUndefined();
  });
});

describe('the words around a notice', () => {
  it('are in the person’s language, else English', () => {
    expect(wordsFor('en-GB').open('Skein')).toBe('Open it in Skein');
    expect(wordsFor('xx').why('Skein')).toContain('Account, Notifications');
    expect(noticeUrl('https://augur.example.org/', 'n 1')).toBe('https://augur.example.org/?notice=n%201');
  });
});

describe('asking identity', () => {
  it('asks as the events service, at most 200 people at a time, and says when identity can’t answer', async () => {
    const asked: { url: string; auth: string }[] = [];
    let status = 200;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      asked.push({ url, auth: (init.headers as Record<string, string>).authorization });
      const ids = new URL(url).searchParams.get('ids')!.split(',');
      return new Response(JSON.stringify({ people: ids.slice(0, 1).map((p) => settings(p)) }), { status });
    }) as unknown as typeof fetch;
    const lookup = identityNoticeSettings({ identityUrl: 'http://identity:8081/', credentials: { name: 'events', getToken: async () => 't' }, fetchImpl });
    const found = await lookup(Array.from({ length: 250 }, (_, i) => `u-${i}`));
    expect(asked.map((a) => [new URL(a.url).pathname, new URL(a.url).searchParams.get('ids')!.split(',').length, a.auth])).toEqual([
      ['/v1/notice-settings', 200, 'Bearer t'],
      ['/v1/notice-settings', 50, 'Bearer t'],
    ]);
    expect([...found.keys()]).toEqual(['u-0', 'u-200']);
    status = 503;
    await expect(lookup(['u-1'])).rejects.toThrow('identity answered 503');
  });
});

describe.runIf(DATABASE_URL)('emailing notices', () => {
  const needs = (recipients: string[], more = {}) => db.store.addNotifications({ app: 'folio', recipients, level: 'needs', title: 'Review the budget paper', detail: 'Due Friday.', kind: 'review', ...more });

  it('emails what needs someone, as they chose, and only once', async () => {
    await needs(['u-1', 'u-2', 'u-3', 'u-4', 'u-5', 'u-6', 'u-gone']);
    await db.store.addNotifications({ app: 'folio', recipients: ['u-1'], level: 'info', title: 'Just so you know' });
    const [read] = await needs(['u-7']);
    await db.store.setRead('u-7', read.id, true);
    const people = new Map(
      [
        settings('u-1', { language: 'fr' }),
        settings('u-2', { email: undefined }),
        settings('u-3', { emailOn: false }),
        settings('u-4', { muted: ['folio'] }),
        settings('u-5', { quietKinds: ['folio:review'] }),
        settings('u-6'),
        settings('u-7'),
      ].map((s) => [s.person, s]),
    );
    const { mailer, sent } = fakeMailer();
    const send = () => sendDueEmails({ outbox: db.store.emails, settings: async () => people, mailer, platformUrl: 'https://augur.example.org', now: () => new Date(Date.now() + 60_000) });
    expect(await send()).toEqual({ sent: 2, later: 0, skipped: 6, failed: 0 });
    expect(sent.map((s) => s.to)).toEqual(expect.arrayContaining(['u-1@example.org', 'u-6@example.org']));
    expect(sent.find((s) => s.to === 'u-1@example.org')).toMatchObject({ subject: 'Review the budget paper', lang: 'fr', url: expect.stringMatching(/^https:\/\/augur\.example\.org\/\?notice=/) });
    const { rows } = await db.pool.query<{ recipient: string; email_skipped: string | null }>('select recipient, email_skipped from events.notifications where email_skipped is not null order by recipient');
    expect(rows).toEqual([
      { recipient: 'u-2', email_skipped: 'no confirmed email address' },
      { recipient: 'u-3', email_skipped: 'they turned email off' },
      { recipient: 'u-4', email_skipped: 'they muted the app' },
      { recipient: 'u-5', email_skipped: 'they set this kind to Quiet' },
      { recipient: 'u-7', email_skipped: 'read in AUGUR before it was emailed' },
      { recipient: 'u-gone', email_skipped: 'they have no account' },
    ]);
    expect(await send()).toEqual({ sent: 0, later: 0, skipped: 0, failed: 0 });
  });

  it('waits out quiet hours, then sends', async () => {
    await needs(['u-1']);
    // Quiet from an hour ago until an hour from now, in UTC, so the notification (made now) isn't stale.
    const base = new Date(Date.now() + 60_000);
    base.setUTCSeconds(0, 0);
    const hhmm = (offset: number) => {
      const m = (base.getUTCHours() * 60 + base.getUTCMinutes() + offset + 1440) % 1440;
      return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    };
    const people = new Map([['u-1', settings('u-1', { timeZone: 'UTC', quietHours: { from: hhmm(-60), to: hhmm(60) } })]]);
    const { mailer, sent } = fakeMailer();
    const at = (minutes: number) => sendDueEmails({ outbox: db.store.emails, settings: async () => people, mailer, now: () => new Date(base.getTime() + minutes * 60_000) });
    expect(await at(0)).toEqual({ sent: 0, later: 1, skipped: 0, failed: 0 });
    expect(await at(59)).toEqual({ sent: 0, later: 0, skipped: 0, failed: 0 });
    expect(await at(60)).toEqual({ sent: 1, later: 0, skipped: 0, failed: 0 });
    expect(sent).toHaveLength(1);
  });

  it('tries a failed send again, then gives up saying why', async () => {
    await needs(['u-1']);
    const people = new Map([['u-1', settings('u-1')]]);
    const { mailer } = fakeMailer(true);
    let clock = Date.now();
    for (let i = 0; i < EMAIL_TRIES; i++) {
      expect(await sendDueEmails({ outbox: db.store.emails, settings: async () => people, mailer, now: () => new Date(clock) })).toMatchObject({ failed: 1 });
      clock += 5 * 60_000;
    }
    const { rows } = await db.pool.query<{ email_skipped: string }>('select email_skipped from events.notifications');
    expect(rows[0].email_skipped).toMatch(/^the relay refused it 5 times/);
  });

  it('sends nothing without a relay, and doesn’t keep a backlog for when one is set', async () => {
    await needs(['u-1']);
    const mailer: NoticeMailer = { configured: false, productName: 'AUGUR', sendNotice: async () => ({ sent: false, reason: 'off' }) };
    expect(await sendDueEmails({ outbox: db.store.emails, settings: async () => new Map(), mailer })).toEqual({ sent: 0, later: 0, skipped: 1, failed: 0 });
  });
});
