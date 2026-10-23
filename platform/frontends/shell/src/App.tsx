import { createEventBus, floorFetch, SDK_VERSION, type AppManifestEntry, type Intent, type IntentReply, type MountContext, type Workspace } from '@platform/mfe-sdk';
import { defaultFunctions, type MenuCategory, type MenuItem, type ShellApp, type ShellFindResult, type UiCentreMenu, type UiDialog, type UiShell } from '@platform/ui-kit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppMounter,
  applyPreferences,
  backFrom,
  escapeIsFree,
  findPages,
  floorBySlug,
  floorFromPath,
  floorHref,
  fromServer,
  hrefFor,
  IntentError,
  loadManifest,
  NotificationActions,
  NotificationFeed,
  orbitMenu,
  ownFloor,
  PreferenceSync,
  RequestBroker,
  routeIntent,
  screenFor,
  titleMenu,
  titleTarget,
  toShellNotification,
  type ImportEntry,
  type OpenRequest,
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
  fetchImpl?: typeof fetch;
  importEntry?: ImportEntry;
}

type Problem = { title: string; summary: string; retry: () => void; action?: string };

const toShellApp = (a: AppManifestEntry): ShellApp => ({ id: a.id, name: a.name, line: a.description, icon: a.icon ?? 'apps', ai: a.ai });

/**
 * What the Shell offers. Agents stay off until they are designed and have
 * something behind them; floors replace Switch workspace.
 */
const alphaFunctions = defaultFunctions.filter((f) => f.id !== 'agents');

/** The water for each screen: Title on Minimal, Orbit on Deep Ocean, apps on Calm Tide. */
const waterFor = (screen: Screen | undefined) => (screen?.kind === 'title' ? 'Minimal' : screen?.kind === 'orbit' ? 'Deep Ocean' : 'Calm Tide');

/** The Orbit category holding the item that opens a path, so going back lands where you came from. */
const categoryOf = (app: AppManifestEntry, path: string) => Math.max(0, app.menu?.findIndex((c) => c.items.some((it) => it.path === path)) ?? 0);

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
  fetchImpl = fetch,
  importEntry,
}: HostProps) {
  const shellRef = useRef<UiShell>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<UiCentreMenu>(null);
  /** Where the next menu starts: Title on the app you came from, Orbit on the category you chose or came from. */
  const lastApp = useRef<string | undefined>(undefined);
  const orbitStart = useRef(0);
  const mounter = useRef<AppMounter | null>(null);
  const bus = useMemo(() => createEventBus(), []);
  const pendingIntent = useRef<Intent | undefined>(undefined);
  const feed = useRef<NotificationFeed | null>(null);
  const broker = useRef(new RequestBroker());
  const dialogRef = useRef<UiDialog>(null);
  const requestStageRef = useRef<HTMLDivElement>(null);
  const requestMounter = useRef<AppMounter | null>(null);
  const [answering, setAnswering] = useState<OpenRequest | null>(null);
  /** Notifications from the events service, by id; those raised in the browser by ctx.notify are not here. */
  const fromEvents = useRef(new Map<string, ServerNotification>());
  /** What each notification's buttons raise; the Shell only has their labels. */
  const actions = useRef(new NotificationActions());
  /** An action pressed on a notification from another floor: raised once that floor's catalogue has loaded. */
  const raiseOnArrival = useRef<{ floor: string; intent: Intent } | null>(null);
  /** Which floor the loaded catalogue is for. */
  const manifestFloor = useRef<string | undefined>(undefined);
  const prefs = useMemo(
    () =>
      new PreferenceSync(preferencesUrl, session.getToken, {
        fetchImpl,
        onError: (title) => shellRef.current?.notify(toShellNotification('platform', { title })),
      }),
    [preferencesUrl, session, fetchImpl],
  );

  const [manifest, setManifest] = useState<AppManifestEntry[] | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
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
  const floorId = (floor ?? home).id;
  useEffect(() => {
    let live = true;
    setProblem(null);
    session
      .getToken()
      .then((token) => loadManifest(fetchImpl, manifestUrl, token, floorId))
      .then((apps) => {
        if (!live) return;
        manifestFloor.current = floorId;
        setManifest(apps);
        if (!apps.length) setProblem({ title: 'No apps yet', summary: 'There are no apps you can open. Ask an admin to give you access to one.', retry: () => setAttempt((n) => n + 1) });
      })
      .catch((err: Error) => {
        if (!live) return;
        setManifest(null);
        setProblem({ title: 'Apps are unavailable', summary: err.message, retry: () => setAttempt((n) => n + 1) });
      });
    return () => {
      live = false;
    };
  }, [session, manifestUrl, fetchImpl, attempt, floorId]);

  const screen = useMemo(() => (manifest && floor ? screenFor(manifest, where.path) : undefined), [manifest, floor, where]);

  const raise = useCallback(
    async (intent: Intent) => {
      if (!manifest) return;
      try {
        routeIntent(manifest, intent, (app) => {
          pendingIntent.current = intent;
          navigate(hrefFor(app));
        });
      } catch (err) {
        if (!(err instanceof IntentError)) throw err;
        shellRef.current?.notify(toShellNotification('platform', { title: err.message }));
        throw err;
      }
    },
    [manifest, navigate],
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
        if (err instanceof IntentError) shellRef.current?.notify(toShellNotification('platform', { title: err.message }));
        return Promise.reject(err);
      }
      setAnswering(started.request);
      return (started.answer as Promise<T>).finally(() => setAnswering(null));
    },
    [manifest],
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
        shellRef.current?.notify(n);
      },
      workspace: floor ?? home,
      getWorkspace: () => floorRef.current,
      fetch: floorFetch(session.getToken, () => floorRef.current, fetchImpl),
      path,
      intent,
      reply,
    }),
    [session, bus, raise, request, floor, home, fetchImpl],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    const stage = requestStageRef.current;
    if (!dialog || !stage) return;
    requestMounter.current ??= new AppMounter(stage, importEntry);
    if (!answering) {
      dialog.close();
      void requestMounter.current.unmount();
      return;
    }
    const { app, intent } = answering;
    const reply: IntentReply = { respond: (result) => broker.current.respond(result), cancel: () => broker.current.cancel() };
    dialog.show();
    requestMounter.current.mount(app, contextFor(app, '/', intent, reply)).catch((err: Error) => {
      broker.current.cancel(new IntentError(`${app.name} didn't open: ${err.message}`));
    });
  }, [answering, contextFor, importEntry]);

  // Closing the dialog without an answer cancels the request.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      if (broker.current.current) broker.current.cancel();
    };
    dialog.addEventListener('ui-close', onClose);
    return () => dialog.removeEventListener('ui-close', onClose);
  }, []);

  // Mount whichever app the location points at; Title and Orbit are the shell's own.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !manifest) return;
    mounter.current ??= new AppMounter(stage, importEntry);
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
      setProblem(null);
      if (screen.kind === 'orbit') {
        shellRef.current?.setCurrent(screen.app.id);
        prefs.opened(screen.app.id);
      }
      return;
    }
    const { app, path } = screen;
    lastApp.current = app.id;
    const intent = pendingIntent.current;
    pendingIntent.current = undefined;
    const ctx = contextFor(app, path, intent);
    setProblem(null);
    shellRef.current?.setCurrent(app.id);
    prefs.opened(app.id);
    mounter.current.mount(app, ctx).catch((err: Error) => {
      setProblem({ title: `${app.name} didn't open`, summary: err.message, retry: () => setAttempt((n) => n + 1) });
    });
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
    void menu.updateComplete.then(() => menu.focus());
    const onSelect = (e: Event) => {
      const { item } = (e as CustomEvent<{ item: MenuItem }>).detail;
      if (screen.kind === 'orbit') return navigate(hrefFor(screen.app, item.id));
      const target = titleTarget(manifest, item);
      if (!target) return;
      lastApp.current = target.app.id;
      orbitStart.current = target.category;
      navigate(hrefFor(target.app));
    };
    const onBack = () => screen.kind === 'orbit' && navigate('/');
    menu.addEventListener('ui-select', onSelect);
    menu.addEventListener('ui-back', onBack);
    return () => {
      menu.removeEventListener('ui-select', onSelect);
      menu.removeEventListener('ui-back', onBack);
    };
  }, [manifest, screen, navigate]);

  // Esc that nothing else used goes back a step: from inside an app to its Orbit, then to Title.
  useEffect(() => {
    if (screen?.kind !== 'app') return;
    const back = backFrom(screen);
    if (!back) return;
    const onKey = (e: KeyboardEvent) => {
      if (shellRef.current?.isOpen || broker.current.current || !escapeIsFree(e)) return;
      e.preventDefault();
      orbitStart.current = categoryOf(screen.app, screen.path);
      navigate(back);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, navigate]);

  useEffect(() => {
    if (shellRef.current) shellRef.current.background = waterFor(screen);
  }, [screen]);

  useEffect(() => () => void mounter.current?.unmount(), []);

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
        shell.notify(fromServer(n));
      },
      onState: (state) => shell.setStream(state),
    });
    feed.current = f;
    f.start();
    return () => f.stop();
  }, [session, fetchImpl, eventsUrl]);

  // Hand the Shell its data and listen to what it asks for.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    shell.apps = (manifest ?? []).map(toShellApp);
    shell.user = { name: session.user.name, email: session.user.email };
    shell.floors = session.floors;
    shell.floor = floor?.id ?? '';
    shell.functions = alphaFunctions;
    shell.canSwitchWorkspace = false;
    shell.version = `${__SHELL_VERSION__} · SDK ${SDK_VERSION}`;
  }, [manifest, session, floor]);

  // What this person chose last time: motion, density, away, and the apps they used most recently.
  useEffect(() => {
    let live = true;
    void prefs.load().then((p) => {
      const shell = shellRef.current;
      if (!live || !shell) return;
      applyPreferences(p);
      shell.settings = { reduceMotion: !!p.reduceMotion, density: p.density ?? 'comfortable' };
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
    const onOpenNotification = (e: Event) => {
      const { id, app: appId } = (e as CustomEvent<{ notification: { id: string; app: string } }>).detail.notification;
      const server = fromEvents.current.get(id);
      if (server) {
        void feed.current?.setRead(id, true);
        shell.notifications = shell.notifications.filter((n) => n.id !== id);
      }
      const app = byId(appId);
      // One from another floor opens there, with the same move up or down; its app may not be on this floor's catalogue yet.
      const there = server?.workspace ? session.floors.find((f) => f.id === server.workspace!.id) : undefined;
      if (there && there.id !== floorRef.current.id) navigate(app ? hrefFor(app, server?.link) : '/', there);
      else if (app) navigate(hrefFor(app, server?.link));
    };
    // A button on a notification raises its intent, as the app would itself, and the notification is done with.
    const onAction = (e: Event) => {
      const { notification, index } = (e as CustomEvent<{ notification: { id: string }; index: number }>).detail;
      const intent = actions.current.intentFor(notification.id, index);
      if (!intent) return;
      const server = fromEvents.current.get(notification.id);
      if (server) void feed.current?.setRead(notification.id, true);
      shell.notifications = shell.notifications.filter((n) => n.id !== notification.id);
      actions.current.forget(notification.id);
      // One from another floor is done there, like opening it: the intent waits for that floor's apps.
      const there = server?.workspace ? session.floors.find((f) => f.id === server.workspace!.id) : undefined;
      if (there && there.id !== floorRef.current.id) {
        raiseOnArrival.current = { floor: there.id, intent };
        navigate('/', there);
      } else raise(intent).catch(() => undefined);
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
      if ((e as CustomEvent<{ id: string }>).detail.id === 'sign-out') void session.signOut();
    };
    const onSetting = (e: Event) => {
      const { key, value } = (e as CustomEvent<{ key: string; value: unknown }>).detail;
      if (key === 'reduceMotion' || key === 'away') prefs.set(key, !!value);
      else if (key === 'density') prefs.set('density', value === 'compact' ? 'compact' : 'comfortable');
      applyPreferences(prefs.current);
    };
    // Going to another floor keeps you in the same app, at its start; its menu or Title stay as they were.
    const onFloor = (e: Event) => {
      const to = session.floors.find((f) => f.id === (e as CustomEvent<{ id: string }>).detail.id);
      if (!to) return;
      navigate(screen && screen.kind !== 'title' ? hrefFor(screen.app) : '/', to);
    };
    const onFind = (e: Event) => {
      shell.findResults = findPages(manifest ?? [], (e as CustomEvent<{ q: string }>).detail.q);
    };
    const onPick = (e: Event) => {
      const { result } = (e as CustomEvent<{ result: ShellFindResult }>).detail;
      if (result.kind === 'page') navigate(result.id);
    };
    shell.addEventListener('ui-open-app', onOpenApp);
    shell.addEventListener('ui-open-notification', onOpenNotification);
    shell.addEventListener('ui-function', onFunction);
    shell.addEventListener('ui-setting', onSetting);
    shell.addEventListener('ui-find', onFind);
    shell.addEventListener('ui-floor', onFloor);
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
      shell.removeEventListener('ui-pick', onPick);
    };
  }, [manifest, navigate, session, prefs, screen, raise]);

  return (
    <ui-shell ref={shellRef} product="Platform">
      <div ref={stageRef} className="stage" hidden={screen?.kind !== 'app'} />
      {screen && screen.kind !== 'app' && manifest?.length ? (
        <ui-centre-menu
          key={screen.kind === 'orbit' ? `orbit:${screen.app.id}` : 'title'}
          ref={menuRef}
          variant={screen.kind}
          label={screen.kind === 'orbit' ? `${screen.app.name} menu` : 'Apps'}
        />
      ) : null}
      {problem && (
        <section className="problem" role="alert">
          <ui-heading heading={problem.title} summary={problem.summary} size="s" />
          <ui-button kind="secondary" onClick={problem.retry}>
            {problem.action ?? 'Try again'}
          </ui-button>
        </section>
      )}
      {!manifest && !problem && <p className="loading">Opening…</p>}
      <ui-dialog ref={dialogRef} size="read" heading={answering?.app.name ?? ''} cancelLabel="Cancel">
        <div ref={requestStageRef} className="request-stage" />
      </ui-dialog>
    </ui-shell>
  );
}

/** Shown in place of the platform when signing in did not work. */
export function SignInProblem({ message, onSignIn }: { message: string; onSignIn: () => void }) {
  return (
    <main className="sign-in-problem" role="alert">
      <ui-heading heading="You're not signed in" summary={message} size="m" />
      <ui-button kind="primary" onClick={onSignIn}>
        Sign in
      </ui-button>
    </main>
  );
}
