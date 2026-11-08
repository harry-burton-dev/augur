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

/** The undici pool options that hold a part to its timeouts. */
export const poolOptions = (limits: AppLimits) => ({
  connect: { timeout: limits.connectTimeoutMs },
  headersTimeout: limits.responseTimeoutMs,
  bodyTimeout: limits.responseTimeoutMs,
});
