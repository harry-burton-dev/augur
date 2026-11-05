import { AppFrame, AskTwice, Button, Choice, Notice, Note, PageHead, RailLink, Rows, Section, Select, State, TextField, Toggle, type IconName } from '@augur/app-kit';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Preferences } from '../host/preferences.js';
import { type AccountApi, type AccountSession, type HeldCredential, type ProfileChanges, type Security, type SignIn } from './api.js';
import { currentFormats, writeDate, type Formats } from '../host/formats.js';
import { whatsNewFor } from './whats-new.js';
import { actionWords, ago, clientWords, DATE_REGIONS, dayAndTime, languageName, regionName, signInWords, timeZones } from './words.js';

/** The Account area's sections (ADR 0036), in the rail's order. Privacy and data comes later. */
export const ACCOUNT_SECTIONS = [
  { id: 'profile', label: 'Profile', icon: 'account' },
  { id: 'security', label: 'Sign-in and security', icon: 'lock' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'region', label: 'Language and region', icon: 'clock' },
  { id: 'apps', label: 'Home and apps', icon: 'home' },
  { id: 'privacy', label: 'Privacy and data', icon: 'download' },
  { id: 'about', label: 'About and help', icon: 'info' },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];
export type AccountSection = (typeof ACCOUNT_SECTIONS)[number]['id'];
export const isAccountSection = (s: string | null | undefined): s is AccountSection => ACCOUNT_SECTIONS.some((x) => x.id === s);

export interface AccountAreaProps {
  section: AccountSection;
  onSection: (section: AccountSection) => void;
  onClose: () => void;
  api: AccountApi;
  /** What they've chosen, and how to change one choice: the shell saves it and applies it at once. */
  prefs: Preferences;
  onPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  /** Their language changed: dates follow it at once. */
  onLanguage?: (locale: string | undefined) => void;
  /** Opens one of Keycloak's screens and comes back to this section. */
  onAction: (kcAction: string, section: AccountSection) => void;
  onSignOut: () => void;
  /** The apps on this floor, for choosing how each one's notifications arrive, with the kinds each declares. */
  apps: { id: string; name: string; kinds?: { id: string; label: string; detail?: string }[] }[];
  /** Their floors, to choose the one AUGUR opens on, and which is their own. */
  floors: { id: string; name: string }[];
  ownFloor: string;
  /** The apps on this floor with settings of their own (a `settings` surface), and how to show them. */
  appSettings: { id: string; name: string }[];
  mountSettings: (el: HTMLElement, app: string) => Promise<boolean>;
  unmountSettings: (el: HTMLElement) => void;
  /** The shell's own sign-in client, so the list of sessions can name it. */
  shellClient: string;
  product: string;
  /** The organisation's time zone (Admin → Organisation), which times follow until they choose their own. */
  orgTimeZone?: string;
  /** What's running, for About. */
  version?: string;
  /** How the last of Keycloak's screens went (kc_action_status), to say once. */
  actionStatus?: string | null;
}

/**
 * The one place a person manages themselves (ADR 0036): who they are, how they sign in and where,
 * how they hear about things, how AUGUR looks for them, their time zone, and what's running. It
 * opens over whatever was on screen, in an app's frame, and closes back to it.
 */
export function AccountArea(props: AccountAreaProps) {
  const { section, onSection, onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !(e.target instanceof HTMLElement && e.target.closest('[role="dialog"], [role="listbox"]'))) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="account-area" role="region" aria-label="Your account">
      <AppFrame
        app={{ name: 'Account', icon: 'account' }}
        onFront={() => onSection('profile')}
        railLabel="Account"
        rail={ACCOUNT_SECTIONS.map((s) => (
          <RailLink key={s.id} icon={s.icon} label={s.label} current={s.id === section} onPress={() => onSection(s.id)} />
        ))}
        measure="read"
        screen={section}
      >
        <div className="account-close">
          <Button kind="tertiary" size="sm" onPress={onClose}>
            Close
          </Button>
        </div>
        {section === 'profile' ? <ProfileSection {...props} /> : null}
        {section === 'security' ? <SecuritySection {...props} /> : null}
        {section === 'notifications' ? <NotificationsSection {...props} /> : null}
        {section === 'appearance' ? <AppearanceSection {...props} /> : null}
        {section === 'region' ? <RegionSection {...props} /> : null}
        {section === 'apps' ? <AppsSection {...props} /> : null}
        {section === 'privacy' ? <PrivacySection {...props} /> : null}
        {section === 'about' ? <AboutSection {...props} /> : null}
      </AppFrame>
    </div>
  );
}

/** Loads something once per section visit, with its error as a sentence and a way to load it again. */
function useLoad<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ value?: T; error?: string; loading: boolean }>({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    load().then(
      (value) => live && setState({ value, loading: false }),
      (err: Error) => live && setState({ error: err.message, loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loads again only when asked
  }, [attempt]);
  return { ...state, set: (value: T) => setState({ value, loading: false }), again: () => setAttempt((n) => n + 1) };
}

function Loading({ what, error, onRetry }: { what: string; error?: string; onRetry: () => void }) {
  if (error) return <State kind="error" heading={`Your ${what} didn’t load`} body={error} action="Try again" onAction={onRetry} />;
  return <State kind="loading" heading={`Loading your ${what}…`} />;
}

// ---------------------------------------------------------------------------------------------------
// Profile

const FIELDS: { key: keyof ProfileChanges; label: string; hint?: string; max: number; type?: 'tel' }[] = [
  { key: 'firstName', label: 'First name', max: 120 },
  { key: 'lastName', label: 'Last name', max: 120 },
  { key: 'jobTitle', label: 'Job title', max: 120 },
  { key: 'phone', label: 'Phone', hint: 'Digits, spaces, brackets, + and -', max: 40, type: 'tel' },
  { key: 'pronouns', label: 'Pronouns', hint: 'Shown beside your name, such as they/them', max: 40 },
];

function ProfileSection({ api, prefs, onPreference, onAction, onSignOut }: AccountAreaProps) {
  const profile = useLoad(() => api.profile());
  const [saving, setSaving] = useState<keyof ProfileChanges | null>(null);
  const [problem, setProblem] = useState<{ key: keyof ProfileChanges; message: string } | null>(null);
  const p = profile.value;
  const save = async (key: keyof ProfileChanges, value: string) => {
    if (!p || (p[key] ?? '') === value) return;
    setSaving(key);
    setProblem(null);
    try {
      profile.set(await api.updateProfile({ [key]: value }));
    } catch (err) {
      setProblem({ key, message: (err as Error).message });
    } finally {
      setSaving(null);
    }
  };
  const name = p ? [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username : '';
  return (
    <>
      <PageHead eyebrow="Account" heading="Profile" summary={p ? `${name}${p.email ? ` · ${p.email}` : ''}` : 'Who you are, as others see you'} />
      {!p ? (
        <Loading what="profile" error={profile.error} onRetry={profile.again} />
      ) : (
        <>
          {p.managed.length ? (
            <Notice tone="info" heading={`${p.managedBy ?? 'Your organisation’s sign-in'} sets your name and email.`}>
              It copies them in each time you sign in, so they’re changed there.
            </Notice>
          ) : null}
          <Section label="About you" count={-1}>
            <div className="account-fields">
              {FIELDS.map((f) => {
                const managed = p.managed.includes(f.key);
                return (
                  <TextField
                    key={`${f.key}:${p[f.key] ?? ''}`}
                    label={f.label}
                    hint={f.hint}
                    type={f.type}
                    maxLength={f.max}
                    defaultValue={p[f.key] ?? ''}
                    required={f.key === 'firstName'}
                    optional={f.key !== 'firstName' && f.key !== 'lastName'}
                    disabled={managed}
                    reason={managed ? `${p.managedBy ?? 'Your organisation’s sign-in'} sets this.` : undefined}
                    busy={saving === f.key}
                    state={problem?.key === f.key ? 'error' : undefined}
                    message={problem?.key === f.key ? problem.message : undefined}
                    onCommit={(v) => void save(f.key, v.trim())}
                  />
                );
              })}
            </div>
          </Section>
          <Section label="Email" count={-1}>
            <div className="account-line">
              <span>
                {p.email ?? 'No email address yet'}
                {p.email && !p.emailVerified ? <small> · not checked yet</small> : null}
              </span>
              <Button
                kind="secondary"
                size="sm"
                disabled={p.managed.includes('email')}
                reason={p.managed.includes('email') ? `${p.managedBy ?? 'Your organisation’s sign-in'} sets your email address.` : undefined}
                onPress={() => onAction('UPDATE_EMAIL', 'profile')}
              >
                {p.email ? 'Change email' : 'Add email'}
              </Button>
            </div>
            <Note>The sign-in page asks for the new address and sends it a link to check before it’s used.</Note>
          </Section>
        </>
      )}
      <Away prefs={prefs} onPreference={onPreference} />
      <Section label="Signing out" count={-1}>
        <div className="account-line">
          <span>Sign out of AUGUR on this device.</span>
          <Button kind="secondary" size="sm" onPress={onSignOut}>
            Sign out
          </Button>
        </div>
      </Section>
    </>
  );
}

/** "Show me as away", with what it says and when it ends by itself. */
function Away({ prefs, onPreference }: Pick<AccountAreaProps, 'prefs' | 'onPreference'>) {
  const until = prefs.awayUntil ? prefs.awayUntil.slice(0, 16) : '';
  return (
    <Section label="Away" count={-1}>
      <Toggle label="Show me as away" hint="Others see you’re away beside your name." checked={!!prefs.away} onChange={(on) => onPreference('away', on)} />
      {prefs.away ? (
        <div className="account-fields">
          <TextField
            label="What it says"
            optional
            maxLength={140}
            placeholder="Back on Monday"
            defaultValue={prefs.awayMessage ?? ''}
            onCommit={(v) => onPreference('awayMessage', v.trim() || undefined)}
          />
          <label className="account-native">
            <span>Until</span>
            <input
              type="datetime-local"
              value={until}
              onChange={(e) => onPreference('awayUntil', e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : undefined)}
            />
            <small>Leave it empty to stay away until you turn it off.</small>
          </label>
        </div>
      ) : null}
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------------
// Sign-in and security

function SecuritySection({ api, onAction, actionStatus, shellClient, product }: AccountAreaProps) {
  const security = useLoad(() => api.security());
  const s = security.value;
  const action = (id: string) => s?.actions.find((a) => a.id === id);
  return (
    <>
      <PageHead eyebrow="Account" heading="Sign-in and security" summary="How you sign in, and where you’re signed in" />
      {actionStatus ? <ActionStatus status={actionStatus} /> : null}
      {!s ? (
        <Loading what="sign-in details" error={security.error} onRetry={security.again} />
      ) : (
        <>
          {s.twoStep.required && !s.twoStep.set ? (
            <Notice tone="needs" heading="Your role needs two-step sign-in." action="Set up a code app" onAction={() => onAction(action('code-app')!.action, 'security')}>
              {s.twoStep.reason}
            </Notice>
          ) : null}
          <Section label="Password" count={-1}>
            <div className="account-line">
              <span>
                {s.password.set ? `Set${s.password.createdAt ? ` ${dayAndTime(s.password.createdAt)}` : ''}` : s.password.managedBy ? `You sign in through ${s.password.managedBy}.` : 'No password yet'}
              </span>
              <ActionButton act={action('password')} label={s.password.set ? 'Change password' : 'Set a password'} onAction={onAction} />
            </div>
          </Section>
          <Section label="Two-step sign-in" count={-1} why={s.twoStep.required ? s.twoStep.reason : 'A second step after your password, so a stolen password alone can’t get in.'}>
            <Credentials title="Code apps" empty="No code app yet." items={s.codeApps} onAction={onAction} />
            <div className="account-line">
              <span />
              <ActionButton act={action('code-app')} label="Add a code app" onAction={onAction} />
            </div>
            <Credentials title="Passkeys" empty="No passkey yet." items={s.passkeys} onAction={onAction} />
            <div className="account-line">
              <span />
              <ActionButton act={action('passkey')} label="Add a passkey" onAction={onAction} />
            </div>
            <div className="account-line">
              <span>{s.recoveryCodes ? `Recovery codes set ${s.recoveryCodes.createdAt ? dayAndTime(s.recoveryCodes.createdAt) : ''}` : 'No recovery codes yet. They get you in if you lose your phone.'}</span>
              <ActionButton act={action('recovery-codes')} label={s.recoveryCodes ? 'Make new codes' : 'Make recovery codes'} onAction={onAction} />
            </div>
          </Section>
          <Section label="Your organisation’s sign-in" count={-1}>
            {s.linked.length ? (
              <Rows items={s.linked.map((l) => ({ label: l.name, value: l.username ?? 'Linked' }))} />
            ) : (
              <Note>Your account isn’t linked to an organisation sign-in.</Note>
            )}
            {s.canLink.map((p) => (
              <div className="account-line" key={p.alias}>
                <span>Sign in with {p.name} too</span>
                <Button kind="secondary" size="sm" onPress={() => onAction(p.action, 'security')}>
                  Link {p.name}
                </Button>
              </div>
            ))}
          </Section>
          {s.emails ? <SecurityEmails emails={s.emails} product={product} /> : null}
        </>
      )}
      <Sessions api={api} shellClient={shellClient} product={product} />
      <RecentSignIns api={api} shellClient={shellClient} product={product} />
    </>
  );
}

function SecurityEmails({ emails, product }: { emails: NonNullable<Security['emails']>; product: string }) {
  const what = 'when your password, code app or passkeys change';
  return (
    <Section label="Emails about your security" count={-1} why="Always on when email works, so a change you didn’t make can’t go unnoticed.">
      <Note>
        {!emails.on
          ? `${product} can’t send email on this deployment yet, so changes to how you sign in aren’t emailed. A deployment admin can connect the organisation’s mail.`
          : !emails.address
            ? `${product} emails you ${what}, once you add an email address in Profile.`
            : emails.verified
              ? `${product} emails you at ${emails.address} ${what}.`
              : `${product} emails you at ${emails.address} ${what}, once you confirm that address.`}
      </Note>
    </Section>
  );
}

function ActionStatus({ status }: { status: string }) {
  if (status === 'success') return <Notice tone="info" heading="Done.">The change is saved.</Notice>;
  if (status === 'cancelled') return <Notice tone="info" heading="Nothing changed.">You came back without finishing.</Notice>;
  return <Notice tone="warning" heading="That didn’t finish.">The sign-in page couldn’t make the change. Try again, or ask an admin if it keeps happening.</Notice>;
}

function ActionButton({ act, label, onAction }: { act?: Security['actions'][number]; label: string; onAction: AccountAreaProps['onAction'] }) {
  if (!act) return null;
  return (
    <Button kind="secondary" size="sm" disabled={!act.available} reason={act.reason} onPress={() => onAction(act.action, 'security')}>
      {label}
    </Button>
  );
}

function Credentials({ title, empty, items, onAction }: { title: string; empty: string; items: HeldCredential[]; onAction: AccountAreaProps['onAction'] }) {
  return (
    <div className="account-creds">
      <h3 className="account-sub">{title}</h3>
      {items.length ? (
        <ul>
          {items.map((c) => (
            <li key={c.id} className="account-line">
              <span>
                {c.label || actionWords(c.type)}
                {c.createdAt ? <small> · added {dayAndTime(c.createdAt)}</small> : null}
              </span>
              <AskTwice size="sm" confirm="Press again to remove" disabled={!c.removable} reason={c.reason} onPress={() => onAction(c.removeAction, 'security')}>
                Remove
              </AskTwice>
            </li>
          ))}
        </ul>
      ) : (
        <Note>{empty}</Note>
      )}
    </div>
  );
}

function Sessions({ api, shellClient, product }: Pick<AccountAreaProps, 'api' | 'shellClient' | 'product'>) {
  const load = useCallback(async () => ({ list: await api.sessions(), here: await api.currentSession() }), [api]);
  const sessions = useLoad(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const end = async (id: string | 'others') => {
    setBusy(id);
    setSaid(null);
    try {
      if (id === 'others') {
        const n = await api.endSessions(sessions.value?.here);
        setSaid(n ? `Signed out of ${n} other ${n === 1 ? 'place' : 'places'}.` : 'You weren’t signed in anywhere else.');
      } else {
        await api.endSession(id);
        setSaid('Signed out there.');
      }
      sessions.again();
    } catch (err) {
      setSaid((err as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const v = sessions.value;
  const others = v ? v.list.filter((s) => s.id !== v.here) : [];
  return (
    <Section label="Where you’re signed in" count={v ? v.list.length : -1}>
      {!v ? (
        <Loading what="sessions" error={sessions.error} onRetry={sessions.again} />
      ) : (
        <>
          <ul className="account-sessions">
            {v.list.map((s: AccountSession) => (
              <li key={s.id} className="account-line">
                <span>
                  <b>{s.id === v.here ? 'This browser' : s.ipAddress ? `From ${s.ipAddress}` : 'Somewhere else'}</b>
                  <small>
                    {' '}
                    · {clientWords(s.clients, shellClient, product)} · signed in {dayAndTime(s.startedAt)} · last used {ago(s.lastSeenAt)}
                  </small>
                </span>
                {s.id === v.here ? null : (
                  <Button kind="tertiary" size="sm" busy={busy === s.id} onPress={() => void end(s.id)}>
                    Sign out there
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="account-line">
            {said ? <Note live>{said}</Note> : <span />}
            <AskTwice size="sm" confirm="Press again to sign out everywhere else" disabled={!others.length} reason="You’re not signed in anywhere else." busy={busy === 'others'} onPress={() => void end('others')}>
              Sign out everywhere else
            </AskTwice>
          </div>
        </>
      )}
    </Section>
  );
}

function RecentSignIns({ api, shellClient, product }: Pick<AccountAreaProps, 'api' | 'shellClient' | 'product'>) {
  const list = useLoad(() => api.signIns(20));
  const items = list.value;
  return (
    <Section label="Recent sign-ins" count={items ? items.length : -1} limit={5} why="Each sign-in, each failed try and each change to how you sign in, for as long as the sign-in service keeps them. One you don’t recognise? Change your password and sign out everywhere else.">
      {!items ? (
        <Loading what="recent sign-ins" error={list.error} onRetry={list.again} />
      ) : items.length ? (
        items.map((e: SignIn) => (
          <div key={`${e.time}:${e.event}`} className="account-line" data-kind={e.kind}>
            <span>
              <b>{signInWords(e)}</b>
              <small>
                {' '}
                · {dayAndTime(e.time)}
                {e.ipAddress ? ` · from ${e.ipAddress}` : ''}
                {e.client ? ` · ${clientWords([e.client], shellClient, product)}` : ''}
              </small>
            </span>
          </div>
        ))
      ) : (
        <Note>Nothing yet. Sign-ins show here from now on.</Note>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------------
// Notifications

/**
 * Whether email reaches this person, and if not, why and who can change it. Email works when the deployment has a mail
 * relay (the realm's, the one security emails use) and their address is checked.
 */
function EmailReach({ api, product, onSection }: Pick<AccountAreaProps, 'api' | 'product' | 'onSection'>) {
  const security = useLoad(() => api.security());
  if (security.loading && !security.value) return null;
  const emails = security.value?.emails;
  if (!emails) return <Note>Whether {product} can email you couldn’t be checked{security.error ? ` (${security.error})` : ''}. Your choices are kept either way.</Note>;
  if (!emails.on)
    return (
      <Notice tone="info" heading={`${product} can’t send email on this deployment yet.`}>
        No mail relay is set up. Your choices are kept, and apply as soon as a deployment admin connects the organisation’s mail.
      </Notice>
    );
  if (!emails.address)
    return (
      <Notice tone="info" heading="Add an email address to get email." action="Open Profile" onAction={() => onSection('profile')}>
        {product} emails you here once you add one in Profile.
      </Notice>
    );
  if (!emails.verified)
    return (
      <Notice tone="info" heading={`${emails.address} isn’t checked yet, so nothing is emailed to it.`} action="Open Profile" onAction={() => onSection('profile')}>
        In Profile, Change email sends the address a link to check.
      </Notice>
    );
  return <Note>{product} emails you at {emails.address}.</Note>;
}

function NotificationsSection({ prefs, onPreference, apps, api, product, onSection }: AccountAreaProps) {
  const n = prefs.notifications ?? {};
  const set = (next: NonNullable<Preferences['notifications']>) => onPreference('notifications', { ...n, ...next });
  const muted = new Set(prefs.muted ?? []);
  const quietKinds = prefs.quietKinds ?? [];
  const quiet = n.quietHours;
  return (
    <>
      <PageHead eyebrow="Account" heading="Notifications" summary="How AUGUR tells you about things" />
      <EmailReach api={api} product={product} onSection={onSection} />
      <Section label="Email" count={-1}>
        <Toggle label="Email me about things that need me" hint="One email for each notification that asks something of you." checked={n.email !== false} onChange={(on) => set({ email: on })} />
        <Choice
          label="Digest"
          hint="One email gathering everything else."
          value={n.digest ?? 'off'}
          onChange={(v) => set({ digest: v as 'off' | 'daily' | 'weekly' })}
          options={[
            { value: 'off', label: 'None', detail: 'Only what needs you' },
            { value: 'daily', label: 'Daily', detail: 'Each morning' },
            { value: 'weekly', label: 'Weekly', detail: 'On Monday mornings' },
          ]}
        />
      </Section>
      <Section label="Quiet hours" count={-1} why="Between these times nothing is said out loud: no toasts and no email. Notifications still wait for you in the shell.">
        <Toggle label="Keep quiet hours" checked={!!quiet} onChange={(on) => set({ quietHours: on ? { from: '22:00', to: '07:00' } : undefined })} />
        {quiet ? (
          <div className="account-fields account-pair">
            <label className="account-native">
              <span>From</span>
              <input type="time" value={quiet.from} onChange={(e) => e.currentTarget.value && set({ quietHours: { ...quiet, from: e.currentTarget.value } })} />
            </label>
            <label className="account-native">
              <span>To</span>
              <input type="time" value={quiet.to} onChange={(e) => e.currentTarget.value && set({ quietHours: { ...quiet, to: e.currentTarget.value } })} />
            </label>
          </div>
        ) : null}
      </Section>
      <Section label="Each app" count={apps.length} why="Quiet: notifications land in the shell without a sound, uncounted, and never on Home or as a toast. Apps that name their kinds of notification let you choose each kind.">
        {apps.length ? (
          apps.map((a) => (
            <div key={a.id} className="account-app">
              <Toggle
                label={a.name}
                onWord="On Home"
                offWord="Quiet"
                checked={!muted.has(a.id)}
                onChange={(on) => onPreference('muted', on ? [...muted].filter((id) => id !== a.id) : [...muted, a.id])}
              />
              {a.kinds?.length ? (
                muted.has(a.id) ? (
                  <Note>Every kind from {a.name} is quiet while the whole app is.</Note>
                ) : (
                  <div className="account-kinds">
                    {a.kinds.map((k) => {
                      const id = `${a.id}:${k.id}`;
                      return (
                        <Toggle
                          key={id}
                          label={k.label}
                          {...(k.detail ? { hint: k.detail } : {})}
                          onWord="On Home"
                          offWord="Quiet"
                          checked={!quietKinds.includes(id)}
                          onChange={(on) => onPreference('quietKinds', on ? quietKinds.filter((q) => q !== id) : [...quietKinds, id])}
                        />
                      );
                    })}
                  </div>
                )
              ) : null}
            </div>
          ))
        ) : (
          <Note>No apps on this floor send notifications.</Note>
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
// Home and apps

function AppsSection({ prefs, onPreference, apps, floors, ownFloor, appSettings, mountSettings, unmountSettings }: AccountAreaProps) {
  const pinned = prefs.pinned ?? [];
  const pinnedHere = new Set(pinned);
  const elsewhere = pinned.filter((id) => !apps.some((a) => a.id === id)).length;
  const recent = prefs.recent ?? [];
  const nameOf = (id: string) => apps.find((a) => a.id === id)?.name;
  const start = prefs.startFloor && floors.some((f) => f.id === prefs.startFloor) ? prefs.startFloor : ownFloor;
  const lost = !!prefs.startFloor && start !== prefs.startFloor;
  return (
    <>
      <PageHead eyebrow="Account" heading="Home and apps" summary="Where AUGUR opens for you, and the apps you keep close" />
      <Section label="Start on" count={-1} why="AUGUR opens on this floor when you arrive at its front door. A link to somewhere in particular still goes there.">
        {lost ? <Notice tone="warning" heading="The floor you chose isn’t one of yours any more.">AUGUR opens on your own floor until you choose another. An admin can add you back to it.</Notice> : null}
        <Select
          label="Floor"
          options={floors.map((f) => ({ value: f.id, label: f.id === ownFloor ? `${f.name} (your own)` : f.name }))}
          value={start}
          onChange={(v) => onPreference('startFloor', v === ownFloor ? undefined : v)}
        />
      </Section>
      <Section label="Pinned apps" count={pinned.length} why="Pinned apps come first on Home and in the list of apps, in the order you pinned them.">
        {apps.length ? (
          apps.map((a) => (
            <Toggle
              key={a.id}
              label={a.name}
              onWord="Pinned"
              offWord="Not pinned"
              checked={pinnedHere.has(a.id)}
              onChange={(on) => onPreference('pinned', on ? [...pinned, a.id] : pinned.filter((id) => id !== a.id))}
            />
          ))
        ) : (
          <Note>There are no apps on this floor to pin.</Note>
        )}
        {elsewhere ? <Note>{elsewhere === 1 ? 'One pinned app isn’t' : `${elsewhere} pinned apps aren’t`} on this floor. Pins stay for the floors that have them.</Note> : null}
      </Section>
      <Section label="Recent apps" count={recent.length} why="The apps you opened last come next on Home and in the list of apps. Clearing them starts the list again from now.">
        {recent.length ? (
          <ul className="account-recent">
            {recent.map((id) => (
              <li key={id}>{nameOf(id) ?? 'An app that isn’t on this floor'}</li>
            ))}
          </ul>
        ) : (
          <Note>Nothing yet. The apps you open will show here.</Note>
        )}
        <div className="account-line">
          <span />
          <Button kind="secondary" size="sm" disabled={!recent.length} reason="There are no recent apps to clear." onPress={() => onPreference('recent', [])}>
            Clear recent apps
          </Button>
        </div>
      </Section>
      <h3 className="account-sub">Each app’s own settings</h3>
      {appSettings.length ? (
        appSettings.map((a) => <AppSettings key={a.id} app={a} mount={mountSettings} unmount={unmountSettings} />)
      ) : (
        <Note>No app on this floor has settings of its own. An app adds them in its manifest, as a settings surface.</Note>
      )}
    </>
  );
}

/** One app's own settings, mounted from the app; one that won't open says so and leaves the rest alone. */
function AppSettings({ app, mount, unmount }: { app: { id: string; name: string }; mount: AccountAreaProps['mountSettings']; unmount: AccountAreaProps['unmountSettings'] }) {
  const el = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<boolean | null>(null);
  useEffect(() => {
    const at = el.current;
    if (!at) return;
    let live = true;
    void mount(at, app.id).then((ok) => live && setShown(ok));
    return () => {
      live = false;
      unmount(at);
    };
  }, [app.id, mount, unmount]);
  return (
    <Section label={app.name} count={-1}>
      {shown === false ? <Note>{app.name}’s settings didn’t open. Try again later; if it keeps happening, the app’s developers can see why.</Note> : null}
      {shown === null ? <State kind="loading" heading={`Opening ${app.name}’s settings…`} /> : null}
      <div ref={el} className="account-app-settings" />
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------------
// Appearance, region, about

function AppearanceSection({ prefs, onPreference }: AccountAreaProps) {
  return (
    <>
      <PageHead eyebrow="Account" heading="Appearance" summary="How AUGUR looks and moves for you, on every device" />
      <Section label="Motion" count={-1}>
        <Toggle label="Reduce motion" hint="Things fade in place of moving. Your device’s own setting is followed too." checked={!!prefs.reduceMotion} onChange={(on) => onPreference('reduceMotion', on)} />
        <Toggle label="Area titles" hint="A title card on arriving at a floor or opening an app." checked={prefs.areaTitles !== false} onChange={(on) => onPreference('areaTitles', on)} />
        <Toggle label="Toasts for new notifications" hint="Each one said once at the bottom of the screen." checked={!!prefs.toasts} onChange={(on) => onPreference('toasts', on)} />
      </Section>
      <Section label="Density" count={-1}>
        <Choice
          label="Spacing"
          value={prefs.density ?? 'comfortable'}
          onChange={(v) => onPreference('density', v === 'compact' ? 'compact' : 'comfortable')}
          options={[
            { value: 'comfortable', label: 'Comfortable', detail: 'Room to breathe' },
            { value: 'compact', label: 'Compact', detail: 'More on screen' },
          ]}
        />
      </Section>
    </>
  );
}

function RegionSection(props: AccountAreaProps) {
  const { prefs, onPreference, orgTimeZone } = props;
  const browser = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const following = orgTimeZone ? `your organisation’s (${orgTimeZone.replace(/_/g, ' ')})` : `this browser’s (${browser})`;
  const zones = useMemo(() => timeZones(), []);
  return (
    <>
      <PageHead eyebrow="Account" heading="Language and region" summary="Your language, and how times and dates are written" />
      <Language {...props} />
      <DatesAndTimes {...props} />
      <Section label="Time zone" count={-1}>
        <Select
          label="Your time zone"
          hint={prefs.timeZone ? undefined : `Times follow ${following} until you choose one.`}
          options={[{ value: '', label: following.charAt(0).toUpperCase() + following.slice(1) }, ...zones.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))]}
          value={prefs.timeZone ?? ''}
          onChange={(v) => onPreference('timeZone', v || undefined)}
        />
      </Section>
    </>
  );
}

/** Their language, kept on their profile so sign-in pages and emails use it too (ADR 0039). */
function Language({ api, onLanguage }: AccountAreaProps) {
  const profile = useLoad(() => api.profile());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const p = profile.value;
  if (!p) {
    return (
      <Section label="Language" count={-1}>
        <Loading what="language" error={profile.error} onRetry={profile.again} />
      </Section>
    );
  }
  const offered = p.languages?.length ? p.languages : ['en'];
  const managed = p.managed.includes('locale');
  const choose = async (v: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await api.updateProfile({ locale: v });
      profile.set(next);
      onLanguage?.(next.locale);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section label="Language" count={-1} why="Sign-in pages and emails use your language, and dates are written its way unless you choose a format below. AUGUR’s own screens are in English for now.">
      {offered.length > 1 || (p.locale && !offered.includes(p.locale)) ? (
        <Select
          label="Your language"
          options={[
            { value: '', label: `Your organisation’s (${languageName(offered[0]!)})` },
            ...offered.map((l) => ({ value: l, label: languageName(l) })),
            ...(p.locale && !offered.includes(p.locale) ? [{ value: p.locale, label: languageName(p.locale), detail: 'No longer offered', disabled: true }] : []),
          ]}
          value={p.locale ?? ''}
          disabled={managed}
          reason={managed ? `${p.managedBy ?? 'Your organisation’s sign-in'} sets this.` : undefined}
          busy={busy}
          onChange={(v) => void choose(v)}
        />
      ) : (
        <>
          <Rows items={[{ label: 'Language', value: languageName(offered[0]!) }]} />
          <Note>Your organisation offers only {languageName(offered[0]!)}. A deployment admin can offer more.</Note>
        </>
      )}
      {error ? <Note live>{error}</Note> : null}
    </Section>
  );
}

/** How dates and times are written: a region's way, and a 12- or 24-hour clock. */
function DatesAndTimes({ prefs, onPreference }: AccountAreaProps) {
  const now = useMemo(() => Date.now(), []);
  const example = (formats: Formats) => writeDate(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }, formats);
  const short = (formats: Formats) => writeDate(now, { dateStyle: 'short' }, formats);
  const yours = currentFormats();
  const regions = [...new Set([...(prefs.dateFormat && !DATE_REGIONS.includes(prefs.dateFormat) ? [prefs.dateFormat] : []), ...DATE_REGIONS])];
  return (
    <Section label="Dates and times" count={-1}>
      <Select
        label="Write dates as in"
        hint={`Now reads: ${example(yours)}`}
        options={[
          { value: '', label: 'Your language’s way' },
          ...regions.map((r) => ({ value: r, label: regionName(r), detail: short({ locale: r }) })),
        ]}
        value={prefs.dateFormat ?? ''}
        onChange={(v) => onPreference('dateFormat', v || undefined)}
      />
      <Choice
        label="Clock"
        value={prefs.clock ?? ''}
        onChange={(v) => onPreference('clock', v === '12' || v === '24' ? v : undefined)}
        options={[
          { value: '', label: 'As dates are written', detail: writeDate(now, { hour: 'numeric', minute: '2-digit' }, { ...yours, hourCycle: undefined }) },
          { value: '12', label: '12-hour', detail: writeDate(now, { hour: 'numeric', minute: '2-digit' }, { ...yours, hourCycle: 'h12' }) },
          { value: '24', label: '24-hour', detail: writeDate(now, { hour: 'numeric', minute: '2-digit' }, { ...yours, hourCycle: 'h23' }) },
        ]}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------------
// Privacy and data

/** Who sees what about them: the people picker shows name and email; the rest follows the profile's permissions. */
const SEEN_BY: { what: string; who: string }[] = [
  { what: 'Your name and email', who: 'Everyone signed in, when they pick people to share with or tell' },
  { what: 'Your job title, phone, pronouns and picture', who: 'You and administrators' },
  { what: 'Your sign-ins, sessions and whole profile', who: 'You, and administrators looking after accounts' },
  { what: 'Whether you’re away, and what it says', who: 'Everyone signed in, beside your name' },
  { what: 'Your other choices, such as quiet hours and pinned apps', who: 'Only you' },
];

function PrivacySection({ api, product }: AccountAreaProps) {
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState<{ tone: 'done' | 'error'; text: string } | null>(null);
  const download = async () => {
    setSaving(true);
    setSaid(null);
    try {
      const { blob, name } = await api.myData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setSaid({ tone: 'done', text: `Saved ${name}.` });
    } catch (err) {
      setSaid({ tone: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <PageHead eyebrow="Account" heading="Privacy and data" summary={`What ${product} keeps about you, who sees it, and leaving`} />
      <Section label="Your data" count={-1} why="One file with your profile, how you sign in, your sessions and sign-ins, your choices, your notifications, your inbox and what you’ve done. Apps keep their own content, such as documents, and this copy doesn’t include it yet.">
        <div className="account-line">
          {said ? <Note live>{said.text}</Note> : <span />}
          <Button kind="secondary" size="sm" busy={saving} onPress={() => void download()}>
            Download my data
          </Button>
        </div>
      </Section>
      <Section label="What others see about you" count={-1}>
        <Rows items={SEEN_BY.map((r) => ({ label: r.what, value: r.who }))} />
      </Section>
      <Leave api={api} />
    </>
  );
}

/** Asking to leave: an administrator closes the account, so nobody deletes their own by mistake (ADR 0040). */
function Leave({ api }: Pick<AccountAreaProps, 'api'>) {
  const req = useLoad(() => api.leaveRequest());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (go: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await go();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const asked = req.value;
  return (
    <Section label="Leaving" count={-1} why="You can’t close your own account. Ask here and an administrator turns it off, ends your sessions and hands on what you own. You can take it back until they do.">
      {req.value === undefined ? (
        <Loading what="request to leave" error={req.error} onRetry={req.again} />
      ) : asked ? (
        <>
          <Notice tone="info" heading={`You asked to leave ${dayAndTime(asked.requestedAt)}.`}>
            {asked.note ? `You said: “${asked.note}”` : 'Administrators have been told.'}
          </Notice>
          <div className="account-line">
            {error ? <Note live>{error}</Note> : <span />}
            <Button kind="tertiary" size="sm" busy={busy} onPress={() => void act(async () => { await api.withdrawLeave(); req.set(null); })}>
              Take it back
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="account-fields">
            <TextField label="Anything they should know" optional maxLength={500} placeholder="My last day is Friday" defaultValue={note} onCommit={(v) => setNote(v)} />
          </div>
          <div className="account-line">
            {error ? <Note live>{error}</Note> : <span />}
            <AskTwice size="sm" confirm="Press again to ask to leave" busy={busy} onPress={() => void act(async () => req.set(await api.requestLeave(note.trim() || undefined)))}>
              Ask to leave
            </AskTwice>
          </div>
        </>
      )}
    </Section>
  );
}

function AboutSection({ version, product }: AccountAreaProps) {
  const news = whatsNewFor(product);
  const keys: [string, string][] = [
    ['`', 'Open or close the shell (also Ctrl or ⌘ K)'],
    ['← →', 'Move along the arc'],
    ['Enter', 'Open'],
    ['x', 'Dismiss a notification'],
    ['Esc', 'Back, then close'],
    ['Alt PgUp PgDn', 'Up or down a floor'],
  ];
  return (
    <>
      <PageHead eyebrow="Account" heading="About and help" summary="What’s running, what’s new, and the keys" />
      <Section label="What’s running" count={-1}>
        <Rows items={version ? [{ label: 'Version', value: version }] : []} empty="This build doesn’t say its version." />
      </Section>
      <Section label={`What’s new in ${news.name}`} count={-1}>
        <p className="account-news-summary">{news.summary}</p>
        <dl className="account-news">
          {news.items.map((i) => (
            <div key={i.title}>
              <dt>{i.title}</dt>
              <dd>{i.text}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section label="Keys" count={-1}>
        <dl className="account-keys">
          {keys.map(([k, what]) => (
            <Key key={k} k={k}>
              {what}
            </Key>
          ))}
        </dl>
      </Section>
    </>
  );
}

function Key({ k, children }: { k: string; children: ReactNode }) {
  return (
    <>
      <dt>
        <kbd>{k}</kbd>
      </dt>
      <dd>{children}</dd>
    </>
  );
}
