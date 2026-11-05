import { mailRelayFromEnv, type MailRelay } from '@augur/service-kit';
import { createHash } from 'node:crypto';
import { DEPLOYMENT_ADMIN_ROLE, DirectoryError, PLATFORM_ROLES, SIGN_IN_FLOW, TERMS_ACTION, TWO_STEP_ROLE, type KeycloakDirectory } from './directory.ts';
import { noticeHtml } from './organisation.ts';
import type { RealmOrganisation } from './realm-sender.ts';
import type { AppClients } from './clients.ts';

/**
 * The realm as code (ADR 0057). Keycloak reads its realm file only on its first start, so everything
 * a deployment's realm must hold is declared here and applied by the realm job (`realm-job.ts`), a
 * one-shot container that runs on every `up` and every upgrade, signed in as Keycloak's master
 * admin. Identity itself never holds that admin, and its own client is given only the rights it uses
 * at run time (`IDENTITY_RIGHTS`).
 *
 * Every setting has a floor from ADRs 0037 to 0039. A deployment may set it stricter in its `.env`
 * (`REALM_*`), never looser: a looser value is raised to the floor, with a warning.
 */

/**
 * What identity's own client (`platform-identity`) may do in the realm at run time: read the realm's
 * roles, manage people and departments, issue apps' sign-ins from Admin, and show each person their own
 * sign-ins and the organisation's sign-ins in their Account (`view-events`, `view-identity-providers`). Realm settings, sign-in
 * flows and policies (`manage-realm`) are the realm job's, so a flaw in identity can't rewrite how
 * people sign in. Nothing in any other realm, Keycloak's master realm included.
 */
export const IDENTITY_RIGHTS = ['view-realm', 'view-users', 'query-users', 'manage-users', 'query-groups', 'view-clients', 'query-clients', 'manage-clients', 'view-events', 'view-identity-providers'] as const;

export { TWO_STEP_ROLE };

/** The roles that need two-step sign-in (ADR 0038). App admin roles join them when apps have their own. */
export const TWO_STEP_ROLES = ['admin', DEPLOYMENT_ADMIN_ROLE.name] as const;

/** The name of the step in the sign-in flow that asks holders of `TWO_STEP_ROLE` for their code. */
export const TWO_STEP_STEP = `${TWO_STEP_ROLE.name} code`;

/** How the realm treats wrong passwords: a growing wait after 10 in a row, up to 15 minutes, never a permanent lock. */
export const BRUTE_FORCE_POLICY = {
  bruteForceProtected: true,
  permanentLockout: false,
  failureFactor: 10,
  waitIncrementSeconds: 60,
  maxFailureWaitSeconds: 900,
  maxDeltaTimeSeconds: 43200,
  quickLoginCheckMilliSeconds: 1000,
  minimumQuickLoginWaitSeconds: 60,
} as const;

/** The actions Keycloak may ask a person to take at sign-in, all turned on. */
export const REQUIRED_ACTIONS = [
  'UPDATE_PASSWORD',
  'CONFIGURE_TOTP',
  'CONFIGURE_RECOVERY_AUTHN_CODES',
  'webauthn-register',
  'webauthn-register-passwordless',
  'UPDATE_PROFILE',
  'UPDATE_EMAIL',
  'VERIFY_PROFILE',
  'delete_credential',
  'update_user_locale',
  'idp_link',
] as const;

const HOUR = 3600;
const DAY = 24 * HOUR;

/** What one deployment's realm is set to. `realmSettingsFromEnv` reads it, held to `REALM_FLOORS`. */
export interface RealmSettings {
  /** The shortest password allowed (NIST SP 800-63B: no composition rules, no forced changes). */
  passwordMinLength: number;
  /** A breached-password list in Keycloak's `data/password-blacklists`, or none. */
  passwordDenylist?: string;
  /** How long a session may sit unused, and how long it may last at most. */
  sessionIdleHours: number;
  sessionMaxHours: number;
  /** How long Keycloak keeps people's sign-in events, and admins' changes. */
  signInEventDays: number;
  adminEventDays: number;
}

/** The floors: the loosest each setting may be. Lengths and retention go up from here, session limits down. */
export const REALM_FLOORS: RealmSettings = {
  passwordMinLength: 15,
  passwordDenylist: 'ncsc-top100k.txt',
  sessionIdleHours: 8,
  sessionMaxHours: 10,
  signInEventDays: 90,
  adminEventDays: 365,
};

const SETTINGS: { key: keyof RealmSettings; env: string; stricter: 'higher' | 'lower' }[] = [
  { key: 'passwordMinLength', env: 'REALM_PASSWORD_MIN_LENGTH', stricter: 'higher' },
  { key: 'sessionIdleHours', env: 'REALM_SESSION_IDLE_HOURS', stricter: 'lower' },
  { key: 'sessionMaxHours', env: 'REALM_SESSION_MAX_HOURS', stricter: 'lower' },
  { key: 'signInEventDays', env: 'REALM_SIGN_IN_EVENT_DAYS', stricter: 'higher' },
  { key: 'adminEventDays', env: 'REALM_ADMIN_EVENT_DAYS', stricter: 'higher' },
];

/** A deployment's realm settings from its environment, each held to its floor. */
export const realmSettingsFromEnv = (env: Record<string, string | undefined>, warn: (message: string) => void = () => undefined): RealmSettings => {
  const settings: RealmSettings = { ...REALM_FLOORS };
  for (const { key, env: name, stricter } of SETTINGS) {
    const raw = env[name]?.trim();
    if (!raw) continue;
    const value = Number(raw);
    const floor = REALM_FLOORS[key] as number;
    if (!Number.isFinite(value) || value <= 0) {
      warn(`${name}=${raw} isn't a positive number, so it stays at ${floor}.`);
      continue;
    }
    if (stricter === 'higher' ? value < floor : value > floor) {
      warn(`${name}=${raw} is looser than AUGUR allows (ADR 0038), so it stays at ${floor}.`);
      continue;
    }
    (settings[key] as number) = value;
  }
  // A session can't outlast its own limit.
  settings.sessionIdleHours = Math.min(settings.sessionIdleHours, settings.sessionMaxHours);
  const denylist = env.REALM_PASSWORD_DENYLIST?.trim();
  if (denylist !== undefined && denylist !== '') {
    if (denylist === 'none') {
      warn('REALM_PASSWORD_DENYLIST=none: passwords are not checked against a breached-password list, which ADR 0038 asks for.');
      delete settings.passwordDenylist;
    } else if (!/^[\w.-]+$/.test(denylist)) {
      warn(`REALM_PASSWORD_DENYLIST=${denylist} isn't a plain file name, so the default list stays.`);
    } else {
      settings.passwordDenylist = denylist;
    }
  }
  return settings;
};

/** Keycloak's password policy string for these settings. */
export const passwordPolicy = (s: RealmSettings) =>
  [`length(${s.passwordMinLength})`, 'maxLength(256)', 'notUsername(undefined)', 'notEmail(undefined)', ...(s.passwordDenylist ? [`passwordBlacklist(${s.passwordDenylist})`] : [])].join(' and ');

/** The realm-level settings, as Keycloak's realm representation. */
export const realmSettings = (s: RealmSettings, displayName?: string) => ({
  ...BRUTE_FORCE_POLICY,
  passwordPolicy: passwordPolicy(s),
  ssoSessionIdleTimeout: s.sessionIdleHours * HOUR,
  ssoSessionMaxLifespan: s.sessionMaxHours * HOUR,
  eventsEnabled: true,
  eventsExpiration: s.signInEventDays * DAY,
  adminEventsEnabled: true,
  adminEventsDetailsEnabled: true,
  // Passkeys: offered in the sign-in form, and counted as the second step for admin roles.
  webAuthnPolicyPasswordlessPasskeysEnabled: true,
  webAuthnPolicyPasswordlessResidentKey: 'Required',
  webAuthnPolicyPasswordlessUserVerificationRequirement: 'required',
  ...(displayName ? { webAuthnPolicyPasswordlessRpEntityName: displayName, webAuthnPolicyRpEntityName: displayName } : {}),
});

/** The realm attributes Keycloak keeps outside its representation's own fields. */
export const realmAttributes = (s: RealmSettings) => ({ adminEventsExpiration: String(s.adminEventDays * DAY) });

/** AUGUR's sign-in and email theme (ADR 0041), shipped in AUGUR's Keycloak image (platform/frontends/sign-in-theme). */
export const SIGN_IN_THEME = 'augur';

/** How the sign-in pages and emails look, and which languages they offer. */
export interface RealmLook {
  theme: string;
  /** The languages people may choose at sign-in, the first being the default. */
  languages: string[];
}

/** A deployment's look from its environment: REALM_LANGUAGES, comma separated, default `en`. */
export const realmLookFromEnv = (env: Record<string, string | undefined>, warn: (message: string) => void = () => undefined): RealmLook => {
  const asked = (env.REALM_LANGUAGES ?? '').split(',').map((l) => l.trim()).filter(Boolean);
  const languages = [...new Set(asked.filter((l) => /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(l) || (warn(`REALM_LANGUAGES: ${l} isn't a language tag such as en or pt-BR, so it's left out.`), false)))];
  return { theme: SIGN_IN_THEME, languages: languages.length ? languages : ['en'] };
};

type ServerThemes = { themes?: Record<string, { name: string; locales?: string[] }[] | undefined> };

/**
 * Puts the realm's sign-in pages and emails in AUGUR's theme, when this Keycloak has it, and offers the
 * languages asked for that the pages have. A Keycloak without the theme (Keycloak's own image, as the
 * local stack runs) keeps Keycloak's look, and says so.
 */
export const applyLook = async (kc: KeycloakDirectory, look: RealmLook, changes: Changes, warn: (message: string) => void = () => undefined) => {
  const { themes = {} } = await kc.server<ServerThemes>('/serverinfo');
  const login = themes.login?.find((t) => t.name === look.theme);
  const email = themes.email?.find((t) => t.name === look.theme);
  if (!login) warn(`This Keycloak has no ${look.theme} theme, so sign-in keeps Keycloak's own look. AUGUR's Keycloak image has it.`);
  const known = login?.locales;
  const languages = known ? look.languages.filter((l) => known.includes(l) || (warn(`REALM_LANGUAGES: the sign-in pages have no ${l}, so it's left out.`), false)) : look.languages;
  const supported = languages.length ? languages : ['en'];
  const { data: realm } = await kc.call<Record<string, unknown>>('GET', '');
  // Without the theme, a realm left on it (a server gone back to Keycloak's own image) returns to Keycloak's.
  const theme = (have: unknown, found: unknown) => (found ? look.theme : have === look.theme ? '' : have);
  const want: Record<string, unknown> = {
    internationalizationEnabled: true,
    supportedLocales: supported,
    defaultLocale: supported[0],
    loginTheme: theme(realm.loginTheme, login),
    emailTheme: theme(realm.emailTheme, email),
  };
  // Keycloak keeps the languages in its own order, so they are compared as a set.
  const same = (a: unknown, b: unknown) => JSON.stringify(Array.isArray(a) ? [...a].sort() : (a ?? '')) === JSON.stringify(Array.isArray(b) ? [...b].sort() : (b ?? ''));
  const differs = Object.entries(want).filter(([k, v]) => !same(realm[k], v)).map(([k]) => k);
  if (!differs.length) return;
  await kc.call('PUT', '', want);
  changes.push(`look and languages: ${differs.join(', ')}`);
};

interface ProfileAttribute {
  name: string;
  displayName?: string;
  validations?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  required?: { roles: string[] };
  permissions: { view: string[]; edit: string[] };
  multivalued?: boolean;
  group?: string;
}

const both = { view: ['admin', 'user'], edit: ['admin', 'user'] };

/**
 * The profile facts beyond Keycloak's own four (ADR 0039). A person sees and edits their own; an
 * admin sees and edits everyone's. `picture` is a link to the image in AUGUR's storage, and `locale`
 * is the one language setting, so sign-in pages and AUGUR agree. A deployment may add more attributes
 * in the console: the job only adds or updates these, and leaves others as they are.
 */
export const PROFILE_ATTRIBUTES: ProfileAttribute[] = [
  { name: 'jobTitle', displayName: 'Job title', validations: { length: { max: 120 } }, permissions: both, multivalued: false },
  { name: 'phone', displayName: 'Phone', validations: { length: { max: 40 }, pattern: { pattern: '^[+0-9 ()-]*$', 'error-message': 'Use digits, spaces, brackets, + and - only.' } }, permissions: both, multivalued: false },
  { name: 'pronouns', displayName: 'Pronouns', validations: { length: { max: 40 } }, permissions: both, multivalued: false },
  { name: 'picture', displayName: 'Picture', validations: { length: { max: 2048 }, uri: {} }, permissions: both, multivalued: false },
  { name: 'locale', displayName: 'Language', validations: { length: { max: 35 } }, permissions: both, multivalued: false },
];

/** What the realm job changed, in words for its log. */
export type Changes = string[];

type Execution = { id: string; level: number; index: number; requirement: string; displayName: string; providerId?: string; authenticationFlow?: boolean; flowId?: string; authenticationConfig?: string };

/** What AUGUR is called where it doesn't say otherwise; a deployment names its own product in ORG_PRODUCT_NAME. */
export const DEFAULT_PRODUCT_NAME = 'AUGUR';

/** The product's name from a deployment's environment: ORG_PRODUCT_NAME, or AUGUR when it is empty. */
export const productNameFromEnv = (env: Record<string, string | undefined>) => env.ORG_PRODUCT_NAME?.trim() || DEFAULT_PRODUCT_NAME;

/**
 * Applies `realmSettings` and `realmAttributes`, and says whether anything differed. `productName`
 * becomes the realm's display name, which Keycloak's emails (their subjects and AUGUR's layout), the
 * sign-in pages and passkey prompts show; without it the realm keeps the one it has.
 */
export const applyRealmSettings = async (kc: KeycloakDirectory, s: RealmSettings, changes: Changes, productName?: string) => {
  const { data: realm } = await kc.call<Record<string, unknown> & { attributes?: Record<string, string>; displayName?: string }>('GET', '');
  const displayName = productName ?? realm.displayName;
  const want = { ...realmSettings(s, displayName), ...(productName ? { displayName: productName } : {}) };
  const attributes = realmAttributes(s);
  const differs = Object.entries(want).filter(([k, v]) => realm[k] !== v).map(([k]) => k);
  const attributesDiffer = Object.entries(attributes).filter(([k, v]) => realm.attributes?.[k] !== v).map(([k]) => k);
  if (!differs.length && !attributesDiffer.length) return;
  await kc.call('PUT', '', { ...want, attributes: { ...realm.attributes, ...attributes } });
  changes.push(`realm settings: ${[...differs, ...attributesDiffer].join(', ')}`);
};

/** Turns on each of `REQUIRED_ACTIONS`, registering any Keycloak hasn't yet. */
export const applyRequiredActions = async (kc: KeycloakDirectory, changes: Changes) => {
  const { data: have } = await kc.call<{ alias: string; name: string; enabled: boolean; providerId?: string }[]>('GET', '/authentication/required-actions');
  for (const alias of REQUIRED_ACTIONS) {
    const action = have.find((a) => a.alias === alias);
    if (!action) {
      const { data: unregistered } = await kc.call<{ providerId: string; name: string }[]>('GET', '/authentication/unregistered-required-actions');
      const found = unregistered.find((u) => u.providerId === alias);
      if (!found) throw new DirectoryError(`Keycloak has no ${alias} required action.`, 503);
      await kc.call('POST', '/authentication/register-required-action', { providerId: found.providerId, name: found.name });
      changes.push(`required action ${alias}: registered`);
      continue;
    }
    if (action.enabled) continue;
    await kc.call('PUT', `/authentication/required-actions/${encodeURIComponent(alias)}`, { ...action, enabled: true });
    changes.push(`required action ${alias}: on`);
  }
};

/** Makes the platform's roles and `TWO_STEP_ROLE`, and puts `TWO_STEP_ROLE` inside each of `TWO_STEP_ROLES`. */
export const applyRoles = async (kc: KeycloakDirectory, changes: Changes) => {
  const made = await kc.ensureRoles([...PLATFORM_ROLES, TWO_STEP_ROLE, { name: 'admin', description: 'Runs AUGUR; sees the Admin app' }]);
  if (made.length) changes.push(`roles made: ${made.join(', ')}`);
  const { data: twoStep } = await kc.call<{ id: string; name: string }>('GET', `/roles/${encodeURIComponent(TWO_STEP_ROLE.name)}`);
  for (const role of TWO_STEP_ROLES) {
    const path = `/roles/${encodeURIComponent(role)}/composites`;
    const { data: inside } = await kc.call<{ name: string }[]>('GET', path);
    if (inside.some((r) => r.name === TWO_STEP_ROLE.name)) continue;
    await kc.call('POST', path, [twoStep]);
    changes.push(`${role} now needs two-step sign-in`);
  }
};

/** Adds or updates `PROFILE_ATTRIBUTES` in the declarative user profile, keeping every other attribute. */
export const applyUserProfile = async (kc: KeycloakDirectory, changes: Changes) => {
  const { data: profile } = await kc.call<{ attributes: ProfileAttribute[]; [k: string]: unknown }>('GET', '/users/profile');
  const attributes = [...profile.attributes];
  const touched: string[] = [];
  for (const want of PROFILE_ATTRIBUTES) {
    const at = attributes.findIndex((a) => a.name === want.name);
    // A deployment's own changes to these (a stricter validation, say) are kept; only what's missing is filled.
    const merged = at === -1 ? want : { ...want, ...attributes[at], permissions: attributes[at]!.permissions ?? want.permissions };
    if (at !== -1 && JSON.stringify(merged) === JSON.stringify(attributes[at])) continue;
    if (at === -1) attributes.push(merged);
    else attributes[at] = merged;
    touched.push(want.name);
  }
  if (!touched.length) return;
  await kc.call('PUT', '/users/profile', { ...profile, attributes });
  changes.push(`profile attributes: ${touched.join(', ')}`);
};

/**
 * The realm's sign-in flow (`SIGN_IN_FLOW`): Keycloak's browser flow, with a step of its own that asks
 * everyone holding `TWO_STEP_ROLE` for a one-time code, setting one up the first time, unless they
 * signed in with a passkey. Everyone else keeps Keycloak's own optional second step. A flow from an
 * older release (one step per role) is rebuilt from Keycloak's current browser flow.
 */
export const applySignInFlow = async (kc: KeycloakDirectory, changes: Changes) => {
  const flows = (await kc.call<{ id: string; alias: string }[]>('GET', '/authentication/flows')).data;
  const executionsOf = async (alias: string) => (await kc.call<Execution[]>('GET', `/authentication/flows/${encodeURIComponent(alias)}/executions`)).data;
  const existing = flows.find((f) => f.alias === SIGN_IN_FLOW);
  if (existing) {
    const all = await executionsOf(SIGN_IN_FLOW);
    if (all.some((e) => e.displayName === TWO_STEP_STEP)) {
      const { data: realm } = await kc.call<{ browserFlow?: string }>('GET', '');
      if (realm.browserFlow !== SIGN_IN_FLOW) {
        await kc.call('PUT', '', { browserFlow: SIGN_IN_FLOW });
        changes.push(`sign-in flow: ${SIGN_IN_FLOW} in use again`);
      }
      return;
    }
    // Built by an older release: hand sign-in back to Keycloak's flow while this one is rebuilt.
    await kc.call('PUT', '', { browserFlow: 'browser' });
    await kc.call('DELETE', `/authentication/flows/${existing.id}`);
    changes.push(`sign-in flow: older ${SIGN_IN_FLOW} replaced`);
  }
  await kc.call('POST', '/authentication/flows/browser/copy', { newName: SIGN_IN_FLOW });

  const flowAlias = async (id: string) => (await kc.call<{ alias: string }>('GET', `/authentication/flows/${id}`)).data.alias;
  const setRequirement = (exec: Execution, requirement: string) => kc.call('PUT', `/authentication/flows/${encodeURIComponent(SIGN_IN_FLOW)}/executions`, { ...exec, requirement });
  const addExecution = async (alias: string, provider: string, requirement: string, config?: { alias: string; config: Record<string, string> }) => {
    const { location } = await kc.call('POST', `/authentication/flows/${encodeURIComponent(alias)}/executions/execution`, { provider });
    const exec = (await executionsOf(SIGN_IN_FLOW)).find((e) => e.id === location?.split('/').pop());
    if (!exec) throw new DirectoryError(`The sign-in service didn't add ${provider} to the sign-in flow.`, 503);
    await setRequirement(exec, requirement);
    if (config) await kc.call('POST', `/authentication/executions/${exec.id}/config`, config);
  };

  let all = await executionsOf(SIGN_IN_FLOW);
  // Keycloak's usual second step (a conditional sub-flow holding the OTP form), and the forms step around it.
  const otpAt = all.findIndex((e) => e.providerId === 'auth-otp-form');
  const otp = all[otpAt];
  const usual = otp && all.slice(0, otpAt).reverse().find((e) => e.authenticationFlow && e.level === otp.level - 1);
  const forms = otp && all.slice(0, otpAt).reverse().find((e) => e.authenticationFlow && e.level === otp.level - 2);
  if (!usual?.flowId || !forms?.flowId) throw new DirectoryError("Keycloak's browser flow isn't shaped as expected, so two-step sign-in wasn't set up.", 503);
  // Keycloak skips its second step after a passkey; the new step does the same, with the same condition.
  const usualSteps = all.slice(otpAt - otp.index, otpAt);
  const passkeyCondition = usualSteps.find((e) => e.providerId === 'conditional-credential');
  const passkeyConfig = passkeyCondition?.authenticationConfig ? (await kc.call<{ config: Record<string, string> }>('GET', `/authentication/config/${passkeyCondition.authenticationConfig}`)).data.config : undefined;

  const usualAlias = await flowAlias(usual.flowId);
  const formsAlias = await flowAlias(forms.flowId);
  // Those who hold the role are asked in the new step, so the usual one leaves them out (they're asked once).
  await addExecution(usualAlias, 'conditional-user-role', 'REQUIRED', { alias: `not ${TWO_STEP_ROLE.name}`, config: { condUserRole: TWO_STEP_ROLE.name, negate: 'true' } });
  await kc.call('POST', `/authentication/flows/${encodeURIComponent(formsAlias)}/executions/flow`, {
    alias: TWO_STEP_STEP,
    type: 'basic-flow',
    provider: 'registration-page-form',
    description: `Everyone with the ${TWO_STEP_ROLE.name} role signs in with a code app or a passkey.`,
  });
  all = await executionsOf(SIGN_IN_FLOW);
  await setRequirement(all.find((e) => e.displayName === TWO_STEP_STEP)!, 'CONDITIONAL');
  await addExecution(TWO_STEP_STEP, 'conditional-user-role', 'REQUIRED', { alias: `has ${TWO_STEP_ROLE.name}`, config: { condUserRole: TWO_STEP_ROLE.name, negate: 'false' } });
  if (passkeyConfig) await addExecution(TWO_STEP_STEP, 'conditional-credential', 'REQUIRED', { alias: `${TWO_STEP_ROLE.name} passkey`, config: passkeyConfig });
  await addExecution(TWO_STEP_STEP, 'auth-otp-form', 'REQUIRED');
  await kc.call('PUT', '', { browserFlow: SIGN_IN_FLOW });
  changes.push(`sign-in flow: ${SIGN_IN_FLOW} asks the admin roles for a second step`);
};

/** Realm-management roles of a client's service account, set to exactly `rights`. */
export const applyServiceAccountRights = async (kc: KeycloakDirectory, clientId: string, rights: readonly string[], changes: Changes) => {
  const client = (await kc.call<{ id: string }[]>('GET', `/clients?clientId=${encodeURIComponent(clientId)}`)).data[0];
  if (!client) throw new DirectoryError(`There is no ${clientId} client to give rights to.`, 404);
  const { data: account } = await kc.call<{ id: string }>('GET', `/clients/${client.id}/service-account-user`);
  const management = (await kc.call<{ id: string }[]>('GET', '/clients?clientId=realm-management')).data[0];
  if (!management) throw new DirectoryError('The realm has no realm-management client.', 404);
  const mappings = `/users/${account.id}/role-mappings/clients/${management.id}`;
  const held = (await kc.call<{ id: string; name: string }[]>('GET', mappings)).data;
  const available = (await kc.call<{ id: string; name: string }[]>('GET', `/clients/${management.id}/roles`)).data;
  const add = available.filter((r) => rights.includes(r.name) && !held.some((h) => h.name === r.name));
  const remove = held.filter((r) => !rights.includes(r.name));
  if (add.length) await kc.call('POST', mappings, add);
  if (remove.length) await kc.call('DELETE', mappings, remove);
  if (add.length || remove.length) {
    changes.push(`${clientId} rights:${add.length ? ` given ${add.map((r) => r.name).join(', ')}` : ''}${remove.length ? ` taken away ${remove.map((r) => r.name).join(', ')}` : ''}`);
  }
};

/** The organisation's relay, read by the service kit from the `SMTP_*` settings AUGUR's own sender also uses (ADR 0065). */
export type RealmMail = MailRelay;
/**
 * The relay from a deployment's environment: SMTP_HOST and SMTP_FROM, with SMTP_PORT, SMTP_SECURITY,
 * SMTP_USER, SMTP_PASSWORD and SMTP_REPLY_TO. Undefined without a host, so a deployment with no relay
 * keeps working and its screens say email is off.
 */
export const realmMailFromEnv = mailRelayFromEnv;

/** Where the relay's settings are kept in the realm's attributes, so a changed password is noticed without reading it back. */
export const MAIL_FINGERPRINT = 'augurSmtpFingerprint';

/** Keycloak's smtpServer for a relay. Its values are all strings; `fromDisplayName` is the organisation's sender name or the product's name, never a literal. */
export const smtpServer = (mail: RealmMail, productName?: string): Record<string, string> => ({
  host: mail.host,
  port: String(mail.port),
  from: mail.from,
  ...(productName ? { fromDisplayName: productName } : {}),
  ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
  starttls: String(mail.security === 'starttls'),
  ssl: String(mail.security === 'tls'),
  auth: String(Boolean(mail.user)),
  ...(mail.user ? { user: mail.user } : {}),
  ...(mail.password ? { password: mail.password } : {}),
});

/** The relay as Keycloak sends with it: from the organisation's sender where an admin set one, else SMTP_FROM under the product's name. */
export const withSender = (mail: RealmMail | undefined, sender: { name: string; address?: string } | undefined, productName?: string) => ({
  mail: mail && sender?.address ? { ...mail, from: sender.address } : mail,
  fromName: sender?.name ?? productName,
});

/** A fingerprint of everything the relay is set to, the password included, that never reveals it. */
export const mailFingerprint = (server: Record<string, string>) =>
  createHash('sha256').update(JSON.stringify(Object.entries(server).sort(([a], [b]) => a.localeCompare(b)))).digest('hex').slice(0, 32);

/**
 * Keycloak's built-in listener that emails a person when their password, code app or passkeys change
 * (ADR 0036). AUGUR's Keycloak image sets KC_SPI_EVENTS_LISTENER__EMAIL__EXCLUDE_EVENTS, which
 * leaves failed sign-ins out, so only security changes are emailed.
 */
export const SECURITY_EMAIL_LISTENER = 'email';

/**
 * Points the realm at the organisation's relay and, with one, turns on what needs email: verifying an
 * address, resetting a forgotten password and emailing people about changes to how they sign in. Without
 * `mail` the relay set in Keycloak's console (if any) is left as it is, and those follow whether the realm
 * has one, so a deployment never offers a reset link it can't send.
 */
export const applyMail = async (kc: KeycloakDirectory, mail: RealmMail | undefined, changes: Changes, productName?: string) => {
  const { data: realm } = await kc.call<Record<string, unknown> & { smtpServer?: Record<string, string>; attributes?: Record<string, string>; eventsListeners?: string[] }>('GET', '');
  const want: Record<string, unknown> = {};
  let attributes: Record<string, string> | undefined;
  if (mail) {
    const server = smtpServer(mail, productName);
    const fingerprint = mailFingerprint(server);
    if (realm.attributes?.[MAIL_FINGERPRINT] !== fingerprint || realm.smtpServer?.host !== mail.host) {
      want.smtpServer = server;
      attributes = { ...realm.attributes, [MAIL_FINGERPRINT]: fingerprint };
    }
  }
  const canSend = Boolean(mail ?? realm.smtpServer?.host);
  if (realm.verifyEmail !== canSend) want.verifyEmail = canSend;
  if (realm.resetPasswordAllowed !== canSend) want.resetPasswordAllowed = canSend;
  // Other listeners an admin added stay; Keycloak's default is jboss-logging alone.
  const listeners = realm.eventsListeners ?? ['jboss-logging'];
  if (listeners.includes(SECURITY_EMAIL_LISTENER) !== canSend) {
    want.eventsListeners = canSend ? [...listeners, SECURITY_EMAIL_LISTENER] : listeners.filter((l) => l !== SECURITY_EMAIL_LISTENER);
  }
  const differs = Object.keys(want);
  if (!differs.length) return;
  await kc.call('PUT', '', { ...want, ...(attributes ? { attributes } : {}) });
  const said = (k: string) => (k === 'smtpServer' ? `relay ${mail!.host}:${mail!.port}` : k === 'eventsListeners' ? `security-change emails ${canSend ? 'on' : 'off'}` : `${k} ${want[k] ? 'on' : 'off'}`);
  changes.push(`email: ${differs.map(said).join(', ')}`);
};

/**
 * Idle accounts (PER-194 spec 4.7): Keycloak's own Workflow, enrolled at each sign-in, emails the person
 * after `warningDays` without one and turns their sign-in off at `turnOffDays`. Every sign-in starts the
 * count again (`restart-in-progress`). Deployment admins are left out, so nobody locks the deployment out by
 * being away; service accounts never enrol, as they don't sign in through LOGIN. The warning is Keycloak's own
 * "Account Disable Warning" email, in each person's language and AUGUR's email theme, and counts the days left.
 *
 * Keycloak refuses to change a Workflow's steps while people are parked on them, so the days are in its name:
 * new days make a new Workflow and the old one is deleted, which cancels its parked steps. A change therefore
 * only ever delays a turn-off, and never brings one forward without a warning.
 */
export const IDLE_WORKFLOW = 'augur-idle-accounts';

export interface IdleDays {
  on: boolean;
  warningDays: number;
  turnOffDays: number;
}

interface KcWorkflow {
  id?: string;
  name: string;
  on?: string;
  if?: string;
  concurrency?: Record<string, string>;
  steps?: { uses: string; after?: string; with?: Record<string, string[]> }[];
}

/** The Workflow for these days. Its name carries the days, so new days are a new Workflow. */
export const idleWorkflow = (idle: IdleDays): KcWorkflow => ({
  name: `${IDLE_WORKFLOW}-${idle.warningDays}-${idle.turnOffDays}`,
  on: 'user-authenticated',
  if: `not has-role(${DEPLOYMENT_ADMIN_ROLE.name})`,
  concurrency: { 'restart-in-progress': 'true' },
  steps: [
    { uses: 'notify-user', after: `${idle.warningDays}d` },
    { uses: 'disable-user', after: `${idle.turnOffDays - idle.warningDays}d` },
  ],
});

/**
 * Keeps exactly one idle-account Workflow in step with the organisation's days, or none when idle accounts
 * are off. None either without email: an account must never turn off without a warning. A Keycloak without
 * Workflows (before 26.6, or with the feature turned off) is warned about and left as it is.
 */
export const applyIdleWorkflow = async (
  kc: KeycloakDirectory,
  idle: IdleDays | undefined,
  canEmail: boolean,
  changes: Changes,
  warn: (message: string) => void = () => undefined,
) => {
  if (!idle) return;
  let existing: KcWorkflow[];
  try {
    existing = (await kc.call<KcWorkflow[]>('GET', `/workflows?search=${encodeURIComponent(IDLE_WORKFLOW)}&max=100`)).data.filter((w) => w.name.startsWith(IDLE_WORKFLOW));
  } catch (err) {
    if (err instanceof DirectoryError && err.status === 404) {
      warn('This Keycloak has no Workflows (26.6 or later, with the feature on), so idle accounts aren’t warned or turned off.');
      return;
    }
    throw err;
  }
  if (idle.on && !canEmail) warn('Idle accounts aren’t turned off: email isn’t set up (SMTP_HOST), so nobody could be warned first.');
  const want = idle.on && canEmail ? idleWorkflow(idle) : undefined;
  if (want && !existing.some((w) => w.name === want.name)) {
    try {
      await kc.call('POST', '/workflows', want);
    } catch (err) {
      // Never fail the realm job, and with it an upgrade, over this: keep what was there, and say why.
      if (!(err instanceof DirectoryError) || err.status !== 400) throw err;
      warn(`Keycloak refused the idle-account Workflow (${err.message}), so the days in Admin → Organisation aren’t applied.`);
      return;
    }
    changes.push(`idle accounts: warned after ${idle.warningDays} days, turned off after ${idle.turnOffDays}`);
  }
  for (const old of existing.filter((w) => w.name !== want?.name)) {
    await kc.call('DELETE', `/workflows/${encodeURIComponent(old.id!)}`);
    if (!want) changes.push('idle accounts: no longer turned off');
  }
};

/** Escaped for the realm's `displayNameHtml`, which Keycloak's own pages show as HTML. */
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Keycloak's own words for its Terms and Conditions page, which the notice replaces in each language offered. */
export const NOTICE_KEYS = { title: 'termsTitle', text: 'termsText' } as const;

/**
 * The organisation's name on the sign-in pages (the realm's `displayNameHtml`; the product's name stays its
 * `displayName`), and its sign-in notice as Keycloak's Terms and Conditions step: on for new people and for anyone
 * an admin asked again, with the notice's words in place of Keycloak's in every language offered. Off, the step is
 * turned off, so nobody is asked, and Keycloak's words come back.
 */
export const applyOrganisation = async (kc: KeycloakDirectory, org: RealmOrganisation | undefined, languages: string[], changes: Changes) => {
  if (!org) return;
  const { data: realm } = await kc.call<{ displayNameHtml?: string }>('GET', '');
  if (org.name && realm.displayNameHtml !== escapeHtml(org.name)) {
    await kc.call('PUT', '', { displayNameHtml: escapeHtml(org.name) });
    changes.push('organisation’s name on sign-in pages');
  }

  const { data: actions } = await kc.call<{ alias: string; name: string; enabled: boolean; defaultAction: boolean }[]>('GET', '/authentication/required-actions');
  let terms = actions.find((a) => a.alias.toUpperCase() === TERMS_ACTION);
  if (!terms && org.notice.on) {
    const { data: unregistered } = await kc.call<{ providerId: string; name: string }[]>('GET', '/authentication/unregistered-required-actions');
    const found = unregistered.find((u) => u.providerId.toUpperCase() === TERMS_ACTION);
    if (!found) throw new DirectoryError(`Keycloak has no ${TERMS_ACTION} required action, so the sign-in notice can’t be shown.`, 503);
    await kc.call('POST', '/authentication/register-required-action', { providerId: found.providerId, name: found.name });
    terms = (await kc.call<typeof actions>('GET', '/authentication/required-actions')).data.find((a) => a.alias.toUpperCase() === TERMS_ACTION);
  }
  if (terms && (terms.enabled !== org.notice.on || terms.defaultAction !== org.notice.on)) {
    await kc.call('PUT', `/authentication/required-actions/${encodeURIComponent(terms.alias)}`, { ...terms, enabled: org.notice.on, defaultAction: org.notice.on });
    changes.push(`sign-in notice ${org.notice.on ? 'on' : 'off'}`);
  }

  const words = org.notice.on && org.notice.title && org.notice.text ? { [NOTICE_KEYS.title]: escapeHtml(org.notice.title), [NOTICE_KEYS.text]: noticeHtml(org.notice.text) } : undefined;
  const touched: string[] = [];
  for (const locale of languages) {
    const { data: have } = await kc.call<Record<string, string>>('GET', `/localization/${encodeURIComponent(locale)}`);
    if (words) {
      if (Object.entries(words).some(([k, v]) => have?.[k] !== v)) {
        await kc.call('POST', `/localization/${encodeURIComponent(locale)}`, words);
        touched.push(locale);
      }
      continue;
    }
    for (const key of Object.values(NOTICE_KEYS)) {
      if (have?.[key] === undefined) continue;
      await kc.call('DELETE', `/localization/${encodeURIComponent(locale)}/${key}`);
      if (!touched.includes(locale)) touched.push(locale);
    }
  }
  if (touched.length) changes.push(`sign-in notice words: ${touched.join(', ')}`);
};

/**
 * Two steps for everyone: `TWO_STEP_ROLE` inside the realm's default roles, which every account holds, so the
 * sign-in flow asks everyone for a code app or a passkey. Off, only the admin roles hold it (`applyRoles`).
 */
export const applyTwoStepForAll = async (kc: KeycloakDirectory, on: boolean | undefined, changes: Changes) => {
  if (on === undefined) return;
  const { data: realm } = await kc.call<{ defaultRole?: { name: string } }>('GET', '');
  const defaults = realm.defaultRole?.name;
  if (!defaults) throw new DirectoryError('The realm has no default roles, so two steps for everyone can’t be set.', 503);
  const path = `/roles/${encodeURIComponent(defaults)}/composites`;
  const { data: inside } = await kc.call<{ name: string }[]>('GET', path);
  const has = inside.some((r) => r.name === TWO_STEP_ROLE.name);
  if (has === on) return;
  const { data: role } = await kc.call<{ id: string; name: string }>('GET', `/roles/${encodeURIComponent(TWO_STEP_ROLE.name)}`);
  await kc.call(on ? 'POST' : 'DELETE', path, [role]);
  changes.push(on ? 'everyone now signs in with two steps' : 'two steps for the admin roles only');
};

/** Whether Keycloak can send email: the organisation's relay, or one set in Keycloak's console. */
const canEmail = async (kc: KeycloakDirectory, mail: RealmMail | undefined) =>
  Boolean(mail) || Boolean((await kc.call<{ smtpServer?: { host?: string } }>('GET', '')).data.smtpServer?.host);

export interface ApplyOptions {
  settings: RealmSettings;
  /** The product's name (`productNameFromEnv`), set as the realm's display name. */
  productName?: string;
  /** The sign-in pages' theme and languages. */
  look?: RealmLook;
  /** Where to say what the job can't do, such as a Keycloak without AUGUR's theme. */
  warn?: (message: string) => void;
  /** Identity's own client and secret; it is made if missing and given `IDENTITY_RIGHTS`. */
  identity?: { clientId: string; secret: string };
  /** The platform's services' sign-ins, client=secret. */
  serviceSecrets: [string, string][];
  clients: AppClients;
  /** Given the deployment-admin role when nobody holds it. */
  firstAdmin?: string;
  /** The organisation's relay (`realmMailFromEnv`); without it, a relay set in the console is kept. */
  mail?: RealmMail;
  /** The organisation's sender (`realmSenderFromDb`): its address replaces SMTP_FROM and its name the product's as the sender. */
  sender?: { name: string; address?: string };
  /** The organisation's idle-account days (`realmIdleFromDb`); without them the idle Workflow is left as it is. */
  idle?: IdleDays;
  /** The rest of Admin → Organisation (`realmOrganisationFromDb`); its languages replace `look`'s. Without it, left as it is. */
  organisation?: RealmOrganisation;
}

/**
 * Brings the realm to what this release declares. Safe to run any number of times: each step reads
 * first and changes only what differs. Returns what it changed.
 */
export const applyRealm = async (kc: KeycloakDirectory, options: ApplyOptions): Promise<Changes> => {
  const changes: Changes = [];
  await applyRealmSettings(kc, options.settings, changes, options.productName);
  const look = options.look && options.organisation?.languages ? { ...options.look, languages: options.organisation.languages } : options.look;
  if (look) await applyLook(kc, look, changes, options.warn);
  const { mail, fromName } = withSender(options.mail, options.sender, options.productName);
  await applyMail(kc, mail, changes, fromName);
  await applyIdleWorkflow(kc, options.idle, await canEmail(kc, mail), changes, options.warn);
  await applyRequiredActions(kc, changes);
  await applyRoles(kc, changes);
  await applyUserProfile(kc, changes);
  await applySignInFlow(kc, changes);
  await applyTwoStepForAll(kc, options.organisation?.twoStepForAll, changes);
  if (options.organisation) {
    const { data: realm } = await kc.call<{ supportedLocales?: string[] }>('GET', '');
    await applyOrganisation(kc, options.organisation, realm.supportedLocales?.length ? realm.supportedLocales : ['en'], changes);
  }
  const secrets = options.identity ? [[options.identity.clientId, options.identity.secret] as [string, string], ...options.serviceSecrets.filter(([id]) => id !== options.identity!.clientId)] : options.serviceSecrets;
  for (const [clientId, secret] of secrets) await options.clients.ensure(clientId, secret);
  if (options.identity) await applyServiceAccountRights(kc, options.identity.clientId, IDENTITY_RIGHTS, changes);
  if (options.firstAdmin && (await kc.ensureRoleHolder(DEPLOYMENT_ADMIN_ROLE.name, options.firstAdmin))) changes.push(`${options.firstAdmin} is now a deployment admin`);
  return changes;
};
