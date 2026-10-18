import { createEventBus, type AppManifestEntry, type Intent, type IntentReply, type MountContext } from '@platform/mfe-sdk';
import type { ShellApp, UiDialog, UiShell } from '@platform/ui-kit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppMounter,
  fromServer,
  hrefFor,
  IntentError,
  loadManifest,
  matchRoute,
  NotificationFeed,
  RequestBroker,
  routeIntent,
  toShellNotification,
  type ImportEntry,
  type OpenRequest,
  type ServerNotification,
  type Session,
} from './host/index.js';

export interface HostProps {
  session: Session;
  /** Where the registry manifest is served, through the gateway. */
  manifestUrl?: string;
  /** Where the events service is reached, through the gateway. */
  eventsUrl?: string;
  fetchImpl?: typeof fetch;
  importEntry?: ImportEntry;
}

type Problem = { title: string; summary: string; retry: () => void };

const toShellApp = (a: AppManifestEntry): ShellApp => ({ id: a.id, name: a.name, line: a.description, icon: a.icon ?? 'apps' });

/**
 * The platform's frame. It owns the Shell, the catalogue of apps, which app is
 * open and the routing of intents between apps; it knows nothing about what
 * any app does.
 */
export function Host({ session, manifestUrl = '/api/registry/manifest', eventsUrl = '/api/events', fetchImpl = fetch, importEntry }: HostProps) {
  const shellRef = useRef<UiShell>(null);
  const stageRef = useRef<HTMLDivElement>(null);
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

  const [manifest, setManifest] = useState<AppManifestEntry[] | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [attempt, setAttempt] = useState(0);

  const navigate = useCallback((href: string) => {
    if (href !== window.location.pathname) window.history.pushState(null, '', href);
    setPathname(window.location.pathname);
  }, []);

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // The catalogue: which apps this person can open.
  useEffect(() => {
    let live = true;
    setProblem(null);
    session
      .getToken()
      .then((token) => loadManifest(fetchImpl, manifestUrl, token))
      .then((apps) => live && setManifest(apps))
      .catch((err: Error) => {
        if (!live) return;
        setManifest(null);
        setProblem({ title: 'Apps are unavailable', summary: err.message, retry: () => setAttempt((n) => n + 1) });
      });
    return () => {
      live = false;
    };
  }, [session, manifestUrl, fetchImpl, attempt]);

  const match = useMemo(() => (manifest ? matchRoute(manifest, pathname) : undefined), [manifest, pathname]);

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

  const contextFor = useCallback(
    (app: AppManifestEntry, path: string, intent?: Intent, reply?: IntentReply): MountContext => ({
      user: session.user,
      getToken: session.getToken,
      bus,
      raise,
      request,
      notify: (message) => shellRef.current?.notify(toShellNotification(app.id, message)),
      path,
      intent,
      reply,
    }),
    [session, bus, raise, request],
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

  // Mount whichever app the location points at.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !manifest) return;
    mounter.current ??= new AppMounter(stage, importEntry);
    if (!match) {
      void mounter.current.unmount();
      setProblem({ title: 'Nothing here', summary: `No app you can open lives at ${pathname}.`, retry: () => navigate('/') });
      return;
    }
    const { app, path } = match;
    const intent = pendingIntent.current;
    pendingIntent.current = undefined;
    const ctx = contextFor(app, path, intent);
    setProblem(null);
    shellRef.current?.setCurrent(app.id);
    mounter.current.mount(app, ctx).catch((err: Error) => {
      setProblem({ title: `${app.name} didn't open`, summary: err.message, retry: () => setAttempt((n) => n + 1) });
    });
  }, [manifest, match, attempt, contextFor, importEntry, navigate, pathname]);

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
        list.forEach((n) => known.set(n.id, n));
        const local = shell.notifications.filter((n) => !known.has(n.id));
        shell.notifications = [...list.map(fromServer), ...local];
      },
      onNotification: (n) => {
        known.set(n.id, n);
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
    shell.workspace = session.workspace;
  }, [manifest, session]);

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
      if (app) navigate(hrefFor(app, server?.link));
    };
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
    shell.addEventListener('ui-open-app', onOpenApp);
    shell.addEventListener('ui-open-notification', onOpenNotification);
    shell.addEventListener('ui-function', onFunction);
    shell.addEventListener('ui-dismiss', onDismiss);
    shell.addEventListener('ui-restore', onRestore);
    shell.addEventListener('ui-retry', onRetry);
    return () => {
      shell.removeEventListener('ui-dismiss', onDismiss);
      shell.removeEventListener('ui-restore', onRestore);
      shell.removeEventListener('ui-retry', onRetry);
      shell.removeEventListener('ui-open-app', onOpenApp);
      shell.removeEventListener('ui-open-notification', onOpenNotification);
      shell.removeEventListener('ui-function', onFunction);
    };
  }, [manifest, navigate, session]);

  return (
    <ui-shell ref={shellRef} product="Platform">
      <div ref={stageRef} className="stage" />
      {problem && (
        <section className="problem" role="alert">
          <ui-heading heading={problem.title} summary={problem.summary} size="s" />
          <ui-button kind="secondary" onClick={problem.retry}>
            Try again
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
