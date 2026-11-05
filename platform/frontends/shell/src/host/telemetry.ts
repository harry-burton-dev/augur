/**
 * Browser errors and traces (ADR 0059): Grafana Faro, started once someone is signed in and only when the
 * gateway says this deployment collects them. The shell hosts every app, so this one hook catches errors
 * from all of them, and says which app each came from and its version. It sends OTLP through the gateway
 * with the person's own token, so nothing reaches the collector from someone not signed in.
 *
 * Nothing that names a person is sent: Faro isn't told who is signed in, and page URLs lose their query
 * and fragment. The gateway takes out the same again on the way through.
 */

/** Where the shell asks whether to send, and where it sends. */
export const TELEMETRY_URL = '/api/gateway/v1/telemetry';

/** An app as the shell knows it: enough to say which one an error came from. */
export interface AppRef {
  id: string;
  version: string;
}

/** The app on screen now, or none: an error with no app of its own in its stack is put down to it. */
let onScreen: AppRef | null = null;

/** Tells telemetry which app is on screen. Costs nothing when telemetry is off. */
export const appOnScreen = (app: AppRef | null) => {
  onScreen = app ? { id: app.id, version: app.version } : null;
};

/** Apps' frontends are served by version, at /apps/<id>/<version>/ (docs/ship-an-app.md). */
const APP_PATH = /\/apps\/([a-z0-9][a-z0-9-]*)\/(\d+\.\d+\.\d+[^/]*)\//;

/** The app a script URL belongs to, by the path every app's frontend is served at. */
export const appFromUrl = (url: string | undefined): AppRef | undefined => {
  const m = url ? APP_PATH.exec(url) : null;
  return m ? { id: m[1], version: decodeURIComponent(m[2]) } : undefined;
};

/** The innermost app frame in a stack: where the error was thrown, as near as the stack says. */
export const appFromFrames = (frames: { filename?: string }[] | undefined): AppRef | undefined => {
  for (const frame of frames ?? []) {
    const app = appFromUrl(frame.filename);
    if (app) return app;
  }
  return undefined;
};

/** A URL without its query and fragment, which may carry ids or search words. */
export const plainUrl = (url: string) => url.replace(/[?#].*$/, '');

/** The parts of a Faro transport item this file reads and changes. */
export interface Item {
  type: string;
  payload: { stacktrace?: { frames?: { filename?: string }[] }; context?: Record<string, string>; [k: string]: unknown };
  meta: { page?: { url?: string; [k: string]: unknown }; user?: unknown; view?: { name: string }; [k: string]: unknown };
}

/**
 * What Faro calls before each send: an exception is put down to the app in its stack, or else the app on
 * screen, or else the shell; and every item loses anything naming a person.
 */
export const beforeSend =
  (onScreen: () => AppRef | null) =>
  <T extends Item>(item: T): T => {
    const meta = { ...item.meta, ...(item.meta.page?.url ? { page: { ...item.meta.page, url: plainUrl(item.meta.page.url) } } : {}) };
    delete meta.user;
    if (item.type !== 'exception') return { ...item, meta };
    const app = appFromFrames(item.payload.stacktrace?.frames) ?? onScreen();
    const context = { ...item.payload.context, ...(app ? { app: app.id, 'app.version': app.version } : { app: 'shell' }) };
    return { ...item, meta, payload: { ...item.payload, context } };
  };

/** Whether this deployment collects browser telemetry, as the gateway says. Off when it can't be asked. */
export async function telemetryOn(token: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(TELEMETRY_URL, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
    if (!res.ok) return false;
    return ((await res.json()) as { on?: unknown }).on === true;
  } catch {
    return false;
  }
}

export interface StartOptions {
  getToken(): Promise<string>;
  /** The shell's own version. */
  version: string;
  fetchImpl?: typeof fetch;
  /** Starts Faro; a test stands in for it. By default Faro is loaded only now, so it never delays the first screen. */
  start?: (config: FaroStart) => Promise<void>;
}

/** What starting Faro needs from the shell. */
export interface FaroStart {
  version: string;
  logsURL: string;
  tracesURL: string;
  authorization: () => Promise<string>;
  beforeSend: ReturnType<typeof beforeSend>;
}

/** Loads Faro and starts it, sending OTLP to the gateway. */
const startFaro = async ({ version, logsURL, tracesURL, authorization, beforeSend: hook }: FaroStart) => {
  const [{ initializeFaro, getWebInstrumentations }, { TracingInstrumentation }, { OtlpHttpTransport }] = await Promise.all([
    import('@grafana/faro-web-sdk'),
    import('@grafana/faro-web-tracing'),
    import('@grafana/faro-transport-otlp-http'),
  ]);
  initializeFaro({
    app: { name: 'augur-shell', version },
    transports: [new OtlpHttpTransport({ logsURL, tracesURL, requestOptions: { headers: { authorization } } })],
    instrumentations: [
      // Console lines are apps' own business, and the browser's performance entries are many: errors, views and web vitals only.
      ...getWebInstrumentations({ captureConsole: false, enablePerformanceInstrumentation: false }),
      // Each call a page makes gets a trace that the services carry on (traceparent), on this site only.
      new TracingInstrumentation(),
    ],
    // Its own sends aren't traced, or each one would make another.
    ignoreUrls: [new RegExp(`${TELEMETRY_URL}/`)],
    preventGlobalExposure: true,
    beforeSend: hook as never,
  });
};

/**
 * Starts browser telemetry when the deployment collects it. Never throws and never blocks: a page that
 * can't send telemetry works exactly as one that can.
 */
export async function startTelemetry({ getToken, version, fetchImpl = fetch, start = startFaro }: StartOptions): Promise<boolean> {
  try {
    if (!(await telemetryOn(await getToken(), fetchImpl))) return false;
    await start({
      version,
      logsURL: `${TELEMETRY_URL}/v1/logs`,
      tracesURL: `${TELEMETRY_URL}/v1/traces`,
      authorization: async () => `Bearer ${await getToken()}`,
      beforeSend: beforeSend(() => onScreen),
    });
    return true;
  } catch {
    return false;
  }
}
