/**
 * The brakes on an app's inbound part (contract 3, spec 7.5): a connect timeout and a response timeout on every
 * call to it, and a cap on how many calls one app has in flight. Platform routes are never affected: a slow or
 * flooded app can't hold the gateway's connections to AUGUR's own services.
 */

export interface AppLimits {
  /** How long the gateway waits to connect to a part before answering 502. */
  connectTimeoutMs: number;
  /** How long a part may take to answer before the gateway answers 504 and lets the connection go. */
  responseTimeoutMs: number;
  /** How many calls one app may have in flight before the next answers 503. */
  concurrentCalls: number;
}

export const DEFAULT_APP_LIMITS: AppLimits = { connectTimeoutMs: 5_000, responseTimeoutMs: 60_000, concurrentCalls: 64 };

/** The settings that change the defaults. */
export const APP_LIMIT_SETTINGS = { connectTimeoutMs: 'APP_CONNECT_TIMEOUT_MS', responseTimeoutMs: 'APP_RESPONSE_TIMEOUT_MS', concurrentCalls: 'APP_CONCURRENT_CALLS' } as const;

const positive = (raw: string | undefined, fallback: number) => {
  const n = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export const appLimitsFromEnv = (env = process.env): AppLimits => ({
  connectTimeoutMs: positive(env[APP_LIMIT_SETTINGS.connectTimeoutMs], DEFAULT_APP_LIMITS.connectTimeoutMs),
  responseTimeoutMs: positive(env[APP_LIMIT_SETTINGS.responseTimeoutMs], DEFAULT_APP_LIMITS.responseTimeoutMs),
  concurrentCalls: positive(env[APP_LIMIT_SETTINGS.concurrentCalls], DEFAULT_APP_LIMITS.concurrentCalls),
});

/** Counts the calls each app has in flight. */
export class InFlight {
  private readonly counts = new Map<string, number>();
  constructor(private readonly cap: number) {}

  /** Takes a slot for `app`; false when it is at its cap. */
  take(app: string): boolean {
    const n = this.counts.get(app) ?? 0;
    if (n >= this.cap) return false;
    this.counts.set(app, n + 1);
    return true;
  }

  release(app: string) {
    const n = (this.counts.get(app) ?? 1) - 1;
    if (n <= 0) this.counts.delete(app);
    else this.counts.set(app, n);
  }

  of(app: string): number {
    return this.counts.get(app) ?? 0;
  }
}

const TIMED_OUT = new Set(['FST_REPLY_FROM_GATEWAY_TIMEOUT', 'FST_REPLY_FROM_TIMEOUT', 'FST_REPLY_FROM_HTTP_REQUEST_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);
const UNREACHED = new Set(['UND_ERR_CONNECT_TIMEOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'UND_ERR_SOCKET', 'FST_REPLY_FROM_SERVICE_UNAVAILABLE']);

/** The error's code and its causes', outermost first: reply-from wraps undici's errors and keeps the original as `cause`. */
const codesOf = (err: unknown): string[] => {
  const codes: string[] = [];
  for (let e: unknown = err, depth = 0; e && typeof e === 'object' && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string') codes.push(code);
  }
  return codes;
};

/** What an upstream error means at an app's door (spec 7.5); undefined for anything else, which answers as before. */
export const appFailure = (err: Error, appName: string): { status: 502 | 504; message: string } | undefined => {
  const codes = codesOf(err);
  if (codes.some((c) => TIMED_OUT.has(c))) return { status: 504, message: `${appName} didn’t answer in time.` };
  if (codes.some((c) => UNREACHED.has(c))) return { status: 502, message: `${appName} isn’t answering right now.` };
  return undefined;
};

/**
 * The gateway's own budget for AUGUR's services. Every open tab holds the events service's streams, so they get a pool
 * of their own and can never take the connections the events service's other calls need (design review RES-2). Calls
 * to a service also have a deadline, kept above each service's own (the model gateway's three minutes, for one), so a
 * service's own words reach the caller first and the gateway's 504 is only the backstop for one that has stopped.
 */
export interface PlatformLimits {
  /** How long the gateway waits to connect to one of AUGUR's services before answering 502. */
  connectTimeoutMs: number;
  /** How long a service may take to start answering, and between one piece of its answer and the next, before the gateway answers 504. Never applies to an open stream. */
  responseTimeoutMs: number;
  /** How many connections the gateway keeps to each of AUGUR's services for ordinary calls. */
  connections: number;
  /** How many open streams the gateway holds to the events service, apart from its ordinary calls. */
  streamConnections: number;
}

export const DEFAULT_PLATFORM_LIMITS: PlatformLimits = { connectTimeoutMs: 5_000, responseTimeoutMs: 200_000, connections: 128, streamConnections: 4_096 };

/** The settings that change the defaults. */
export const PLATFORM_LIMIT_SETTINGS = {
  connectTimeoutMs: 'PLATFORM_CONNECT_TIMEOUT_MS',
  responseTimeoutMs: 'PLATFORM_RESPONSE_TIMEOUT_MS',
  connections: 'PLATFORM_CONNECTIONS',
  streamConnections: 'PLATFORM_STREAM_CONNECTIONS',
} as const;

export const platformLimitsFromEnv = (env = process.env): PlatformLimits => ({
  connectTimeoutMs: positive(env[PLATFORM_LIMIT_SETTINGS.connectTimeoutMs], DEFAULT_PLATFORM_LIMITS.connectTimeoutMs),
  responseTimeoutMs: positive(env[PLATFORM_LIMIT_SETTINGS.responseTimeoutMs], DEFAULT_PLATFORM_LIMITS.responseTimeoutMs),
  connections: positive(env[PLATFORM_LIMIT_SETTINGS.connections], DEFAULT_PLATFORM_LIMITS.connections),
  streamConnections: positive(env[PLATFORM_LIMIT_SETTINGS.streamConnections], DEFAULT_PLATFORM_LIMITS.streamConnections),
});

/** The events service's streams: each is its own route at the gateway, with its own pool. */
export const EVENT_STREAMS = ['/v1/notifications/stream', '/v1/domain-events/stream'];

/** What each of AUGUR's services is called in a refusal. */
const SERVICE_WORDS: Record<string, string> = {
  identity: 'AUGUR’s identity service',
  registry: 'AUGUR’s registry',
  events: 'AUGUR’s events service',
  models: 'AUGUR’s model gateway',
  knowledge: 'AUGUR’s knowledge graph',
  permissions: 'AUGUR’s permissions service',
};

/** What an upstream error means at the door of one of AUGUR's services; undefined for anything else. */
export const platformFailure = (err: Error, service: string) => appFailure(err, SERVICE_WORDS[service] ?? `AUGUR’s ${service} service`);

/** The undici pool options for one of AUGUR's services: ordinary calls, or the events service's open streams. */
export const platformPoolOptions = (limits: PlatformLimits, kind: 'calls' | 'streams') =>
  kind === 'streams'
    ? // A stream waits for its first answer like any call, then stays open for as long as the tab does.
      { connections: limits.streamConnections, connect: { timeout: limits.connectTimeoutMs }, headersTimeout: limits.responseTimeoutMs, bodyTimeout: 0 }
    : { connections: limits.connections, connect: { timeout: limits.connectTimeoutMs }, headersTimeout: limits.responseTimeoutMs, bodyTimeout: limits.responseTimeoutMs };

/** The undici pool options that hold a part to its timeouts. */
export const poolOptions = (limits: AppLimits) => ({
  connect: { timeout: limits.connectTimeoutMs },
  headersTimeout: limits.responseTimeoutMs,
  bodyTimeout: limits.responseTimeoutMs,
});
