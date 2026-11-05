import { describe, expect, it, vi } from 'vitest';
import { MAIL_CHECK_MS, Mailer, NO_RELAY, mailRelayFromEnv, organisationSender, relayProblem, renderNotice, type MailTransport } from './mail.js';

const relay = { host: 'relay.example.org', port: 587, security: 'starttls' as const, from: 'augur@example.org' };

const standIn = (overrides: Partial<{ verify: () => Promise<true>; sendMail: (m: unknown) => Promise<{ messageId: string }> }> = {}) => {
  const t = { verify: vi.fn(async () => true as const), sendMail: vi.fn(async () => ({ messageId: '<m1@example.org>' })), ...overrides };
  return t as unknown as MailTransport & typeof t;
};

describe('the mail relay settings', () => {
  it('reads the relay with sensible defaults, and none without a host', () => {
    expect(mailRelayFromEnv({})).toBeUndefined();
    expect(mailRelayFromEnv({ SMTP_HOST: 'relay', SMTP_FROM: 'a@b.org' })).toEqual({ host: 'relay', port: 587, security: 'starttls', from: 'a@b.org' });
    expect(mailRelayFromEnv({ SMTP_HOST: 'relay', SMTP_FROM: 'a@b.org', SMTP_PORT: '465' })?.security).toBe('tls');
    const warn = vi.fn();
    expect(mailRelayFromEnv({ SMTP_HOST: 'relay', SMTP_FROM: 'nobody' }, warn)).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('SMTP_FROM'));
  });
});

describe('the sender', () => {
  it('says email is off, and who can change that, without a relay', async () => {
    const mailer = new Mailer();
    expect(mailer.configured).toBe(false);
    expect(await mailer.status()).toEqual({ state: 'off', problem: NO_RELAY });
    expect(await mailer.sendNotice('p@example.org', { subject: 's', heading: 'h', lines: [] })).toEqual({ sent: false, reason: NO_RELAY });
  });

  it('checks the relay at most every few minutes, and says what to fix when it fails', async () => {
    let now = 1_000_000;
    const transport = standIn();
    const mailer = new Mailer({ relay, transport, now: () => now });
    expect(await mailer.status()).toMatchObject({ state: 'ok', relay: 'relay.example.org:587', from: 'augur@example.org' });
    await mailer.status();
    expect(transport.verify).toHaveBeenCalledTimes(1);
    now += MAIL_CHECK_MS;
    transport.verify.mockRejectedValueOnce(Object.assign(new Error('Invalid login'), { code: 'EAUTH', responseCode: 535 }));
    const status = await mailer.status();
    expect(status.state).toBe('attention');
    expect(status.problem).toContain('SMTP_USER');
    expect(JSON.stringify(status)).not.toContain('password');
  });

  it('sends a notice from the product, as HTML and plain text, and never throws', async () => {
    const transport = standIn();
    const mailer = new Mailer({ relay: { ...relay, replyTo: 'help@example.org' }, transport, productName: 'Skein' });
    const sent = await mailer.sendNotice('p@example.org', { subject: 'A change', heading: 'Something changed', lines: ['First line.'], action: { label: 'Open it', url: 'https://augur.example.org/x' } });
    expect(sent).toEqual({ sent: true, id: '<m1@example.org>' });
    const mail = transport.sendMail.mock.calls[0]![0] as Record<string, unknown>;
    expect(mail).toMatchObject({ from: { name: 'Skein', address: 'augur@example.org' }, replyTo: 'help@example.org', to: 'p@example.org', subject: 'A change' });
    expect(mail.html).toContain('Something changed');
    expect(mail.text).toContain('First line.');

    transport.sendMail.mockRejectedValueOnce(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));
    const failed = await mailer.sendNotice('p@example.org', { subject: 's', heading: 'h', lines: [] });
    expect(failed.sent).toBe(false);
    expect(!failed.sent && failed.reason).toContain('SMTP_HOST');
  });
});

describe('the notice template', () => {
  it('renders the heading, lines, link and why, with the product’s name', async () => {
    const { html, text } = await renderNotice({ productName: 'Skein', heading: 'Your export is ready', lines: ['It has 3 files.'], action: { label: 'Download', url: 'https://x.example/d' }, why: 'You asked for it.' });
    for (const words of ['Skein', 'Your export is ready', 'It has 3 files.', 'Download', 'You asked for it.']) {
      expect(html).toContain(words);
      expect(text.toLowerCase()).toContain(words.toLowerCase());
    }
    expect(html).toContain('https://x.example/d');
  });

  it('words an unknown relay error without leaking it', () => {
    expect(relayProblem(new Error('boom'))).toContain('didn’t accept');
  });
});

describe('the organisation’s sender', () => {
  it('sends from the organisation’s sender when it has one, else SMTP_FROM under the product’s name', async () => {
    const transport = standIn();
    let set: { name: string; address?: string } | undefined = { name: 'Finance Group', address: 'notices@finance.example' };
    const mailer = new Mailer({ relay, transport, productName: 'Skein', sender: async () => set });
    await mailer.sendNotice('p@example.org', { subject: 's', heading: 'h', lines: [] });
    expect((transport.sendMail.mock.calls[0]![0] as { from: unknown }).from).toEqual({ name: 'Finance Group', address: 'notices@finance.example' });
    expect(await mailer.status()).toMatchObject({ state: 'ok', from: 'notices@finance.example', fromName: 'Finance Group' });
    set = { name: 'Finance Group' };
    // The change shows without waiting for the next relay check.
    expect(await mailer.status()).toMatchObject({ from: 'augur@example.org', fromName: 'Finance Group' });
    expect(transport.verify).toHaveBeenCalledTimes(1);
    const broken = new Mailer({ relay, transport, productName: 'Skein', sender: async () => Promise.reject(new Error('down')) });
    expect(await broken.from()).toEqual({ name: 'Skein', address: 'augur@example.org' });
  });

  it('reads it from identity, keeps it a minute, and keeps the last answer when identity is away', async () => {
    let now = 0;
    let answer: Response | Error = Response.json({ name: 'Org', timeZone: 'UTC', sender: { name: 'Org', address: 'a@org.example' } });
    const fetchImpl = vi.fn(async () => {
      if (answer instanceof Error) throw answer;
      return answer.clone();
    });
    const warn = vi.fn();
    const lookup = organisationSender({ identityUrl: 'http://identity/', headers: async () => ({ authorization: 'Bearer t' }), fetchImpl: fetchImpl as unknown as typeof fetch, now: () => now, warn });
    expect(await lookup()).toEqual({ name: 'Org', address: 'a@org.example' });
    expect(fetchImpl).toHaveBeenCalledWith('http://identity/v1/organisation', expect.objectContaining({ headers: { authorization: 'Bearer t' } }));
    await lookup();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    now += 60_000;
    answer = new Error('ECONNREFUSED');
    expect(await lookup()).toEqual({ name: 'Org', address: 'a@org.example' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('SMTP_FROM'));
  });
});
