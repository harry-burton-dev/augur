import { serviceHeaders, type ServiceCredentials } from '@augur/service-kit';
import type { MailResult, NoticeEmailProps } from '@augur/service-kit/mail';
import type { DueEmail, EmailOutbox } from './email-outbox.ts';

/**
 * Emailing people the notifications that need them (ADR 0044, D7). Once a minute the notice-emails job takes what is
 * due, asks identity how each person wants their notices (`GET /v1/notice-settings`), and for each one sends it,
 * puts it off until their quiet hours end, or skips it, saying why. Settings are read at send time, so a choice made
 * in Account → Notifications after the notification arrived still counts.
 */

/** How a person wants their notices emailed, as identity answers (its `NoticeSettings`). */
export interface NoticeSettings {
  person: string;
  /** Only once they have confirmed it. */
  email?: string;
  language: string;
  timeZone: string;
  emailOn: boolean;
  digest: 'off' | 'daily' | 'weekly';
  quietHours?: { from: string; to: string };
  /** `<app>:<kind>` set to Quiet. */
  quietKinds: string[];
  muted: string[];
}

/** Each named person's settings; a person identity doesn't know is missing. Throws when identity can't answer. */
export type SettingsLookup = (people: string[]) => Promise<Map<string, NoticeSettings>>;

/** Asks identity for people's notice settings, signed in as the events service. */
export const identityNoticeSettings =
  ({ identityUrl, credentials, fetchImpl = fetch }: { identityUrl: string; credentials: ServiceCredentials; fetchImpl?: typeof fetch }): SettingsLookup =>
  async (people) => {
    const found = new Map<string, NoticeSettings>();
    // Identity answers at most 200 people at once.
    for (let i = 0; i < people.length; i += 200) {
      const ids = people.slice(i, i + 200).map(encodeURIComponent).join(',');
      const res = await fetchImpl(`${identityUrl.replace(/\/$/, '')}/v1/notice-settings?ids=${ids}`, { headers: await serviceHeaders(credentials), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`identity answered ${res.status} when asked for notice settings`);
      for (const s of ((await res.json()) as { people: NoticeSettings[] }).people) found.set(s.person, s);
    }
    return found;
  };

const minutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
};

/** The minute of the day it is in a time zone (an unknown zone counts as UTC). */
export const minuteIn = (at: Date, timeZone: string) => {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  } catch {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  }
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return part('hour') * 60 + part('minute');
};

/**
 * When their quiet hours end, if `at` falls inside them; undefined when it doesn't. Quiet hours may run past
 * midnight (19:00 to 08:00). A change of clocks inside them is caught when the email is due again.
 */
export const quietUntil = (at: Date, timeZone: string, quiet?: { from: string; to: string }): Date | undefined => {
  if (!quiet) return undefined;
  const from = minutes(quiet.from);
  const to = minutes(quiet.to);
  if (from === undefined || to === undefined || from === to) return undefined;
  const now = minuteIn(at, timeZone);
  const inside = from < to ? now >= from && now < to : now >= from || now < to;
  if (!inside) return undefined;
  const wait = (to - now + 1440) % 1440;
  const end = new Date(at.getTime() + wait * 60_000);
  end.setUTCSeconds(0, 0);
  return end;
};

/** The words around a notification in its email. Apps write the notification itself; these frame it. */
export interface EmailWords {
  open: (product: string) => string;
  why: (product: string) => string;
}

/**
 * By language. A language without its own words gets English's, as the shell does until it's translated. Add one by
 * its language tag (`fr`), matched on the person's language without its region (`fr-CA` → `fr`).
 */
export const EMAIL_WORDS: Record<string, EmailWords> = {
  en: {
    open: (product) => `Open it in ${product}`,
    why: (product) => `You get this email because this needs you. Choose what ${product} emails you in Account, Notifications.`,
  },
};

export const wordsFor = (language: string) => EMAIL_WORDS[language] ?? EMAIL_WORDS[language.split('-')[0].toLowerCase()] ?? EMAIL_WORDS.en;

/** Where an email's link goes: the shell, which opens the notification as clicking it there would, on its floor. */
export const noticeUrl = (platformUrl: string, id: string) => `${platformUrl.replace(/\/$/, '')}/?notice=${encodeURIComponent(id)}`;

/** The part of the Mailer this uses, so tests can stand in for it. */
export interface NoticeMailer {
  readonly configured: boolean;
  readonly productName: string;
  sendNotice(to: string, notice: Omit<NoticeEmailProps, 'productName'> & { subject: string }): Promise<MailResult>;
}

/** Notifications older than this aren't emailed: by then it's news they'll have seen, or missed for good. */
export const EMAIL_STALE_MS = 24 * 3_600_000;
/** A send that fails is tried again after this, at most `EMAIL_TRIES` times. */
export const EMAIL_RETRY_MS = 5 * 60_000;
export const EMAIL_TRIES = 5;
/** At most this many emails in one run; the rest wait a minute. */
export const EMAIL_BATCH = 200;

/** Why a notification isn't emailed to this person, or undefined when it should be. */
export const skipReason = (n: DueEmail, s: NoticeSettings | undefined, now: Date): string | undefined => {
  if (!s) return 'they have no account';
  if (n.read) return 'read in AUGUR before it was emailed';
  if (!s.email) return 'no confirmed email address';
  if (!s.emailOn) return 'they turned email off';
  if (s.muted.includes(n.app)) return 'they muted the app';
  if (n.kind && s.quietKinds.includes(`${n.app}:${n.kind}`)) return 'they set this kind to Quiet';
  if (now.getTime() - Date.parse(n.createdAt) > EMAIL_STALE_MS) return 'too old by the time it could be sent';
  return undefined;
};

export interface SendOptions {
  outbox: EmailOutbox;
  settings: SettingsLookup;
  mailer: NoticeMailer;
  /** AUGUR's address (PLATFORM_URL), for the link back. Without it, the email has no link. */
  platformUrl?: string;
  now?: () => Date;
  log?: { info(obj: unknown, msg?: string): void; warn(obj: unknown, msg?: string): void };
}

export interface SendSummary {
  sent: number;
  later: number;
  skipped: number;
  failed: number;
}

/** Sends the notice emails that are due. Never throws for one email; identity not answering leaves them all due. */
export const sendDueEmails = async ({ outbox, settings, mailer, platformUrl, now = () => new Date(), log }: SendOptions): Promise<SendSummary> => {
  const summary: SendSummary = { sent: 0, later: 0, skipped: 0, failed: 0 };
  const due = await outbox.due(EMAIL_BATCH, now());
  if (!due.length) return summary;
  // Without a relay nothing can go, and a backlog sent once one is set would be stale: Account says why.
  if (!mailer.configured) {
    for (const n of due) await outbox.skipped(n.id, 'no mail relay is set');
    summary.skipped = due.length;
    return summary;
  }
  const people = await settings([...new Set(due.map((n) => n.recipient))]);
  for (const n of due) {
    const s = people.get(n.recipient);
    const at = now();
    const why = skipReason(n, s, at);
    if (why || !s?.email) {
      await outbox.skipped(n.id, why ?? 'no confirmed email address');
      summary.skipped++;
      continue;
    }
    const until = quietUntil(at, s.timeZone, s.quietHours);
    if (until) {
      await outbox.later(n.id, until);
      summary.later++;
      continue;
    }
    const words = wordsFor(s.language);
    const result = await mailer.sendNotice(s.email, {
      lang: s.language,
      subject: n.title,
      heading: n.title,
      lines: n.detail ? [n.detail] : [],
      ...(platformUrl ? { action: { label: words.open(mailer.productName), url: noticeUrl(platformUrl, n.id) } } : {}),
      why: words.why(mailer.productName),
    });
    if (result.sent) {
      await outbox.sent(n.id);
      summary.sent++;
    } else if (n.tries + 1 >= EMAIL_TRIES) {
      await outbox.skipped(n.id, `the relay refused it ${EMAIL_TRIES} times: ${result.reason}`);
      summary.failed++;
    } else {
      await outbox.later(n.id, new Date(at.getTime() + EMAIL_RETRY_MS), true);
      summary.failed++;
      log?.warn({ notification: n.id, why: result.reason }, 'a notice email could not be sent; trying again in 5 minutes');
    }
  }
  return summary;
};
