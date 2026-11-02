/**
 * How the gateway's calls have been answering lately, for the updater's watch after an upgrade
 * (ADR 0020): requests and server errors (5xx) in each of the last minutes. Kept in memory, so it
 * starts again when the gateway does. GET /traffic is reachable only inside the deployment's network:
 * the front door (nginx) sends only /api/ to the gateway.
 *
 * AUGUR's own services and apps are counted apart, so the watch can judge AUGUR by its own calls:
 * an app answering with errors mustn't send AUGUR back to its last release.
 */
export const TRAFFIC_PATH = '/traffic';
/** How many minutes are kept. */
export const TRAFFIC_MINUTES = 15;

/** Whose calls: AUGUR's own services (and the gateway itself), or an app's. */
export type TrafficPart = 'platform' | 'apps';

interface Counts {
  requests: number;
  serverErrors: number;
}

interface Minute {
  at: number;
  platform: Counts;
  apps: Counts;
}

const sum = (minutes: Minute[], part: TrafficPart): Counts => ({
  requests: minutes.reduce((n, m) => n + m[part].requests, 0),
  serverErrors: minutes.reduce((n, m) => n + m[part].serverErrors, 0),
});

export class Traffic {
  private minutes: Minute[] = [];
  private readonly startedAt: number;

  constructor(private readonly now: () => number = Date.now) {
    this.startedAt = now();
  }

  /** Counts one answered call, as AUGUR's or an app's. */
  record(statusCode: number, part: TrafficPart = 'platform') {
    const at = Math.floor(this.now() / 60_000);
    let minute = this.minutes.at(-1);
    if (minute?.at !== at) {
      minute = { at, platform: { requests: 0, serverErrors: 0 }, apps: { requests: 0, serverErrors: 0 } };
      this.minutes = [...this.minutes.filter((m) => m.at > at - TRAFFIC_MINUTES), minute];
    }
    minute[part].requests += 1;
    if (statusCode >= 500) minute[part].serverErrors += 1;
  }

  /**
   * The calls answered in the last `minutes` (this one included), and since when the gateway counted:
   * all of them (as before apps were counted apart), then AUGUR's and apps' each.
   */
  snapshot(minutes = 5) {
    const span = Math.min(Math.max(1, Math.floor(minutes)), TRAFFIC_MINUTES);
    const from = Math.floor(this.now() / 60_000) - span + 1;
    const kept = this.minutes.filter((m) => m.at >= from);
    const platform = sum(kept, 'platform');
    const apps = sum(kept, 'apps');
    return {
      minutes: span,
      requests: platform.requests + apps.requests,
      serverErrors: platform.serverErrors + apps.serverErrors,
      platform,
      apps,
      countingSince: new Date(this.startedAt).toISOString(),
    };
  }
}
