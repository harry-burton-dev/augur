/**
 * The caller's own account, for the shell's Account area (ADR 0036): who they are (Keycloak's user
 * profile, ADR 0039), how they sign in, where they're signed in, their recent sign-ins, and what they've
 * chosen for AUGUR (identity's preferences). Identity reads and changes Keycloak through its admin API
 * with its own client, never Keycloak's account REST API. Anything that touches a credential (a password,
 * a code app, a passkey, recovery codes, the email address) isn't changed here: the security summary says
 * which of Keycloak's own screens does it (`kc_action`), and the shell sends the person there and back.
 */
import type { FastifyInstance } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Type from 'typebox';
import { callerFromHeaders, type Caller, type NewAuditEntry, type NewNotification } from '@augur/service-kit';
import { DirectoryError, TWO_STEP_ROLE, type KeycloakDirectory } from './directory.ts';
import { SECURITY_EMAIL_LISTENER, TWO_STEP_ROLES } from './realm.ts';
import { choice, empty, IdParams, Preferences, ref, refused } from './schemas.ts';
import type { LeaveRequest, PreferenceStore, Preferences as Prefs } from './store.ts';

// ---------------------------------------------------------------------------------------------------
// What an account holds

/** The profile facts a person may see; `managed` names those their organisation's sign-in sets. */
export interface Profile {
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  emailVerified: boolean;
  jobTitle?: string;
  phone?: string;
  pronouns?: string;
  picture?: string;
  locale?: string;
  /** Fields copied in from the organisation's sign-in at every sign-in, so changing them here wouldn't last. */
  managed: ProfileField[];
  /** The organisation's sign-in that sets them, by its name. */
  managedBy?: string;
}

export const PROFILE_FIELDS = ['firstName', 'lastName', 'email', 'jobTitle', 'phone', 'pronouns', 'picture', 'locale'] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];
const FIELD_WORDS: Record<ProfileField, string> = { firstName: 'first name', lastName: 'last name', email: 'email address', jobTitle: 'job title', phone: 'phone', pronouns: 'pronouns', picture: 'picture', locale: 'language' };
/** What a person changes here. The email address changes on Keycloak's screen, which checks it. */
export type ProfileChanges = Partial<Pick<Profile, 'firstName' | 'lastName' | 'jobTitle' | 'phone' | 'pronouns' | 'picture' | 'locale'>>;
const EDITABLE = ['firstName', 'lastName', 'jobTitle', 'phone', 'pronouns', 'picture', 'locale'] as const satisfies readonly (keyof ProfileChanges)[];
/** The facts kept as user-profile attributes rather than Keycloak's own fields. */
const ATTRIBUTES = ['jobTitle', 'phone', 'pronouns', 'picture', 'locale'] as const;

/** One way of proving who you are. */
export interface Credential {
  id: string;
  /** Keycloak's type: password, otp, webauthn, webauthn-passwordless or recovery-authn-codes. */
  type: string;
  label?: string;
  createdAt?: string;
}

/** An organisation's sign-in (such as Entra) a person's account is linked to. */
export interface LinkedAccount {
  provider: string;
  name: string;
  username?: string;
}

/** An organisation's sign-in a person could link their account to. */
export interface Provider {
  alias: string;
  name: string;
  /** Whether it sets the person's name and email at every sign-in. */
  setsProfile: boolean;
}

/** Somewhere the person is signed in. */
export interface Session {
  id: string;
  startedAt: string;
  lastSeenAt: string;
  ipAddress?: string;
  /** The parts of AUGUR it's signed in to, by their sign-in client. */
  clients: string[];
  rememberMe?: boolean;
}

/** One recent sign-in, failed sign-in or change to how they sign in. */
export interface SignIn {
  time: string;
  kind: 'signed-in' | 'failed' | 'changed';
  /** Keycloak's event type, such as LOGIN, LOGIN_ERROR or UPDATE_PASSWORD. */
  event: string;
  ipAddress?: string;
  client?: string;
  /** Why it failed, as Keycloak says it (such as invalid_user_credentials). */
  error?: string;
}

/** Where accounts are kept: Keycloak on a server, memory in tests and a stack without it. */
export interface AccountSource {
  profile(person: string): Promise<Profile>;
  updateProfile(person: string, changes: ProfileChanges): Promise<Profile>;
  credentials(person: string): Promise<Credential[]>;
  linked(person: string): Promise<LinkedAccount[]>;
  /** The organisation's sign-ins this deployment has. */
  providers(): Promise<Provider[]>;
  sessions(person: string): Promise<Session[]>;
  /** Ends one of the person's sessions; a session that isn't theirs is not found. */
  endSession(person: string, session: string): Promise<void>;
  /** Ends every one of their sessions but `keep`; returns how many ended. */
  endSessions(person: string, keep?: string): Promise<number>;
  signIns(person: string, max: number): Promise<SignIn[]>;
  /** Whether Keycloak emails people when how they sign in changes: the realm has a relay and its email listener. */
  securityEmails(): Promise<boolean>;
}

/** The Keycloak events a person's recent sign-ins are read from. */
export const SIGN_IN_EVENTS = { 'signed-in': ['LOGIN'], failed: ['LOGIN_ERROR'], changed: ['UPDATE_PASSWORD', 'UPDATE_CREDENTIAL', 'REMOVE_CREDENTIAL', 'UPDATE_TOTP', 'REMOVE_TOTP', 'UPDATE_EMAIL', 'FEDERATED_IDENTITY_LINK', 'REMOVE_FEDERATED_IDENTITY'] } as const;
const kindOf = (event: string): SignIn['kind'] =>
  (Object.entries(SIGN_IN_EVENTS) as [SignIn['kind'], readonly string[]][]).find(([, types]) => types.includes(event))?.[0] ?? 'changed';

// ---------------------------------------------------------------------------------------------------
// Keycloak

interface KcUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerified?: boolean;
  attributes?: Record<string, string[]>;
  [key: string]: unknown;
}

/** Accounts in Keycloak, through identity's admin client (IDENTITY_RIGHTS in realm.ts). */
export class KeycloakAccounts implements AccountSource {
  private known?: { list: Provider[]; at: number };
  private readonly kc: Pick<KeycloakDirectory, 'call'>;

  constructor(kc: Pick<KeycloakDirectory, 'call'>) {
    this.kc = kc;
  }

  private user(person: string) {
    return this.kc.call<KcUser>('GET', `/users/${encodeURIComponent(person)}?userProfileMetadata=false`, undefined, 'Your account isn’t in the directory.');
  }

  async profile(person: string): Promise<Profile> {
    const [{ data: u }, linked, providers] = await Promise.all([this.user(person), this.linked(person), this.providers()]);
    const setter = providers.find((p) => p.setsProfile && linked.some((l) => l.provider === p.alias));
    const attr = (name: string) => u.attributes?.[name]?.[0] || undefined;
    const facts = Object.fromEntries(ATTRIBUTES.map((a) => [a, attr(a)]).filter(([, v]) => v !== undefined));
    return {
      username: u.username,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      ...(u.email ? { email: u.email } : {}),
      emailVerified: !!u.emailVerified,
      ...facts,
      managed: setter ? ['firstName', 'lastName', 'email'] : [],
      ...(setter ? { managedBy: setter.name } : {}),
    };
  }

  async updateProfile(person: string, changes: ProfileChanges): Promise<Profile> {
    const { data: u } = await this.user(person);
    const attributes = { ...(u.attributes ?? {}) };
    for (const a of ATTRIBUTES) {
      if (!(a in changes)) continue;
      const value = (changes as Record<string, string | undefined>)[a]?.trim();
      if (value) attributes[a] = [value];
      else delete attributes[a];
    }
    const own = Object.fromEntries((['firstName', 'lastName'] as const).filter((k) => changes[k] !== undefined).map((k) => [k, changes[k]!.trim()]));
    await this.kc.call('PUT', `/users/${encodeURIComponent(person)}`, { ...u, ...own, attributes });
    return this.profile(person);
  }

  async credentials(person: string): Promise<Credential[]> {
    const { data } = await this.kc.call<{ id: string; type: string; userLabel?: string; createdDate?: number }[]>('GET', `/users/${encodeURIComponent(person)}/credentials`);
    return data.map((c) => ({ id: c.id, type: c.type, ...(c.userLabel ? { label: c.userLabel } : {}), ...(c.createdDate ? { createdAt: new Date(c.createdDate).toISOString() } : {}) }));
  }

  async linked(person: string): Promise<LinkedAccount[]> {
    const [{ data }, providers] = await Promise.all([
      this.kc.call<{ identityProvider: string; userName?: string }[]>('GET', `/users/${encodeURIComponent(person)}/federated-identity`),
      this.providers(),
    ]);
    return data.map((f) => ({ provider: f.identityProvider, name: providers.find((p) => p.alias === f.identityProvider)?.name ?? f.identityProvider, ...(f.userName ? { username: f.userName } : {}) }));
  }

  private emails?: { on: boolean; at: number };

  async securityEmails() {
    if (this.emails && Date.now() - this.emails.at < 60_000) return this.emails.on;
    const { data } = await this.kc.call<{ smtpServer?: { host?: string }; eventsListeners?: string[] }>('GET', '');
    const on = Boolean(data.smtpServer?.host) && (data.eventsListeners ?? []).includes(SECURITY_EMAIL_LISTENER);
    this.emails = { on, at: Date.now() };
    return on;
  }

  async providers(): Promise<Provider[]> {
    if (this.known && Date.now() - this.known.at < 60_000) return this.known.list;
    const { data } = await this.kc.call<{ alias: string; displayName?: string; enabled: boolean; config?: { syncMode?: string } }[]>('GET', '/identity-provider/instances?briefRepresentation=false');
    const list = data.filter((p) => p.enabled).map((p) => ({ alias: p.alias, name: p.displayName || p.alias, setsProfile: (p.config?.syncMode ?? 'LEGACY') === 'FORCE' }));
    this.known = { list, at: Date.now() };
    return list;
  }

  async sessions(person: string): Promise<Session[]> {
    const { data } = await this.kc.call<{ id: string; ipAddress?: string; start: number; lastAccess: number; rememberMe?: boolean; clients?: Record<string, string> }[]>(
      'GET',
      `/users/${encodeURIComponent(person)}/sessions`,
    );
    return data
      .map((s) => ({
        id: s.id,
        startedAt: new Date(s.start).toISOString(),
        lastSeenAt: new Date(s.lastAccess).toISOString(),
        ...(s.ipAddress ? { ipAddress: s.ipAddress } : {}),
        clients: Object.values(s.clients ?? {}).sort(),
        ...(s.rememberMe ? { rememberMe: true } : {}),
      }))
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  async endSession(person: string, session: string) {
    // Keycloak ends any session it's given: say no to one that isn't the caller's own.
    if (!(await this.sessions(person)).some((s) => s.id === session)) throw new DirectoryError('You’re not signed in there any more.', 404);
    await this.kc.call('DELETE', `/sessions/${encodeURIComponent(session)}`, undefined, 'You’re not signed in there any more.');
  }

  async endSessions(person: string, keep?: string) {
    const all = await this.sessions(person);
    if (!keep) {
      await this.kc.call('POST', `/users/${encodeURIComponent(person)}/logout`);
      return all.length;
    }
    const others = all.filter((s) => s.id !== keep);
    for (const s of others) await this.kc.call('DELETE', `/sessions/${encodeURIComponent(s.id)}`).catch((err: unknown) => {
      // one that ended meanwhile is as good as ended
      if (!(err instanceof DirectoryError && err.status === 404)) throw err;
    });
    return others.length;
  }

  async signIns(person: string, max: number): Promise<SignIn[]> {
    const types = Object.values(SIGN_IN_EVENTS).flat();
    const q = new URLSearchParams([['user', person], ['max', String(max)], ...types.map((t) => ['type', t])]);
    const { data } = await this.kc.call<{ time: number; type: string; ipAddress?: string; clientId?: string; error?: string }[]>('GET', `/events?${q}`);
    return data.map((e) => ({
      time: new Date(e.time).toISOString(),
      kind: kindOf(e.type),
      event: e.type,
      ...(e.ipAddress ? { ipAddress: e.ipAddress } : {}),
      ...(e.clientId ? { client: e.clientId } : {}),
      ...(e.error ? { error: e.error } : {}),
    }));
  }
}

/** For tests and a stack without Keycloak. Forgets everything on restart. */
export class MemoryAccounts implements AccountSource {
  readonly people = new Map<string, { profile: Profile; credentials: Credential[]; linked: LinkedAccount[]; sessions: Session[]; signIns: SignIn[] }>();
  readonly orgSignIns: Provider[] = [];
  /** Whether this pretend realm emails security changes. */
  emailsSecurity = false;

  add(person: string, profile: Partial<Profile> & { username: string }, more: Partial<{ credentials: Credential[]; linked: LinkedAccount[]; sessions: Session[]; signIns: SignIn[] }> = {}) {
    this.people.set(person, {
      profile: { firstName: '', lastName: '', emailVerified: false, managed: [], ...profile },
      credentials: more.credentials ?? [],
      linked: more.linked ?? [],
      sessions: more.sessions ?? [],
      signIns: more.signIns ?? [],
    });
  }

  private of(person: string) {
    const found = this.people.get(person);
    if (!found) throw new DirectoryError('Your account isn’t in the directory.', 404);
    return found;
  }

  async profile(person: string) {
    return structuredClone(this.of(person).profile);
  }

  async updateProfile(person: string, changes: ProfileChanges) {
    const p = this.of(person).profile;
    for (const k of EDITABLE) {
      if (!(k in changes)) continue;
      const v = changes[k]?.trim();
      if (k === 'firstName' || k === 'lastName') p[k] = v ?? '';
      else if (v) p[k] = v;
      else delete p[k];
    }
    return this.profile(person);
  }

  async credentials(person: string) {
    return structuredClone(this.of(person).credentials);
  }

  async linked(person: string) {
    return structuredClone(this.of(person).linked);
  }

  async providers() {
    return structuredClone(this.orgSignIns);
  }

  async securityEmails() {
    return this.emailsSecurity;
  }

  async sessions(person: string) {
    return structuredClone(this.of(person).sessions);
  }

  async endSession(person: string, session: string) {
    const p = this.of(person);
    if (!p.sessions.some((s) => s.id === session)) throw new DirectoryError('You’re not signed in there any more.', 404);
    p.sessions = p.sessions.filter((s) => s.id !== session);
  }

  async endSessions(person: string, keep?: string) {
    const p = this.of(person);
    const ended = p.sessions.filter((s) => s.id !== keep).length;
    p.sessions = p.sessions.filter((s) => s.id === keep);
    return ended;
  }

  async signIns(person: string, max: number) {
    return structuredClone(this.of(person).signIns.slice(0, max));
  }
}

// ---------------------------------------------------------------------------------------------------
// How a person signs in, and what they can change

/** Keycloak's own screens for changing a credential: the shell signs in again with `kc_action` set to one. */
export const ACCOUNT_ACTIONS = {
  password: 'UPDATE_PASSWORD',
  'code-app': 'CONFIGURE_TOTP',
  passkey: 'webauthn-register-passwordless',
  'recovery-codes': 'CONFIGURE_RECOVERY_AUTHN_CODES',
  email: 'UPDATE_EMAIL',
} as const;
export type AccountAction = keyof typeof ACCOUNT_ACTIONS;

/** What the summary says of one credential. */
interface Held extends Credential {
  /** `delete_credential:<id>`, the screen that removes it. */
  removeAction: string;
  removable: boolean;
  /** Why it can't be removed, when it can't. */
  reason?: string;
}

/** The second steps: a code from an app, a passkey, or a recovery code. */
const SECOND_STEPS = new Set(['otp', 'webauthn', 'webauthn-passwordless', 'recovery-authn-codes']);

export interface Security {
  password: { set: boolean; createdAt?: string; managedBy?: string };
  codeApps: Held[];
  passkeys: Held[];
  recoveryCodes: Held | null;
  twoStep: { required: boolean; set: boolean; reason?: string };
  linked: LinkedAccount[];
  /** The organisation's sign-ins they could link, each through `idp_link:<alias>`. */
  canLink: { alias: string; name: string; action: string }[];
  /** Keycloak's screens for each change, and whether this person can use it. */
  actions: { id: AccountAction; action: string; available: boolean; reason?: string }[];
  /** Whether a change to how they sign in is emailed to them, and where. */
  emails: { on: boolean; address?: string; verified: boolean };
}

/** The security summary for a caller, from what their account holds. */
export const securityOf = (
  caller: Pick<Caller, 'roles'>,
  creds: Credential[],
  linked: LinkedAccount[],
  providers: Provider[],
  profile: Pick<Profile, 'managed' | 'managedBy'> & Partial<Pick<Profile, 'email' | 'emailVerified'>>,
  emails = false,
): Security => {
  const required = caller.roles.includes(TWO_STEP_ROLE.name);
  const seconds = creds.filter((c) => SECOND_STEPS.has(c.type) && c.type !== 'recovery-authn-codes');
  const password = creds.find((c) => c.type === 'password');
  const orgSignIn = linked[0]?.name;
  const held = (c: Credential): Held => {
    // the last code app or passkey of someone who must have one stays: they'd be asked for one at next sign-in
    const last = required && SECOND_STEPS.has(c.type) && c.type !== 'recovery-authn-codes' && seconds.length === 1;
    return { ...c, removeAction: `delete_credential:${c.id}`, removable: !last, ...(last ? { reason: 'Your role needs two-step sign-in, so keep one code app or passkey. Add another before removing this one.' } : {}) };
  };
  const codes = creds.find((c) => c.type === 'recovery-authn-codes');
  const managedEmail = profile.managed.includes('email');
  return {
    password: password ? { set: true, ...(password.createdAt ? { createdAt: password.createdAt } : {}) } : { set: false, ...(orgSignIn ? { managedBy: orgSignIn } : {}) },
    codeApps: creds.filter((c) => c.type === 'otp').map(held),
    passkeys: creds.filter((c) => c.type === 'webauthn' || c.type === 'webauthn-passwordless').map(held),
    recoveryCodes: codes ? held(codes) : null,
    twoStep: {
      required,
      set: seconds.length > 0,
      ...(required
        ? {
            reason: caller.roles.some((r) => (TWO_STEP_ROLES as readonly string[]).includes(r))
              ? 'Your role can change AUGUR for everyone, so it signs in with a second step (ADR 0038).'
              : 'Your organisation asks everyone to sign in with a second step.',
          }
        : {}),
    },
    linked,
    canLink: providers.filter((p) => !linked.some((l) => l.provider === p.alias)).map((p) => ({ alias: p.alias, name: p.name, action: `idp_link:${p.alias}` })),
    actions: (Object.entries(ACCOUNT_ACTIONS) as [AccountAction, string][]).map(([id, action]) => {
      if (id === 'password' && !password && orgSignIn) return { id, action, available: false, reason: `You sign in through ${orgSignIn}, so your password is changed there.` };
      if (id === 'email' && managedEmail) return { id, action, available: false, reason: `${profile.managedBy ?? 'Your organisation’s sign-in'} sets your email address at every sign-in, so it's changed there.` };
      return { id, action, available: true };
    }),
    emails: { on: emails, ...(profile.email ? { address: profile.email } : {}), verified: Boolean(profile.email && profile.emailVerified) },
  };
};

// ---------------------------------------------------------------------------------------------------
// Preferences

/** Whether `zone` is an IANA time zone this runtime knows. */
export const knownTimeZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return zone.includes('/') || zone === 'UTC';
  } catch {
    return false;
  }
};

/** Whether `tag` is a language tag this runtime can write dates in. */
export const knownRegion = (tag: string) => {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([tag]).length === 1;
  } catch {
    return false;
  }
};

/** What's wrong with preferences the schema let through, or undefined. */
export const preferencesProblem = (prefs: Prefs): string | undefined => {
  if (prefs.timeZone !== undefined && !knownTimeZone(prefs.timeZone)) return `“${prefs.timeZone}” isn’t a time zone. Use a name such as Europe/London.`;
  if (prefs.dateFormat !== undefined && !knownRegion(prefs.dateFormat)) return `“${prefs.dateFormat}” isn’t a way of writing dates this server knows. Use a tag such as en-GB.`;
  const q = prefs.notifications?.quietHours;
  if (q && q.from === q.to) return 'Quiet hours need to start and end at different times.';
  return undefined;
};

// ---------------------------------------------------------------------------------------------------
// The wire

const at = () => Type.String({ format: 'date-time' });
const opt = Type.Optional;

export const AccountProfile = Type.Object(
  {
    username: Type.String(),
    firstName: Type.String(),
    lastName: Type.String(),
    email: opt(Type.String()),
    emailVerified: Type.Boolean(),
    jobTitle: opt(Type.String()),
    phone: opt(Type.String()),
    pronouns: opt(Type.String()),
    picture: opt(Type.String({ description: 'A link to their picture in AUGUR’s storage' })),
    locale: opt(Type.String({ description: 'Their language (the user profile’s locale), which sign-in pages use too' })),
    managed: Type.Array(choice([...PROFILE_FIELDS]), { description: 'Fields their organisation’s sign-in sets at every sign-in, so they can’t be changed here' }),
    managedBy: opt(Type.String({ description: 'That sign-in’s name' })),
    languages: opt(Type.Array(Type.String(), { description: 'The languages this deployment offers, the first its default (since 1.20)' })),
  },
  { $id: 'AccountProfile' },
);

const text = (max: number) => Type.String({ maxLength: max });
export const AccountProfileChanges = Type.Object(
  {
    firstName: opt(Type.String({ minLength: 1, maxLength: 120 })),
    lastName: opt(text(120)),
    jobTitle: opt(text(120)),
    phone: opt(Type.String({ maxLength: 40, pattern: '^[+0-9 ()-]*$' })),
    pronouns: opt(text(40)),
    picture: opt(Type.String({ maxLength: 2048, description: 'A link, or empty to take it away' })),
    locale: opt(Type.String({ maxLength: 35, description: 'One of `languages`, or empty for the deployment’s default (since 1.20)' })),
  },
  { $id: 'AccountProfileChanges', additionalProperties: false, minProperties: 1, description: 'Only what changes. An empty string takes a fact away. The email address changes through the email action.' },
);

const HeldCredential = Type.Object({
  id: Type.String(),
  type: Type.String({ description: 'otp, webauthn, webauthn-passwordless or recovery-authn-codes' }),
  label: opt(Type.String()),
  createdAt: opt(at()),
  removeAction: Type.String({ description: 'The kc_action that removes it: delete_credential:<id>' }),
  removable: Type.Boolean(),
  reason: opt(Type.String({ description: 'Why it can’t be removed' })),
});
const Linked = Type.Object({ provider: Type.String(), name: Type.String(), username: opt(Type.String()) });

export const AccountSecurity = Type.Object(
  {
    password: Type.Object({ set: Type.Boolean(), createdAt: opt(at()), managedBy: opt(Type.String({ description: 'The organisation’s sign-in that holds it, when they have no password here' })) }),
    codeApps: Type.Array(HeldCredential),
    passkeys: Type.Array(HeldCredential),
    recoveryCodes: Type.Union([HeldCredential, Type.Null()]),
    twoStep: Type.Object({ required: Type.Boolean({ description: 'Their role signs in with a second step' }), set: Type.Boolean({ description: 'They have a code app or a passkey' }), reason: opt(Type.String()) }),
    linked: Type.Array(Linked),
    canLink: Type.Array(Type.Object({ alias: Type.String(), name: Type.String(), action: Type.String({ description: 'idp_link:<alias>' }) })),
    actions: Type.Array(
      Type.Object({
        id: choice(Object.keys(ACCOUNT_ACTIONS) as AccountAction[]),
        action: Type.String({ description: 'The kc_action that opens Keycloak’s screen for it' }),
        available: Type.Boolean(),
        reason: opt(Type.String({ description: 'Why not, and who can change it' })),
      }),
    ),
    emails: Type.Object(
      {
        on: Type.Boolean({ description: 'This deployment emails people when their password, code app or passkeys change' }),
        address: opt(Type.String({ description: 'Where those emails go' })),
        verified: Type.Boolean({ description: 'They have confirmed that address' }),
      },
      { description: 'Emails about changes to how they sign in' },
    ),
  },
  { $id: 'AccountSecurity', description: 'How they sign in. Each change is made on Keycloak’s own screen: sign in again with kc_action set to its action, and come back.' },
);

export const AccountSession = Type.Object(
  {
    id: Type.String({ description: 'The sign-in session, as the sid claim in their tokens names it' }),
    startedAt: at(),
    lastSeenAt: at(),
    ipAddress: opt(Type.String()),
    clients: Type.Array(Type.String(), { description: 'What it’s signed in to' }),
    rememberMe: opt(Type.Boolean()),
  },
  { $id: 'AccountSession' },
);

export const AccountSignIn = Type.Object(
  {
    time: at(),
    kind: choice(['signed-in', 'failed', 'changed']),
    event: Type.String({ description: 'Keycloak’s event type' }),
    ipAddress: opt(Type.String()),
    client: opt(Type.String()),
    error: opt(Type.String()),
  },
  { $id: 'AccountSignIn' },
);

/** The named shapes in this file, for the contract. */
export const ME_SCHEMAS = [AccountProfile, AccountProfileChanges, AccountSecurity, AccountSession, AccountSignIn];

/** How many recent sign-ins the list shows at most. */
export const MAX_SIGN_INS = 50;

export interface MeOptions {
  store: PreferenceStore;
  /** Where accounts are kept. Without it everything but preferences answers 503. */
  accounts?: AccountSource;
  /** Records what a person did to their own account in Activity (the audit log). */
  audit?: (entry: NewAuditEntry) => Promise<void>;
  /** Tells people through the events service, as identity: an admin hears when someone asks to leave. */
  tell?: (n: NewNotification) => Promise<void>;
  /** What another service keeps about a person, for their download, by the name of the service. */
  dataFrom?: Record<string, (person: string) => Promise<unknown>>;
  /** The languages this deployment offers (Admin → Organisation, else REALM_LANGUAGES), the first the default. */
  languages?: string[] | (() => Promise<string[]>);
}

/** Who acts on a request to leave: the people who run AUGUR (ADR 0040's leaver flow is theirs). */
const LEAVE_AUDIENCE = ['role:admin'];

/** One part of a person's download: what a service keeps about them, or why it isn't there. */
const part = async (name: string, read: () => Promise<unknown>): Promise<[string, unknown] | [string, undefined, string]> => {
  try {
    return [name, await read()];
  } catch (err) {
    return [name, undefined, `${name}: ${(err as Error).message || 'it couldn’t be read'}`];
  }
};

const unavailable = 'Your account can’t be read right now: the sign-in service isn’t connected to AUGUR. A deployment admin can connect it.';

/** The /me/* routes beside /me itself: preferences, and the account. Registered under /v1, behind the signed-in check. */
export const meRoutes =
  ({ store, accounts, audit, tell, dataFrom = {}, languages: offered = ['en'] }: MeOptions) =>
  async (plain: FastifyInstance) => {
    const offeredNow = async () => (typeof offered === 'function' ? offered() : offered);
    const app = plain.withTypeProvider<TypeBoxTypeProvider>();
    const unauthenticated = refused('No signed-in caller');
    const noAccounts = refused('The sign-in service isn’t connected, or can’t be reached right now');
    const caller = (headers: Parameters<typeof callerFromHeaders>[0]) => callerFromHeaders(headers)!;
    /** The account source; without one, the request is answered 503 by the error handler below. */
    const acct = () => {
      if (!accounts) throw new DirectoryError(unavailable, 503);
      return accounts;
    };
    app.setErrorHandler((err: Error, req, reply) => {
      if (err instanceof DirectoryError) {
        const error = { 400: 'bad_request', 404: 'not_found', 409: 'conflict', 503: 'unavailable' }[err.status];
        return reply.code(err.status).send({ error, message: err.message });
      }
      if ((err as { validation?: unknown }).validation) return reply.code(400).send({ error: 'bad_request', message: err.message });
      req.log.error({ err }, 'account request failed');
      return reply.code(500).send({ error: 'internal', message: 'Something went wrong. Nothing was changed; try again.' });
    });

    app.get(
      '/me/preferences',
      {
        schema: {
          summary: 'What the caller has chosen for AUGUR',
          response: { 200: { ...ref(Preferences), description: 'Their preferences; empty when they have chosen nothing' }, 401: unauthenticated },
        },
      },
      async (req) => store.get(caller(req.headers).id),
    );

    app.put(
      '/me/preferences',
      {
        schema: {
          summary: "Replace the caller's preferences",
          body: ref(Preferences),
          response: {
            200: { ...ref(Preferences), description: 'Saved, as sent' },
            400: refused("A field it doesn't know, or a value out of range"),
            401: unauthenticated,
          },
        },
      },
      async (req, reply) => {
        const problem = preferencesProblem(req.body);
        if (problem) return reply.code(400).send({ error: 'invalid', message: problem });
        await store.put(caller(req.headers).id, req.body);
        return req.body;
      },
    );

    app.get(
      '/me/profile',
      {
        schema: {
          summary: "The caller's profile",
          description: 'Who they are, from the sign-in service’s user profile (ADR 0039), with the facts their organisation’s sign-in sets marked.',
          response: { 200: { ...ref(AccountProfile), description: 'Their profile' }, 401: unauthenticated, 503: noAccounts },
        },
      },
      async (req) => ({ ...(await acct().profile(caller(req.headers).id)), languages: await offeredNow() }),
    );

    app.patch(
      '/me/profile',
      {
        schema: {
          summary: "Change the caller's profile",
          body: ref(AccountProfileChanges),
          response: {
            200: { ...ref(AccountProfile), description: 'Their profile, changed' },
            400: refused('A value the user profile refuses'),
            401: unauthenticated,
            409: refused('A fact their organisation’s sign-in sets'),
            503: noAccounts,
          },
        },
      },
      async (req) => {
        const id = caller(req.headers).id;
        const now = await acct().profile(id);
        const managed = (Object.keys(req.body) as ProfileField[]).find((k) => now.managed.includes(k) && req.body[k as keyof ProfileChanges] !== now[k]);
        if (managed) throw new DirectoryError(`${now.managedBy ?? 'Your organisation’s sign-in'} sets your ${FIELD_WORDS[managed]}, so it’s changed there.`, 409);
        const locale = req.body.locale?.trim();
        const languages = await offeredNow();
        if (locale && !languages.includes(locale)) throw new DirectoryError(`${locale} isn’t one of the languages offered here (${languages.join(', ')}). A deployment admin can offer more.`, 400);
        return { ...(await acct().updateProfile(id, req.body)), languages };
      },
    );

    app.get(
      '/me/security',
      {
        schema: {
          summary: 'How the caller signs in',
          description: [
            'Their password, code apps, passkeys and recovery codes, whether their role needs two-step sign-in,',
            'the organisation sign-ins their account is linked to, and the kc_action that changes each.',
          ].join(' '),
          response: { 200: { ...ref(AccountSecurity), description: 'How they sign in' }, 401: unauthenticated, 503: noAccounts },
        },
      },
      async (req) => {
        const who = caller(req.headers);
        const a = acct();
        const [creds, linked, providers, profile, emails] = await Promise.all([a.credentials(who.id), a.linked(who.id), a.providers(), a.profile(who.id), a.securityEmails().catch(() => false)]);
        return securityOf(who, creds, linked, providers, profile, emails);
      },
    );

    app.get(
      '/me/sessions',
      {
        schema: {
          summary: 'Where the caller is signed in',
          description: 'Most recently used first. The shell marks its own by the sid claim in its token.',
          response: { 200: Type.Object({ sessions: Type.Array(ref(AccountSession)) }, { description: 'Their sessions' }), 401: unauthenticated, 503: noAccounts },
        },
      },
      async (req) => ({ sessions: await acct().sessions(caller(req.headers).id) }),
    );

    app.delete(
      '/me/sessions/:id',
      {
        schema: {
          summary: 'Sign the caller out of one session',
          params: IdParams,
          response: { 204: empty('Signed out there'), 401: unauthenticated, 404: refused('Not one of their sessions, or it has ended'), 503: noAccounts },
        },
      },
      async (req, reply) => {
        await acct().endSession(caller(req.headers).id, req.params.id);
        return reply.code(204).send(null);
      },
    );

    app.delete(
      '/me/sessions',
      {
        schema: {
          summary: 'Sign the caller out everywhere',
          description: 'Every session, or every one but `keep` (the one they’re using) to sign out everywhere else.',
          querystring: Type.Object({ keep: Type.Optional(Type.String({ minLength: 1, description: 'A session to leave signed in' })) }),
          response: { 200: Type.Object({ ended: Type.Integer() }, { description: 'How many sessions ended' }), 401: unauthenticated, 503: noAccounts },
        },
      },
      async (req) => ({ ended: await acct().endSessions(caller(req.headers).id, req.query.keep) }),
    );

    app.get(
      '/me/sign-ins',
      {
        schema: {
          summary: "The caller's recent sign-ins",
          description: 'Sign-ins, failed sign-ins and changes to how they sign in, newest first, for as long as the sign-in service keeps them.',
          querystring: Type.Object({ max: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_SIGN_INS, default: 20 })) }),
          response: { 200: Type.Object({ signIns: Type.Array(ref(AccountSignIn)) }, { description: 'Newest first' }), 401: unauthenticated, 503: noAccounts },
        },
      },
      async (req) => ({ signIns: await acct().signIns(caller(req.headers).id, req.query.max ?? 20) }),
    );

    // Privacy and data (ADR 0040): a copy of everything AUGUR keeps about them, and asking to leave.
    const LeaveState = Type.Object(
      { requestedAt: Type.Optional(Type.String({ format: 'date-time' })), note: Type.Optional(Type.String()) },
      { description: 'Their open request to leave; empty when they have none' },
    );
    const record = async (who: Caller, action: string, detail?: Record<string, unknown>) => {
      await audit?.({ actor: { id: who.id, kind: 'user' }, app: 'identity', action, target: who.id, ...(detail ? { detail } : {}) });
    };

    app.get(
      '/me/leave',
      { schema: { summary: 'Whether the caller has asked to leave', response: { 200: LeaveState, 401: unauthenticated } } },
      async (req) => (await store.leaveRequest(caller(req.headers).id)) ?? {},
    );

    app.post(
      '/me/leave',
      {
        schema: {
          summary: 'Ask to leave',
          description: [
            'People don’t delete their own account (ADR 0040): they ask, and an admin’s leaver',
            'flow turns the account off, ends their sessions and hands on what they own.',
            'Admins are told, and it is recorded in Activity. Asking again keeps the first time',
            'and replaces the note.',
          ].join(' '),
          body: Type.Object({ note: Type.Optional(Type.String({ maxLength: 500, description: 'Anything the admin should know' })) }, { additionalProperties: false }),
          response: { 201: LeaveState, 401: unauthenticated },
        },
      },
      async (req, reply) => {
        const who = caller(req.headers);
        const note = req.body.note?.trim() || undefined;
        const before = await store.leaveRequest(who.id);
        const request: LeaveRequest = await store.requestLeave(who.id, note);
        await record(who, 'account.leave-requested', note ? { note } : undefined);
        if (!before) {
          await tell?.({
            app: 'admin',
            recipients: [],
            audience: LEAVE_AUDIENCE,
            key: `leave:${who.id}:${request.requestedAt}`,
            level: 'needs',
            title: `${who.name} asked to leave`,
            detail: note ?? 'They asked from their account. Turn their account off in People when they go.',
            link: '/people',
          }).catch((err: Error) => req.log.warn({ err }, 'admins were not told of a request to leave'));
        }
        return reply.code(201).send(request);
      },
    );

    app.delete(
      '/me/leave',
      { schema: { summary: 'Take back a request to leave', response: { 204: { ...empty, description: 'Taken back, or there was none' }, 401: unauthenticated } } },
      async (req, reply) => {
        const who = caller(req.headers);
        if (await store.withdrawLeave(who.id)) await record(who, 'account.leave-withdrawn');
        return reply.code(204).send(null);
      },
    );

    app.get(
      '/me/data',
      {
        schema: {
          summary: 'A copy of everything AUGUR keeps about the caller',
          description: [
            'One JSON document (ADR 0040): who they are, how and where they sign in (never a secret),',
            'what they have chosen, whether they asked to leave, and what each other service keeps',
            'about them. A part that can’t be read is named in `missing`, with why. Recorded in Activity.',
          ].join(' '),
          response: { 200: Type.Object({}, { additionalProperties: true, description: 'Their data, as a download' }), 401: unauthenticated },
        },
      },
      async (req, reply) => {
        const who = caller(req.headers);
        const mine = <T>(read: (a: AccountSource) => Promise<T>) => () => read(acct());
        const parts = await Promise.all([
          part('profile', mine((a) => a.profile(who.id))),
          part('credentials', mine((a) => a.credentials(who.id))),
          part('linked accounts', mine((a) => a.linked(who.id))),
          part('sessions', mine((a) => a.sessions(who.id))),
          part('sign-ins', mine((a) => a.signIns(who.id, 50))),
          ...Object.entries(dataFrom).map(([name, read]) => part(name, () => read(who.id))),
        ]);
        const missing = parts.filter((p) => p.length === 3).map((p) => p[2]);
        const from = Object.fromEntries(parts.filter((p) => p[1] !== undefined).map(([name, value]) => [name, value]));
        await record(who, 'account.data-downloaded', missing.length ? { missing: missing.length } : undefined);
        const day = new Date().toISOString().slice(0, 10);
        void reply.header('content-disposition', `attachment; filename="my-data-${day}.json"`);
        return {
          madeAt: new Date().toISOString(),
          you: { id: who.id, name: who.name, ...(who.email ? { email: who.email } : {}), roles: who.roles, departments: who.departments },
          preferences: await store.get(who.id),
          leaveRequest: (await store.leaveRequest(who.id)) ?? null,
          ...from,
          missing,
          note: 'Apps keep their own content, such as documents, in their own services, and this copy doesn’t include it yet.',
        };
      },
    );
  };
