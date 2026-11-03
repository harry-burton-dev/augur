import { createEventBus, floorFetch, SDK_VERSION, type AppManifestEntry, type Intent, type IntentReply, type MountContext, type Workspace } from '@augur/mfe-sdk';
import {
  Button,
  CentreMenu,
  CentreMenuModel,
  defaultFunctions,
  Dialog,
  finishMotion,
  Heading,
  liftGhost,
  moving,
  Shell,
  ShellModel,
  Toasts,
  type FloorDirection,
  type Ghost,
  type MenuCategory,
  type MenuItem,
  type ShellApp,
  type ShellFindResult,
  type ShellNotification,
} from '@augur/shell-kit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppMounter,
  applyPreferences,
  areaOf,
  backFrom,
  navsFor,
  navTarget,
  titleFor,
  escapeIsFree,
  findPages,
  floorBySlug,
  floorFromPath,
  floorHref,
  fromServer,
  AppSearch,
  HOME_CHANNEL,
  cardsFor,
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
  orbitIndexOf,
  orbitMenu,
  ownFloor,
  PreferenceSync,
  previewLine,
  previewPr,
  RequestBroker,
  routeIntent,
  screenFor,
  titleMenu,
  titleTarget,
  toShellNotification,
  toastFor,
  withToast,
  type ShellToast,
  type ImportEntry,
  type OpenRequest,
  type PreviewApp,
  type Screen,
  type ServerNotification,
  type Session,
} from './host/index.js';

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
  /** Where the registry lists apps' feature previews and takes a person's choice of them (SDK 1.7). */
  featurePreviewsUrl?: string;
  fetchImpl?: typeof fetch;
  importEntry?: ImportEntry;
}

type Problem = { title: string; summary: string; retry: () => void; action?: string };

const toShellApp = (a: AppManifestEntry): ShellApp => ({ id: a.id, name: a.name, line: a.description, icon: a.icon ?? 'apps', ai: a.ai, sameOnEveryFloor: a.sameOnEveryFloor });

/**
 * What the Shell offers. Agents stay off until they are designed and have
 * something behind them; floors replace Switch workspace.
 */
const alphaFunctions = defaultFunctions.filter((f) => f.id !== 'agents');
/** For an app's developers: its pull requests' previews, to switch to for themselves. */
const PREVIEWS_FUNCTION = { id: 'previews', label: 'Previews', icon: 'preview' };

/** How long an app may take to mount before its place says it's opening. */
const SLOW_APP_MS = 400;
/**
 * The ground for each screen: Title on Minimal water, Orbit on Deep Ocean, and
 * every app on the same still ground, the slate Artifacts sits on, so no app
 * floats on water and none differs from another.
 */
const waterFor = (screen: Screen) => (screen.kind === 'title' ? 'Minimal' : screen.kind === 'orbit' ? 'Deep Ocean' : 'none');
/** Before the catalogue says what's at an address: Title's water at the root, the still ground anywhere else. */
const waterAt = (path: string) => (path === '/' || path === '' ? 'Minimal' : 'none');

/** The Orbit category holding the item that opens a path, so going back lands where you came from. */

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
  previewsUrl = '/api/registry/v1/previews',
  featurePreviewsUrl = '/api/registry/v1/feature-previews',
  fetchImpl = fetch,
  importEntry,
}: HostProps) {
  const [shellModel] = useState(() => new ShellModel());
  const shellRef = useRef<ShellModel>(shellModel);
  const stageRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<CentreMenuModel>(null);
  /** Where the next menu starts: Title on the app you came from, Orbit on the category you chose or came from. */
  const lastApp = useRef<string | undefined>(undefined);
  const orbitStart = useRef(0);
  /** What was chosen, lifted from the screen being left, to land on the next one (see "The choice carries you"). */
  const carried = useRef<Ghost | null>(null);
  /** A move away is under way: a second choice waits for it rather than starting another. */
  const leaving = useRef(false);
  const mounter = useRef<AppMounter | null>(null);
  const bus = useMemo(() => createEventBus(), []);
  const pendingIntent = useRef<Intent | undefined>(undefined);
  const feed = useRef<NotificationFeed | null>(null);
  const broker = useRef(new RequestBroker());
  /** Where the answering app mounts, inside the request dialog while it's open. */
  const [requestStage, setRequestStage] = useState<HTMLDivElement | null>(null);
  const requestMounter = useRef<AppMounter | null>(null);
  const [answering, setAnswering] = useState<OpenRequest | null>(null);
  /** The previews this person may try, as a developer of their apps; none for everyone else. */
  const [previewApps, setPreviewApps] = useState<PreviewApp[]>([]);
  /** Apps' feature previews, and whether each is on for this person (SDK 1.7). */
  const [featureApps, setFeatureApps] = useState<FeaturePreviewApp[]>([]);
  const [previewsOpen, setPreviewsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  /** Notifications from the events service, by id; those raised in the browser by ctx.notify are not here. */
  const fromEvents = useRef(new Map<string, ServerNotification>());
  /** What each notification's buttons raise; the Shell only has their labels. */
  const actions = useRef(new NotificationActions());
  /** An action pressed on a notification from another floor: raised once that floor's catalogue has loaded. */
  const raiseOnArrival = useRef<{ floor: string; intent: Intent } | null>(null);
  /** Which floor the loaded catalogue is for. */
  const manifestFloor = useRef<string | undefined>(undefined);
  /** What Home can ask for: the same as pressing a row or an action in the stream. */
  const homeAsks = useRef<{ open(id: string): void; act(id: string, index: number): void } | null>(null);
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
  const [pathname, setPathname] = useState(settled);
  const [attempt, setAttempt] = useState(0);

  /** The floor the location names, and where on it. An unknown floor is undefined. */
  const where = useMemo(() => floorFromPath(pathname), [pathname]);
  const floor = floorBySlug(session.floors, where.slug);
  const floorRef = useRef<Workspace>(floor ?? home);
  floorRef.current = floor ?? home;
  const floorId = (floor ?? home).id;
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

  useEffect(() => {
    const onPop = () => setPathname(settled());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [settled]);

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
  const screen = useMemo(() => (manifest && floor ? screenFor(manifest, where.path, Boolean(pendingIntent.current)) : undefined), [manifest, floor, where, raised]);

  const raise = useCallback(
    async (intent: Intent) => {
      if (!manifest) return;
      try {
        routeIntent(manifest, intent, (app) => {
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
        started = broker.current.begin(manifest, intent);
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
      fetch: floorFetch(session.getToken, () => floorRef.current, fetchImpl),
      path,
      intent,
      reply,
      previewOn: (id) => app.previewsOn?.includes(id) ?? false,
    }),
    [session, bus, raise, request, floor, home, fetchImpl, tell],
  );

  // The answering app mounts once per request. Its context is read when it opens, so the
  // catalogue loading again, or anything else that makes a new context, doesn't mount it a
  // second time under the person's hands (it reaches the current floor through getWorkspace).
  const contextForRef = useRef(contextFor);
  contextForRef.current = contextFor;
  useEffect(() => {
    const stage = requestStage;
    if (!answering || !stage) return;
    const mounter = new AppMounter(stage, importEntry);
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

  // Mount whichever app the location points at; Title and Orbit are the shell's own.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    mounter.current ??= new AppMounter(stage, importEntry);
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
      shellRef.current?.settleStage();
      setOpening(false);
      setProblem(null);
      if (screen.kind === 'orbit') {
        shellRef.current?.setCurrent(screen.app.id);
        prefs.opened(screen.app.id);
      } else if (shellRef.current) shellRef.current.current = '';
      return;
    }
    const { app, path } = screen;
    // whatever move brought you here has ended: the way out mustn't think one is still under way
    leaving.current = false;
    lastApp.current = app.id;
    const intent = pendingIntent.current;
    pendingIntent.current = undefined;
    const ctx = contextFor(app, path, intent);
    setProblem(null);
    shellRef.current?.setCurrent(app.id);
    prefs.opened(app.id);
    // a slow app's place says it's opening after a moment, rather than sitting blank
    const slow = setTimeout(() => setOpening(true), SLOW_APP_MS);
    mounter.current
      .mount(app, ctx)
      .then(() => {
        const shell = shellRef.current;
        void shell?.arrive();
        const ghost = carried.current;
        carried.current = null;
        void shell?.updateComplete.then(() => ghost?.land(shell.placeTitle?.getBoundingClientRect()));
      })
      .catch((err: Error) => {
        carried.current?.drop();
        carried.current = null;
        setProblem({ title: `${app.name} didn't open`, summary: err.message, retry: () => setAttempt((n) => n + 1) });
      })
      .finally(() => {
        clearTimeout(slow);
        setOpening(false);
      });
    return () => clearTimeout(slow);
  }, [manifest, floor, home, where, screen, attempt, contextFor, importEntry, navigate, prefs]);

  // Title and Orbit: what they hold, where they start, and where choosing leads.
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu || !manifest || !screen || screen.kind === 'app') return;
    let categories: MenuCategory[];
    if (screen.kind === 'title') {
      categories = titleMenu(manifest);
      menu.startCategory = Math.max(0, manifest.findIndex((a) => a.id === lastApp.current));
    } else {
      categories = orbitMenu(screen.app);
      menu.startCategory = orbitStart.current;
      orbitStart.current = 0;
      lastApp.current = screen.app.id;
    }
    menu.categories = categories;
    menu.background = shellRef.current?.waves ?? null;
    leaving.current = false;
    void menu.updateComplete.then(async () => {
      menu.focus();
      // what was carried here lands on what's now in focus, once the menu has measured itself and drawn
      await new Promise((r) => requestAnimationFrame(r));
      await menu.updateComplete;
      const ghost = carried.current;
      carried.current = null;
      void ghost?.land(menu.focusedRect());
    });
    /** Step away, carrying what's in focus, then go. */
    const go = async (to: string, way: 'deeper' | 'back') => {
      if (leaving.current) return;
      leaving.current = true;
      carried.current?.drop();
      carried.current = liftGhost(menu.focusedIcon());
      await menu.leave(way);
      navigate(to);
    };
    const onSelect = (e: Event) => {
      const { item } = (e as CustomEvent<{ item: MenuItem }>).detail;
      if (screen.kind === 'orbit') return void go(hrefFor(screen.app, item.id), 'deeper');
      const target = titleTarget(manifest, item);
      if (!target) return;
      lastApp.current = target.app.id;
      orbitStart.current = target.category;
      void go(hrefFor(target.app, target.path), 'deeper');
    };
    const onBack = () => screen.kind === 'orbit' && void go('/', 'back');
    const onChange = (e: Event) => {
      const shell = shellRef.current;
      if (shell && screen.kind === 'orbit') shell.area = (e as CustomEvent<{ category: MenuCategory | null }>).detail.category?.section ?? '';
    };
    menu.addEventListener('ui-select', onSelect);
    menu.addEventListener('ui-back', onBack);
    menu.addEventListener('ui-change', onChange);
    return () => {
      menu.removeEventListener('ui-select', onSelect);
      menu.removeEventListener('ui-back', onBack);
      menu.removeEventListener('ui-change', onChange);
    };
  }, [manifest, screen, navigate]);

  /** Leave the open app on the way up: its name is carried back to its icon as the app sinks. */
  const leaveApp = useCallback(
    async (to: string) => {
      if (leaving.current) return;
      leaving.current = true;
      const shell = shellRef.current;
      carried.current?.drop();
      carried.current = liftGhost(shell?.placeTitle);
      await shell?.sink();
      leaving.current = false;
      navigate(to);
    },
    [navigate],
  );

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

  // Esc that nothing else used goes back a step: from inside an app to its Orbit, then to Title. An app that keeps its own menu keeps Esc.
  useEffect(() => {
    if (screen?.kind !== 'app') return;
    const back = backFrom(screen);
    if (!back) return;
    const onKey = (e: KeyboardEvent) => {
      if (shellRef.current?.isOpen || broker.current.current || !escapeIsFree(e)) return;
      e.preventDefault();
      orbitStart.current = orbitIndexOf(screen.app, screen.path);
      void leaveApp(back);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, leaveApp]);

  // Between screens (on the way to another floor, while its catalogue loads) the ground stays as it was,
  // so an app's still ground never gives way to water partway through a move.
  useEffect(() => {
    if (shellRef.current && !screen) shellRef.current.background = waterAt(where.path);
    // once, for the first address, before anything has loaded
  }, []);
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || !screen) return;
    shell.background = waterFor(screen);
    // coming up from an app the water is new: Title and Orbit swell this one
    void shell.updateComplete.then(() => menuRef.current && (menuRef.current.background = shell.waves));
  }, [screen]);

  // The band follows where you are: Home and Title mark the one you're on, and the tab says the page, app and floor.
  useEffect(() => {
    const shell = shellRef.current;
    if (shell) {
      shell.navs = navsFor(screen, manifest ?? []);
      // inside an app, the area its page is in; Orbit names the area of the group in focus as it moves
      if (screen?.kind !== 'orbit') shell.area = screen?.kind === 'app' ? (areaOf(screen.app, screen.path)?.label ?? '') : '';
    }
    if (screen) document.title = titleFor(screen, floor?.name);
  }, [screen, floor, manifest]);

  useEffect(() => () => void mounter.current?.unmount(), []);

  // Home hears from the shell on the bus: what needs you and the cards for this floor; the shell does what Home asks.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || !manifest) return;
    const here = floor ?? home;
    cards.current ??= new SurfaceMounter(importEntry);
    const send = () =>
      bus.emit<HomeState>(HOME_CHANNEL.state, {
        needs: needsFor(shell.notifications, { muted: shell.muted, apps: manifest, floors: session.floors, here: here.id }),
        cards: cardsFor(manifest, here, shell.recent),
      });
    const offs = [
      bus.on(HOME_CHANNEL.ready, send),
      bus.on<{ id: string }>(HOME_CHANNEL.open, ({ id }) => homeAsks.current?.open(id)),
      bus.on<{ id: string; index: number }>(HOME_CHANNEL.act, ({ id, index }) => homeAsks.current?.act(id, index)),
      bus.on<{ el: HTMLElement; app: string; done?: (shown: boolean) => void }>(HOME_CHANNEL.mountCard, ({ el, app, done }) => {
        const entry = manifest.find((a) => a.id === app);
        if (!entry) return done?.(false);
        void cards.current!.mount(el, entry, here, contextFor(entry, '/')).then((shown) => done?.(shown));
      }),
      bus.on<{ el: HTMLElement }>(HOME_CHANNEL.unmountCard, ({ el }) => void cards.current?.unmount(el)),
    ];
    shell.addEventListener('ui-notifications', send);
    send();
    return () => {
      offs.forEach((off) => off());
      shell.removeEventListener('ui-notifications', send);
    };
  }, [bus, manifest, floor, home, session, contextFor, importEntry]);

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
        shell.notifications = [...list.map(fromServer), ...local];
      },
      onNotification: (n) => {
        known.set(n.id, n);
        actions.current.remember(n.id, n.actions);
        tell(fromServer(n));
      },
      onState: (state) => shell.setStream(state),
    });
    feed.current = f;
    f.start();
    return () => f.stop();
  }, [session, fetchImpl, eventsUrl, tell]);

  // Hand the Shell its data and listen to what it asks for.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    shell.apps = (catalogue?.apps ?? []).map(toShellApp);
    shell.user = { name: session.user.name, email: session.user.email };
    shell.floors = session.floors;
    shell.floor = floor?.id ?? '';
    shell.functions = previewApps.length || featureApps.some((a) => a.previews.some(choosable)) ? [...alphaFunctions, PREVIEWS_FUNCTION] : alphaFunctions;
    shell.canSwitchWorkspace = false;
    shell.version = `${__SHELL_VERSION__} · SDK ${SDK_VERSION}`;
  }, [catalogue, session, floor, previewApps, featureApps]);

  // What this person chose last time: motion, density, away, and the apps they used most recently.
  useEffect(() => {
    let live = true;
    void prefs.load().then((p) => {
      const shell = shellRef.current;
      if (!live || !shell) return;
      applyPreferences(p);
      shell.settings = { reduceMotion: !!p.reduceMotion, density: p.density ?? 'comfortable', areaTitles: p.areaTitles !== false, toasts: !!p.toasts };
      shell.away = !!p.away;
      shell.muted = p.muted ?? [];
      shell.recent = [...new Set([...shell.recent, ...(p.recent ?? [])])].slice(0, 6);
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
      actions.current.forget(id);
      // One from another floor is done there, like opening it: the intent waits for that floor's apps.
      const there = server?.workspace ? session.floors.find((f) => f.id === server.workspace!.id) : undefined;
      if (there && there.id !== floorRef.current.id) {
        raiseOnArrival.current = { floor: there.id, intent };
        navigate('/', there);
      } else raise(intent).catch(() => undefined);
    };
    homeAsks.current = { open: openNotification, act: actOn };
    const onOpenNotification = (e: Event) => openNotification((e as CustomEvent<{ notification: { id: string } }>).detail.notification.id);
    const onAction = (e: Event) => {
      const { notification, index } = (e as CustomEvent<{ notification: { id: string }; index: number }>).detail;
      actOn(notification.id, index);
    };
    const onMute = () => prefs.set('muted', [...shell.muted]);
    // Dismissing a notification marks it read, so it stays gone next time; Undo brings it back.
    const onDismiss = (e: Event) => {
      for (const id of (e as CustomEvent<{ ids: string[] }>).detail.ids) if (fromEvents.current.has(id)) void feed.current?.setRead(id, true);
    };
    const onRestore = (e: Event) => {
      for (const id of (e as CustomEvent<{ ids: string[] }>).detail.ids) if (fromEvents.current.has(id)) void feed.current?.setRead(id, false);
    };
    const onRetry = (e: Event) => {
      if ((e as CustomEvent<{ what: string }>).detail.what === 'stream') feed.current?.start();
    };
    const onFunction = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      if (id === 'sign-out') void session.signOut();
      else if (id === 'previews') setPreviewsOpen(true);
    };
    const onSetting = (e: Event) => {
      const { key, value } = (e as CustomEvent<{ key: string; value: unknown }>).detail;
      if (key === 'reduceMotion' || key === 'away' || key === 'areaTitles' || key === 'toasts') prefs.set(key, !!value);
      else if (key === 'density') prefs.set('density', value === 'compact' ? 'compact' : 'comfortable');
      applyPreferences(prefs.current);
    };
    // Home and Title in the band: straight there, from whatever screen you're on.
    const onNav = (e: Event) => {
      const to = navTarget((e as CustomEvent<{ id: string }>).detail.id, manifest ?? []);
      if (!to) return;
      if (screen?.kind === 'app') return void leaveApp(to);
      // Title or Orbit steps aside first, as it does for Back
      void (menuRef.current?.leave('back') ?? Promise.resolve()).then(() => navigate(to));
    };
    // Going to another floor keeps you in the same app, at its start; its menu or Title stay as they were.
    // What you're looking at leaves the way you're going first, so nothing goes blank partway through.
    const onFloor = async (e: Event) => {
      const { id, direction } = (e as CustomEvent<{ id: string; direction: FloorDirection }>).detail;
      const to = session.floors.find((f) => f.id === id);
      if (!to) return;
      await shell.leaveFloor(direction);
      navigate(screen && screen.kind !== 'title' ? hrefFor(screen.app) : '/', to);
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
        void search.run(manifest ?? [], q, floorRef.current.id, ({ results, groups }) => {
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
    shell.addEventListener('ui-nav', onNav);
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
      shell.removeEventListener('ui-nav', onNav);
      shell.removeEventListener('ui-pick', onPick);
    };
  }, [manifest, navigate, session, prefs, screen, raise, search, leaveApp]);

  // The open app is a pull request's preview: say so, with the way back.
  const openApp = screen && screen.kind !== 'title' ? screen.app : undefined;
  const previewOf = previewPr(openApp?.version);
  const previewing = previewOf !== undefined ? previewApps.find((a) => a.app === openApp?.id) : undefined;
  // The open app has feature previews on for this person: say which, with the way to change them.
  const featuresOn = openApp?.previewsOn?.length ? featureApps.find((a) => a.app === openApp.id)?.previews.filter((p) => p.on) : undefined;

  return (
    <Shell model={shellModel}>
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
      <div ref={stageRef} className="stage" hidden={screen?.kind !== 'app'} />
      {screen && screen.kind !== 'app' && manifest?.length ? (
        <CentreMenu
          key={screen.kind === 'orbit' ? `orbit:${screen.app.id}` : 'title'}
          ref={menuRef}
          variant={screen.kind}
          label={screen.kind === 'orbit' ? `${screen.app.name} menu` : 'Apps'}
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
        <input type="url" value={entry} placeholder="https://your-machine.ts.net/…/entry.ts" onChange={(e) => setEntry(e.currentTarget.value)} />
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
