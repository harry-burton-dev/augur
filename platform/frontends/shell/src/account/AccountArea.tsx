import {
  AskTwice,
  Button,
  CheckList,
  CheckRow,
  Choice,
  FitParts,
  Notice,
  Note,
  PagedList,
  SectionDialog,
  Select,
  State,
  StepList,
  TextField,
  Toggle,
  tokens,
  type DialogSection,
  type FitPart,
  type IconName,
  type StepItem,
} from '@augur/app-kit';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Preferences } from '../host/preferences.js';
import { type AccountApi, type AccountSession, type HeldCredential, type Profile, type ProfileChanges, type Security, type SignIn } from './api.js';
import { currentFormats, writeDate, type Formats } from '../host/formats.js';
import { whatsNewFor } from './whats-new.js';
import { actionWords, ago, clientWords, DATE_REGIONS, dayAndTime, languageName, regionName, signInWords, timeZones } from './words.js';

/**
 * The Account dialog's sections (ADR 0036), as its tabs, in order: Overview first, then the eight
 * places a person manages themselves.
 */
export const ACCOUNT_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
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

/** A page inside a section, reached from a part: its name follows the section's in the dialog's heading. */
type Sub = { id: 'wrong'; label: string } | { id: 'signins'; label: string } | { id: 'app'; label: string; app: { id: string; name: string } };

export interface AccountAreaProps {
  section: AccountSection;
  onSection: (section: AccountSection) => void;
  /** Esc, or Back to the menu: the dialog closes and the menu it was opened from is still there. */
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

/** What identity knows about them, loaded once when the dialog opens and shared by its sections. */
interface Known {
  profile: Loaded<Profile>;
  security: Loaded<Security>;
  sessions: Loaded<{ list: AccountSession[]; here: string | undefined }>;
  signIns: Loaded<SignIn[]>;
}
type SectionProps = AccountAreaProps & { known: Known; open: (sub: Sub) => void; rows: RowCounts };

/** How many rows a part's list shows at once: fewer in a short window, so nothing scrolls. */
interface RowCounts {
  list: number;
  short: boolean;
}

/** A window too short for the whole dialog: the dialog's own height plus the screen's edge on both sides. */
const tallEnough = () => typeof window === 'undefined' || window.innerHeight >= Number.parseFloat(tokens['dialog-section-height']) + 2 * Number.parseFloat(tokens.edge);

function useRows(): RowCounts {
  const [tall, setTall] = useState(tallEnough);
  useEffect(() => {
    const on = () => setTall(tallEnough());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return { list: tall ? 5 : 3, short: !tall };
}

/**
 * The one place a person manages themselves (ADR 0036), as a dialog opened from the shell's menu:
 * who they are, how they sign in and where, how they hear about things, how AUGUR looks for them,
 * their time zone, and what's running. Its sections are tabs down the side; each one's parts sit side
 * by side while they fit and wait behind a switch when they don't, and long lists page, so it never
 * scrolls. It closes back to the menu.
 */
export function AccountArea(props: AccountAreaProps) {
  const { section, onSection, onClose, api } = props;
  const rows = useRows();
  const profile = useLoad(() => api.profile());
  const security = useLoad(() => api.security());
  const loadSessions = useCallback(async () => ({ list: await api.sessions(), here: await api.currentSession() }), [api]);
  const sessions = useLoad(loadSessions);
  const signIns = useLoad(() => api.signIns(20));
  const known: Known = { profile, security, sessions, signIns };
  const [sub, setSub] = useState<Sub | null>(null);
  const select = (id: string) => {
    setSub(null);
    if (isAccountSection(id)) onSection(id);
  };
  const needsTwoStep = !!security.value && security.value.twoStep.required && !security.value.twoStep.set;
  const sections: DialogSection[] = ACCOUNT_SECTIONS.map((s) => ({ ...s, needs: needsTwoStep && (s.id === 'overview' || s.id === 'security') }));
  const here = ACCOUNT_SECTIONS.find((s) => s.id === section)!;
  const inner: SectionProps = { ...props, known, open: setSub, rows };
  const body = sub ? <SubPage {...inner} sub={sub} back={() => setSub(null)} /> : <SectionBody {...inner} />;
  return (
    <SectionDialog
      open
      onClose={onClose}
      heading="Account"
      where={sub ? `${here.label} › ${sub.label}` : here.label}
      closeLabel="Back to the menu"
      sectionsLabel="Account sections"
      sections={sections}
      selected={section}
      onSelect={select}
      ruleAfter={['overview']}
    >
      <div className="account-panel" data-section={section}>
        {section === 'security' && props.actionStatus ? <ActionStatus status={props.actionStatus} /> : null}
        {body}
      </div>
    </SectionDialog>
  );
}

function SectionBody(props: SectionProps) {
  const label = `Parts of ${ACCOUNT_SECTIONS.find((s) => s.id === props.section)!.label}`;
  const parts = partsOf(props);
  return <FitParts key={props.section} label={label} parts={parts} />;
}

function partsOf(props: SectionProps): FitPart[] {
  switch (props.section) {
    case 'overview':
      return [
        { id: 'you', label: 'You', content: <You {...props} /> },
        { id: 'check', label: 'Account check', content: <AccountCheck {...props} /> },
      ];
    case 'profile':
      return [
        { id: 'about', label: 'About you', content: <AboutYou {...props} /> },
        { id: 'seen', label: 'Email and sign-out', content: <EmailAndSignOut {...props} /> },
      ];
    case 'security':
      return [
        { id: 'how', label: 'How you sign in', content: <HowYouSignIn {...props} /> },
        { id: 'two', label: 'Two-step sign-in', content: <TwoStep {...props} /> },
        { id: 'where', label: 'Where you’re signed in', content: <Sessions {...props} /> },
        { id: 'recent', label: 'Recent sign-ins', content: <RecentSignIns {...props} /> },
      ];
    case 'notifications':
      return [
        { id: 'email', label: 'Email', content: <NotificationEmail {...props} /> },
        { id: 'quiet', label: 'Quiet hours', content: <QuietHours {...props} /> },
        { id: 'apps', label: 'Each app', content: <EachApp {...props} /> },
      ];
    case 'appearance':
      return [
        { id: 'motion', label: 'Motion', content: <Motion {...props} /> },
        { id: 'layout', label: 'Density', content: <Density {...props} /> },
      ];
    case 'region':
      return [
        { id: 'language', label: 'Language', content: <Language {...props} /> },
        { id: 'dates', label: 'Dates and times', content: <DatesAndTimes {...props} /> },
      ];
    case 'apps':
      return [
        { id: 'start', label: 'Start on', content: <StartOn {...props} /> },
        { id: 'pinned', label: 'Pinned apps', content: <Pinned {...props} /> },
        { id: 'own', label: 'Each app’s own settings', content: <OwnSettings {...props} /> },
      ];
    case 'privacy':
      return [
        { id: 'data', label: 'Your data', content: <YourData {...props} /> },
        { id: 'seen', label: 'What others see about you', content: <SeenBy /> },
        { id: 'leave', label: 'Leaving', content: <Leave {...props} /> },
      ];
    case 'about':
      return [
        { id: 'running', label: 'What’s running', content: <Running {...props} /> },
        { id: 'keys', label: 'Keys', content: <Keys /> },
      ];
  }
}

function SubPage(props: SectionProps & { sub: Sub; back: () => void }) {
  const { sub, back } = props;
  const parts: FitPart[] =
    sub.id === 'wrong'
      ? [{ id: 'steps', label: 'Secure your account', content: <SecureSteps {...props} /> }]
      : sub.id === 'signins'
        ? [{ id: 'all', label: 'All sign-ins', content: <AllSignIns {...props} /> }]
        : [{ id: 'own', label: `From ${sub.app.name}`, content: <AppSettings app={sub.app} mount={props.mountSettings} unmount={props.unmountSettings} /> }];
  return (
    <div className="account-sub-page">
      <div className="account-back">
        <Button kind="tertiary" size="sm" onPress={back}>
          Back to {ACCOUNT_SECTIONS.find((s) => s.id === props.section)!.label}
        </Button>
      </div>
      <FitParts key={sub.id} label={sub.label} parts={parts} />
    </div>
  );
}

/** Loads something once, with its error as a sentence and a way to load it again. */
interface Loaded<T> {
  value?: T;
  error?: string;
  loading: boolean;
  set: (value: T) => void;
  again: () => void;
}
function useLoad<T>(load: () => Promise<T>): Loaded<T> {
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
  const set = useCallback((value: T) => setState({ value, loading: false }), []);
  const again = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, set, again };
}

function Loading({ what, error, onRetry }: { what: string; error?: string; onRetry: () => void }) {
  if (error) return <State kind="error" size="line" heading={`Your ${what} didn’t load`} body={error} action="Try again" onAction={onRetry} />;
  return <State kind="loading" size="line" heading={`Loading your ${what}…`} />;
}

/** One line: what it is, what's known, and one way to act. */
function Line({ title, detail, children, kind }: { title?: ReactNode; detail?: ReactNode; children?: ReactNode; kind?: string }) {
  return (
    <div className="account-line" data-kind={kind}>
      <span>
        {title ? <b>{title}</b> : null}
        {detail ? <small>{detail}</small> : null}
      </span>
      {children}
    </div>
  );
}

const nameOf = (p: Profile) => [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username;
const managedBy = (p?: Profile) => p?.managedBy ?? 'Your organisation’s sign-in';

// ---------------------------------------------------------------------------------------------------
// Overview

function You({ known, prefs, onPreference, onSignOut, product }: SectionProps) {
  const p = known.profile.value;
  return (
    <>
      {p ? (
        <Line title={`${nameOf(p)}${p.pronouns ? ` (${p.pronouns})` : ''}`} detail={[p.jobTitle, p.email].filter(Boolean).join(' · ') || undefined} />
      ) : (
        <Loading what="profile" error={known.profile.error} onRetry={known.profile.again} />
      )}
      <Away prefs={prefs} onPreference={onPreference} />
      <Line detail={`Sign out of ${product} on this device.`}>
        <Button kind="secondary" size="sm" onPress={onSignOut}>
          Sign out
        </Button>
      </Line>
    </>
  );
}

/** What about their account needs a look: two-step sign-in, recovery codes, email, where they're signed in, failed tries. */
function AccountCheck({ known, onSection, open }: SectionProps) {
  const s = known.security.value;
  if (!s) return <Loading what="sign-in details" error={known.security.error} onRetry={known.security.again} />;
  const p = known.profile.value;
  const places = known.sessions.value?.list.length;
  const week = Date.now() - 7 * 86_400_000;
  const failed = (known.signIns.value ?? []).filter((e) => e.kind === 'failed' && Date.parse(e.time) >= week);
  const held = s.codeApps.length + s.passkeys.length;
  const see = (section: AccountSection) => ({ label: 'See', onPress: () => onSection(section) });
  return (
    <>
      <CheckList label="Account check">
        {s.twoStep.required && !s.twoStep.set ? (
          <CheckRow title="Two-step sign-in" tone="needs" detail={s.twoStep.reason ?? 'Your role needs it, and it isn’t set up.'} action={{ label: 'Set up', onPress: () => onSection('security') }} />
        ) : (
          <CheckRow
            title="Two-step sign-in"
            tone={held ? 'ok' : 'info'}
            detail={held ? `${held === 1 ? 'One way' : `${held} ways`} set up: ${[s.codeApps.length ? 'code app' : '', s.passkeys.length ? 'passkey' : ''].filter(Boolean).join(' and ')}` : 'Not set up. A second step means a stolen password alone can’t get in.'}
            action={see('security')}
          />
        )}
        <CheckRow title="Recovery codes" tone={s.recoveryCodes ? 'ok' : 'info'} detail={s.recoveryCodes ? `Made${s.recoveryCodes.createdAt ? ` ${dayAndTime(s.recoveryCodes.createdAt)}` : ''}` : 'None yet. They get you in if you lose your phone.'} action={see('security')} />
        <CheckRow
          title="Email"
          tone={p?.email && p.emailVerified ? 'ok' : 'info'}
          detail={!p ? 'Not loaded yet' : !p.email ? 'No email address yet' : p.emailVerified ? `${p.email}, checked` : `${p.email}, not checked yet`}
          action={see('profile')}
        />
        <CheckRow title="Where you’re signed in" tone="info" detail={places === undefined ? 'Not loaded yet' : places <= 1 ? 'Only this browser' : `This browser and ${places - 1} other ${places === 2 ? 'place' : 'places'}`} action={see('security')} />
        <CheckRow
          title="Failed sign-ins"
          tone={failed.length ? 'problem' : 'ok'}
          detail={
            failed.length
              ? `${failed.length} in the last 7 days, the last ${dayAndTime(failed[0]!.time)}${failed[0]!.ipAddress ? ` from ${failed[0]!.ipAddress}` : ''}`
              : `None in the last 7 days${known.signIns.value ? '' : ' that could be checked'}`
          }
          action={{ label: 'See', onPress: () => open({ id: 'signins', label: 'All sign-ins' }) }}
        />
      </CheckList>
      <Line title="Something’s wrong?" detail="A lost phone, or a sign-in you don’t recognise.">
        <Button kind="secondary" size="sm" onPress={() => open({ id: 'wrong', label: 'Secure your account' })}>
          Secure your account
        </Button>
      </Line>
    </>
  );
}

/** "Something's wrong?": the steps that secure an account, in order, each with its one action. */
function SecureSteps({ known, onAction, onSection, open, api }: SectionProps) {
  const [ended, setEnded] = useState<string | null>(null);
  const s = known.security.value;
  if (!s) return <Loading what="sign-in details" error={known.security.error} onRetry={known.security.again} />;
  const v = known.sessions.value;
  const others = v ? v.list.filter((x) => x.id !== v.here) : [];
  const failed = (known.signIns.value ?? []).filter((e) => e.kind === 'failed');
  const pw = s.actions.find((a) => a.id === 'password');
  const held = s.codeApps.length + s.passkeys.length;
  const steps: StepItem[] = [
    {
      id: 'password',
      title: 'Change your password',
      detail: s.password.managedBy ? `You sign in through ${s.password.managedBy}. Change it there, then come back.` : 'Opens the sign-in page, and comes back here.',
      ...(pw && pw.available ? { action: { label: 'Change password', onPress: () => onAction(pw.action, 'security') } } : { unavailable: pw?.reason ?? (s.password.managedBy ? `${s.password.managedBy} manages your password.` : 'Changing your password isn’t offered here.') }),
    },
    {
      id: 'others',
      title: 'Sign out everywhere else',
      detail: ended ?? (others.length ? `You’re signed in in ${others.length} other ${others.length === 1 ? 'place' : 'places'}.` : 'You’re not signed in anywhere else.'),
      done: !!v && !others.length,
      ...(others.length
        ? {
            action: {
              label: 'Sign out everywhere else',
              onPress: () =>
                void api.endSessions(v?.here).then(
                  (n) => {
                    setEnded(`Signed out of ${n} other ${n === 1 ? 'place' : 'places'}.`);
                    known.sessions.again();
                  },
                  (err: Error) => setEnded(err.message),
                ),
            },
          }
        : {}),
    },
    {
      id: 'methods',
      title: 'Check how you sign in',
      detail: held ? `${held === 1 ? 'One way' : `${held} ways`} of two-step sign-in. Remove any you don’t know.` : 'No code app or passkey yet: add one, so a password alone can’t get in.',
      action: { label: held ? 'See them' : 'Add one', onPress: () => onSection('security') },
    },
    {
      id: 'signins',
      title: 'Read your recent sign-ins',
      detail: failed.length ? `${failed.length} failed ${failed.length === 1 ? 'try' : 'tries'}, the last ${dayAndTime(failed[0]!.time)}${failed[0]!.ipAddress ? ` from ${failed[0]!.ipAddress}` : ''}.` : 'No failed tries among the recent ones.',
      action: { label: 'All sign-ins', onPress: () => open({ id: 'signins', label: 'All sign-ins' }) },
    },
    {
      id: 'tell',
      title: 'Tell an administrator',
      detail: 'Ask them directly: they can see your sign-ins too.',
      unavailable: 'There’s no way to tell them from here yet.',
    },
  ];
  return <StepList label="Secure your account" steps={steps} />;
}

// ---------------------------------------------------------------------------------------------------
// Profile

const FIELDS: { key: keyof ProfileChanges; label: string; hint?: string; max: number; type?: 'tel'; wide?: boolean }[] = [
  { key: 'firstName', label: 'First name', max: 120 },
  { key: 'lastName', label: 'Last name', max: 120 },
  { key: 'jobTitle', label: 'Job title', max: 120, wide: true },
  { key: 'phone', label: 'Phone', hint: 'Digits, spaces, brackets, + and -', max: 40, type: 'tel' },
  { key: 'pronouns', label: 'Pronouns', hint: 'Shown beside your name', max: 40 },
];

function AboutYou({ api, known }: SectionProps) {
  const profile = known.profile;
  const [saving, setSaving] = useState<keyof ProfileChanges | null>(null);
  const [problem, setProblem] = useState<{ key: keyof ProfileChanges; message: string } | null>(null);
  const p = profile.value;
  if (!p) return <Loading what="profile" error={profile.error} onRetry={profile.again} />;
  const save = async (key: keyof ProfileChanges, value: string) => {
    if ((p[key] ?? '') === value) return;
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
  return (
    <>
      {p.managed.length ? <Note>{managedBy(p)} sets your name and email, and copies them in each time you sign in, so they’re changed there.</Note> : null}
      <div className="account-fields">
        {FIELDS.map((f) => {
          const managed = p.managed.includes(f.key);
          return (
            <TextField
              key={`${f.key}:${p[f.key] ?? ''}`}
              className={f.wide ? 'account-wide' : undefined}
              label={f.label}
              hint={f.hint}
              type={f.type}
              maxLength={f.max}
              defaultValue={p[f.key] ?? ''}
              required={f.key === 'firstName'}
              optional={f.key !== 'firstName' && f.key !== 'lastName'}
              disabled={managed}
              reason={managed ? `${managedBy(p)} sets this.` : undefined}
              busy={saving === f.key}
              state={problem?.key === f.key ? 'error' : undefined}
              message={problem?.key === f.key ? problem.message : undefined}
              onCommit={(v) => void save(f.key, v.trim())}
            />
          );
        })}
      </div>
    </>
  );
}

function EmailAndSignOut({ known, onAction, onSignOut, product }: SectionProps) {
  const p = known.profile.value;
  if (!p) return <Loading what="profile" error={known.profile.error} onRetry={known.profile.again} />;
  const managed = p.managed.includes('email');
  return (
    <>
      <Line title={p.email ?? 'No email address yet'} detail={p.email ? (p.emailVerified ? 'Checked' : 'Not checked yet') : undefined}>
        <Button kind="secondary" size="sm" disabled={managed} reason={managed ? `${managedBy(p)} sets your email address.` : undefined} onPress={() => onAction('UPDATE_EMAIL', 'profile')}>
          {p.email ? 'Change email' : 'Add email'}
        </Button>
      </Line>
      <Note>The sign-in page asks for the new address and sends it a link to check before it’s used.</Note>
      <Line detail={`Sign out of ${product} on this device.`}>
        <Button kind="secondary" size="sm" onPress={onSignOut}>
          Sign out
        </Button>
      </Line>
    </>
  );
}

/** "Show me as away", with what it says and when it ends by itself. */
function Away({ prefs, onPreference }: Pick<AccountAreaProps, 'prefs' | 'onPreference'>) {
  const until = prefs.awayUntil ? prefs.awayUntil.slice(0, 16) : '';
  return (
    <>
      <Toggle label="Show me as away" hint="Others see you’re away beside your name." checked={!!prefs.away} onChange={(on) => onPreference('away', on)} />
      {prefs.away ? (
        <div className="account-fields">
          <TextField label="What it says" optional maxLength={140} placeholder="Back on Monday" defaultValue={prefs.awayMessage ?? ''} onCommit={(v) => onPreference('awayMessage', v.trim() || undefined)} />
          <label className="account-native">
            <span>Until</span>
            <input type="datetime-local" value={until} onChange={(e) => onPreference('awayUntil', e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : undefined)} />
            <small>Empty: away until you turn it off.</small>
          </label>
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
// Sign-in and security

function HowYouSignIn({ known, onAction, product }: SectionProps) {
  const s = known.security.value;
  if (!s) return <Loading what="sign-in details" error={known.security.error} onRetry={known.security.again} />;
  const action = (id: string) => s.actions.find((a) => a.id === id);
  return (
    <>
      <Line title="Password" detail={s.password.set ? `Set${s.password.createdAt ? ` ${dayAndTime(s.password.createdAt)}` : ''}` : s.password.managedBy ? `You sign in through ${s.password.managedBy}.` : 'No password yet'}>
        <ActionButton act={action('password')} label={s.password.set ? 'Change password' : 'Set a password'} onAction={onAction} />
      </Line>
      {s.linked.map((l) => (
        <Line key={l.provider} title={l.name} detail={l.username ? `Linked as ${l.username}` : 'Linked'} />
      ))}
      {s.canLink.map((p) => (
        <Line key={p.alias} detail={`Sign in with ${p.name} too`}>
          <Button kind="secondary" size="sm" onPress={() => onAction(p.action, 'security')}>
            Link {p.name}
          </Button>
        </Line>
      ))}
      {!s.linked.length && !s.canLink.length ? <Note>Your account isn’t linked to an organisation sign-in.</Note> : null}
      {s.emails ? <SecurityEmails emails={s.emails} product={product} /> : null}
    </>
  );
}

function SecurityEmails({ emails, product }: { emails: NonNullable<Security['emails']>; product: string }) {
  const what = 'when your password, code app or passkeys change';
  return (
    <Note why="Always on when email works, so a change you didn’t make can’t go unnoticed.">
      {!emails.on
        ? `${product} can’t send email on this deployment yet, so changes to how you sign in aren’t emailed. A deployment admin can connect the organisation’s mail.`
        : !emails.address
          ? `${product} emails you ${what}, once you add an email address in Profile.`
          : emails.verified
            ? `${product} emails you at ${emails.address} ${what}.`
            : `${product} emails you at ${emails.address} ${what}, once you confirm that address.`}
    </Note>
  );
}

function TwoStep({ known, onAction }: SectionProps) {
  const s = known.security.value;
  if (!s) return <Loading what="sign-in details" error={known.security.error} onRetry={known.security.again} />;
  const action = (id: string) => s.actions.find((a) => a.id === id);
  const held = [...s.codeApps, ...s.passkeys];
  return (
    <>
      {s.twoStep.required && !s.twoStep.set ? <Notice tone="needs" heading="Your role needs two-step sign-in.">{s.twoStep.reason}</Notice> : null}
      <Credentials items={held} onAction={onAction} />
      <Line detail={s.codeApps.length ? undefined : 'No code app yet.'}>
        <ActionButton act={action('code-app')} label={s.codeApps.length ? 'Add another code app' : 'Add a code app'} onAction={onAction} />
      </Line>
      <Line detail={s.passkeys.length ? undefined : 'No passkey yet.'}>
        <ActionButton act={action('passkey')} label="Add a passkey" onAction={onAction} />
      </Line>
      <Line title="Recovery codes" detail={s.recoveryCodes ? `Made${s.recoveryCodes.createdAt ? ` ${dayAndTime(s.recoveryCodes.createdAt)}` : ''}` : 'None yet. They get you in if you lose your phone.'}>
        <ActionButton act={action('recovery-codes')} label={s.recoveryCodes ? 'Make new codes' : 'Make recovery codes'} onAction={onAction} />
      </Line>
    </>
  );
}

function ActionStatus({ status }: { status: string }) {
  if (status === 'success') return <Note live>Done. The change is saved.</Note>;
  if (status === 'cancelled') return <Note live>Nothing changed. You came back without finishing.</Note>;
  return <Note live>That didn’t finish. The sign-in page couldn’t make the change. Try again, or ask an admin if it keeps happening.</Note>;
}

function ActionButton({ act, label, onAction }: { act?: Security['actions'][number]; label: string; onAction: AccountAreaProps['onAction'] }) {
  if (!act) return null;
  return (
    <Button kind="secondary" size="sm" disabled={!act.available} reason={act.reason} onPress={() => onAction(act.action, 'security')}>
      {label}
    </Button>
  );
}

function Credentials({ items, onAction }: { items: HeldCredential[]; onAction: AccountAreaProps['onAction'] }) {
  return (
    <>
      {items.map((c) => (
        <Line key={c.id} title={c.label || actionWords(c.type)} detail={`${actionWords(c.type)}${c.createdAt ? ` · added ${dayAndTime(c.createdAt)}` : ''}`}>
          <AskTwice size="sm" confirm="Press again to remove" disabled={!c.removable} reason={c.reason} onPress={() => onAction(c.removeAction, 'security')}>
            Remove
          </AskTwice>
        </Line>
      ))}
    </>
  );
}

function Sessions({ api, known, shellClient, product, rows }: SectionProps) {
  const sessions = known.sessions;
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
  if (!v) return <Loading what="sessions" error={sessions.error} onRetry={sessions.again} />;
  const others = v.list.filter((s) => s.id !== v.here);
  const here = v.list.filter((s) => s.id === v.here);
  return (
    <>
      <PagedList
        label="Where you’re signed in"
        items={[...here, ...others]}
        pageSize={rows.short ? 2 : 3}
        keyOf={(s) => s.id}
        render={(s: AccountSession) => (
          <Line title={s.id === v.here ? 'This browser' : s.ipAddress ? `From ${s.ipAddress}` : 'Somewhere else'} detail={`${clientWords(s.clients, shellClient, product)} · signed in ${dayAndTime(s.startedAt)} · last used ${ago(s.lastSeenAt)}`}>
            {s.id === v.here ? null : (
              <Button kind="tertiary" size="sm" busy={busy === s.id} onPress={() => void end(s.id)}>
                Sign out there
              </Button>
            )}
          </Line>
        )}
      />
      <Line detail={said ? <span role="status">{said}</span> : undefined}>
        <AskTwice size="sm" confirm="Press again to sign out everywhere else" disabled={!others.length} reason="You’re not signed in anywhere else." busy={busy === 'others'} onPress={() => void end('others')}>
          Sign out everywhere else
        </AskTwice>
      </Line>
    </>
  );
}

const signInLine = (e: SignIn, shellClient: string, product: string) => (
  <Line kind={e.kind} title={signInWords(e)} detail={`${dayAndTime(e.time)}${e.ipAddress ? ` · from ${e.ipAddress}` : ''}${e.client ? ` · ${clientWords([e.client], shellClient, product)}` : ''}`} />
);
const signInKey = (e: SignIn) => `${e.time}:${e.event}`;

function RecentSignIns({ known, open, shellClient, product, rows }: SectionProps) {
  const list = known.signIns;
  const items = list.value;
  if (!items) return <Loading what="recent sign-ins" error={list.error} onRetry={list.again} />;
  const shown = rows.short ? 2 : 4;
  return (
    <>
      {items.length ? items.slice(0, shown).map((e) => <div key={signInKey(e)}>{signInLine(e, shellClient, product)}</div>) : <Note>Nothing yet. Sign-ins show here from now on.</Note>}
      <Line detail={items.length > shown ? `${shown} of ${items.length}` : undefined}>
        <Button kind="tertiary" size="sm" disabled={!items.length} reason="There are no sign-ins yet." onPress={() => open({ id: 'signins', label: 'All sign-ins' })}>
          All sign-ins
        </Button>
      </Line>
    </>
  );
}

function AllSignIns({ known, shellClient, product, rows }: SectionProps) {
  const list = known.signIns;
  if (!list.value) return <Loading what="recent sign-ins" error={list.error} onRetry={list.again} />;
  return (
    <>
      <PagedList label="All sign-ins" items={list.value} pageSize={rows.list} keyOf={signInKey} render={(e) => signInLine(e, shellClient, product)} empty={<Note>Nothing yet. Sign-ins show here from now on.</Note>} />
      <Note>Each sign-in, each failed try and each change to how you sign in, for as long as the sign-in service keeps them. One you don’t recognise? Use Something’s wrong, in Overview.</Note>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
// Notifications

/**
 * Whether email reaches this person, and if not, why and who can change it. Email works when the deployment has a mail
 * relay (the realm's, the one security emails use) and their address is checked.
 */
function EmailReach({ known, product, onSection }: SectionProps) {
  const security = known.security;
  if (security.loading && !security.value) return null;
  const emails = security.value?.emails;
  if (!emails) return <Note>Whether {product} can email you couldn’t be checked{security.error ? ` (${security.error})` : ''}. Your choices are kept either way.</Note>;
  if (!emails.on) return <Note why="No mail relay is set up. Your choices are kept, and apply as soon as a deployment admin connects the organisation’s mail.">{product} can’t send email on this deployment yet.</Note>;
  if (!emails.address)
    return (
      <Line detail={`Add an email address to get email. ${product} emails you here once you add one in Profile.`}>
        <Button kind="tertiary" size="sm" onPress={() => onSection('profile')}>
          Open Profile
        </Button>
      </Line>
    );
  if (!emails.verified)
    return (
      <Line detail={`${emails.address} isn’t checked yet, so nothing is emailed to it.`}>
        <Button kind="tertiary" size="sm" onPress={() => onSection('profile')}>
          Open Profile
        </Button>
      </Line>
    );
  return <Note>{product} emails you at {emails.address}.</Note>;
}

function NotificationEmail(props: SectionProps) {
  const { prefs, onPreference } = props;
  const n = prefs.notifications ?? {};
  const set = (next: NonNullable<Preferences['notifications']>) => onPreference('notifications', { ...n, ...next });
  return (
    <>
      <EmailReach {...props} />
      <Toggle label="Email me about things that need me" hint="One email for each notification that asks something of you." checked={n.email !== false} onChange={(on) => set({ email: on })} />
      <Select
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
    </>
  );
}

function QuietHours({ prefs, onPreference }: SectionProps) {
  const n = prefs.notifications ?? {};
  const set = (next: NonNullable<Preferences['notifications']>) => onPreference('notifications', { ...n, ...next });
  const quiet = n.quietHours;
  return (
    <>
      <Toggle label="Keep quiet hours" hint="No toasts and no email between these times. Notifications still wait for you in the shell." checked={!!quiet} onChange={(on) => set({ quietHours: on ? { from: '22:00', to: '07:00' } : undefined })} />
      {quiet ? (
        <div className="account-fields">
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
    </>
  );
}

function EachApp({ prefs, onPreference, apps, rows }: SectionProps) {
  const muted = new Set(prefs.muted ?? []);
  const quietKinds = prefs.quietKinds ?? [];
  return (
    <>
      <Note why="Quiet: notifications land in the shell without a sound, uncounted, and never on Home or as a toast.">Choose for each app, and each kind of notification it names.</Note>
      <PagedList
        label="Each app"
        items={apps}
        pageSize={rows.short ? 2 : 3}
        keyOf={(a) => a.id}
        empty={<Note>No apps on this floor send notifications.</Note>}
        render={(a) => (
          <div className="account-app">
            <Toggle label={a.name} onWord="On Home" offWord="Quiet" checked={!muted.has(a.id)} onChange={(on) => onPreference('muted', on ? [...muted].filter((id) => id !== a.id) : [...muted, a.id])} />
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
        )}
      />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
// Home and apps

function StartOn({ prefs, onPreference, apps, floors, ownFloor, product }: SectionProps) {
  const start = prefs.startFloor && floors.some((f) => f.id === prefs.startFloor) ? prefs.startFloor : ownFloor;
  const lost = !!prefs.startFloor && start !== prefs.startFloor;
  const recent = prefs.recent ?? [];
  const nameOf = (id: string) => apps.find((a) => a.id === id)?.name ?? 'an app that isn’t on this floor';
  return (
    <>
      {lost ? <Note>The floor you chose isn’t one of yours any more. {product} opens on your own floor until you choose another. An admin can add you back to it.</Note> : null}
      <Select
        label="Floor"
        hint={`${product} opens here at its front door. A link to somewhere in particular still goes there.`}
        options={floors.map((f) => ({ value: f.id, label: f.id === ownFloor ? `${f.name} (your own)` : f.name }))}
        value={start}
        onChange={(v) => onPreference('startFloor', v === ownFloor ? undefined : v)}
      />
      <Line title="Recent apps" detail={recent.length ? `${recent.map(nameOf).join(', ')}: they come next on Home and in the list of apps.` : 'Nothing yet. The apps you open will show here.'}>
        <Button kind="secondary" size="sm" disabled={!recent.length} reason="There are no recent apps to clear." onPress={() => onPreference('recent', [])}>
          Clear recent apps
        </Button>
      </Line>
    </>
  );
}

function Pinned({ prefs, onPreference, apps, rows }: SectionProps) {
  const pinned = prefs.pinned ?? [];
  const pinnedHere = new Set(pinned);
  const elsewhere = pinned.filter((id) => !apps.some((a) => a.id === id)).length;
  return (
    <>
      <Note>Pinned apps come first on Home and in the list of apps, in the order you pinned them.</Note>
      <PagedList
        label="Pinned apps"
        items={apps}
        pageSize={rows.short ? 3 : 4}
        keyOf={(a) => a.id}
        empty={<Note>There are no apps on this floor to pin.</Note>}
        render={(a) => <Toggle label={a.name} onWord="Pinned" offWord="Not pinned" checked={pinnedHere.has(a.id)} onChange={(on) => onPreference('pinned', on ? [...pinned, a.id] : pinned.filter((id) => id !== a.id))} />}
      />
      {elsewhere ? <Note>{elsewhere === 1 ? 'One pinned app isn’t' : `${elsewhere} pinned apps aren’t`} on this floor. Pins stay for the floors that have them.</Note> : null}
    </>
  );
}

function OwnSettings({ appSettings, open, rows }: SectionProps) {
  return (
    <PagedList
      label="Each app’s own settings"
      items={appSettings}
      pageSize={rows.list}
      keyOf={(a) => a.id}
      empty={<Note>No app on this floor has settings of its own. An app adds them in its manifest, as a settings surface.</Note>}
      render={(a) => (
        <Line title={a.name} detail="Its own settings, drawn by the app">
          <Button kind="tertiary" size="sm" onPress={() => open({ id: 'app', label: a.name, app: a })}>
            Open
          </Button>
        </Line>
      )}
    />
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
    <>
      {shown === false ? <Note>{app.name}’s settings didn’t open. Try again later; if it keeps happening, the app’s developers can see why.</Note> : null}
      {shown === null ? <State kind="loading" size="line" heading={`Opening ${app.name}’s settings…`} /> : null}
      <div ref={el} className="account-app-settings" />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
// Appearance, region, about

function Motion({ prefs, onPreference }: SectionProps) {
  return (
    <>
      <Toggle label="Reduce motion" hint="Things fade in place of moving. Your device’s own setting is followed too." checked={!!prefs.reduceMotion} onChange={(on) => onPreference('reduceMotion', on)} />
      <Toggle label="Area titles" hint="A title card on arriving at a floor or opening an app." checked={prefs.areaTitles !== false} onChange={(on) => onPreference('areaTitles', on)} />
      <Toggle label="Toasts for new notifications" hint="Each one said once at the bottom of the screen." checked={!!prefs.toasts} onChange={(on) => onPreference('toasts', on)} />
    </>
  );
}

function Density({ prefs, onPreference }: SectionProps) {
  return (
    <Choice
      label="Spacing"
      value={prefs.density ?? 'comfortable'}
      onChange={(v) => onPreference('density', v === 'compact' ? 'compact' : 'comfortable')}
      options={[
        { value: 'comfortable', label: 'Comfortable', detail: 'Room to breathe' },
        { value: 'compact', label: 'Compact', detail: 'More on screen' },
      ]}
    />
  );
}

/** Their language, kept on their profile so sign-in pages and emails use it too (ADR 0039). */
function Language({ api, known, onLanguage, product }: SectionProps) {
  const profile = known.profile;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const p = profile.value;
  if (!p) return <Loading what="language" error={profile.error} onRetry={profile.again} />;
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
    <>
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
          reason={managed ? `${managedBy(p)} sets this.` : undefined}
          busy={busy}
          onChange={(v) => void choose(v)}
        />
      ) : (
        <>
          <Line title="Language" detail={languageName(offered[0]!)} />
          <Note>Your organisation offers only {languageName(offered[0]!)}. A deployment admin can offer more.</Note>
        </>
      )}
      <Note>Sign-in pages and emails use your language, and dates are written its way unless you choose a format. {product}’s own screens are in English for now.</Note>
      {error ? <Note live>{error}</Note> : null}
    </>
  );
}

/** How dates and times are written: a region's way, a 12- or 24-hour clock, and their time zone. */
function DatesAndTimes({ prefs, onPreference, orgTimeZone }: SectionProps) {
  const now = useMemo(() => Date.now(), []);
  const browser = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const zones = useMemo(() => timeZones(), []);
  const following = orgTimeZone ? `your organisation’s (${orgTimeZone.replace(/_/g, ' ')})` : `this browser’s (${browser})`;
  const example = (formats: Formats) => writeDate(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }, formats);
  const short = (formats: Formats) => writeDate(now, { dateStyle: 'short' }, formats);
  const time = (formats: Formats) => writeDate(now, { hour: 'numeric', minute: '2-digit' }, formats);
  const yours = currentFormats();
  const regions = [...new Set([...(prefs.dateFormat && !DATE_REGIONS.includes(prefs.dateFormat) ? [prefs.dateFormat] : []), ...DATE_REGIONS])];
  return (
    <>
      <Select
        label="Write dates as in"
        hint={`Now reads: ${example(yours)}`}
        options={[{ value: '', label: 'Your language’s way' }, ...regions.map((r) => ({ value: r, label: regionName(r), detail: short({ locale: r }) }))]}
        value={prefs.dateFormat ?? ''}
        onChange={(v) => onPreference('dateFormat', v || undefined)}
      />
      <Select
        label="Clock"
        value={prefs.clock ?? ''}
        onChange={(v) => onPreference('clock', v === '12' || v === '24' ? v : undefined)}
        options={[
          { value: '', label: `As dates are written (${time({ ...yours, hourCycle: undefined })})` },
          { value: '12', label: `12-hour (${time({ ...yours, hourCycle: 'h12' })})` },
          { value: '24', label: `24-hour (${time({ ...yours, hourCycle: 'h23' })})` },
        ]}
      />
      <Select
        label="Time zone"
        hint={prefs.timeZone ? undefined : `Times follow ${following} until you choose one.`}
        options={[{ value: '', label: following.charAt(0).toUpperCase() + following.slice(1) }, ...zones.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))]}
        value={prefs.timeZone ?? ''}
        onChange={(v) => onPreference('timeZone', v || undefined)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
// Privacy and data

/** Who sees what about them: the people picker shows name and email; the rest follows the profile's permissions. */
const SEEN_BY: { what: string; who: string }[] = [
  { what: 'Your name and email', who: 'Everyone signed in, when they pick people' },
  { what: 'Job title, phone, pronouns, picture', who: 'You and administrators' },
  { what: 'Sign-ins, sessions, your whole profile', who: 'You, and administrators looking after accounts' },
  { what: 'Whether you’re away, and what it says', who: 'Everyone signed in, beside your name' },
  { what: 'Your other choices', who: 'Only you' },
];

function YourData({ api, product }: SectionProps) {
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
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
      setSaid(`Saved ${name}.`);
    } catch (err) {
      setSaid((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Line detail={said ? <span role="status">{said}</span> : `One file with what ${product} keeps about you. Apps keep their own content, such as documents, and it isn’t in this copy yet.`}>
        <Button kind="secondary" size="sm" busy={saving} onPress={() => void download()}>
          Download my data
        </Button>
      </Line>
    </>
  );
}

function SeenBy() {
  return (
    <>
      {SEEN_BY.map((r) => (
        <Line key={r.what} title={r.what} detail={r.who} />
      ))}
    </>
  );
}

/** Asking to leave: an administrator closes the account, so nobody deletes their own by mistake (ADR 0040). */
function Leave({ api }: SectionProps) {
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
  if (asked === undefined) return <Loading what="request to leave" error={req.error} onRetry={req.again} />;
  if (asked)
    return (
      <>
        <Note>
          You asked to leave {dayAndTime(asked.requestedAt)}. {asked.note ? `You said: “${asked.note}”` : 'Administrators have been told.'}
        </Note>
        <Line detail={error ? <span role="status">{error}</span> : undefined}>
          <Button kind="tertiary" size="sm" busy={busy} onPress={() => void act(async () => { await api.withdrawLeave(); req.set(null); })}>
            Take it back
          </Button>
        </Line>
      </>
    );
  return (
    <>
      <Note>You can’t close your own account. Ask here and an administrator turns it off, ends your sessions and hands on what you own. You can take it back until they do.</Note>
      <TextField label="Anything they should know" optional maxLength={500} placeholder="My last day is Friday" defaultValue={note} onCommit={(v) => setNote(v)} />
      <Line detail={error ? <span role="status">{error}</span> : undefined}>
        <AskTwice size="sm" confirm="Press again to ask to leave" busy={busy} onPress={() => void act(async () => req.set(await api.requestLeave(note.trim() || undefined)))}>
          Ask to leave
        </AskTwice>
      </Line>
    </>
  );
}

function Running({ version, product, rows }: SectionProps) {
  const news = whatsNewFor(product);
  return (
    <>
      <Line title="Version" detail={version ?? 'This build doesn’t say its version.'} />
      <h4 className="account-sub">What’s new in {news.name}</h4>
      <p className="account-news-summary">{news.summary}</p>
      <PagedList
        label={`What’s new in ${news.name}`}
        items={news.items}
        pageSize={rows.short ? 2 : 3}
        keyOf={(i) => i.title}
        render={(i) => <Line title={i.title} detail={i.text} />}
      />
    </>
  );
}

const KEYS: [string, string][] = [
  ['`', 'Open or close the shell (also Ctrl or ⌘ K)'],
  ['← →', 'Move along the arc'],
  ['Enter', 'Open'],
  ['x', 'Dismiss a notification'],
  ['Esc', 'Back, then close'],
  ['Alt PgUp PgDn', 'Up or down a floor'],
];

function Keys() {
  return (
    <dl className="account-keys">
      {KEYS.map(([k, what]) => (
        <div key={k}>
          <dt>
            <kbd>{k}</kbd>
          </dt>
          <dd>{what}</dd>
        </div>
      ))}
    </dl>
  );
}
