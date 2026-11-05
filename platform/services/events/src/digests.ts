import { serviceHeaders, type ServiceCredentials } from '@augur/service-kit';
import type pg from 'pg';
import { minuteIn, noticeUrl, quietUntil, type NoticeMailer, type NoticeSettings } from './notice-emails.ts';

/**
 * The daily and weekly digests (ADR 0044, D7): one email gathering what a person hasn't read and wasn't already
 * emailed, for everyone who chose one in Account → Notifications. The digests job runs every hour, across every
 * instance, and sends each person theirs once their morning has come in their time zone (else the organisation's):
 * daily at 08:00, weekly at 08:00 on Mondays, or as soon after as their quiet hours allow. Each person's last digest
 * of each kind is kept, so a run that's repeated, or a slow hour, never sends one twice.
 */

export type DigestKind = 'daily' | 'weekly';

/** When a digest is due: 08:00 in the person's time zone. */
export const DIGEST_MINUTE = 8 * 60;
/** How far back a first digest looks. */
export const DIGEST_SPAN_MS: Record<DigestKind, number> = { daily: 86_400_000, weekly: 7 * 86_400_000 };
/** At most this many notifications are named in one digest; the rest are counted. */
export const DIGEST_NAMED = 15;

/** Added after notice emails (010). */
export const digestMigration = {
  id: '011_digests',
  sql: `
    -- Each person's last digest of each kind (ADR 0044, D7): the morning it was for, in their time zone, and when it went.
    create table events.digests (
      person text not null,
      kind text not null,
      period text not null,
      sent_at timestamptz not null default now(),
      primary key (person, kind)
    );`,
};

/** The date and weekday in a time zone (an unknown zone counts as UTC). */
export const dayIn = (at: Date, timeZone: string): { date: string; weekday: number } => {
  const format = (tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(at);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = format(timeZone);
  } catch {
    parts = format('UTC');
  }
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(part('weekday')) + 1 };
};

/** The morning a digest is due for (its local date), once 08:00 has come; undefined before then, or on a weekday that isn't Monday for weekly. */
export const digestPeriod = (kind: DigestKind, at: Date, timeZone: string): string | undefined => {
  if (minuteIn(at, timeZone) < DIGEST_MINUTE) return undefined;
  const { date, weekday } = dayIn(at, timeZone);
  if (kind === 'weekly' && weekday !== 1) return undefined;
  return date;
};

/** One notification as a digest names it. */
export interface DigestItem {
  id: string;
  title: string;
  createdAt: string;
}

export interface DigestStore {
  /** The person's last digest of this kind, if any. */
  last(person: string, kind: DigestKind): Promise<{ period: string; sentAt: string } | undefined>;
  /** Records the digest for this morning, sent or empty, so it isn't looked at again until the next. */
  done(person: string, kind: DigestKind, period: string): Promise<void>;
  /** What the person hasn't read and wasn't emailed, made since `since`: newest first, up to `limit`, with how many in all. */
  unreadSince(person: string, since: Date, limit: number): Promise<{ items: DigestItem[]; total: number }>;
}

export class PgDigestStore implements DigestStore {
  constructor(private readonly pool: pg.Pool) {}

  async last(person: string, kind: DigestKind) {
    const { rows } = await this.pool.query<{ period: string; sent_at: Date }>('select period, sent_at from events.digests where person = $1 and kind = $2', [person, kind]);
    return rows[0] ? { period: rows[0].period, sentAt: rows[0].sent_at.toISOString() } : undefined;
  }

  async done(person: string, kind: DigestKind, period: string) {
    await this.pool.query(
      `insert into events.digests (person, kind, period) values ($1, $2, $3)
       on conflict (person, kind) do update set period = excluded.period, sent_at = now()`,
      [person, kind, period],
    );
  }

  async unreadSince(person: string, since: Date, limit: number) {
    const { rows } = await this.pool.query<{ id: string; title: string; created_at: Date; total: string }>(
      `select id, title, created_at, count(*) over () as total from events.notifications
       where recipient = $1 and read_at is null and emailed_at is null and created_at > $2
       order by created_at desc, id limit $3`,
      [person, since, limit],
    );
    return { items: rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at.toISOString() })), total: rows.length ? Number(rows[0].total) : 0 };
  }
}

/** Everyone who chose this digest, as identity answers. Throws when identity can't answer. */
export type DigestPeople = (kind: DigestKind) => Promise<NoticeSettings[]>;

/** Asks identity for everyone on a digest, signed in as the events service. */
export const identityDigestPeople =
  ({ identityUrl, credentials, fetchImpl = fetch }: { identityUrl: string; credentials: ServiceCredentials; fetchImpl?: typeof fetch }): DigestPeople =>
  async (kind) => {
    const res = await fetchImpl(`${identityUrl.replace(/\/$/, '')}/v1/notice-settings?digest=${kind}`, { headers: await serviceHeaders(credentials), signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`identity answered ${res.status} when asked who is on the ${kind} digest`);
    return ((await res.json()) as { people: NoticeSettings[] }).people;
  };

/** The words of a digest, by language, as EMAIL_WORDS are. */
export interface DigestWords {
  subject: (kind: DigestKind, count: number, product: string) => string;
  more: (count: number) => string;
  open: (product: string) => string;
  why: (kind: DigestKind, product: string) => string;
}

export const DIGEST_WORDS: Record<string, DigestWords> = {
  en: {
    subject: (kind, count, product) => `${kind === 'daily' ? 'Your day' : 'Your week'} in ${product}: ${count} unread`,
    more: (count) => `And ${count} more.`,
    open: (product) => `Open ${product}`,
    why: (kind, product) => `You get this ${kind === 'daily' ? 'each morning' : 'on Monday mornings'} because you chose a ${kind} digest. Change it in Account, Notifications in ${product}.`,
  },
};

export const digestWordsFor = (language: string) => DIGEST_WORDS[language] ?? DIGEST_WORDS[language.split('-')[0].toLowerCase()] ?? DIGEST_WORDS.en;

export interface DigestOptions {
  kind: DigestKind;
  people: DigestPeople;
  store: DigestStore;
  mailer: NoticeMailer;
  platformUrl?: string;
  now?: () => Date;
  log?: { warn(obj: unknown, msg?: string): void };
}

export interface DigestSummary {
  sent: number;
  empty: number;
  notYet: number;
  failed: number;
}

/** Sends this kind of digest to each person whose morning has come. Never throws for one person. */
export const sendDigests = async ({ kind, people, store, mailer, platformUrl, now = () => new Date(), log }: DigestOptions): Promise<DigestSummary> => {
  const summary: DigestSummary = { sent: 0, empty: 0, notYet: 0, failed: 0 };
  // Without a relay nothing can go; the digests wait, and Account says why.
  if (!mailer.configured) return summary;
  for (const s of await people(kind)) {
    const at = now();
    const period = digestPeriod(kind, at, s.timeZone);
    if (!s.email || !period || quietUntil(at, s.timeZone, s.quietHours)) {
      summary.notYet++;
      continue;
    }
    const last = await store.last(s.person, kind);
    if (last?.period === period) continue;
    const since = last ? new Date(last.sentAt) : new Date(at.getTime() - DIGEST_SPAN_MS[kind]);
    const { items, total } = await store.unreadSince(s.person, since, DIGEST_NAMED);
    if (!total) {
      await store.done(s.person, kind, period);
      summary.empty++;
      continue;
    }
    const words = digestWordsFor(s.language);
    const result = await mailer.sendNotice(s.email, {
      lang: s.language,
      subject: words.subject(kind, total, mailer.productName),
      heading: words.subject(kind, total, mailer.productName),
      lines: [...items.map((i) => i.title), ...(total > items.length ? [words.more(total - items.length)] : [])],
      ...(platformUrl ? { action: { label: words.open(mailer.productName), url: items.length === 1 ? noticeUrl(platformUrl, items[0].id) : `${platformUrl.replace(/\/$/, '')}/` } } : {}),
      why: words.why(kind, mailer.productName),
    });
    if (result.sent) {
      await store.done(s.person, kind, period);
      summary.sent++;
    } else {
      // Tried again next hour, still this morning's.
      summary.failed++;
      log?.warn({ person: s.person, kind, why: result.reason }, 'a digest could not be sent; trying again next hour');
    }
  }
  return summary;
};
