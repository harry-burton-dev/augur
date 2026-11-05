import semver from 'semver';
import { isZeroMinor } from './desired-state.ts';
import type { AppRelease } from './store.ts';
import { sameRepository } from './feed-trust.ts';
import { FeedProblem, feedReader, feedSource, haltOf, type FeedChecking, type GitHubRelease, type Halt, type ReadKey } from './updates.ts';

/** Which of an app's releases a deployment takes: stable ones only, betas too, or dev builds too (a preview server only). */
export type AppChannel = 'stable' | 'beta' | 'dev';
/** What happens when a newer release is out on the app's channel. */
export type AppPolicy = 'automatic' | 'ask' | 'hold';

/**
 * One app release in the feed. Its release file is missing when it couldn't be read (or wasn't needed).
 * A pull request's build (a version such as 1.3.0-pr.12.4) is on the `preview` channel, which no
 * deployment follows: it's only ever run beside the app, for the app's developers. A dev build (a version
 * such as 1.3.1-dev.40, from a merge into main) is on the `dev` channel, which only a preview server follows.
 */
export interface AppFeedRelease {
  app: string;
  version: string;
  channel: AppChannel | 'preview';
  /** For a preview: the pull request it was built from. */
  pr?: number;
  released?: string;
  notesUrl?: string;
  release?: AppRelease;
  /** Halted by its publisher (ADR 0018): listed, never installed or offered. */
  halted?: Halt;
}

export type AppFeed = () => Promise<AppFeedRelease[]>;

/** How many of each app's newest releases have their release files read. */
const FILES_READ_PER_APP = 4;
const TAG = /^app\/([a-z][a-z0-9-]{1,39})@(.+)$/;
/** A pull request's build: <version>-pr.<number>.<run>. */
const PREVIEW = /-pr\.(\d+)\.\d+$/;
/** A dev build: <next patch>-dev.<run>. */
const DEV = /-dev\.\d+$/;
/** Whether a version is a dev build. */
export const isDevBuild = (version: string) => DEV.test(version);
/** The pull request a version was built from, when it's a preview. */
export const previewPr = (version: string) => {
  const m = PREVIEW.exec(version);
  return m ? Number(m[1]) : undefined;
};
const channelOf = (version: string, prerelease: boolean): Pick<AppFeedRelease, 'channel' | 'pr'> => {
  const pr = previewPr(version);
  return pr !== undefined ? { channel: 'preview', pr } : { channel: isDevBuild(version) ? 'dev' : prerelease ? 'beta' : 'stable' };
};

const isAppRelease = (x: unknown): x is AppRelease =>
  typeof x === 'object' && x !== null && (x as AppRelease).schema === 'augur.app-release/v1' && typeof (x as AppRelease).id === 'string' && semver.valid((x as AppRelease).version) !== null;

/**
 * Reads app releases from `url`: GitHub's releases API (the `app/<id>@<version>` ones, with their
 * app-release.json asset), or a mirror's JSON, which is a list of release files or `{ apps: [...] }`.
 * On GitHub a release marked pre-release is beta.
 */
export const appFeed =
  ({ url, token, key, fetchImpl, ...checking }: { url: string; token?: string; key?: ReadKey; fetchImpl?: typeof fetch } & FeedChecking): AppFeed =>
  async () => {
    const get = feedReader({ token, key, fetchImpl });
    // The same feed as AUGUR's, so it's checked the same way: signed and in date (ADR 0017).
    const { body } = await feedSource({ token, key, fetchImpl, ...checking })(url, 'application/vnd.github+json, application/json');
    const items: unknown[] = Array.isArray(body) ? body : Array.isArray((body as { apps?: unknown })?.apps) ? (body as { apps: unknown[] }).apps : [];
    if (items.some(isAppRelease)) {
      return items.filter(isAppRelease).map((r) => {
        const halted = haltOf(r);
        return { app: r.id, version: r.version, ...channelOf(r.version, r.channel !== 'stable'), ...(r.releasedAt ? { released: r.releasedAt } : {}), release: r, ...(halted ? { halted } : {}) };
      });
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
        const haltAsset = r.assets?.find((a) => a.name === 'halted.json');
        const halted = haltAsset ? haltOf({ halted: await get(haltAsset.url, 'application/octet-stream').catch(() => ({ reason: 'Halted by the publisher.' })) }) : undefined;
        const base: AppFeedRelease = { app, version, ...channelOf(version, Boolean(r.prerelease)), ...(r.published_at ? { released: r.published_at } : {}), ...(r.html_url ? { notesUrl: r.html_url } : {}), ...(halted ? { halted } : {}) };
        // Each app's newest few releases, its newest dev build, and each pull request's newest build.
        const key = base.pr !== undefined ? `${app}#${base.pr}` : base.channel === 'dev' ? `${app}~dev` : app;
        const count = read.get(key) ?? 0;
        const asset = r.assets?.find((a) => a.name === 'app-release.json');
        if (count >= (key === app ? FILES_READ_PER_APP : 1) || !asset) return base;
        read.set(key, count + 1);
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

/** Whether a release on `release` is one a deployment following `follows` takes: stable within beta within dev. */
export const onChannel = (follows: AppChannel, release: AppFeedRelease['channel']) =>
  release !== 'preview' && (release === 'stable' || follows === 'dev' || (follows === 'beta' && release === 'beta'));

/** The newest release of `app` on `channel` that the feed has a release file for. Never a preview, and never one its publisher halted. */
export const newestOn = (releases: AppFeedRelease[], app: string, channel: AppChannel) =>
  releases
    .filter((r) => r.app === app && r.release && !r.halted && onChannel(channel, r.channel))
    .sort((a, b) => semver.rcompare(a.version, b.version))[0];

/** Each open pull request's newest build of `app` that the feed has a release file for, newest pull request first. */
export const previewsIn = (releases: AppFeedRelease[], app: string) => {
  const newest = new Map<number, AppFeedRelease>();
  for (const r of releases) {
    if (r.app !== app || r.pr === undefined || !r.release) continue;
    const had = newest.get(r.pr);
    if (!had || semver.gt(r.version, had.version)) newest.set(r.pr, r);
  }
  return [...newest.values()].sort((a, b) => b.pr! - a.pr!);
};

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
  else if (isZeroMinor(from.version, to.version)) needs.push(`${to.version} is a 0.x minor version, which may change how ${b.name} works like a major.`);
  const newScopes = (b.scopes ?? []).filter((s) => !(a.scopes ?? []).includes(s));
  if (newScopes.length) needs.push(`It asks for more: ${newScopes.join(', ')}.`);
  if ((b.storage?.database && !a.storage?.database) || (b.storage?.bucket && !a.storage?.bucket)) needs.push('It asks for storage it didn’t have.');
  const floors = (e: typeof a) => e.floors ?? ['personal', 'team', 'org'];
  if (floors(b).some((f) => !floors(a).includes(f))) needs.push('It asks to work on more kinds of floor.');
  if ((b.maxUpload ?? 10) > (a.maxUpload ?? 10)) needs.push(`It asks for uploads up to ${b.maxUpload} MB.`);
  if (!semver.satisfies(sdkVersion, b.sdk, { includePrerelease: true })) needs.push(`It needs SDK ${b.sdk}, and this AUGUR has ${sdkVersion}.`);
  if (!sameRepository(to.signer.repository, from.signer.repository) || to.signer.workflow !== from.signer.workflow) needs.push(`It’s signed by ${to.signer.repository}, not ${from.signer.repository}.`);
  return needs;
};
