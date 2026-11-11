/**
 * The one way AUGUR's own services send email (ADR 0065): Nodemailer to the organisation's relay (ADR 0035), from
 * the React Email templates in `mail-templates.tsx`. The relay settings are the same `SMTP_*` ones the realm job
 * gives Keycloak. Mail comes from the organisation's sender (Admin → Organisation, kept by identity, ADR 0042) when one
 * is set, else from SMTP_FROM under the product's name. Without a relay the sender says so instead of failing, so a
 * screen that would email can fall back and Deployment, Health can say why.
 *
 * Import it from `@augur/service-kit/mail`, so services that never email don't load Nodemailer or React.
 */
import { createTransport } from 'nodemailer';
import type { NoticeEmailProps } from './mail-templates.js';

export type { NoticeEmailProps } from './mail-templates.js';

export { MAIL_SECURITY, mailRelayFromEnv, type MailRelay } from './mail-relay.js';
import type { MailRelay } from './mail-relay.js';

/** Whether email can be sent now, in words a deployment admin can act on. */
export interface MailStatus {
  /** `off`: no relay is set. `ok`: the relay answered its last check. `attention`: it is set but didn't answer. */
  state: 'off' | 'ok' | 'attention';
  /** Why, when it isn't `ok`, and who can change it. */
  problem?: string;
  /** The relay, as `host:port`, when one is set. Never its sign-in. */
  relay?: string;
  /** The address mail comes from: the organisation's sender address, or SMTP_FROM. */
  from?: string;
  /** The name mail comes from: the organisation's sender name, or the product's name. */
  fromName?: string;
  /** When the relay was last checked. */
  checkedAt?: string;
}

/** What `send` did: sent, or why not. */
export type MailResult = { sent: true; id: string } | { sent: false; reason: string };

export const NO_RELAY =
  'No mail relay is set, so AUGUR sends no email. A deployment admin sets SMTP_HOST and SMTP_FROM in the server’s .env (AUGUR’s docs, Set up email).';

/** How long a relay check is trusted before it is asked again. */
export const MAIL_CHECK_MS = 5 * 60_000;

/** Who mail says it is from, as the organisation set it (identity's `GET /v1/organisation`, `sender`). */
export interface MailFrom {
  name: string;
  /** Absent until an admin sets one; SMTP_FROM is used meanwhile. */
  address?: string;
}

/** Where the organisation's sender is read from; undefined when it can't be, so SMTP_FROM and the product's name stand. */
export type SenderLookup = () => Promise<MailFrom | undefined>;

/**
 * The organisation's sender from identity (`GET /v1/organisation`), kept for `ttlMs`. When identity can't answer, the
 * last answer stands, or none, so mail still goes from SMTP_FROM. `headers` signs the request in, as the calling service.
 */
export const organisationSender = ({
  identityUrl,
  headers,
  ttlMs = 60_000,
  fetchImpl = fetch,
  now = Date.now,
  warn = () => undefined,
}: {
  identityUrl: string;
  headers: () => Promise<Record<string, string>>;
  ttlMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  warn?: (message: string) => void;
}): SenderLookup => {
  let last: { at: number; sender?: MailFrom } | undefined;
  return async () => {
    if (last && now() - last.at < ttlMs) return last.sender;
    try {
      const res = await fetchImpl(`${identityUrl.replace(/\/$/, '')}/v1/organisation`, { headers: await headers(), signal: AbortSignal.timeout(5_000) });
      if (!res.ok) throw new Error(`identity answered ${res.status}`);
      const { sender } = (await res.json()) as { sender?: Partial<MailFrom> };
      last = { at: now(), sender: sender?.name ? { name: sender.name, ...(sender.address ? { address: sender.address } : {}) } : undefined };
    } catch (err) {
      warn(`The organisation’s email sender couldn’t be read, so mail goes from SMTP_FROM meanwhile: ${(err as Error).message}`);
      last = { at: now(), sender: last?.sender };
    }
    return last.sender;
  };
};


/** One message as the sender hands it to the transport. */
export interface MailMessage {
  from: { name: string; address: string };
  replyTo?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * The part of a Nodemailer transport the sender uses, so tests can stand in for the relay. Our own type, so a
 * Nodemailer major never changes the service kit's surface (ADR 0052).
 */
export interface MailTransport {
  sendMail(message: MailMessage): Promise<{ messageId?: string }>;
  verify(): Promise<unknown>;
}

export interface MailerOptions {
  /** The relay (`mailRelayFromEnv`); without one, nothing is sent and `status` says why. */
  relay?: MailRelay;
  /** The product's name as people know it (ORG_PRODUCT_NAME), shown as the sender's name and in templates. */
  productName?: string;
  /** The organisation's sender (`organisationSender`); without one, mail goes from SMTP_FROM under `productName`. */
  sender?: SenderLookup;
  /** For tests: a stand-in for the relay. */
  transport?: MailTransport;
  now?: () => number;
}

export class Mailer {
  readonly relay?: MailRelay;
  readonly productName: string;
  private readonly transport?: MailTransport;
  private readonly sender?: SenderLookup;
  private readonly now: () => number;
  private checked?: { at: number; status: MailStatus };

  constructor({ relay, productName = 'AUGUR', sender, transport, now = Date.now }: MailerOptions = {}) {
    this.relay = relay;
    this.productName = productName;
    this.sender = sender;
    this.now = now;
    this.transport =
      transport ??
      (relay
        ? createTransport({
            host: relay.host,
            port: relay.port,
            secure: relay.security === 'tls',
            requireTLS: relay.security === 'starttls',
            ignoreTLS: relay.security === 'none',
            ...(relay.user ? { auth: { user: relay.user, pass: relay.password ?? '' } } : {}),
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
          })
        : undefined);
  }

  get configured() {
    return !!this.relay;
  }

  /** Who mail comes from now: the organisation's sender where it has one, else SMTP_FROM under the product's name. */
  async from(): Promise<{ name: string; address: string }> {
    const set = await this.sender?.().catch(() => undefined);
    return { name: set?.name ?? this.productName, address: set?.address ?? this.relay?.from ?? '' };
  }

  /** Whether email can be sent, checking the relay at most every `MAIL_CHECK_MS` (or now, with `fresh`). */
  async status({ fresh = false }: { fresh?: boolean } = {}): Promise<MailStatus> {
    if (!this.relay || !this.transport) return { state: 'off', problem: NO_RELAY };
    // Who mail comes from is read each time (the lookup keeps its own short cache), so a change in Admin shows at once.
    const from = await this.from();
    const sender = { from: from.address, fromName: from.name };
    if (!fresh && this.checked && this.now() - this.checked.at < MAIL_CHECK_MS) return { ...this.checked.status, ...sender };
    const base = { relay: `${this.relay.host}:${this.relay.port}`, checkedAt: new Date(this.now()).toISOString() };
    let status: MailStatus;
    try {
      await this.transport.verify();
      status = { state: 'ok', ...base };
    } catch (err) {
      status = { state: 'attention', ...base, problem: relayProblem(err) };
    }
    this.checked = { at: this.now(), status };
    return { ...status, ...sender };
  }

  /** Sends one notice email. Never throws: a missing or failing relay comes back as `{ sent: false, reason }`. */
  async sendNotice(to: string, notice: Omit<NoticeEmailProps, 'productName'> & { subject: string }): Promise<MailResult> {
    if (!this.relay || !this.transport) return { sent: false, reason: NO_RELAY };
    const { subject, ...props } = notice;
    const [{ html, text }, from] = await Promise.all([renderNotice({ ...props, productName: this.productName }), this.from()]);
    try {
      const info = await this.transport.sendMail({
        from,
        ...(this.relay.replyTo ? { replyTo: this.relay.replyTo } : {}),
        to,
        subject,
        html,
        text,
      });
      return { sent: true, id: String(info.messageId ?? '') };
    } catch (err) {
      // A failed send means the relay is worth checking again on the next status.
      this.checked = undefined;
      return { sent: false, reason: relayProblem(err) };
    }
  }
}

/**
 * A notice email as HTML and plain text. React and the templates load only when something is sent, so a service
 * that only checks the relay (the gateway, for Status) never loads them.
 */
export const renderNotice = async (props: NoticeEmailProps) => {
  const [{ render }, { createElement }, { NoticeEmail }] = await Promise.all([import('@react-email/render'), import('react'), import('./mail-templates.js')]);
  const element = createElement(NoticeEmail, props);
  return { html: await render(element), text: await render(element, { plainText: true }) };
};

/** What went wrong with the relay, in words an admin can act on. Never echoes a password. */
export const relayProblem = (err: unknown): string => {
  const e = err as { code?: string; responseCode?: number; message?: string };
  if (e.code === 'EAUTH' || e.responseCode === 535) return 'The relay refused AUGUR’s sign-in. Check SMTP_USER and SMTP_PASSWORD in the server’s .env.';
  if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'EDNS')
    return 'AUGUR can’t reach the relay. Check SMTP_HOST and SMTP_PORT in the server’s .env, and that the server may connect to it.';
  if (e.code === 'ETIMEDOUT' || e.code === 'ESOCKET' || e.code === 'ECONNECTION')
    return 'The relay didn’t answer in time, or the connection broke. Check SMTP_PORT and SMTP_SECURITY match what the relay expects.';
  if (e.code === 'ETLS') return 'The secure connection to the relay failed. Check SMTP_SECURITY (starttls, tls or none) matches the relay.';
  return `The relay didn’t accept the mail${e.responseCode ? ` (${e.responseCode})` : ''}. Its logs say more.`;
};
