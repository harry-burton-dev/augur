import { mailRelayFromEnv, type MailRelay } from '@augur/service-kit';
import { createHash } from 'node:crypto';
import { DEPLOYMENT_ADMIN_ROLE, DirectoryError, PLATFORM_ROLES, SIGN_IN_FLOW, TWO_STEP_ROLE, type KeycloakDirectory } from './directory.ts';
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

/** Keycloak's smtpServer for a relay. Its values are all strings; `fromDisplayName` is the product's name, never a literal. */
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

/** A fingerprint of everything the relay is set to, the password included, that never reveals it. */
export const mailFingerprint = (server: Record<string, string>) =>
  createHash('sha256').update(JSON.stringify(Object.entries(server).sort(([a], [b]) => a.localeCompare(b)))).digest('hex').slice(0, 32);

/**
 * Points the realm at the organisation's relay and, with one, turns on what needs email: verifying an
 * address and resetting a forgotten password. Without `mail` the relay set in Keycloak's console (if any)
 * is left as it is, and those two follow whether the realm has one, so a deployment never offers a reset
 * link it can't send.
 */
export const applyMail = async (kc: KeycloakDirectory, mail: RealmMail | undefined, changes: Changes, productName?: string) => {
  const { data: realm } = await kc.call<Record<string, unknown> & { smtpServer?: Record<string, string>; attributes?: Record<string, string> }>('GET', '');
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
  const differs = Object.keys(want);
  if (!differs.length) return;
  await kc.call('PUT', '', { ...want, ...(attributes ? { attributes } : {}) });
  changes.push(`email: ${differs.map((k) => (k === 'smtpServer' ? `relay ${mail!.host}:${mail!.port}` : `${k} ${want[k] ? 'on' : 'off'}`)).join(', ')}`);
};

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
}

/**
 * Brings the realm to what this release declares. Safe to run any number of times: each step reads
 * first and changes only what differs. Returns what it changed.
 */
export const applyRealm = async (kc: KeycloakDirectory, options: ApplyOptions): Promise<Changes> => {
  const changes: Changes = [];
  await applyRealmSettings(kc, options.settings, changes, options.productName);
  if (options.look) await applyLook(kc, options.look, changes, options.warn);
  await applyMail(kc, options.mail, changes, options.productName);
  await applyRequiredActions(kc, changes);
  await applyRoles(kc, changes);
  await applyUserProfile(kc, changes);
  await applySignInFlow(kc, changes);
  const secrets = options.identity ? [[options.identity.clientId, options.identity.secret] as [string, string], ...options.serviceSecrets.filter(([id]) => id !== options.identity!.clientId)] : options.serviceSecrets;
  for (const [clientId, secret] of secrets) await options.clients.ensure(clientId, secret);
  if (options.identity) await applyServiceAccountRights(kc, options.identity.clientId, IDENTITY_RIGHTS, changes);
  if (options.firstAdmin && (await kc.ensureRoleHolder(DEPLOYMENT_ADMIN_ROLE.name, options.firstAdmin))) changes.push(`${options.firstAdmin} is now a deployment admin`);
  return changes;
};
