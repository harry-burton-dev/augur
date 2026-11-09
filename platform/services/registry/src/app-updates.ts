import semver from 'semver';
import { asksOf2, isRelease2 } from '@augur/app-tools/release2';
import { contractMessage, stable } from './release-check.ts';
import { isZeroMinor } from './desired-state.ts';
import type { AppRelease } from './store.ts';
import { sameRepository, type FeedTrust } from './feed-trust.ts';
import { FeedProblem, feedReader, feedSource, haltOf, type FeedChecking, type GitHubRelease, type Halt, type ReadKey } from './updates.ts';

/** Which of an app's releases a deployment takes: stable ones only, betas too, or dev builds too (a preview server only). */
export type AppChannel = 'stable' | 'beta' | 'dev';

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
  /** Why its release file can't install here, such as one on contract 2 (spec 11.6): listed to say so, never installed. */
  refused?: string;
  /** What the app is called, for one refused: its release file isn't kept. */
  name?: string;
  /** The feed it was listed in, one of APP_FEEDS. */
  feed?: string;
}

/** What a read of the app feed found: its releases, and whether the feed itself can be trusted. */
export interface AppFeedRead {
  releases: AppFeedRelease[];
  trust?: FeedTrust;
  /** A feed of several that couldn't be read; the releases are the others'. */
  problem?: string;
}

export type AppFeed = () => Promise<AppFeedRelease[] | AppFeedRead>;

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

const isAppRelease = (x: unknown): x is AppRelease => isRelease2(x) && semver.valid(x.version) !== null;

/** A release file on contract 2 (augur.app-release/v1), which this AUGUR lists only to say why it can't install. */
type OldRelease = { schema: 'augur.app-release/v1'; id: string; version: string; channel?: string; manifest?: { name?: unknown } };
const isOldRelease = (x: unknown): x is OldRelease => {
  const r = x as Partial<OldRelease> | null;
  return !!r && typeof r === 'object' && r.schema === 'augur.app-release/v1' && typeof r.id === 'string' && TAG.test(`app/${r.id}@x`) && typeof r.version === 'string' && semver.valid(r.version) !== null;
};
const refusedOld = (r: OldRelease) => ({ refused: contractMessage(2, undefined, { name: r.manifest?.name, version: r.version }), ...(typeof r.manifest?.name === 'string' ? { name: r.manifest.name } : {}) });

/**
 * Reads app releases from `url`: GitHub's releases API (the `app/<id>@<version>` ones, with their
 * app-release.json asset), or a mirror's JSON, which is a list of release files or `{ apps: [...] }`.
 * On GitHub a release marked pre-release is beta.
 */
export const appFeed =
  ({ url, token, key, fetchImpl, ...checking }: { url: string; token?: string; key?: ReadKey; fetchImpl?: typeof fetch } & FeedChecking): AppFeed => {
  // The same feed as AUGUR's, so it's checked the same way: signed and in date (ADR 0017). One source for
  // every read, so it remembers the newest feed it accepted.
  const source = feedSource({ token, key, fetchImpl, ...checking });
  return async () => {
    const get = feedReader({ token, key, fetchImpl });
    const { body, trust } = await source(url, 'application/vnd.github+json, application/json');
    const items: unknown[] = Array.isArray(body) ? body : Array.isArray((body as { apps?: unknown })?.apps) ? (body as { apps: unknown[] }).apps : [];
    if (items.some((x) => isAppRelease(x) || isOldRelease(x))) {
      const releases = items.flatMap((r): AppFeedRelease[] => {
        if (isOldRelease(r)) return [{ app: r.id, version: r.version, ...channelOf(r.version, r.channel !== 'stable'), ...refusedOld(r) }];
        if (!isAppRelease(r)) return [];
        const halted = haltOf(r);
        return [{ app: r.id, version: r.version, ...channelOf(r.version, r.channel !== 'stable'), ...(r.releasedAt ? { released: r.releasedAt } : {}), release: r, ...(halted ? { halted } : {}) }];
      });
      return { releases, trust };
    }
    const releases = (items as GitHubRelease[])
      .filter((r) => typeof r?.tag_name === 'string' && !r.draft)
      .map((r) => ({ r, tag: TAG.exec(r.tag_name) }))
      .filter((x): x is { r: GitHubRelease; tag: RegExpExecArray } => Boolean(x.tag && semver.valid(x.tag[2])))
      .sort((a, b) => semver.rcompare(a.tag[2], b.tag[2]));
    const read = new Map<string, number>();
    const found = await Promise.all(
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
        if (isOldRelease(file) && file.id === app && file.version === version) return { ...base, ...refusedOld(file) };
        return isAppRelease(file) && file.id === app && file.version === version ? { ...base, release: file } : base;
      }),
    );
    return { releases: found, trust };
  };
};

/** An app feed and where it is, as APP_FEEDS names it. */
export interface NamedFeed {
  url: string;
  feed: AppFeed;
}

/** A feed's address: on the web, on an OCI registry, or a file on the server (a mirror's, docs/mirror.md). */
const FEED_ADDRESS = /^(https?:\/\/|oci:\/\/|file:\/\/\/)\S+$/;

/**
 * The app feeds a deployment reads (spec 3.3): APP_FEEDS, a list split by commas, spaces or lines; or
 * APP_FEED_URL, its name before contract 3; or else `own`, the feed AUGUR's releases come from. None when
 * either says off, or when AUGUR's own releases come from a mirror (RELEASE_FEED_URL) and neither is set.
 * Compose passes unset settings as empty strings.
 */
export const appFeedUrls = (env: Record<string, string | undefined>, own: string): string[] => {
  const named = env.APP_FEEDS?.trim() || env.APP_FEED_URL?.trim();
  if (!named) return env.RELEASE_FEED_URL ? [] : [own];
  const urls = [...new Set(named.split(/[\s,]+/).filter(Boolean))];
  if (urls.includes('off')) {
    if (urls.length > 1) throw new Error('APP_FEEDS is off, or a list of feeds, not both.');
    return [];
  }
  for (const url of urls) if (!FEED_ADDRESS.test(url)) throw new Error(`APP_FEEDS lists the app feeds to read, each an https://, oci:// or file:/// address, or off; "${url}" is none of those.`);
  return urls;
};

/**
 * Reads every feed, in order. A release is from the first feed that lists its version. A feed that
 * can't be read is named in the problem while the others' releases still count; when none can be
 * read, that is the problem. The trust shown is the first feed's (AUGUR's own, by default).
 */
export const appFeeds = (feeds: NamedFeed[]): AppFeed => async () => {
  const reads = await Promise.allSettled(feeds.map((f) => f.feed()));
  const problems: string[] = [];
  const seen = new Set<string>();
  const releases: AppFeedRelease[] = [];
  let trust: FeedTrust | undefined;
  reads.forEach((read, i) => {
    const { url } = feeds[i]!;
    if (read.status === 'rejected') {
      const why = read.reason instanceof FeedProblem ? read.reason.message : 'it couldn’t be reached. Try again later.';
      problems.push(`${url} couldn’t be read: ${why}`);
      return;
    }
    const list = Array.isArray(read.value) ? read.value : read.value.releases;
    if (i === 0 && !Array.isArray(read.value)) trust = read.value.trust;
    for (const r of list) {
      const key = `${r.app}@${r.version}`;
      if (seen.has(key)) continue;
      seen.add(key);
      releases.push({ ...r, feed: url });
    }
  });
  if (problems.length === feeds.length && feeds.length) throw new FeedProblem(problems.join(' '));
  return { releases, ...(trust ? { trust } : {}), ...(problems.length ? { problem: problems.join(' ') } : {}) };
};

const RECHECK_MS = 30_000;

/** What the last check of the app feed found. */
export interface AppCheckResult {
  checkedAt?: string;
  problem?: string;
  releases: AppFeedRelease[];
  /** Whether the feed the releases came from can be trusted (ADR 0017). */
  trust?: FeedTrust;
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
        const read = await feed();
        this.last = Array.isArray(read)
          ? { checkedAt: this.now().toISOString(), releases: read }
          : { checkedAt: this.now().toISOString(), releases: read.releases, ...(read.trust ? { trust: read.trust } : {}), ...(read.problem ? { problem: read.problem } : {}) };
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

/** The newest release of `app` on `channel` that is listed only to say why it can't install, such as one on contract 2. */
export const refusedIn = (releases: AppFeedRelease[], app: string, channel: AppChannel) =>
  releases.filter((r) => r.app === app && r.refused && !r.release && onChannel(channel, r.channel)).sort((a, b) => semver.rcompare(a.version, b.version))[0];

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

const MEMORY_UNITS: Record<string, number> = { '': 1, K: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15, E: 1e18, Ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40, Pi: 2 ** 50, Ei: 2 ** 60 };

/** A Score (Kubernetes-style) memory amount in bytes: `512Mi`, `125M`, `1073741824`. NaN when it isn't one. */
const bytes = (v: string): number => {
  const m = /^(\d+(?:\.\d+)?)([KMGTPE]i?)?$/.exec(v.trim());
  return m ? Number(m[1]) * (MEMORY_UNITS[m[2] ?? ''] ?? Number.NaN) : Number.NaN;
};

/** A Score CPU amount in thousandths of a CPU: `500m`, `1`, `0.5`. NaN when it isn't one. */
const millicpu = (v: string): number => {
  const m = /^(\d+(?:\.\d+)?)(m)?$/.exec(v.trim());
  return m ? Number(m[1]) * (m[2] ? 1 : 1000) : Number.NaN;
};

/** Whether `to` is more than `from`: a raise, or (when either can't be read) any change. */
const raised = (from: string, to: string, read: (v: string) => number) => {
  const [a, b] = [read(from), read(to)];
  return Number.isNaN(a) || Number.isNaN(b) ? from.trim() !== to.trim() : b > a;
};

/** The ids of one of a manifest's contribution lists. */
const idsOf = (release: AppRelease, key: string): Map<string, string> => {
  const list = (release.manifest.contributes as Record<string, unknown> | undefined)?.[key];
  return new Map((Array.isArray(list) ? (list as { id?: unknown; label?: unknown }[]) : []).map((x) => [String(x.id), String(x.label ?? x.id)]));
};

/**
 * What a later version asks for that the installed one didn't (spec 3.7, 9.4), each in words: a new
 * scope, resource, setting, place, command or About section, a raised limit, more kinds of floor, bigger
 * uploads, the canvas, a major version, another signer. Nothing when it only takes things away: such a
 * version may install by itself under the app's policy.
 */
export const updateNeeds = (from: AppRelease, to: AppRelease): string[] => {
  const needs: string[] = [];
  const name = to.manifest.name;
  // Computed from the manifest and parts, not taken from the file (which the registry checks agree).
  const a = asksOf2(from.manifest, from.parts);
  const b = asksOf2(to.manifest, to.parts);
  if (semver.major(to.version) > semver.major(from.version)) needs.push(`${to.version} is a major version: it may change how ${name} works.`);
  else if (isZeroMinor(from.version, to.version)) needs.push(`${to.version} is a 0.x minor version, which may change how ${name} works like a major.`);
  const newScopes = b.scopes.filter((s) => !a.scopes.includes(s));
  if (newScopes.length) needs.push(`It asks for more: ${newScopes.join(', ')}.`);
  const key = (r: AppRelease['asks']['resources'][number]) => `${r.part} ${r.type} ${stable(r.params ?? {})}`;
  const had = new Set(a.resources.map(key));
  for (const r of b.resources.filter((r) => !had.has(key(r)))) needs.push(`Its ${r.part} part asks for ${r.type}${r.params && Object.keys(r.params).length ? ` (${JSON.stringify(r.params)})` : ''}.`);
  for (const [part, limit] of Object.entries(b.limits)) {
    const was = a.limits[part];
    if (!was) continue; // A new part is listed with its resources; its limits are in the review.
    if (raised(was.memory, limit.memory, bytes)) needs.push(`Its ${part} part asks for ${limit.memory} of memory, up from ${was.memory}.`);
    if (raised(was.cpu, limit.cpu, millicpu)) needs.push(`Its ${part} part asks for ${limit.cpu} CPU, up from ${was.cpu}.`);
  }
  for (const part of Object.keys(b.limits).filter((p) => !(p in a.limits))) needs.push(`It adds a part, ${part}, with ${b.limits[part]!.memory} of memory and ${b.limits[part]!.cpu} CPU.`);
  if (b.floors.some((f) => !a.floors.includes(f))) needs.push('It asks to work on more kinds of floor.');
  if (b.maxUpload > a.maxUpload) needs.push(`It asks for uploads up to ${b.maxUpload} MB.`);
  if (b.canvas && !a.canvas) needs.push('It asks to draw in a canvas frame.');
  for (const [what, keyName] of [['setting', 'settings'], ['place', 'places'], ['command', 'commands'], ['About section', 'about']] as const) {
    const before = idsOf(from, keyName);
    for (const [id, label] of idsOf(to, keyName)) if (!before.has(id)) needs.push(`It adds the ${what} "${label}".`);
  }
  if (!sameRepository(to.signer.repository, from.signer.repository) || to.signer.workflow !== from.signer.workflow) needs.push(`It’s signed by ${to.signer.repository}, not ${from.signer.repository}.`);
  return needs;
};
