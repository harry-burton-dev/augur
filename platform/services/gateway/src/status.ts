import type { Upstreams } from './app.ts';

/** What the platform is made of, as admins see it on Status. */
export type ComponentKind = 'gateway' | 'service' | 'app' | 'sign-in';

/** `up` answers in time, `slow` answers late, `down` failed its last check or has gone quiet, `checking` has not been checked yet. */
export type ComponentState = 'up' | 'slow' | 'down' | 'checking';

export interface ComponentStatus {
  name: string;
  kind: ComponentKind;
  state: ComponentState;
  /** What `/healthz` said is deployed. */
  version?: string;
  api?: string;
  /** How long the last answer took. */
  latencyMs?: number;
  /** When it was last checked, and when it last answered. */
  checkedAt?: string;
  seenAt?: string;
  /** Why the last check failed, in words an admin can act on. */
  problem?: string;
}

export interface Probe {
  name: string;
  kind: ComponentKind;
  url: string;
}

export interface MonitorOptions {
  probes: Probe[];
  /** How often every probe is checked. */
  intervalMs?: number;
  /** How long one check may take before it counts as failed. */
  timeoutMs?: number;
  /** An answer slower than this is `slow`. */
  slowMs?: number;
  /** With no answer for this long, a component is `down`. */
  staleMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface Seen {
  checkedAt?: number;
  seenAt?: number;
  latencyMs?: number;
  version?: string;
  api?: string;
  problem?: string;
}

/** The probes for a gateway: its upstreams' `/healthz`, and the sign-in service's signing keys. */
export const probesFor = (upstreams: Upstreams, platform: string[], signInUrl?: string): Probe[] => [
  ...Object.entries(upstreams).map(([name, url]) => ({
    name,
    kind: (platform.includes(name) ? 'service' : 'app') as ComponentKind,
    url: `${url.replace(/\/$/, '')}/healthz`,
  })),
  ...(signInUrl ? [{ name: 'sign-in', kind: 'sign-in' as const, url: signInUrl }] : []),
];

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

/**
 * Checks every part of the platform on a timer and keeps the last answer, so
 * Status never waits on a slow service. A component with no answer for
 * `staleMs` reads down, even if the last check is still in flight.
 */
export class HealthMonitor {
  private readonly probes: Probe[];
  private readonly intervalMs: number;
  private readonly timeoutMs: number;
  private readonly slowMs: number;
  private readonly staleMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly seen = new Map<string, Seen>();
  private timer?: ReturnType<typeof setInterval>;
  private readonly startedAt: number;

  constructor({ probes, intervalMs = 30_000, timeoutMs = 5_000, slowMs = 2_000, staleMs = 120_000, fetchImpl = (...a) => fetch(...a), now = Date.now }: MonitorOptions) {
    this.probes = probes;
    this.intervalMs = intervalMs;
    this.timeoutMs = timeoutMs;
    this.slowMs = slowMs;
    this.staleMs = staleMs;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.startedAt = now();
  }

  start() {
    if (this.timer) return;
    void this.checkAll();
    this.timer = setInterval(() => void this.checkAll(), this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async checkAll(): Promise<void> {
    await Promise.all(this.probes.map((p) => this.check(p)));
  }

  private async check(probe: Probe): Promise<void> {
    const started = this.now();
    const was = this.seen.get(probe.name) ?? {};
    try {
      const res = await this.fetchImpl(probe.url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!res.ok) throw new Error(`It answered ${res.status}.`);
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const at = this.now();
      this.seen.set(probe.name, { checkedAt: at, seenAt: at, latencyMs: at - started, version: str(body.version), api: str(body.api) });
    } catch (err) {
      const timedOut = (err as Error).name === 'TimeoutError';
      const problem = timedOut ? `It didn’t answer within ${this.timeoutMs / 1000} seconds.` : (err as Error).message.startsWith('It answered') ? (err as Error).message : 'It can’t be reached.';
      this.seen.set(probe.name, { ...was, checkedAt: this.now(), problem });
    }
  }

  /** Every component as it stands now, the gateway first. */
  snapshot(gateway: { version: string; api: string }): ComponentStatus[] {
    const now = this.now();
    const iso = (t?: number) => (t === undefined ? undefined : new Date(t).toISOString());
    const rows = this.probes.map((p): ComponentStatus => {
      const s = this.seen.get(p.name) ?? {};
      const quiet = s.seenAt === undefined ? now - this.startedAt >= this.staleMs : now - s.seenAt >= this.staleMs;
      const state: ComponentState = s.problem || (quiet && s.seenAt !== undefined) ? 'down' : s.seenAt === undefined ? (quiet ? 'down' : 'checking') : (s.latencyMs ?? 0) > this.slowMs ? 'slow' : 'up';
      const problem = s.problem ?? (state === 'down' ? `It hasn’t answered for ${Math.round(this.staleMs / 60_000)} minutes.` : undefined);
      return {
        name: p.name,
        kind: p.kind,
        state,
        ...(s.version ? { version: s.version } : {}),
        ...(s.api ? { api: s.api } : {}),
        ...(s.latencyMs !== undefined ? { latencyMs: s.latencyMs } : {}),
        ...(s.checkedAt !== undefined ? { checkedAt: iso(s.checkedAt) } : {}),
        ...(s.seenAt !== undefined ? { seenAt: iso(s.seenAt) } : {}),
        ...(problem ? { problem } : {}),
      };
    });
    return [{ name: 'gateway', kind: 'gateway', state: 'up', version: gateway.version, api: gateway.api, checkedAt: iso(now), seenAt: iso(now) }, ...rows];
  }
}
