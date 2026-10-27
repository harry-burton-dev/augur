import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import type { AppRecord } from './store.ts';

/** Which releases a deployment follows: stable only, or beta too (every release starts on beta). */
export type Channel = 'stable' | 'beta';

/** An AUGUR release file, as scripts/augur-release.mjs writes it and the Release workflow attaches it. */
export interface ReleaseManifest {
  version: string;
  channel: Channel;
  released?: string;
  upgradeFrom: string;
  changed: string[];
  breaking: string[];
  settings: { all: string[]; required: string[]; added: string[]; removed: string[] };
  parts: Record<string, { version: string }>;
  /** Each part's image by digest; the Release workflow adds it to the attached file. */
  images?: Record<string, string>;
  /** The release's files in infra/deploy, by path inside it, as sha256; the Release workflow adds it too. */
  deploy?: Record<string, string>;
  /** Where its notes are; a mirror's feed adds it (scripts/mirror-release.mjs). */
  notesUrl?: string;
}

/** One release in the feed. Its manifest is absent when it couldn't be read (or wasn't needed). */
export interface FeedRelease {
  version: string;
  channel: Channel;
  released?: string;
  notesUrl?: string;
  manifest?: ReleaseManifest;
}

/** Where releases are listed. */
export type ReleaseFeed = (running: string) => Promise<FeedRelease[]>;

/** This repo's GitHub releases: the feed every deployment reads unless RELEASE_FEED_URL points at a mirror. */
export const DEFAULT_FEED_URL = 'https://api.github.com/repos/harry-burton-dev/im-platform/releases?per_page=100';

/** How many releases newer than the running one have their manifests read. */
const MANIFESTS_READ = 10;
const TIMEOUT_MS = 10_000;

/** The feed couldn't be read; the message says what to do about it. */
export class FeedProblem extends Error {}

const isManifest = (x: unknown): x is ReleaseManifest =>
  typeof x === 'object' && x !== null && typeof (x as ReleaseManifest).version === 'string' && semver.valid((x as ReleaseManifest).version) !== null && typeof (x as ReleaseManifest).parts === 'object';

export interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at?: string;
  html_url?: string;
  assets?: { name: string; url: string }[];
}

/**
 * Fetches a feed's JSON: GitHub's releases API, an asset of a release, a mirror's file over the web,
 * or one on the server (`file:///…`). Failures are FeedProblems that say what to do.
 */
export const feedReader =
  ({ token, fetchImpl = (...args) => fetch(...args) }: { token?: string; fetchImpl?: typeof fetch }) =>
  async (target: string, accept: string): Promise<unknown> => {
    if (target.startsWith('file:')) {
      const text = await readFile(fileURLToPath(target), 'utf8').catch(() => {
        throw new FeedProblem(`The release feed file ${fileURLToPath(target)} can’t be read. Check RELEASE_FEED_URL and that it’s mounted (docs/mirror.md).`);
      });
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new FeedProblem('The release feed file isn’t JSON. Check RELEASE_FEED_URL.');
      }
    }
    let res: Response;
    try {
      res = await fetchImpl(target, {
        headers: { accept, 'user-agent': 'augur-registry', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new FeedProblem(`The release feed at ${new URL(target).host} can’t be reached. Check the server can reach it, or point RELEASE_FEED_URL at a mirror.`);
    }
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      throw new FeedProblem('GitHub’s limit on checks without a token was reached. It resets within the hour; a read-only token raises it (docs/upgrade.md).');
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new FeedProblem(
        token
          ? `The release feed refused the registry’s token (${res.status}). Check it can still read the repository’s releases.`
          : `The release feed refused the registry (${res.status}). A private repository needs a read-only token: see docs/upgrade.md.`,
      );
    }
    if (!res.ok) throw new FeedProblem(`The release feed answered ${res.status}. Try again later.`);
    return res.json().catch(() => {
      throw new FeedProblem('The release feed didn’t answer with JSON. Check RELEASE_FEED_URL.');
    }) as Promise<unknown>;
  };

/**
 * Reads releases from `url`: GitHub's releases API (the `augur@<version>` ones, with their
 * augur-release.json asset) or a mirror's JSON, which is a list of release files or `{ releases: [...] }`.
 * A mirror's feed can be a file on the server too (`file:///…`), for one that can't reach any web server.
 * On GitHub a release marked pre-release is beta; promoting it to stable is unticking that.
 */
export const releaseFeed =
  ({ url, token, fetchImpl }: { url: string; token?: string; fetchImpl?: typeof fetch }): ReleaseFeed =>
  async (running) => {
    const get = feedReader({ token, fetchImpl });
    const body = await get(url, 'application/vnd.github+json, application/json');
    const items: unknown[] = Array.isArray(body) ? body : Array.isArray((body as { releases?: unknown })?.releases) ? (body as { releases: unknown[] }).releases : [];

    if (items.some(isManifest)) {
      // A mirror: the release files themselves.
      return items.filter(isManifest).map((m) => ({ version: m.version, channel: m.channel === 'stable' ? 'stable' : 'beta', released: m.released, ...(m.notesUrl ? { notesUrl: m.notesUrl } : {}), manifest: m }));
    }

    const releases = (items as GitHubRelease[])
      .filter((r) => typeof r?.tag_name === 'string' && r.tag_name.startsWith('augur@') && !r.draft && semver.valid(r.tag_name.slice('augur@'.length)))
      .map((r) => ({ release: r, version: r.tag_name.slice('augur@'.length) }))
      .sort((a, b) => semver.rcompare(a.version, b.version));
    // Only the running release and the newer ones matter, and only so many of those.
    const wanted = new Set(releases.filter((r) => semver.gte(r.version, running)).slice(0, MANIFESTS_READ + 1).map((r) => r.version));
    return Promise.all(
      releases.map(async ({ release, version }): Promise<FeedRelease> => {
        const base: FeedRelease = { version, channel: release.prerelease ? 'beta' : 'stable', released: release.published_at, notesUrl: release.html_url };
        const asset = release.assets?.find((a) => a.name === 'augur-release.json');
        if (!wanted.has(version) || !asset) return base;
        // Asked for as bytes, GitHub redirects to the file; fetch drops the token on the way.
        const manifest = await get(asset.url, 'application/octet-stream').catch(() => undefined);
        return isManifest(manifest) ? { ...base, manifest } : base;
      }),
    );
  };

/** The registry's read-only token for a private feed: a Docker secret, or RELEASE_FEED_TOKEN. */
export const feedTokenFromEnv = (env = process.env) => {
  const file = env.RELEASE_FEED_TOKEN_FILE ?? '/run/secrets/augur/release-feed-token';
  const fromFile = existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
  return fromFile || env.RELEASE_FEED_TOKEN || undefined;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** A check asked for this soon after the last one gets the last one's answer, so a busy button can't run the feed's rate limit down. */
const RECHECK_MS = 30_000;

/** What the last check of the feed found. */
export interface CheckResult {
  checkedAt?: string;
  problem?: string;
  releases: FeedRelease[];
}

/** Checks the feed once a day and when an admin asks, and keeps what it found. Never restarts anything. */
export class UpdateChecker {
  readonly running: { version: string; channel: Channel };
  readonly channel: Channel;
  private readonly feed?: ReleaseFeed;
  private readonly now: () => Date;
  private last: CheckResult = { releases: [] };
  private inFlight?: Promise<CheckResult>;
  private timer?: ReturnType<typeof setInterval>;

  constructor({ feed, running, channel, now = () => new Date() }: { feed?: ReleaseFeed; running: { version: string; channel: Channel }; channel?: Channel; now?: () => Date }) {
    this.feed = feed;
    this.running = running;
    this.channel = channel ?? running.channel;
    this.now = now;
  }

  /** Off when the deployment set RELEASE_FEED_URL=off. */
  get on() {
    return this.feed !== undefined;
  }

  get result(): CheckResult {
    return this.last;
  }

  /** Reads the feed. A failure is kept as the problem, beside the releases the last good check found. */
  check(): Promise<CheckResult> {
    if (!this.feed) return Promise.resolve(this.last);
    if (this.inFlight) return this.inFlight;
    if (this.last.checkedAt && !this.last.problem && this.now().getTime() - Date.parse(this.last.checkedAt) < RECHECK_MS) return Promise.resolve(this.last);
    const feed = this.feed;
    this.inFlight = (async () => {
      try {
        this.last = { checkedAt: this.now().toISOString(), releases: await feed(this.running.version) };
      } catch (err) {
        const problem = err instanceof FeedProblem ? err.message : 'The release feed couldn’t be read. Try again later.';
        this.last = { ...this.last, checkedAt: this.now().toISOString(), problem };
      } finally {
        this.inFlight = undefined;
      }
      return this.last;
    })();
    return this.inFlight;
  }

  /** Checks now and then once a day, without keeping the process alive. */
  start(everyMs = DAY_MS) {
    void this.check();
    this.timer = setInterval(() => void this.check(), everyMs);
    this.timer.unref();
  }

  stop() {
    clearInterval(this.timer);
  }
}

/** A release as the Updates page shows it. */
export interface ReleaseSummary {
  version: string;
  channel: Channel;
  released?: string;
  notesUrl?: string;
  breaking: string[];
}

/** Something a person has to do or know before upgrading. */
export type NeedsYou =
  | { kind: 'path'; version: string; message: string }
  | { kind: 'setting'; key: string; required: boolean; message: string }
  | { kind: 'breaking'; version: string; message: string }
  | { kind: 'app'; app: string; message: string }
  | { kind: 'unknown'; version: string; message: string };

/** One part that changes in the upgrade. */
export interface PartChange {
  name: string;
  from?: string;
  to: string;
}

/** What the Updates page shows (see contracts/registry.openapi.yaml). */
export interface UpdatesView {
  running: { version: string; channel: Channel };
  channel: Channel;
  feed: 'on' | 'off';
  checkedAt?: string;
  problem?: string;
  /** The newest release on the channel, when it is newer than the running one. */
  available?: ReleaseSummary & { parts: PartChange[] };
  /** Every release on the channel newer than the running one, newest first. */
  newer: ReleaseSummary[];
  /** On stable: a beta newer than anything stable, for those who'd rather follow beta. */
  beta?: ReleaseSummary;
  /**
   * The release to upgrade to next: the available one, or one on the way when it can't be reached
   * straight. Absent when none can be reached, or its release file couldn't be read.
   */
  next?: string;
  needsYou: NeedsYou[];
}

const summary = (r: FeedRelease): ReleaseSummary => ({
  version: r.version,
  channel: r.channel,
  ...(r.released ? { released: r.released } : {}),
  ...(r.notesUrl ? { notesUrl: r.notesUrl } : {}),
  breaking: r.manifest?.breaking ?? [],
});

/** Whether a release's `upgradeFrom` lets the running version take it straight. */
const reachable = (r: FeedRelease, running: string) => r.manifest !== undefined && semver.satisfies(running, r.manifest.upgradeFrom, { includePrerelease: true });

/**
 * What an upgrade from the running release would take: the newest release on the channel, how to
 * get there, and what has to be done first. Pure, so the page and its tests agree.
 */
export const updatesView = ({ checker, apps }: { checker: UpdateChecker; apps: AppRecord[] }): UpdatesView => {
  const { running, channel } = checker;
  const { checkedAt, problem, releases } = checker.result;
  const base = { running, channel, feed: checker.on ? ('on' as const) : ('off' as const), ...(checkedAt ? { checkedAt } : {}), ...(problem ? { problem } : {}) };
  const onChannel = (r: FeedRelease) => channel === 'beta' || r.channel === 'stable';
  const newer = releases.filter((r) => onChannel(r) && semver.gt(r.version, running.version)).sort((a, b) => semver.rcompare(a.version, b.version));
  const newestBeta = releases.filter((r) => r.channel === 'beta' && semver.gt(r.version, newer[0]?.version ?? running.version)).sort((a, b) => semver.rcompare(a.version, b.version))[0];
  const beta = channel === 'stable' && newestBeta ? summary(newestBeta) : undefined;
  if (!newer.length) return { ...base, newer: [], ...(beta ? { beta } : {}), needsYou: [] };

  const available = newer[0];
  const needsYou: NeedsYou[] = [];
  // Straight there when it allows it; otherwise the newest release on the way that does.
  let next = available;
  if (!available.manifest) {
    needsYou.push({ kind: 'unknown', version: available.version, message: `AUGUR ${available.version}’s release file couldn’t be read, so what it needs isn’t known. Read its notes before upgrading.` });
  } else if (!reachable(available, running.version)) {
    const via = newer.find((r) => r !== available && reachable(r, running.version));
    if (via) {
      next = via;
      needsYou.push({ kind: 'path', version: via.version, message: `Upgrade to ${via.version} first: ${available.version} upgrades only from ${available.manifest.upgradeFrom.replace('>=', '')} or later.` });
    } else {
      needsYou.push({ kind: 'path', version: available.version, message: `${available.version} upgrades only from ${available.manifest.upgradeFrom.replace('>=', '')} or later, and no release on the way can be reached from ${running.version}. Read its notes.` });
    }
  }

  // Everything from the running release up to the next one: what each step adds.
  const steps = newer.filter((r) => semver.lte(r.version, next.version)).reverse();
  const target = next.manifest;
  for (const r of steps) for (const b of r.manifest?.breaking ?? []) needsYou.push({ kind: 'breaking', version: r.version, message: `${r.version}: ${b}` });
  if (target) {
    const added = new Set(steps.flatMap((r) => r.manifest?.settings.added ?? []).filter((k) => target.settings.all.includes(k)));
    for (const key of added) {
      const required = target.settings.required.includes(key);
      needsYou.push({ kind: 'setting', key, required, message: required ? `Set ${key} in .env: ${next.version} won’t start without it.` : `${key} is a new, optional setting.` });
    }
    // Apps that register themselves run in the new shell only if it speaks their SDK.
    const sdk = target.parts['@augur/mfe-sdk']?.version;
    if (sdk) {
      for (const { entry } of apps.filter((a) => a.enabled)) {
        if (!semver.satisfies(sdk, entry.sdk, { includePrerelease: true })) {
          needsYou.push({ kind: 'app', app: entry.id, message: `${entry.name} needs SDK ${entry.sdk}, and ${next.version} has ${sdk}: it won’t open until it’s rebuilt.` });
        }
      }
    }
  }

  const runningParts = releases.find((r) => r.version === running.version)?.manifest?.parts;
  const parts: PartChange[] = available.manifest
    ? Object.entries(available.manifest.parts)
        .filter(([name, { version }]) => (runningParts ? runningParts[name]?.version !== version : available.manifest!.changed.includes(name)))
        .map(([name, { version }]) => ({ name, ...(runningParts?.[name] ? { from: runningParts[name].version } : {}), to: version }))
    : [];

  return {
    ...base,
    available: { ...summary(available), parts },
    newer: newer.map(summary),
    ...(beta ? { beta } : {}),
    ...(next.manifest && reachable(next, running.version) ? { next: next.version } : {}),
    needsYou,
  };
};
