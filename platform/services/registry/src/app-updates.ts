import semver from 'semver';
import type { AppRelease } from './store.ts';
import { FeedProblem, feedReader, type GitHubRelease } from './updates.ts';

/** Which of an app's releases a deployment takes: stable ones only, or betas too. */
export type AppChannel = 'stable' | 'beta';
/** What happens when a newer release is out on the app's channel. */
export type AppPolicy = 'automatic' | 'ask' | 'hold';

/** One app release in the feed. Its release file is missing when it couldn't be read (or wasn't needed). */
export interface AppFeedRelease {
  app: string;
  version: string;
  channel: AppChannel;
  released?: string;
  notesUrl?: string;
  release?: AppRelease;
}

export type AppFeed = () => Promise<AppFeedRelease[]>;

/** How many of each app's newest releases have their release files read. */
const FILES_READ_PER_APP = 4;
const TAG = /^app\/([a-z][a-z0-9-]{1,39})@(.+)$/;

const isAppRelease = (x: unknown): x is AppRelease =>
  typeof x === 'object' && x !== null && (x as AppRelease).schema === 'augur.app-release/v1' && typeof (x as AppRelease).id === 'string' && semver.valid((x as AppRelease).version) !== null;

/**
 * Reads app releases from `url`: GitHub's releases API (the `app/<id>@<version>` ones, with their
 * app-release.json asset), or a mirror's JSON, which is a list of release files or `{ apps: [...] }`.
 * On GitHub a release marked pre-release is beta.
 */
export const appFeed =
  ({ url, token, fetchImpl }: { url: string; token?: string; fetchImpl?: typeof fetch }): AppFeed =>
  async () => {
    const get = feedReader({ token, fetchImpl });
    const body = await get(url, 'application/vnd.github+json, application/json');
    const items: unknown[] = Array.isArray(body) ? body : Array.isArray((body as { apps?: unknown })?.apps) ? (body as { apps: unknown[] }).apps : [];
    if (items.some(isAppRelease)) {
      return items.filter(isAppRelease).map((r) => ({ app: r.id, version: r.version, channel: r.channel === 'stable' ? 'stable' : 'beta', ...(r.releasedAt ? { released: r.releasedAt } : {}), release: r }));
    }
    const releases = (items as GitHubRelease[])
      .filter((r) => typeof r?.tag_name === 'string' && !r.draft)
      .map((r) => ({ r, tag: TAG.exec(r.tag_name) }))
      .filter((x): x is { r: GitHubRelease; tag: RegExpExecArray } => Boolean(x.tag && semver.valid(x.tag[2])))
      .sort((a, b) => semver.rcompare(a.tag[2], b.tag[2]));
    const read = new Map<string, number>();
    return Promise.all(
      releases.map(async ({ r, tag }): Promise<AppFeedRelease> => {
        const [, app, version] = tag;
        const base: AppFeedRelease = { app, version, channel: r.prerelease ? 'beta' : 'stable', ...(r.published_at ? { released: r.published_at } : {}), ...(r.html_url ? { notesUrl: r.html_url } : {}) };
        const count = read.get(app) ?? 0;
        const asset = r.assets?.find((a) => a.name === 'app-release.json');
        if (count >= FILES_READ_PER_APP || !asset) return base;
        read.set(app, count + 1);
        const file = await get(asset.url, 'application/octet-stream').catch(() => undefined);
        return isAppRelease(file) && file.id === app && file.version === version ? { ...base, release: file } : base;
      }),
    );
  };

const RECHECK_MS = 30_000;

/** What the last check of the app feed found. */
export interface AppCheckResult {
  checkedAt?: string;
  problem?: string;
  releases: AppFeedRelease[];
}

/** Checks the app feed every 15 minutes and when an admin asks, keeps what it found, and says when it has. */
export class AppUpdateChecker {
  private last: AppCheckResult = { releases: [] };
  private inFlight?: Promise<AppCheckResult>;
  private timer?: ReturnType<typeof setInterval>;
  private readonly listeners: ((result: AppCheckResult) => unknown)[] = [];

  constructor(
    private readonly feed?: AppFeed,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get on() {
    return this.feed !== undefined;
  }

  get result() {
    return this.last;
  }

  /** Calls `listener` after each good check: how automatic updates are started. */
  onChecked(listener: (result: AppCheckResult) => unknown) {
    this.listeners.push(listener);
  }

  check(): Promise<AppCheckResult> {
    if (!this.feed) return Promise.resolve(this.last);
    if (this.inFlight) return this.inFlight;
    if (this.last.checkedAt && !this.last.problem && this.now().getTime() - Date.parse(this.last.checkedAt) < RECHECK_MS) return Promise.resolve(this.last);
    const feed = this.feed;
    this.inFlight = (async () => {
      try {
        this.last = { checkedAt: this.now().toISOString(), releases: await feed() };
        for (const listener of this.listeners) await Promise.resolve(listener(this.last)).catch(() => undefined);
      } catch (err) {
        this.last = { ...this.last, checkedAt: this.now().toISOString(), problem: err instanceof FeedProblem ? err.message : 'The app feed couldn’t be read. Try again later.' };
      } finally {
        this.inFlight = undefined;
      }
      return this.last;
    })();
    return this.inFlight;
  }

  start(everyMs = 15 * 60_000) {
    void this.check();
    this.timer = setInterval(() => void this.check(), everyMs);
    this.timer.unref();
  }

  stop() {
    clearInterval(this.timer);
  }
}

/** The newest release of `app` on `channel` that the feed has a release file for. */
export const newestOn = (releases: AppFeedRelease[], app: string, channel: AppChannel) =>
  releases
    .filter((r) => r.app === app && r.release && (channel === 'beta' || r.channel === 'stable'))
    .sort((a, b) => semver.rcompare(a.version, b.version))[0];

/**
 * Why an update from `from` to `to` waits for an admin even under the Automatic policy: a major
 * version, more than the installed version was allowed (scopes, storage, floor kinds, upload size),
 * or an SDK range this shell can't open. Empty when it can install by itself.
 */
export const updateNeeds = (from: AppRelease, to: AppRelease, sdkVersion: string): string[] => {
  const needs: string[] = [];
  const a = from.manifest;
  const b = to.manifest;
  if (semver.major(to.version) > semver.major(from.version)) needs.push(`${to.version} is a major version: it may change how ${b.name} works.`);
  const newScopes = (b.scopes ?? []).filter((s) => !(a.scopes ?? []).includes(s));
  if (newScopes.length) needs.push(`It asks for more: ${newScopes.join(', ')}.`);
  if ((b.storage?.database && !a.storage?.database) || (b.storage?.bucket && !a.storage?.bucket)) needs.push('It asks for storage it didn’t have.');
  const floors = (e: typeof a) => e.floors ?? ['personal', 'team', 'org'];
  if (floors(b).some((f) => !floors(a).includes(f))) needs.push('It asks to work on more kinds of floor.');
  if ((b.maxUpload ?? 10) > (a.maxUpload ?? 10)) needs.push(`It asks for uploads up to ${b.maxUpload} MB.`);
  if (!semver.satisfies(sdkVersion, b.sdk, { includePrerelease: true })) needs.push(`It needs SDK ${b.sdk}, and this AUGUR has ${sdkVersion}.`);
  if (to.signer.repository !== from.signer.repository || to.signer.workflow !== from.signer.workflow) needs.push(`It’s signed by ${to.signer.repository}, not ${from.signer.repository}.`);
  return needs;
};
