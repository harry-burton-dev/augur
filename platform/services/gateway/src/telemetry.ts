/**
 * Browser telemetry (ADR 0059): the shell's Faro sends OTLP/HTTP JSON logs and traces here, signed in and
 * on the same site, and the gateway passes them on to the deployment's collector (ADR 0034). The gateway,
 * not the browser, says what the records are: every resource is stamped `service.name=augur-browser` with
 * the deployment's own attributes, so a browser can't pass itself off as a service. Anything that could
 * name a person is taken out on the way through.
 */

/** What the browser's records are called in the collector. */
export const BROWSER_SERVICE = 'augur-browser';
/** The most one send may carry. Faro batches a few records at a time. */
export const TELEMETRY_BODY_LIMIT = 256 * 1024;
/** How many sends one person may make a minute; more are refused until the minute is out. */
export const TELEMETRY_SENDS_PER_MINUTE = 60;
const FORWARD_TIMEOUT_MS = 5_000;

export type Signal = 'logs' | 'traces';

export interface BrowserTelemetry {
  on: boolean;
  /** Why it is off, and who can change that. */
  why?: string;
  /** The collector's base URL, without /v1/<signal>. */
  endpoint?: string;
  headers?: Record<string, string>;
  /** The deployment's own resource attributes (OTEL_RESOURCE_ATTRIBUTES), stamped on every browser record. */
  resource?: Record<string, string>;
}

/** "a=1,b=x%20y" → { a: '1', b: 'x y' }, as the OTEL_* settings write them. */
export const parsePairs = (spec = ''): Record<string, string> =>
  Object.fromEntries(
    spec
      .split(',')
      .map((pair) => {
        const at = pair.indexOf('=');
        return at < 1 ? [] : [decodeURIComponent(pair.slice(0, at).trim()), decodeURIComponent(pair.slice(at + 1).trim())];
      })
      .filter((p) => p.length === 2 && p[0]),
  );

/** On when the deployment names a collector. */
export function browserTelemetryFrom(env: NodeJS.ProcessEnv = process.env): BrowserTelemetry {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/+$/, '');
  if (!endpoint) return { on: false, why: 'Browser errors aren’t collected here: no collector is named (OTEL_EXPORTER_OTLP_ENDPOINT in the deployment’s .env, docs/observability.md). A deployment admin can change that.' };
  if (/^true$/i.test(env.OTEL_SDK_DISABLED?.trim() ?? '')) return { on: false, why: 'Browser errors aren’t collected here: telemetry is turned off (OTEL_SDK_DISABLED in the deployment’s .env, docs/observability.md). A deployment admin can change that.' };
  const { 'service.name': _, 'service.version': __, ...resource } = parsePairs(env.OTEL_RESOURCE_ATTRIBUTES);
  return { on: true, endpoint, headers: parsePairs(env.OTEL_EXPORTER_OTLP_HEADERS), resource };
}

interface KeyValue {
  key: string;
  value?: Record<string, unknown>;
}
interface Resourced {
  resource?: { attributes?: KeyValue[] };
  [scope: string]: unknown;
}

const str = (stringValue: string) => ({ stringValue });
/** Attributes that could name a person: Faro sets them when told who is signed in. The shell never does, and they go anyway. */
const PERSONAL = /^(user\.|enduser\.|faro\.user|client\.address|user_agent\.original)/;
const URL_KEYS = new Set(['url.full', 'page.url', 'http.url']);

/** A URL without its query and fragment, which may carry ids or search words. */
const plainUrl = (value: unknown) => {
  if (typeof value !== 'string') return value;
  return value.replace(/[?#].*$/, '');
};

const scrub = (attributes: unknown): KeyValue[] | undefined => {
  if (!Array.isArray(attributes)) return undefined;
  return (attributes as KeyValue[])
    .filter((a) => a && typeof a.key === 'string' && !PERSONAL.test(a.key))
    .map((a) => (URL_KEYS.has(a.key) && a.value && 'stringValue' in a.value ? { key: a.key, value: str(String(plainUrl(a.value.stringValue))) } : a));
};

/** Every record's attributes scrubbed, at any depth the OTLP shape puts them (records, spans, events). */
const scrubRecords = (node: unknown): void => {
  if (Array.isArray(node)) return node.forEach(scrubRecords);
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if (Array.isArray(o.attributes)) o.attributes = scrub(o.attributes);
  for (const [k, v] of Object.entries(o)) if (k !== 'attributes' && typeof v === 'object') scrubRecords(v);
};

/** The top-level list a signal's body holds: resourceLogs or resourceSpans. */
const listOf = (signal: Signal) => (signal === 'logs' ? 'resourceLogs' : 'resourceSpans');

/**
 * The body as it goes to the collector: each resource keeps what the browser said of itself (browser,
 * SDK, its version as `augur.shell.version`), loses anything personal, and is stamped as the gateway says.
 * Undefined when it isn't an OTLP body of that signal at all.
 */
export function stamped(body: unknown, signal: Signal, resource: Record<string, string> = {}): Record<string, unknown> | undefined {
  const list = (body as Record<string, unknown> | null)?.[listOf(signal)];
  if (!Array.isArray(list)) return undefined;
  const out = (list as Resourced[]).map((r) => {
    if (!r || typeof r !== 'object') return undefined;
    const own = (scrub(r.resource?.attributes) ?? []).filter((a) => a.key !== 'service.name' && !(a.key in resource) && a.key !== 'service.instance.id' && !a.key.startsWith('deployment.'));
    // The shell's version stays, under a name that can't be mistaken for a service's.
    const version = own.find((a) => a.key === 'service.version');
    const kept = own.filter((a) => a.key !== 'service.version');
    const attributes: KeyValue[] = [
      { key: 'service.name', value: str(BROWSER_SERVICE) },
      ...Object.entries(resource).map(([key, value]) => ({ key, value: str(value) })),
      ...(version ? [{ key: 'augur.shell.version', value: version.value }] : []),
      ...kept,
    ];
    const { resource: _, ...rest } = r;
    scrubRecords(rest);
    return { ...rest, resource: { attributes } };
  });
  if (out.some((r) => r === undefined)) return undefined;
  return { [listOf(signal)]: out };
}

/** Sends one person may make, counted per minute. Kept in memory: it only has to stop one tab looping. */
export class SendLimit {
  private minute = -1;
  private counts = new Map<string, number>();

  constructor(
    private readonly perMinute = TELEMETRY_SENDS_PER_MINUTE,
    private readonly now: () => number = Date.now,
  ) {}

  /** True when this send is within the limit, and counts it. */
  take(who: string): boolean {
    const minute = Math.floor(this.now() / 60_000);
    if (minute !== this.minute) {
      this.minute = minute;
      this.counts.clear();
    }
    const n = (this.counts.get(who) ?? 0) + 1;
    this.counts.set(who, n);
    return n <= this.perMinute;
  }
}

export class ForwardFailed extends Error {}

/** Passes a stamped body on to the collector, as the services' own exporters would. */
export async function forward(telemetry: BrowserTelemetry, signal: Signal, body: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<void> {
  let res: Response;
  try {
    res = await fetchImpl(`${telemetry.endpoint}/v1/${signal}`, {
      method: 'POST',
      headers: { ...telemetry.headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
  } catch (err) {
    throw new ForwardFailed(`The collector can’t be reached: ${(err as Error).message}`);
  }
  // Drained, so the connection can be used again.
  await res.arrayBuffer().catch(() => undefined);
  if (!res.ok) throw new ForwardFailed(`The collector answered ${res.status}.`);
}
