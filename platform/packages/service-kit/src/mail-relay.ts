/**
 * The organisation's mail relay (ADR 0035), read from `SMTP_*`: the same settings serve Keycloak (through the realm
 * job) and AUGUR's own sender (`@augur/service-kit/mail`, ADR 0065). No dependencies, so the realm job can read it
 * without loading the sender.
 */
export const MAIL_SECURITY = ['starttls', 'tls', 'none'] as const;

/** The organisation's relay, from `SMTP_*`. */
export interface MailRelay {
  host: string;
  port: number;
  /** STARTTLS after connecting (587), TLS from the start (465), or neither (a relay on the same trusted network). */
  security: (typeof MAIL_SECURITY)[number];
  from: string;
  replyTo?: string;
  user?: string;
  password?: string;
}

/**
 * The relay from `SMTP_*`, or undefined when there is none or it can't be used; `warn` says why. The port defaults
 * to 587, or 465 with `tls` and 25 with `none`; the security defaults to `tls` on 465 and `starttls` otherwise.
 */
export const mailRelayFromEnv = (env: Record<string, string | undefined>, warn: (message: string) => void = () => undefined): MailRelay | undefined => {
  const host = env.SMTP_HOST?.trim();
  if (!host) return undefined;
  const from = env.SMTP_FROM?.trim();
  if (!from || !/^[^\s@]+@[^\s@]+$/.test(from)) {
    warn(`SMTP_HOST is set but SMTP_FROM ${from ? `(${from}) isn't an email address` : 'is empty'}, so no email is sent. Set SMTP_FROM to the address mail comes from.`);
    return undefined;
  }
  const askedSecurity = env.SMTP_SECURITY?.trim().toLowerCase();
  const askedPort = env.SMTP_PORT?.trim();
  const port = askedPort ? Number(askedPort) : undefined;
  if (askedPort && (!Number.isInteger(port) || port! < 1 || port! > 65535)) {
    warn(`SMTP_PORT ${askedPort} isn't a port, so no email is sent.`);
    return undefined;
  }
  let security: MailRelay['security'];
  if (!askedSecurity) security = port === 465 ? 'tls' : 'starttls';
  else if ((MAIL_SECURITY as readonly string[]).includes(askedSecurity)) security = askedSecurity as MailRelay['security'];
  else {
    warn(`SMTP_SECURITY ${askedSecurity} is none of ${MAIL_SECURITY.join(', ')}, so no email is sent.`);
    return undefined;
  }
  const user = env.SMTP_USER?.trim() || undefined;
  const password = env.SMTP_PASSWORD || undefined;
  if (password && !user) warn('SMTP_PASSWORD is set without SMTP_USER, so the relay is used without signing in.');
  const replyTo = env.SMTP_REPLY_TO?.trim() || undefined;
  return { host, port: port ?? (security === 'tls' ? 465 : security === 'starttls' ? 587 : 25), security, from, ...(replyTo ? { replyTo } : {}), ...(user ? { user, ...(password ? { password } : {}) } : {}) };
};

