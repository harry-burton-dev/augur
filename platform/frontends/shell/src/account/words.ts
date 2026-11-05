import { writeDate, type Formats } from '../host/formats.js';
import type { SignIn } from './api.js';

/** A credential's kind, in words, for one without its own label. */
export const actionWords = (type: string) =>
  ({ otp: 'Code app', webauthn: 'Passkey', 'webauthn-passwordless': 'Passkey', 'recovery-authn-codes': 'Recovery codes', password: 'Password' })[type] ?? type;

/** What a session is signed in to: the product for the shell's own client, the client's id for the rest. */
export const clientWords = (clients: string[], shellClient: string, product: string) => {
  if (!clients.length) return 'not in use';
  return [...new Set(clients.map((c) => (c === shellClient ? product : c)))].join(', ');
};

/** "5 Nov, 09:14", written the reader's way and in their time zone. */
export const dayAndTime = (iso: string, formats?: Formats) => writeDate(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, formats);

/** "just now", "4 min ago", "2 h ago", "3 days ago". */
export const ago = (iso: string, now = Date.now()) => {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return `${d} ${d === 1 ? 'day' : 'days'} ago`;
};

const CHANGES: Record<string, string> = {
  UPDATE_PASSWORD: 'Password changed',
  UPDATE_CREDENTIAL: 'Sign-in method changed',
  REMOVE_CREDENTIAL: 'Sign-in method removed',
  UPDATE_TOTP: 'Code app added',
  REMOVE_TOTP: 'Code app removed',
  UPDATE_EMAIL: 'Email address changed',
  FEDERATED_IDENTITY_LINK: 'Organisation sign-in linked',
  REMOVE_FEDERATED_IDENTITY: 'Organisation sign-in unlinked',
};

const FAILURES: Record<string, string> = {
  invalid_user_credentials: 'wrong password',
  user_temporarily_disabled: 'locked for a while after too many tries',
  user_disabled: 'account turned off',
  invalid_totp: 'wrong code',
  user_not_found: 'unknown account',
};

/** One recent sign-in, in words. */
export const signInWords = (e: SignIn) => {
  if (e.kind === 'signed-in') return 'Signed in';
  if (e.kind === 'failed') return `Sign-in failed${e.error ? `: ${FAILURES[e.error] ?? e.error.replace(/_/g, ' ')}` : ''}`;
  return CHANGES[e.event] ?? e.event.toLowerCase().replace(/_/g, ' ');
};

/** Every time zone this browser knows, or the few that matter when it can't list them. */
export const timeZones = (): string[] => {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  try {
    return intl.supportedValuesOf?.('timeZone') ?? ['UTC'];
  } catch {
    return ['UTC'];
  }
};

/** Ways of writing dates offered beside their language's, as language tags: the regions people most often ask for. */
export const DATE_REGIONS = ['en-GB', 'en-US', 'en-AU', 'en-CA', 'en-IE', 'en-IN', 'en-NZ', 'en-ZA', 'de-DE', 'de-CH', 'fr-FR', 'fr-CA', 'es-ES', 'es-MX', 'it-IT', 'nl-NL', 'pt-PT', 'pt-BR', 'sv-SE', 'da-DK', 'nb-NO', 'fi-FI', 'pl-PL', 'ja-JP', 'zh-CN', 'ko-KR'];

/** A language tag's name in English, and in itself when that differs: "German (Deutsch)". */
export const languageName = (tag: string) => {
  try {
    const english = new Intl.DisplayNames(['en'], { type: 'language' }).of(tag) ?? tag;
    const own = new Intl.DisplayNames([tag], { type: 'language' }).of(tag);
    return own && own.toLowerCase() !== english.toLowerCase() ? `${english} (${own})` : english;
  } catch {
    return tag;
  }
};


/** A region's tag in words: "English (United Kingdom)". */
export const regionName = (tag: string) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
};
