import { createEventBus, floorFetch, SDK_VERSION, type AppManifestEntry, type InboxItem, type Intent, type IntentReply, type MountContext, type Workspace } from '@augur/mfe-sdk';
import {
  Button,
  defaultFunctions,
  Dialog,
  finishMotion,
  Heading,
  moving,
  Shell,
  ShellModel,
  Toasts,
  type FloorDirection,
  type ShellFindResult,
  type ShellNotification,
} from '@augur/shell-kit';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  StageMounter,
  incompatibility,
  workerCards,
  applyPreferences,
  areaOf,
  groupsFor,
  pageAt,
  toShellApp,
  titleFor,
  findPages,
  floorBySlug,
  floorFromPath,
  floorHref,
  fromServer,
  isQuiet,
  AppSearch,
  HOME_CHANNEL,
  InboxClient,
  INBOX_MORE,
  type ShellInboxCounts,
  inboxNeeds,
  itemOfNeed,
  withInbox,
  cardsFor,
  settingsOf,
  choosePreview,
  chooseLive,
  chooseFeaturePreview,
  choosable,
  featureLine,
  loadFeaturePreviews,
  type FeaturePreviewApp,
  hrefFor,
  IntentError,
  needsFor,
  SurfaceMounter,
  type HomeState,
  loadManifest,
  loadPreviews,
  NotificationActions,
  NotificationFeed,
  ownFloor,
  PreferenceSync,
  previewLine,
  previewPr,
  RequestBroker,
  routeIntent,
  screenFor,
  toShellNotification,
  toastFor,
  withToast,
  type ShellToast,
  type ImportEntry,
  type OpenRequest,
  type PreviewApp,
  type ServerNotification,
  type Session,
} from './host/index.js';
import { AccountApi } from './account/api.js';
import type { Preferences } from './host/preferences.js';
import { currentFormats, formatsFrom, languageOf, loadOrgTimeZone, setFormats } from './host/formats.js';
import { URGENT_PREVIEW, UrgentNotices, urgentQueue } from './urgent/UrgentNotices.js';
import { AccountArea, isAccountSection, type AccountSection } from './account/AccountArea.js';
import { DomainEventStream, topicsFor } from './host/domain-events.js';
import { ACTION_STATUS, SIGN_IN_AGAIN_PATH } from './host/session.js';
import { ActingAs, PersonaClient, withPersona, type HeldPersona } from './host/personas.js';
import { dayAndTime } from './account/words.js';
import { productName } from './host/menus.js';
import { pageKit, versionLine } from './host/kit.js';
import { appOnScreen } from './host/telemetry.js';
import { InboxView } from './inbox/InboxView.js';

/** The apps this shell can open: an intent goes to one of them, and Find asks only them. One it can't open still says why where it is listed. */
const openable = (apps: AppManifestEntry[]) => apps.filter((a) => !incompatibility(a));

export interface HostProps {
  session: Session;
  /** Where the registry manifest is served, through the gateway. */
  manifestUrl?: string;
  /** Where the events service is reached, through the gateway. */
  eventsUrl?: string;
  /** Where Identity keeps the person's preferences, through the gateway. */
  preferencesUrl?: string;
  /** Where the registry lists the pull requests' previews a developer may try, through the gateway. */
  previewsUrl?: string;
  /** Identity's organisation settings, for the time zone people follow until they choose their own. */
  organisationUrl?: string;
  /** Where the registry lists apps' feature previews and takes a person's choice of them (SDK 1.7). */
  featurePreviewsUrl?: string;
  fetchImpl?: typeof fetch;
  importEntry?: ImportEntry;
}

type Problem = { title: string; summary: string; retry: () => void; action?: string };

/**
 * Agents aren't built yet: they are still being designed and have nothing
 * behind them. Rather than hiding them (Nothing is obtuse, Shell principles in the AUGUR handbook, 02 Principles),
 * the Shell keeps them in its functions as unavailable, so they look it and say
 * why on hover and focus, and pressing them does nothing.
 */
export const AGENTS_WHY =
  'Not here yet: they’re still being designed and arrive with a later release of AUGUR, so nobody can turn them on.';
/**
 * Account opens the shell's Account area (ADR 0036), which the host draws, and Settings has moved into it
 * (Appearance), so the Shell's own small Account and Settings views aren't offered.
 */
export const ACCOUNT_AREA = 'account-area';
/** Where the Account area is in the address: `?account=<section>`, so a reload and Keycloak's screens come back to it. */
export const ACCOUNT_PARAM = 'account';
/** Back from entering the password again to start "Act as" (PDR-024): `?account=security&acting=again` reopens it. */
export const ACTING_PARAM = 'acting';
/** What a notice email links to: `?notice=<id>` opens that notification as clicking it in the Shell would (ADR 0044, D7). */
export const NOTICE_PARAM = 'notice';
/** What the Shell offers; floors replace Switch workspace. */
export const alphaFunctions = defaultFunctions
  .filter((f) => f.id !== 'settings')
  .map((f) => (f.id === 'agents' ? { ...f, unavailable: AGENTS_WHY } : f.id === 'account' ? { ...f, id: ACCOUNT_AREA } : f));
/** For an app's developers: its pull requests' previews, to switch to for themselves. */
/** The stream again after the person changed which kinds are quiet: each notification from the events service marked as its kind now is. */
const requieted = (list: ShellNotification[], known: ReadonlyMap<string, ServerNotification>, quiet: readonly string[]) =>
  list.map((n) => {
    const server = known.get(n.id);
    const q = !!server && isQuiet(server, quiet);
    return q === !!n.quiet ? n : { ...n, quiet: q };
  });
/** Pinned apps first, in their order, then the few opened most recently. */
/** What the Shell draws from someone's preferences, the app bar's place among them (PDR-020 D4). */
const shellSettings = (p: Preferences) => ({ reduceMotion: !!p.reduceMotion, density: p.density ?? 'comfortable', areaTitles: p.areaTitles !== false, toasts: !!p.toasts, barStop: p.barStop ?? 1 }) as const;
const keptClose = (pinned: string[] = [], recent: string[] = []) => [...new Set([...pinned, ...recent.slice(0, 6)])];
const PREVIEWS_FUNCTION = { id: 'previews', label: 'Previews', icon: 'preview' };

/** How long an app may take to mount before its place says it's opening. */
const SLOW_APP_MS = 400;
/** The page's fetch as it is at each call: telemetry patching it reaches every call, without a new function for Host's effects to restart on. */
const pageFetch: typeof fetch = (...args) => fetch(...args);

/**
 * The platform's frame. It owns the Shell, the catalogue of apps, which app is
 * open and the routing of intents between apps; it knows nothing about what
 * any app does.
 */
export function Host({
  session,
  manifestUrl = '/api/registry/v1/manifest',
  eventsUrl = '/api/events/v1',
  preferencesUrl = '/api/identity/v1/me/preferences',
  organisationUrl = '/api/identity/v1/organisation',
  previewsUrl = '/api/registry/v1/previews',
  featurePreviewsUrl = '/api/registry/v1/feature-previews',
  fetchImpl = pageFetch,
  importEntry,
}: HostProps) {
  const [shellModel] = useState(() => new ShellModel());
  const shellRef = useRef<ShellModel>(shellModel);
  const stageRef = useRef<HTMLDivElement>(null);
  const mounter = useRef<StageMounter | null>(null);
  const bus = useMemo(() => createEventBus(), []);
  const pendingIntent = useRef<Intent | undefined>(undefined);
  const feed = useRef<NotificationFeed | null>(null);
  const broker = useRef(new RequestBroker());
  /** Where the answering app mounts, inside the request dialog while it's open. */
  const [requestStage, setRequestStage] = useState<HTMLDivElement | null>(null);
  const requestMounter = useRef<StageMounter | null>(null);
  const [answering, setAnswering] = useState<OpenRequest | null>(null);
  /** The previews this person may try, as a developer of their apps; none for everyone else. */
  const [previewApps, setPreviewApps] = useState<PreviewApp[]>([]);
  /** Apps' feature previews, and whether each is on for this person (SDK 1.7). */
  const [featureApps, setFeatureApps] = useState<FeaturePreviewApp[]>([]);
  const [previewsOpen, setPreviewsOpen] = useState(false);
  /**
   * The Account dialog's open section; null when it's closed. It opens only from the menu's Account, or
   * on coming back from one of Keycloak's screens (`?account=<section>` with `kc_action_status`).
   */
  const [accountSection, setAccountSection] = useState<AccountSection | null>(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get(ACCOUNT_PARAM);
    return isAccountSection(s) && (q.has(ACTION_STATUS) || q.has(ACTING_PARAM)) ? s : null;
  });
  /** How the last of Keycloak's screens went, said once in the Account area. */
  const [actionStatus] = useState(() => new URLSearchParams(window.location.search).get(ACTION_STATUS));
  const accountApi = useMemo(() => new AccountApi({ getToken: session.getToken, fetchImpl }), [session, fetchImpl]);
  /**
   * "Act as" (PDR-024): the admin personas they hold and the session they act in. Only AUGUR's own frontends (apps
   * in the platform category) send the persona, through `platformFetch`; the gateway refuses it for any other app.
   */
  const acting = useMemo(() => new ActingAs(), []);
  const actingSession = useSyncExternalStore(acting.subscribe, acting.current);
  const personaClient = useMemo(() => new PersonaClient({ getToken: session.getToken, fetchImpl }), [session, fetchImpl]);
  const [heldPersonas, setHeldPersonas] = useState<HeldPersona[]>([]);
  useEffect(() => {
    let live = true;
    // A deployment without the permissions service, or one that can't answer now: there's no "Act as" to offer.
    personaClient.list().then(
      (p) => {
        if (!live) return;
        setHeldPersonas(p.personas);
        acting.set(p.session);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [personaClient, acting]);
  const platformFetch = useMemo(() => withPersona(fetchImpl, acting), [fetchImpl, acting]);
  const stopActing = useCallback(async () => {
    await personaClient.stop();
    acting.ended();
  }, [personaClient, acting]);
  /** The preferences the Account area shows; the shell's own copy is in `prefs`. */
  const [chosen, setChosen] = useState<Preferences>({});
  const pinned = chosen.pinned;
  /** The Inbox (ADR 0026): whether its view is open, the counts in its label, and Home's first items on this floor. */
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxCounts, setInboxCounts] = useState<ShellInboxCounts | undefined>(undefined);
  const [inboxForHome, setInboxForHome] = useState<InboxItem[]>([]);
  /** Bumped when the stream says an item changed, so the view's tab loads again. */
  const [inboxVersion, setInboxVersion] = useState(0);
  const [switching, setSwitching] = useState(false);
  /** Notifications from the events service, by id; those raised in the browser by ctx.notify are not here. */
  const fromEvents = useRef(new Map<string, ServerNotification>());
  /** The kinds of notification the person made quiet, as "<app>:<kind>", read as each one arrives. */
  const quietRef = useRef<string[]>([]);
  /** What each notification's buttons raise; the Shell only has their labels. */
  const actions = useRef(new NotificationActions());
  /** An action pressed on a notification from another floor: raised once that floor's catalogue has loaded. */
  const raiseOnArrival = useRef<{ floor: string; intent: Intent } | null>(null);
  /** Which floor the loaded catalogue is for. */
  const manifestFloor = useRef<string | undefined>(undefined);
  /** What Home can ask for: the same as pressing a row or an action in the stream. */
  const homeAsks = useRef<{ open(id: string): void; act(id: string, index: number): void; openItem(id: string): void } | null>(null);
  const cards = useRef<SurfaceMounter | null>(null);
  /** Find over apps' content, asked a moment after the person stops typing. */
  const search = useMemo(
    () =>
      new AppSearch(floorFetch(session.getToken, () => floorRef.current, fetchImpl), {
        floorName: (id) => {
          const f = session.floors.find((x) => x.id === id);
          return f && (f.kind === 'personal' ? 'your own floor' : f.name);
        },
      }),
    [session, fetchImpl],
  );
  const findTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => search.stop(), [search]);
  /** Unread urgent notifications from the events service, letterboxed when their app's preview is on (PER-283). */
  const [urgent, setUrgent] = useState<ServerNotification[]>([]);
  const settle = useCallback((ids: readonly string[]) => setUrgent((list) => (list.some((n) => ids.includes(n.id)) ? list.filter((n) => !ids.includes(n.id)) : list)), []);
  /** New notifications said once at the bottom of the screen, for someone who turned toasts on in Settings. */
  const [toasts, setToasts] = useState<ShellToast[]>([]);
  /** Puts a notification on the stream, and says it as a toast too when the person chose that. */
  const tell = useCallback((n: ShellNotification) => {
    const shell = shellRef.current;
    if (!shell) return;
    shell.notify(n);
    const t = toastFor(n, { on: !!shell.settings.toasts, muted: shell.muted });
    if (t) setToasts((list) => withToast(list, t));
  }, []);
  const toastDone = useCallback((id: string) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const prefs = useMemo(
    () =>
      new PreferenceSync(preferencesUrl, session.getToken, {
        fetchImpl,
        onError: (title) => tell(toShellNotification('platform', { title })),
      }),
    [preferencesUrl, session, fetchImpl, tell],
  );
  /** Their language, from their sign-in (Keycloak's locale) until they choose another in Account. */
  const language = useRef<string | undefined>(undefined);
  /** The organisation's time zone, which times follow until someone chooses their own (ADR 0039, 0042). */
  const orgZone = useRef<string | undefined>(undefined);
  const [orgTimeZone, setOrgTimeZone] = useState<string | undefined>(undefined);
  useEffect(() => {
    void session.getToken().then(
      async (token) => {
        language.current ??= languageOf(token);
        setFormats(formatsFrom(prefs.current, language.current, orgZone.current));
        orgZone.current = await loadOrgTimeZone(fetchImpl, organisationUrl, token);
        setOrgTimeZone(orgZone.current);
        setFormats(formatsFrom(prefs.current, language.current, orgZone.current));
      },
      () => undefined,
    );
  }, [session, prefs, fetchImpl, organisationUrl]);
  /** A language chosen in Account: dates follow it at once, unless they chose a date format of their own. */
  const chooseLanguage = useCallback(
    (locale: string | undefined) => {
      language.current = locale;
      setFormats(formatsFrom(prefs.current, locale, orgZone.current));
    },
    [prefs],
  );
  /** Applies one choice from the Account area at once, and saves it. */
  const choose = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      prefs.set(key, value);
      const now = prefs.current;
      setChosen(now);
      applyPreferences(now);
      setFormats(formatsFrom(now, language.current, orgZone.current));
      const shell = shellRef.current;
      if (!shell) return;
      shell.settings = shellSettings(now);
      shell.away = !!now.away;
      shell.muted = now.muted ?? [];
      if (key === 'recent' || key === 'pinned') shell.recent = keptClose(now.pinned, key === 'recent' ? [] : shell.recent);
      if (key === 'quietKinds') shell.notifications = requieted(shell.notifications, fromEvents.current, (quietRef.current = now.quietKinds ?? []));
    },
    [prefs],
  );

  /** The catalogue, and the floor it's for: until the new floor's arrives, nothing is shown from the last one's. */
  const [catalogue, setCatalogue] = useState<{ floor: string; apps: AppManifestEntry[] } | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  /** The open app is taking a while to mount. */
  const [opening, setOpening] = useState(false);
  const home = ownFloor(session.floors)!;
  /** Every location names its floor: one that doesn't is on the person's own, and the address says so. */
  const settled = useCallback(() => {
    const { slug, path } = floorFromPath(window.location.pathname);
    if (!slug) window.history.replaceState(window.history.state, '', `${floorHref(home.slug, path)}${window.location.search}`);
    return window.location.pathname;
  }, [home]);
  /** Whether they came to the front door, an address naming no floor and no place: only then does their start floor apply. */
  const arrivedBare = useRef(window.location.pathname === '/' || window.location.pathname === '');
  const [pathname, setPathname] = useState(settled);
  const startFrom = useRef({ floors: session.floors, own: home.id });
  startFrom.current = { floors: session.floors, own: home.id };
  const [attempt, setAttempt] = useState(0);

  /** The floor the location names, and where on it. An unknown floor is undefined. */
  const where = useMemo(() => floorFromPath(pathname), [pathname]);
  const floor = floorBySlug(session.floors, where.slug);
  const floorRef = useRef<Workspace>(floor ?? home);
  floorRef.current = floor ?? home;
  const floorId = (floor ?? home).id;
  const inbox = useMemo(() => new InboxClient({ getToken: session.getToken, floor: () => floorRef.current.id, fetchImpl, baseUrl: eventsUrl }), [session, fetchImpl, eventsUrl]);
  /** Loads the counts and the items Home lists; quietly keeps the last ones when the events service can't answer. */
  const refreshInbox = useCallback(() => {
    void inbox.counts().then(setInboxCounts, () => undefined);
    void Promise.all([inbox.list('you'), inbox.list('teams')]).then(([you, teams]) => setInboxForHome([...you, ...teams]), () => undefined);
  }, [inbox]);
  useEffect(refreshInbox, [refreshInbox, floorId]);
  const manifest = catalogue?.floor === floorId ? catalogue.apps : null;

  /** Goes to a path on the current floor; `to` goes to another floor instead. */
  const navigate = useCallback(
    (href: string, to: Workspace = floorRef.current) => {
      const target = floorHref(to.slug, href);
      if (target !== window.location.pathname) window.history.pushState(null, '', target);
      setPathname(window.location.pathname);
    },
    [],
  );

  /** Opens the Account dialog at a section, or closes it (null). The address doesn't change: Account isn't a place. */
  const showAccount = useCallback((section: AccountSection | null) => setAccountSection(section), []);

  // Back from one of Keycloak's screens: the menu and the dialog open again where they were, and the
  // address loses the return's words, so a reload doesn't open them again.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(ACCOUNT_PARAM) && !url.searchParams.has(ACTION_STATUS)) return;
    if (accountSection) shellRef.current?.open();
    url.searchParams.delete(ACCOUNT_PARAM);
    url.searchParams.delete(ACTION_STATUS);
    url.searchParams.delete(ACTING_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arriving
  }, []);

  useEffect(() => {
    const onPop = () => setPathname(settled());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [settled]);

  // While the Account dialog is open, the keys that summon the menu don't reach it: the dialog is over the
  // menu, and Esc or Back to the menu is the way back to it.
  useEffect(() => {
    if (!accountSection) return;
    const hold = (e: KeyboardEvent) => {
      const summon = (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k');
      if (summon) e.stopPropagation();
    };
    window.addEventListener('keydown', hold, { capture: true });
    return () => window.removeEventListener('keydown', hold, { capture: true });
  }, [accountSection]);

  // The catalogue: which apps this person can open on this floor. Another floor may have other apps.
  useEffect(() => {
    let live = true;
    setProblem(null);
    session
      .getToken()
      .then((token) => loadManifest(fetchImpl, manifestUrl, token, floorId))
      .then((apps) => {
        if (!live) return;
        manifestFloor.current = floorId;
        setCatalogue({ floor: floorId, apps });
        if (!apps.length) setProblem({ title: 'No apps yet', summary: 'There are no apps you can open. Ask an admin to give you access to one.', retry: () => setAttempt((n) => n + 1) });
      })
      .catch((err: Error) => {
        if (!live) return;
        setCatalogue(null);
        setProblem({ title: 'Apps are unavailable', summary: err.message, retry: () => setAttempt((n) => n + 1) });
      });
    return () => {
      live = false;
    };
  }, [session, manifestUrl, fetchImpl, attempt, floorId]);

  // Which previews this person may try: asked again with the catalogue, since choosing one changes both.
  useEffect(() => {
    let live = true;
    void session
      .getToken()
      .then((token) => Promise.all([loadPreviews(fetchImpl, previewsUrl, token), loadFeaturePreviews(fetchImpl, featurePreviewsUrl, token)]))
      .then(([apps, features]) => {
        if (!live) return;
        setPreviewApps(apps);
        setFeatureApps(features);
      });
    return () => {
      live = false;
    };
  }, [session, fetchImpl, previewsUrl, featurePreviewsUrl, attempt]);

  /** Turns one of an app's feature previews on or off for this person, then loads the catalogue again, which mounts the app again. */
  const switchFeature = useCallback(
    async (app: FeaturePreviewApp, id: string, on: boolean) => {
      setSwitching(true);
      try {
        await chooseFeaturePreview(fetchImpl, featurePreviewsUrl, await session.getToken(), app.app, id, on);
        const name = app.previews.find((p) => p.id === id)?.name ?? id;
        tell(toShellNotification('platform', { title: `${name} is ${on ? 'on' : 'off'} in ${app.name}`, body: 'Only for you. Turn it off again in Previews.' }));
        setAttempt((n) => n + 1);
      } catch (err) {
        tell(toShellNotification('platform', { title: `Couldn’t change it: ${(err as Error).message}` }));
      } finally {
        setSwitching(false);
      }
    },
    [fetchImpl, featurePreviewsUrl, session, tell],
  );

  /** Loads an app from this person's own machine (Live on the workbench), or stops, then loads the catalogue again. */
  const switchLive = useCallback(
    async (app: PreviewApp, entry: string | null) => {
      setSwitching(true);
      try {
        await chooseLive(fetchImpl, previewsUrl, await session.getToken(), app.app, entry);
        tell(
          toShellNotification('platform', {
            title: entry === null ? `Back to ${app.name} ${app.version}` : `${app.name} is loading from your machine`,
            body: entry === null ? 'Everyone’s version again.' : 'Only for you, with the real sign-in, floors and data. Save a file and it reloads.',
          }),
        );
        setPreviewsOpen(false);
        setAttempt((n) => n + 1);
      } catch (err) {
        tell(toShellNotification('platform', { title: `Couldn’t switch: ${(err as Error).message}` }));
      } finally {
        setSwitching(false);
      }
    },
    [fetchImpl, previewsUrl, session, tell],
  );

  /** Switches this person to a pull request's preview of an app, or back to the app, then loads the catalogue again. */
  const switchPreview = useCallback(
    async (app: PreviewApp, pr: number | null) => {
      setSwitching(true);
      try {
        await choosePreview(fetchImpl, previewsUrl, await session.getToken(), app.app, pr);
        tell(
          toShellNotification('platform', {
            title: pr === null ? `Back to ${app.name} ${app.version}` : `You’re on pull request #${pr}’s preview of ${app.name}`,
            body: 'Only you. Its service takes your calls within half a minute.',
          }),
        );
        setPreviewsOpen(false);
        setAttempt((n) => n + 1);
      } catch (err) {
        tell(toShellNotification('platform', { title: `Couldn’t switch: ${(err as Error).message}` }));
      } finally {
        setSwitching(false);
      }
    },
    [fetchImpl, previewsUrl, session, tell],
  );

  // Raising an intent counts up, so the app is mounted to answer it even when the location doesn't change.
  const [raised, setRaised] = useState(0);
  const screen = useMemo(() => (manifest && floor ? screenFor(manifest, where.path) : undefined), [manifest, floor, where, raised]);

  const raise = useCallback(
    async (intent: Intent) => {
      if (!manifest) return;
      try {
        routeIntent(openable(manifest), intent, (app) => {
          pendingIntent.current = intent;
          setRaised((n) => n + 1);
          navigate(hrefFor(app));
        });
      } catch (err) {
        if (!(err instanceof IntentError)) throw err;
        tell(toShellNotification('platform', { title: err.message }));
        throw err;
      }
    },
    [manifest, navigate, tell],
  );

  /**
   * Opens an inbox item as a notification's button would: raises its intent, or opens its app at its
   * path. One on another floor opens there, its intent waiting for that floor's apps.
   */
  const openInboxItem = useCallback(
    (item: InboxItem) => {
      const intent: Intent | undefined = item.open ? { type: item.open.type, payload: item.open.payload ?? {} } : undefined;
      const there = item.workspace ? session.floors.find((f) => f.id === item.workspace!.id) : undefined;
      const app = manifest?.find((a) => a.id === item.app);
      if (there && there.id !== floorRef.current.id) {
        if (intent) raiseOnArrival.current = { floor: there.id, intent };
        navigate('/', there);
      } else if (intent) raise(intent).catch(() => undefined);
      else if (app) navigate(hrefFor(app, item.path));
    },
    [session, manifest, navigate, raise],
  );

  // An action pressed on another floor's notification, raised now that its floor's apps are here.
  useEffect(() => {
    const pending = raiseOnArrival.current;
    if (!pending || !manifest || manifestFloor.current !== pending.floor) return;
    raiseOnArrival.current = null;
    raise(pending.intent).catch(() => undefined);
  }, [manifest, raise]);

  // An app asks another for an answer: the answering app opens over it in a dialog.
  const request = useCallback(
    <T,>(intent: Intent): Promise<T> => {
      if (!manifest) return Promise.reject(new IntentError('Apps are still loading. Try again in a moment.'));
      let started: ReturnType<RequestBroker['begin']>;
      try {
        started = broker.current.begin(openable(manifest), intent);
      } catch (err) {
        if (err instanceof IntentError) tell(toShellNotification('platform', { title: err.message }));
        return Promise.reject(err);
      }
      setAnswering(started.request);
      return (started.answer as Promise<T>).finally(() => setAnswering(null));
    },
    [manifest, tell],
  );

  // A new floor makes a new context, so the open app is mounted again on it.
  const contextFor = useCallback(
    (app: AppManifestEntry, path: string, intent?: Intent, reply?: IntentReply): MountContext => ({
      user: session.user,
      getToken: session.getToken,
      bus,
      raise,
      request,
      notify: (message) => {
        const n = toShellNotification(app.id, message);
        actions.current.remember(n.id, message.actions);
        tell(n);
      },
      workspace: floor ?? home,
      getWorkspace: () => floorRef.current,
      fetch: floorFetch(session.getToken, () => floorRef.current, app.category === 'platform' ? platformFetch : fetchImpl),
      path,
      intent,
      reply,
      previewOn: (id) => app.previewsOn?.includes(id) ?? false,
      // Read live, so a change in Account reaches apps already open.
      get formats() {
        return currentFormats();
      },
    }),
    [session, bus, raise, request, floor, home, fetchImpl, platformFetch, tell],
  );

  /** Apps' own settings in Account's Home and apps, mounted like Home's cards (ADR 0036). */
  const mountSettings = useCallback(
    (el: HTMLElement, id: string) => {
      const app = manifest?.find((a) => a.id === id);
      if (!app) return Promise.resolve(false);
      cards.current ??= new SurfaceMounter(importEntry, workerCards((app, path) => navigate(hrefFor(app, path))));
      return cards.current.mountSurface(el, app, settingsOf(app, floor ?? home), contextFor(app, '/'));
    },
    [manifest, floor, home, contextFor, importEntry],
  );
  const unmountSettings = useCallback((el: HTMLElement) => void cards.current?.unmount(el), []);

  // The answering app mounts once per request. Its context is read when it opens, so the
  // catalogue loading again, or anything else that makes a new context, doesn't mount it a
  // second time under the person's hands (it reaches the current floor through getWorkspace).
  const contextForRef = useRef(contextFor);
  contextForRef.current = contextFor;
  useEffect(() => {
    const stage = requestStage;
    if (!answering || !stage) return;
    // An app answering in the dialog stays where it is: the page behind it doesn't move.
    const mounter = new StageMounter(stage, importEntry, { navigate: () => undefined });
    requestMounter.current = mounter;
    const { app, intent } = answering;
    const reply: IntentReply = { respond: (result) => broker.current.respond(result), cancel: () => broker.current.cancel() };
    mounter.mount(app, contextForRef.current(app, '/', intent, reply)).catch((err: Error) => {
      broker.current.cancel(new IntentError(`${app.name} didn't open: ${err.message}`));
    });
    return () => {
      void mounter.unmount();
      if (requestMounter.current === mounter) requestMounter.current = null;
    };
  }, [answering, requestStage, importEntry]);

  // Mount whichever app the location points at; the desktop is the shell's own.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    mounter.current ??= new StageMounter(stage, importEntry, {
      navigate: (app, path) => navigate(hrefFor(app, path)),
      // What the open app put under its places goes to the rail, kept by app so one never lands under another's.
      onUnder: (id, under) => {
        const shell = shellRef.current;
        if (shell) shell.under = { ...shell.under, [id]: under };
      },
    });
    // On the way to another floor: the app comes off until that floor's catalogue says what's there.
    if (!manifest) {
      void mounter.current.unmount();
      return;
    }
    if (!manifest.length) return;
    if (!floor) {
      void mounter.current.unmount();
      setProblem({
        title: 'You’re not on that floor',
        summary: `There’s no @${where.slug} you can go to. It may have been renamed, or you may not be on that team.`,
        retry: () => navigate('/', home),
        action: 'Go to your own floor',
      });
      return;
    }
    if (!screen) {
      void mounter.current.unmount();
      setProblem({ title: 'Nothing here', summary: `No app you can open lives at ${where.path} on ${floor.name}. An app can be on one floor and not another.`, retry: () => navigate('/') });
      return;
    }
    if (screen.kind !== 'app') {
      void mounter.current.unmount();
      appOnScreen(null);
      shellRef.current?.settleStage();
      setOpening(false);
      setProblem(null);
      if (shellRef.current) shellRef.current.current = '';
      return;
    }
    const { app, path } = screen;
    const intent = pendingIntent.current;
    pendingIntent.current = undefined;
    const ctx = contextFor(app, path, intent);
    setProblem(null);
    shellRef.current?.setCurrent(app.id);
    appOnScreen(app);
    prefs.opened(app.id);
    // a slow app's place says it's opening after a moment, rather than sitting blank
    const slow = setTimeout(() => setOpening(true), SLOW_APP_MS);
    mounter.current
      .mount(app, ctx)
      .then(() => void shellRef.current?.arrive())
      .catch((err: Error) => {
        setProblem({ title: `${app.name} didn't open`, summary: err.message, retry: () => setAttempt((n) => n + 1) });
      })
      .finally(() => {
        clearTimeout(slow);
        setOpening(false);
      });
    return () => clearTimeout(slow);
  }, [manifest, floor, home, where, screen, attempt, contextFor, importEntry, navigate, prefs]);

  // A key or a press during a move jumps it to its end: moves never keep anyone waiting.
  useEffect(() => {
    const jump = () => moving() && finishMotion();
    window.addEventListener('keydown', jump, true);
    window.addEventListener('pointerdown', jump, true);
    return () => {
      window.removeEventListener('keydown', jump, true);
      window.removeEventListener('pointerdown', jump, true);
    };
  }, []);

  // Esc no longer leaves an app (PDR-020 D6): it closes start menus and the app's own things, and Home in the rail is the way out.

  // The app bar follows where you are: the app in front is all that runs, since one app is mounted at a time (D3), and the rail marks its page.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    shell.running = screen?.kind === 'app' ? [screen.app.id] : [];
    shell.page = screen?.kind === 'app' ? pageAt(screen.app, screen.path) : '';
    // The thing marked under a place is the one chosen there, until the app moves somewhere else.
    if (shell.path && (screen?.kind !== 'app' || screen.path !== shell.path)) shell.path = '';
  }, [screen]);

  // The band names the area the open page is in, and the tab says the page, app and floor.
  useEffect(() => {
    const shell = shellRef.current;
    if (shell) shell.area = screen?.kind === 'app' ? (areaOf(screen.app, screen.path)?.label ?? '') : '';
    if (screen) document.title = titleFor(screen, floor?.name);
  }, [screen, floor]);

  useEffect(() => () => void mounter.current?.unmount(), []);

  // A card comes off whatever else is changing: Home says so as it unmounts, which on a floor change is while there's no catalogue.
  useEffect(() => bus.on<{ el: HTMLElement }>(HOME_CHANNEL.unmountCard, ({ el }) => void cards.current?.unmount(el)), [bus]);

  // Home hears from the shell on the bus: what needs you and the cards for this floor; the shell does what Home asks.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || !manifest) return;
    const here = floor ?? home;
    cards.current ??= new SurfaceMounter(importEntry, workerCards((app, path) => navigate(hrefFor(app, path))));
    const send = () =>
      bus.emit<HomeState>(HOME_CHANNEL.state, {
        // Open inbox items on this floor first (at most five, then a row for the rest), above the notifications that need you.
        needs: [
          ...inboxNeeds(inboxForHome, { manifest, here: here.id, total: inboxForHome.filter((i) => i.state === 'open' && !i.redacted && (i.workspace?.id ?? here.id) === here.id).length }),
          ...needsFor(shell.notifications, { muted: shell.muted, apps: manifest, floors: session.floors, here: here.id }),
        ],
        cards: cardsFor(manifest, here, keptClose(pinned, shell.recent)),
      });
    const offs = [
      bus.on(HOME_CHANNEL.ready, send),
      bus.on<{ id: string }>(HOME_CHANNEL.open, ({ id }) => {
        if (id === INBOX_MORE) return setInboxOpen(true);
        const item = itemOfNeed(id);
        if (item) return homeAsks.current?.openItem(item);
        homeAsks.current?.open(id);
      }),
      bus.on<{ id: string; index: number }>(HOME_CHANNEL.act, ({ id, index }) => homeAsks.current?.act(id, index)),
      bus.on<{ el: HTMLElement; app: string; done?: (shown: boolean) => void }>(HOME_CHANNEL.mountCard, ({ el, app, done }) => {
        const entry = manifest.find((a) => a.id === app);
        if (!entry) return done?.(false);
        void cards.current!.mount(el, entry, here, contextFor(entry, '/')).then((shown) => done?.(shown));
      }),
    ];
    shell.addEventListener('ui-notifications', send);
    send();
    return () => {
      offs.forEach((off) => off());
      shell.removeEventListener('ui-notifications', send);
    };
  }, [bus, manifest, floor, home, session, contextFor, importEntry, inboxForHome, pinned]);

  // Domain events on this floor, for the apps here, each on the bus by its topic: apps' `refreshOn` hears them.
  const followed = manifest && floor ? topicsFor(manifest).join(',') : '';
  useEffect(() => {
    if (!followed) return;
    const stream = new DomainEventStream({ getToken: session.getToken, fetchImpl, baseUrl: eventsUrl, floor: floorId, topics: followed.split(','), bus });
    stream.start();
    return () => stream.stop();
  }, [floorId, followed, session, fetchImpl, eventsUrl, bus]);

  // The person's notifications: what is unread now, then each new one as it arrives.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const known = fromEvents.current;
    const f = new NotificationFeed({
      getToken: session.getToken,
      fetchImpl,
      baseUrl: eventsUrl,
      onList: (list) => {
        list.forEach((n) => {
          known.set(n.id, n);
          actions.current.remember(n.id, n.actions);
        });
        const local = shell.notifications.filter((n) => !known.has(n.id));
        shell.notifications = [...list.map((n) => fromServer(n, quietRef.current)), ...local];
        setUrgent(list.filter((n) => n.urgent));
      },
      onNotification: (n) => {
        known.set(n.id, n);
        actions.current.remember(n.id, n.actions);
        tell(fromServer(n, quietRef.current));
        if (n.urgent) setUrgent((list) => [...list.filter((x) => x.id !== n.id), n]);
      },
      onState: (state) => shell.setStream(state),
      onInbox: () => {
        refreshInbox();
        setInboxVersion((v) => v + 1);
      },
    });
    feed.current = f;
    f.start();
    return () => f.stop();
  }, [session, fetchImpl, eventsUrl, tell, refreshInbox]);

  // Hand the Shell its data and listen to what it asks for.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    shell.apps = (catalogue?.apps ?? []).map(toShellApp);
    shell.groups = groupsFor(catalogue?.apps ?? []);
    shell.user = { name: session.user.name, email: session.user.email };
    shell.floors = session.floors;
    shell.floor = floor?.id ?? '';
    const functions = withInbox(alphaFunctions, inboxCounts);
    shell.functions = previewApps.length || featureApps.some((a) => a.previews.some(choosable)) ? [...functions, PREVIEWS_FUNCTION] : functions;
    shell.canSwitchWorkspace = false;
    shell.version = versionLine(__SHELL_VERSION__, SDK_VERSION, pageKit());
  }, [catalogue, session, floor, previewApps, featureApps, inboxCounts]);

  // What this person chose last time: motion, density, away, and the apps they used most recently.
  useEffect(() => {
    let live = true;
    void prefs.load().then((p) => {
      const shell = shellRef.current;
      if (!live || !shell) return;
      // Away with an end ends by itself once that time has passed.
      if (p.away && p.awayUntil && Date.parse(p.awayUntil) <= Date.now()) {
        prefs.set('away', false);
        prefs.set('awayUntil', undefined);
      }
      const now = prefs.current;
      applyPreferences(now);
      setFormats(formatsFrom(now, language.current, orgZone.current));
      setChosen(now);
      shell.settings = shellSettings(now);
      shell.away = !!now.away;
      shell.muted = p.muted ?? [];
      shell.recent = keptClose(now.pinned, [...shell.recent, ...(p.recent ?? [])]);
      shell.notifications = requieted(shell.notifications, fromEvents.current, (quietRef.current = now.quietKinds ?? []));
      // Arriving at the front door opens the floor they chose to start on, when it's still one of theirs.
      const { floors, own } = startFrom.current;
      const start = now.startFloor ? floors.find((f) => f.id === now.startFloor) : undefined;
      if (arrivedBare.current && start && start.id !== own && floorRef.current.id === own && floorFromPath(window.location.pathname).path === '/') {
        window.history.replaceState(window.history.state, '', `${floorHref(start.slug, '/')}${window.location.search}`);
        setPathname(window.location.pathname);
      }
    });
    return () => {
      live = false;
      void prefs.save();
      prefs.stop();
    };
  }, [prefs]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const byId = (id: string) => manifest?.find((a) => a.id === id);
    const onOpenApp = (e: Event) => {
      const app = byId((e as CustomEvent<{ id: string }>).detail.id);
      if (app) navigate(hrefFor(app));
    };
    const openNotification = (id: string) => {
      const server = fromEvents.current.get(id);
      const appId = server?.app ?? shell.notifications.find((n) => n.id === id)?.app;
      if (server) {
        void feed.current?.setRead(id, true);
        shell.notifications = shell.notifications.filter((n) => n.id !== id);
        settle([id]);
      }
      const app = appId ? byId(appId) : undefined;
      // One from another floor opens there, with the same move up or down; its app may not be on this floor's catalogue yet.
      const there = server?.workspace ? session.floors.find((f) => f.id === server.workspace!.id) : undefined;
      if (there && there.id !== floorRef.current.id) navigate(app ? hrefFor(app, server?.link) : '/', there);
      else if (app) navigate(hrefFor(app, server?.link));
    };
    // A button on a notification raises its intent, as the app would itself, and the notification is done with.
    const actOn = (id: string, index: number) => {
      const intent = actions.current.intentFor(id, index);
      if (!intent) return;
      const server = fromEvents.current.get(id);
      if (server) void feed.current?.setRead(id, true);
      shell.notifications = shell.notifications.filter((n) => n.id !== id);
      settle([id]);
      actions.current.forget(id);
      // One from another floor is done there, like opening it: the intent waits for that floor's apps.
      const there = server?.workspace ? session.floors.find((f) => f.id === server.workspace!.id) : undefined;
      if (there && there.id !== floorRef.current.id) {
        raiseOnArrival.current = { floor: there.id, intent };
        navigate('/', there);
      } else raise(intent).catch(() => undefined);
    };
    // Opening an inbox item raises its intent, as a notification's button does, or opens its app at its path; one on another floor opens there.
    const openItem = (id: string) => {
      const item = inboxForHome.find((i) => i.id === id);
      if (item) openInboxItem(item);
    };
    homeAsks.current = { open: openNotification, act: actOn, openItem };
    const onOpenNotification = (e: Event) => openNotification((e as CustomEvent<{ notification: { id: string } }>).detail.notification.id);
    const onAction = (e: Event) => {
      const { notification, index } = (e as CustomEvent<{ notification: { id: string }; index: number }>).detail;
      actOn(notification.id, index);
    };
    const onMute = () => prefs.set('muted', [...shell.muted]);
    // Dismissing a notification marks it read, so it stays gone next time; Undo brings it back.
    const onDismiss = (e: Event) => {
      const { ids } = (e as CustomEvent<{ ids: string[] }>).detail;
      for (const id of ids) if (fromEvents.current.has(id)) void feed.current?.setRead(id, true);
      settle(ids);
    };
    const onRestore = (e: Event) => {
      const { ids } = (e as CustomEvent<{ ids: string[] }>).detail;
      for (const id of ids) if (fromEvents.current.has(id)) void feed.current?.setRead(id, false);
      const back = ids.map((id) => fromEvents.current.get(id)).filter((n): n is ServerNotification => !!n?.urgent);
      if (back.length) setUrgent((list) => [...list.filter((n) => !ids.includes(n.id)), ...back]);
    };
    const onRetry = (e: Event) => {
      if ((e as CustomEvent<{ what: string }>).detail.what === 'stream') feed.current?.start();
    };
    const onFunction = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      if (id === 'sign-out') void session.signOut();
      else if (id === 'previews') setPreviewsOpen(true);
      else if (id === 'inbox') setInboxOpen(true);
      // Account opens over the menu, which stays open behind it to come back to.
      else if (id === ACCOUNT_AREA) showAccount('overview');
    };
    const onSetting = (e: Event) => {
      const { key, value } = (e as CustomEvent<{ key: string; value: unknown }>).detail;
      if (key === 'reduceMotion' || key === 'away' || key === 'areaTitles' || key === 'toasts') prefs.set(key, !!value);
      else if (key === 'density') prefs.set('density', value === 'compact' ? 'compact' : 'comfortable');
      else if (key === 'barStop' && (value === 0 || value === 1 || value === 2 || value === 3)) prefs.set('barStop', value);
      applyPreferences(prefs.current);
      setChosen(prefs.current);
    };
    // The app bar: Home in the rail goes back to the desktop, a page in the rail opens it, and closing the app in front does too.
    const onHome = () => navigate('/');
    const onPage = (e: Event) => {
      const { app, id } = (e as CustomEvent<{ app: string; id: string }>).detail;
      const entry = byId(app);
      if (entry) navigate(hrefFor(entry, id));
    };
    const onPath = (e: Event) => {
      const { app, path } = (e as CustomEvent<{ app: string; path: string }>).detail;
      const entry = byId(app);
      if (entry) navigate(hrefFor(entry, path));
    };
    const onCloseApp = (e: Event) => {
      if (screen?.kind === 'app' && screen.app.id === (e as CustomEvent<{ id: string }>).detail.id) navigate('/');
    };
    // Going to another floor keeps you in the same app, at its start; its menu or Title stay as they were.
    // What you're looking at leaves the way you're going first, so nothing goes blank partway through.
    const onFloor = async (e: Event) => {
      const { id, direction } = (e as CustomEvent<{ id: string; direction: FloorDirection }>).detail;
      const to = session.floors.find((f) => f.id === id);
      if (!to) return;
      await shell.leaveFloor(direction);
      navigate(screen?.kind === 'app' ? hrefFor(screen.app) : '/', to);
    };
    // Find: the shell's own pages at once, then each app's content as it answers.
    const onFind = (e: Event) => {
      const { q } = (e as CustomEvent<{ q: string }>).detail;
      const pages = findPages(manifest ?? [], q);
      shell.findResults = pages;
      shell.findGroups = [];
      search.stop();
      clearTimeout(findTimer.current);
      findTimer.current = setTimeout(() => {
        void search.run(openable(manifest ?? []), q, floorRef.current.id, ({ results, groups }) => {
          shell.findResults = [...pages, ...results];
          shell.findGroups = groups;
        });
      }, 150);
    };
    const onPick = (e: Event) => {
      const { result } = (e as CustomEvent<{ result: ShellFindResult }>).detail;
      if (result.kind === 'page') return navigate(result.id);
      const found = result.kind === 'content' ? search.foundIn(result.id) : undefined;
      if (!found) return;
      const there = found.workspace ? session.floors.find((f) => f.id === found.workspace) : undefined;
      navigate(hrefFor(found.app, found.path), there);
    };
    shell.addEventListener('ui-open-app', onOpenApp);
    shell.addEventListener('ui-open-notification', onOpenNotification);
    shell.addEventListener('ui-function', onFunction);
    shell.addEventListener('ui-setting', onSetting);
    shell.addEventListener('ui-find', onFind);
    shell.addEventListener('ui-floor', onFloor);
    shell.addEventListener('ui-home', onHome);
    shell.addEventListener('ui-page', onPage);
    shell.addEventListener('ui-path', onPath);
    shell.addEventListener('ui-close-app', onCloseApp);
    shell.addEventListener('ui-pick', onPick);
    shell.addEventListener('ui-notification-action', onAction);
    shell.addEventListener('ui-mute', onMute);
    shell.addEventListener('ui-dismiss', onDismiss);
    shell.addEventListener('ui-restore', onRestore);
    shell.addEventListener('ui-retry', onRetry);
    return () => {
      shell.removeEventListener('ui-notification-action', onAction);
      shell.removeEventListener('ui-mute', onMute);
      shell.removeEventListener('ui-dismiss', onDismiss);
      shell.removeEventListener('ui-restore', onRestore);
      shell.removeEventListener('ui-retry', onRetry);
      shell.removeEventListener('ui-open-app', onOpenApp);
      shell.removeEventListener('ui-open-notification', onOpenNotification);
      shell.removeEventListener('ui-function', onFunction);
      shell.removeEventListener('ui-setting', onSetting);
      shell.removeEventListener('ui-find', onFind);
      shell.removeEventListener('ui-floor', onFloor);
      shell.removeEventListener('ui-home', onHome);
      shell.removeEventListener('ui-page', onPage);
      shell.removeEventListener('ui-path', onPath);
      shell.removeEventListener('ui-close-app', onCloseApp);
      shell.removeEventListener('ui-pick', onPick);
    };
  }, [manifest, navigate, session, prefs, screen, raise, search, showAccount, inboxForHome, openInboxItem, settle]);

  // A notice email's link: once the apps on this floor are known, open the notification it names, read or not, on its own floor.
  const noticeAsked = useRef(new URLSearchParams(window.location.search).get(NOTICE_PARAM));
  useEffect(() => {
    const id = noticeAsked.current;
    const f = feed.current;
    if (!id || !manifest || !homeAsks.current || !f) return;
    noticeAsked.current = null;
    const url = new URL(window.location.href);
    url.searchParams.delete(NOTICE_PARAM);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    const cant = (detail: string) => tell({ id: `notice:${id}`, app: 'shell', level: 'info', title: 'That notification can’t be opened', detail, time: Date.now() });
    f.get(id).then(
      (n) => {
        if (!n) return cant('It was sent to someone else, or it has gone. Notifications go after a while, and when the person they were for is removed.');
        fromEvents.current.set(n.id, n);
        homeAsks.current?.open(n.id);
      },
      (err: Error) => cant(`Notifications couldn’t be reached (${err.message}). Try the link again in a moment.`),
    );
  }, [manifest, tell]);

  // The open app is a pull request's preview: say so, with the way back.
  const openApp = screen?.kind === 'app' ? screen.app : undefined;
  const previewOf = previewPr(openApp?.version);
  const previewing = previewOf !== undefined ? previewApps.find((a) => a.app === openApp?.id) : undefined;
  // The open app has feature previews on for this person: say which, with the way to change them.
  const featuresOn = openApp?.previewsOn?.length ? featureApps.find((a) => a.app === openApp.id)?.previews.filter((p) => p.on) : undefined;

  return (
    <Shell model={shellModel}>
      {actingSession ? (
        <aside className="preview-badge" role="status" data-acting>
          <span>
            Acting as {actingSession.persona} until {dayAndTime(actingSession.endsAt)}
          </span>
          <Button kind="tertiary" size="sm" onPress={() => void stopActing().catch((err: Error) => tell({ id: 'acting', app: 'shell', level: 'info', title: 'Acting as couldn’t be stopped', detail: err.message, time: Date.now() }))}>
            Stop
          </Button>
        </aside>
      ) : null}
      {previewOf !== undefined ? (
        <aside className="preview-badge" role="status">
          <span>
            Preview of{' '}
            {previewing?.previews.find((p) => p.pr === previewOf)?.url ? (
              <a href={previewing.previews.find((p) => p.pr === previewOf)!.url} target="_blank" rel="noopener noreferrer">
                pull request #{previewOf}
              </a>
            ) : (
              `pull request #${previewOf}`
            )}
            , for you alone
          </span>
          {previewing ? (
            <Button kind="tertiary" size="sm" onPress={() => void switchPreview(previewing, null)}>
              Back to {previewing.version}
            </Button>
          ) : null}
        </aside>
      ) : null}
      {previewOf === undefined && featuresOn?.length ? (
        <aside className="preview-badge" role="status" data-features-on>
          <span>Preview on: {featuresOn.map((p) => p.name).join(', ')}</span>
          <Button kind="tertiary" size="sm" onPress={() => setPreviewsOpen(true)}>
            Previews
          </Button>
        </aside>
      ) : null}
      <Toasts
        toasts={toasts.map((t) => ({ id: t.id, text: t.text, ...(t.open ? { action: { label: 'Open', onPress: () => homeAsks.current?.open(t.id) } } : {}) }))}
        onDone={toastDone}
      />
      <UrgentNotices
        queue={urgentQueue(urgent, (app) => !!manifest?.find((a) => a.id === app)?.previewsOn?.includes(URGENT_PREVIEW))}
        appName={(id) => manifest?.find((a) => a.id === id)?.name ?? id}
        floorName={(id) => session.floors.find((f) => f.id === id)?.name}
        me={session.user.name}
        onOpen={(id) => homeAsks.current?.open(id)}
      />
      <div ref={stageRef} className="stage" hidden={screen?.kind !== 'app'} />
      {accountSection ? (
        <AccountArea
          section={accountSection}
          onSection={showAccount}
          onClose={() => showAccount(null)}
          api={accountApi}
          prefs={chosen}
          onPreference={choose}
          onLanguage={chooseLanguage}
          orgTimeZone={orgTimeZone}
          onAction={(action, section) => void session.startAction(action, `${window.location.pathname}?${ACCOUNT_PARAM}=${section}`)}
          onSignOut={() => void session.signOut()}
          apps={(manifest ?? []).map((a) => ({ id: a.id, name: a.name, ...(a.notifications?.kinds.length ? { kinds: a.notifications.kinds } : {}) }))}
          floors={session.floors.map((f) => ({ id: f.id, name: f.name }))}
          ownFloor={home.id}
          appSettings={(manifest ?? []).filter((a) => settingsOf(a, floor ?? home)).map((a) => ({ id: a.id, name: a.name }))}
          mountSettings={mountSettings}
          unmountSettings={unmountSettings}
          shellClient={import.meta.env.VITE_OIDC_CLIENT_ID ?? 'shell'}
          product={productName()}
          version={versionLine(__SHELL_VERSION__, SDK_VERSION, pageKit())}
          actionStatus={actionStatus}
          actAs={{
            personas: heldPersonas,
            ...(actingSession ? { session: actingSession } : {}),
            start: async (persona, reason, minutes) => acting.set(await personaClient.start(persona, reason, minutes)),
            stop: stopActing,
            signInAgain: () => window.location.assign(`${SIGN_IN_AGAIN_PATH}?return=${encodeURIComponent(`${window.location.pathname}?${ACCOUNT_PARAM}=security&${ACTING_PARAM}=again`)}`),
          }}
        />
      ) : null}
      {problem && (
        <section className="problem" role="alert">
          <Heading heading={problem.title} summary={problem.summary} size="s" />
          <Button kind="secondary" onPress={problem.retry}>
            {problem.action ?? 'Try again'}
          </Button>
        </section>
      )}
      {((!manifest && !problem) || (opening && !problem)) && <p className="loading">Opening…</p>}
      <Dialog
        open={!!answering}
        onClose={() => {
          // closing without an answer cancels the request
          if (broker.current.current) broker.current.cancel();
        }}
        size="read"
        heading={answering?.app.name ?? ''}
        cancelLabel="Cancel"
      >
        <div ref={setRequestStage} className="request-stage" />
      </Dialog>
      <Dialog open={inboxOpen} onClose={() => setInboxOpen(false)} size="read" heading="Inbox" summary="Work that waits on you and your teams." cancelLabel="Close">
        {inboxOpen && manifest ? (
          <InboxView
            client={inbox}
            manifest={manifest}
            floors={session.floors}
            here={floorId}
            me={session.user.id}
            counts={inboxCounts}
            version={inboxVersion}
            fetch={floorFetch(session.getToken, () => floorRef.current, fetchImpl)}
            onChanged={refreshInbox}
            onOpen={(item) => {
              setInboxOpen(false);
              openInboxItem(item);
            }}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={previewsOpen}
        onClose={() => setPreviewsOpen(false)}
        size="read"
        heading="Previews"
        summary="Features apps are trying before they’re everyone’s, and pull requests’ builds of the apps you’re a developer of. Each choice is yours alone."
        cancelLabel="Close"
      >
        {featureApps.map((app) => (
          <section key={`f:${app.app}`} className="previews" data-feature-previews={app.app}>
            <Heading heading={app.name} summary="Features it’s trying out" size="s" />
            <ul>
              {app.previews.map((p) => (
                <li key={p.id}>
                  <span>
                    <strong>{p.name}</strong>
                    {p.detail ? ` · ${p.detail}` : ''}
                    <br />
                    <small>{featureLine(p)}</small>
                  </span>
                  {choosable(p) ? (
                    <Button kind={p.on ? 'tertiary' : 'secondary'} size="sm" busy={switching} onPress={() => void switchFeature(app, p.id, !p.on)}>
                      {p.on ? 'Turn off' : 'Turn on'}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {previewApps.map((app) => (
          <section key={app.app} className="previews" data-previews={app.app}>
            <Heading heading={app.name} summary={app.chosen === undefined ? `You’re on ${app.version}, as everyone is.` : `You’re on pull request #${app.chosen}’s preview.`} size="s" />
            {app.previews.length ? (
              <ul>
                {app.previews.map((p) => (
                  <li key={p.pr}>
                    <span>
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          {previewLine(p)}
                        </a>
                      ) : (
                        previewLine(p)
                      )}
                    </span>
                    {app.chosen === p.pr ? (
                      <Button kind="tertiary" size="sm" busy={switching} onPress={() => void switchPreview(app, null)}>
                        Back to {app.version}
                      </Button>
                    ) : (
                      <Button kind="secondary" size="sm" busy={switching} onPress={() => void switchPreview(app, p.pr)}>
                        Use it
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No pull request of it has a preview running.</p>
            )}
            <LiveFromMyMachine app={app} busy={switching} onChoose={(entry) => void switchLive(app, entry)} />
          </section>
        ))}
      </Dialog>
    </Shell>
  );
}

/**
 * Live on the workbench: load the app's frontend from your own machine's `pnpm dev:app <id> --live`, for you
 * alone. Elsewhere it stays in the list and says why (explain, never hide).
 */
function LiveFromMyMachine({ app, busy, onChoose }: { app: PreviewApp; busy: boolean; onChoose: (entry: string | null) => void }) {
  const [entry, setEntry] = useState('');
  if (app.live) {
    return (
      <div className="live" data-live={app.app}>
        <span>
          Loading from your machine
          <br />
          <small>{app.live}</small>
        </span>
        <Button kind="tertiary" size="sm" busy={busy} onPress={() => onChoose(null)}>
          Back to {app.version}
        </Button>
      </div>
    );
  }
  if (app.liveProblem) {
    return (
      <p className="live" data-live={app.app}>
        <small>Live from my machine: {app.liveProblem}</small>
      </p>
    );
  }
  return (
    <form
      className="live"
      data-live={app.app}
      onSubmit={(e) => {
        e.preventDefault();
        if (entry.trim()) onChoose(entry.trim());
      }}
    >
      <label>
        <small>Live from my machine: the address <code>pnpm dev:app {app.app} --live</code> prints</small>
        <input type="url" value={entry} placeholder="https://your-machine.ts.net/…/entry.tsx" onChange={(e) => setEntry(e.currentTarget.value)} />
      </label>
      <Button kind="secondary" size="sm" busy={busy} disabled={!entry.trim()} reason="Paste the address first." onPress={() => entry.trim() && onChoose(entry.trim())}>
        Load it
      </Button>
    </form>
  );
}

/** Shown in place of the platform when signing in did not work. */
export function SignInProblem({ message, onSignIn }: { message: string; onSignIn: () => void }) {
  return (
    <main className="sign-in-problem" role="alert">
      <Heading heading="You're not signed in" summary={message} size="m" />
      <Button kind="primary" onPress={onSignIn}>
        Sign in
      </Button>
    </main>
  );
}
