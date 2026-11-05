/**
 * The one way AUGUR's own services send email (ADR 0065): Nodemailer to the organisation's relay (ADR 0035), from
 * the React Email templates in `mail-templates.tsx`. The relay settings are the same `SMTP_*` ones the realm job
 * gives Keycloak. Without a relay the sender says so instead of failing, so a screen that would email can fall back
 * and Admin → Status can say why.
 *
 * Import it from `@augur/service-kit/mail`, so services that never email don't load Nodemailer or React.
 */
import { createTransport, type Transporter } from 'nodemailer';
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
  /** The address mail comes from. */
  from?: string;
  /** When the relay was last checked. */
  checkedAt?: string;
}

/** What `send` did: sent, or why not. */
export type MailResult = { sent: true; id: string } | { sent: false; reason: string };

export const NO_RELAY =
  'No mail relay is set, so AUGUR sends no email. A deployment admin sets SMTP_HOST and SMTP_FROM in the server’s .env (docs/deploy.md, Email).';

/** How long a relay check is trusted before it is asked again. */
export const MAIL_CHECK_MS = 5 * 60_000;

/** The part of a Nodemailer transport the sender uses, so tests can stand in for the relay. */
export type MailTransport = Pick<Transporter, 'sendMail' | 'verify'>;

export interface MailerOptions {
  /** The relay (`mailRelayFromEnv`); without one, nothing is sent and `status` says why. */
  relay?: MailRelay;
  /** The product's name as people know it (ORG_PRODUCT_NAME), shown as the sender's name and in templates. */
  productName?: string;
  /** For tests: a stand-in for the relay. */
  transport?: MailTransport;
  now?: () => number;
}

export class Mailer {
  readonly relay?: MailRelay;
  readonly productName: string;
  private readonly transport?: MailTransport;
  private readonly now: () => number;
  private checked?: { at: number; status: MailStatus };

  constructor({ relay, productName = 'AUGUR', transport, now = Date.now }: MailerOptions = {}) {
    this.relay = relay;
    this.productName = productName;
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

  /** Whether email can be sent, checking the relay at most every `MAIL_CHECK_MS` (or now, with `fresh`). */
  async status({ fresh = false }: { fresh?: boolean } = {}): Promise<MailStatus> {
    if (!this.relay || !this.transport) return { state: 'off', problem: NO_RELAY };
    if (!fresh && this.checked && this.now() - this.checked.at < MAIL_CHECK_MS) return this.checked.status;
    const base = { relay: `${this.relay.host}:${this.relay.port}`, from: this.relay.from, checkedAt: new Date(this.now()).toISOString() };
    let status: MailStatus;
    try {
      await this.transport.verify();
      status = { state: 'ok', ...base };
    } catch (err) {
      status = { state: 'attention', ...base, problem: relayProblem(err) };
    }
    this.checked = { at: this.now(), status };
    return status;
  }

  /** Sends one notice email. Never throws: a missing or failing relay comes back as `{ sent: false, reason }`. */
  async sendNotice(to: string, notice: Omit<NoticeEmailProps, 'productName'> & { subject: string }): Promise<MailResult> {
    if (!this.relay || !this.transport) return { sent: false, reason: NO_RELAY };
    const { subject, ...props } = notice;
    const { html, text } = await renderNotice({ ...props, productName: this.productName });
    try {
      const info = await this.transport.sendMail({
        from: { name: this.productName, address: this.relay.from },
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
