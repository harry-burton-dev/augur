import { createEventBus, type AppManifestEntry, type Intent, type MountContext } from '@platform/mfe-sdk';
import type { ShellApp, UiShell } from '@platform/ui-kit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppMounter,
  hrefFor,
  IntentError,
  loadManifest,
  matchRoute,
  routeIntent,
  toShellNotification,
  type ImportEntry,
  type Session,
} from './host/index.js';

export interface HostProps {
  session: Session;
  /** Where the registry manifest is served, through the gateway. */
  manifestUrl?: string;
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
export function Host({ session, manifestUrl = '/api/registry/manifest', fetchImpl = fetch, importEntry }: HostProps) {
  const shellRef = useRef<UiShell>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const mounter = useRef<AppMounter | null>(null);
  const bus = useMemo(() => createEventBus(), []);
  const pendingIntent = useRef<Intent | undefined>(undefined);

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
    const ctx: MountContext = {
      user: session.user,
      getToken: session.getToken,
      bus,
      raise,
      notify: (message) => shellRef.current?.notify(toShellNotification(app.id, message)),
      path,
      intent,
    };
    setProblem(null);
    shellRef.current?.setCurrent(app.id);
    mounter.current.mount(app, ctx).catch((err: Error) => {
      setProblem({ title: `${app.name} didn't open`, summary: err.message, retry: () => setAttempt((n) => n + 1) });
    });
  }, [manifest, match, attempt, bus, raise, session, importEntry, navigate, pathname]);

  useEffect(() => () => void mounter.current?.unmount(), []);

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
      const app = byId((e as CustomEvent<{ notification: { app: string } }>).detail.notification.app);
      if (app) navigate(hrefFor(app));
    };
    const onFunction = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail.id === 'sign-out') void session.signOut();
    };
    shell.addEventListener('ui-open-app', onOpenApp);
    shell.addEventListener('ui-open-notification', onOpenNotification);
    shell.addEventListener('ui-function', onFunction);
    return () => {
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
