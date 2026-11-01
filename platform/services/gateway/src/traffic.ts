/**
 * How the gateway's calls have been answering lately, for the updater's watch after an upgrade
 * (ADR 0020): requests and server errors (5xx) in each of the last minutes. Kept in memory, so it
 * starts again when the gateway does. GET /traffic is reachable only inside the deployment's network:
 * the front door (nginx) sends only /api/ to the gateway.
 */
export const TRAFFIC_PATH = '/traffic';
/** How many minutes are kept. */
export const TRAFFIC_MINUTES = 15;

interface Minute {
  at: number;
  requests: number;
  serverErrors: number;
}

export class Traffic {
  private minutes: Minute[] = [];
  private readonly startedAt: number;

  constructor(private readonly now: () => number = Date.now) {
    this.startedAt = now();
  }

  /** Counts one answered call. */
  record(statusCode: number) {
    const at = Math.floor(this.now() / 60_000);
    let minute = this.minutes.at(-1);
    if (minute?.at !== at) {
      minute = { at, requests: 0, serverErrors: 0 };
      this.minutes = [...this.minutes.filter((m) => m.at > at - TRAFFIC_MINUTES), minute];
    }
    minute.requests += 1;
    if (statusCode >= 500) minute.serverErrors += 1;
  }

  /** The calls answered in the last `minutes` (this one included), and since when the gateway counted. */
  snapshot(minutes = 5) {
    const span = Math.min(Math.max(1, Math.floor(minutes)), TRAFFIC_MINUTES);
    const from = Math.floor(this.now() / 60_000) - span + 1;
    const kept = this.minutes.filter((m) => m.at >= from);
    return {
      minutes: span,
      requests: kept.reduce((n, m) => n + m.requests, 0),
      serverErrors: kept.reduce((n, m) => n + m.serverErrors, 0),
      countingSince: new Date(this.startedAt).toISOString(),
    };
  }
}
