import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import { releaseChanges, type Change } from './changes.ts';
import { automaticProblem, firstUpgradeProblem, windowAt, type DesiredState } from './desired-state.ts';
import { checkPublisherFeed, FeedTrustProblem, type FeedSignatureCheck, type FeedTrust } from './feed-trust.ts';
import { PRODUCTION_ONLY, takesAugurDevBuilds, takesPreview, type Ring } from './ring.ts';
import type { AppRecord, Upgrade } from './store.ts';

/**
 * Which releases a deployment follows: stable (promoted to production) only, beta too (on preview;
 * every release starts there), or dev too (a build of every merge into dev, for the workbench only).
 * Admin calls them Production, Preview and Dev builds (docs/release-channels.md).
 */
export type Channel = 'stable' | 'beta' | 'dev';

/** An AUGUR dev build's version: the next patch, then -dev. and the workflow run (scripts/augur-release.mjs). */
export const isDevBuild = (version: string) => /-dev\.\d+$/.test(version);

/** Whether a server following `channel` takes a release on `release`: dev takes all, beta all but dev, stable only stable. */
export const follows = (channel: Channel, release: Channel) => channel === 'dev' || (channel === 'beta' ? release !== 'dev' : release === 'stable');

const feedChannel = (version: string, prerelease: boolean): Channel => (isDevBuild(version) ? 'dev' : prerelease ? 'beta' : 'stable');

/** An AUGUR release file, as scripts/augur-release.mjs writes it and the Release workflow attaches it. */
export interface ReleaseManifest {
  version: string;
  /** Its release name (release/names.json), shown beside the version; a patch keeps its release's. */
  name?: string;
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
  /** Each changed part's changelog for this release; the Release workflow adds it. */
  changelogs?: Record<string, string>;
}

/** Why a release was halted (the Halt rollout workflow, ADR 0018): no deployment is offered it. */
export interface Halt {
  reason: string;
  at?: string;
}

/** One release in the feed. Its manifest is absent when it couldn't be read (or wasn't needed). */
export interface FeedRelease {
  version: string;
  channel: Channel;
  released?: string;
  notesUrl?: string;
  manifest?: ReleaseManifest;
  /** Halted by the publisher: never offered, and a deployment running it is told to move. */
  halted?: Halt;
}

/** What a read of the feed found: its releases, and whether the feed itself can be trusted. */
export interface FeedRead {
  releases: FeedRelease[];
  trust?: FeedTrust;
}

/** Where releases are listed. */
export type ReleaseFeed = (running: string) => Promise<FeedRelease[] | FeedRead>;

/** Ends a reason someone typed with a full stop, so a sentence can follow it. */
const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/** A feed entry's `halted`, when it says why. */
export const haltOf = (x: unknown): Halt | undefined => {
  const h = (x as { halted?: { reason?: unknown; at?: unknown } } | undefined)?.halted;
  return h && typeof h.reason === 'string' && h.reason.trim() ? { reason: h.reason, ...(typeof h.at === 'string' ? { at: h.at } : {}) } : undefined;
};

/** This repo's GitHub releases: the feed every deployment reads unless RELEASE_FEED_URL points at a mirror. */
export const DEFAULT_FEED_URL = 'https://api.github.com/repos/harry-burton-dev/augur/releases?per_page=100';

/**
 * The same releases, and apps' releases, as one file the Release workflow pushes to GitHub's container
 * registry beside the images (scripts/publish-feed.mjs). A deployment reads it with its read key, the
 * same read:packages token it pulls images with, so one key covers updates of AUGUR and of apps.
 */
export const DEFAULT_OCI_FEED_URL = 'oci://ghcr.io/harry-burton-dev/im-platform/feed:latest';

/** A deployment's read key: a GitHub token that can read this repository's packages, and whose it is. */
export interface ReadKey {
  user: string;
  token: string;
}

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
  ({ token, key, fetchImpl = (...args) => fetch(...args) }: { token?: string; key?: ReadKey; fetchImpl?: typeof fetch }) =>
  async (target: string, accept: string): Promise<unknown> => {
    if (target.startsWith('oci:')) return parseJson((await ociFiles(target, key, fetchImpl)).text);
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

/** How the feed itself is checked: the publisher's signature and expiry (ADR 0017). */
export interface FeedChecking {
  check?: FeedSignatureCheck;
  signer?: string;
  now?: () => Date;
}

/**
 * Reads the feed itself, at `target`, and says whether it can be trusted: the publisher's feed on a
 * container registry must be signed and in date (feed-trust.ts); a mirror's feed is the mirror's own;
 * GitHub's releases, read directly, aren't signed. A refused feed is a FeedProblem that says why.
 */
export const feedSource =
  ({ token, key, fetchImpl = (...args) => fetch(...args), check, signer, now = () => new Date() }: { token?: string; key?: ReadKey; fetchImpl?: typeof fetch } & FeedChecking) => {
  // When the newest feed this registry accepted was issued, so an older one can't be replayed. It lives as
  // long as this process: after a restart, a replayed feed still has to be signed and in date.
  let newest: string | undefined;
  return async (target: string, accept: string): Promise<{ body: unknown; trust: FeedTrust }> => {
    if (target.startsWith('oci:')) {
      const { text, bundle } = await ociFiles(target, key, fetchImpl);
      try {
        const trust = await checkPublisherFeed({ text, bundle, check, signer, now: now(), newest });
        const body = parseJson(text);
        if (trust.issued) newest = trust.issued;
        return { body, trust };
      } catch (err) {
        if (err instanceof FeedTrustProblem) throw new FeedProblem(err.message);
        throw err;
      }
    }
    const body = await feedReader({ token, key, fetchImpl })(target, accept);
    if (!target.startsWith('file:') && new URL(target).host === 'api.github.com') {
      return { body, trust: { state: 'unchecked', note: 'This server reads GitHub’s releases directly, which aren’t signed. Give it a read key to read the signed feed instead (docs/upgrade.md, The read key).' } };
    }
    return { body, trust: { state: 'mirror', note: 'A mirror’s own feed: the organisation that runs the mirror vouches for the list, and the updater still checks every image’s signature.' } };
  };
};

const parseJson = (text: string) => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new FeedProblem('The release feed isn’t JSON. Check RELEASE_FEED_URL.');
  }
};

/** The feed's signature, as scripts/publish-feed.mjs pushes it beside the feed. */
const BUNDLE_MEDIA_TYPE = 'application/vnd.dev.sigstore.bundle.v0.3+json';

/**
 * Reads the feed of an OCI artifact, `oci://<registry>/<repository>:<tag>`, as Docker would pull it: a
 * pull token for the repository (with the read key, when there is one), then the tag's manifest, then
 * the feed's layer and, when there is one, its signature's.
 */
const ociFiles = async (target: string, key: ReadKey | undefined, fetchImpl: typeof fetch): Promise<{ text: string; bundle?: string }> => {
  const m = /^oci:\/\/([^/]+)\/(.+):([^:/]+)$/.exec(target);
  if (!m) throw new FeedProblem('The release feed’s address isn’t oci://<registry>/<repository>:<tag>. Check RELEASE_FEED_URL.');
  const [, host, repository, tag] = m;
  const call = async (url: string, headers: Record<string, string>) => {
    try {
      return await fetchImpl(url, { headers: { 'user-agent': 'augur-registry', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new FeedProblem(`The release feed at ${host} can’t be reached. Check the server can reach it, or point RELEASE_FEED_URL at a mirror.`);
    }
  };
  const refused = (status: number) =>
    new FeedProblem(
      key
        ? `The release feed refused this deployment’s read key (${status}). Check the token in secrets/github-read-key can still read the repository’s packages, and that GITHUB_READ_USER is its account (docs/upgrade.md).`
        : `The release feed refused the registry (${status}). A private repository needs a read key: see docs/upgrade.md.`,
    );
  const tokenRes = await call(
    `https://${host}/token?service=${encodeURIComponent(host)}&scope=${encodeURIComponent(`repository:${repository}:pull`)}`,
    key ? { authorization: `Basic ${Buffer.from(`${key.user}:${key.token}`).toString('base64')}` } : {},
  );
  if (!tokenRes.ok) throw refused(tokenRes.status);
  const { token } = (await tokenRes.json().catch(() => ({}))) as { token?: string };
  if (!token) throw refused(tokenRes.status);
  const auth = { authorization: `Bearer ${token}` };
  const manifestRes = await call(`https://${host}/v2/${repository}/manifests/${tag}`, { ...auth, accept: 'application/vnd.oci.image.manifest.v1+json' });
  if (manifestRes.status === 401 || manifestRes.status === 403 || manifestRes.status === 404) throw refused(manifestRes.status);
  if (!manifestRes.ok) throw new FeedProblem(`The release feed answered ${manifestRes.status}. Try again later.`);
  const manifest = (await manifestRes.json().catch(() => ({}))) as { layers?: { digest?: string; mediaType?: string }[] };
  const layers = manifest.layers ?? [];
  const signature = layers.find((l) => l.mediaType === BUNDLE_MEDIA_TYPE);
  const digest = layers.find((l) => l !== signature)?.digest;
  if (!digest) throw new FeedProblem('The release feed has no file in it. Check RELEASE_FEED_URL.');
  // A blob is a redirect to storage elsewhere; fetch drops the token on the way.
  const blob = async (d: string) => {
    const res = await call(`https://${host}/v2/${repository}/blobs/${d}`, auth);
    if (!res.ok) throw new FeedProblem(`The release feed answered ${res.status}. Try again later.`);
    return res.text();
  };
  return { text: await blob(digest), ...(signature?.digest ? { bundle: await blob(signature.digest) } : {}) };
};

/**
 * Reads releases from `url`: GitHub's releases API (the `augur@<version>` ones, with their
 * augur-release.json asset) or a mirror's JSON, which is a list of release files or `{ releases: [...] }`.
 * A mirror's feed can be a file on the server too (`file:///…`), for one that can't reach any web server.
 * On GitHub a release marked pre-release is beta; promoting it to stable is unticking that.
 */
export const releaseFeed =
  ({ url, token, key, fetchImpl, ...checking }: { url: string; token?: string; key?: ReadKey; fetchImpl?: typeof fetch } & FeedChecking): ReleaseFeed => {
  // One source for every read, so it remembers the newest feed it accepted.
  const source = feedSource({ token, key, fetchImpl, ...checking });
  return async (running) => {
    const get = feedReader({ token, key, fetchImpl });
    const { body, trust } = await source(url, 'application/vnd.github+json, application/json');
    const items: unknown[] = Array.isArray(body) ? body : Array.isArray((body as { releases?: unknown })?.releases) ? (body as { releases: unknown[] }).releases : [];

    if (items.some(isManifest)) {
      // The feed, or a mirror's: the release files themselves.
      const releases = items.filter(isManifest).map((m) => {
        const halted = haltOf(m);
        return { version: m.version, channel: feedChannel(m.version, m.channel !== 'stable'), released: m.released, ...(m.notesUrl ? { notesUrl: m.notesUrl } : {}), manifest: m, ...(halted ? { halted } : {}) };
      });
      return { releases, trust };
    }

    const releases = (items as GitHubRelease[])
      .filter((r) => typeof r?.tag_name === 'string' && r.tag_name.startsWith('augur@') && !r.draft && semver.valid(r.tag_name.slice('augur@'.length)))
      .map((r) => ({ release: r, version: r.tag_name.slice('augur@'.length) }))
      .sort((a, b) => semver.rcompare(a.version, b.version));
    // The running release, so many newer ones, and the few older ones it could go back to.
    const wanted = new Set([
      ...releases.filter((r) => semver.gte(r.version, running)).slice(0, MANIFESTS_READ + 1),
      ...releases.filter((r) => semver.lt(r.version, running)).slice(0, GO_BACK_LISTED),
    ].map((r) => r.version));
    const read = await Promise.all(
      releases.map(async ({ release, version }): Promise<FeedRelease> => {
        const base: FeedRelease = { version, channel: feedChannel(version, release.prerelease), released: release.published_at, notesUrl: release.html_url };
        // A release the Halt rollout workflow halted carries halted.json.
        const halted = release.assets?.some((a) => a.name === 'halted.json') ? haltOf({ halted: await get(release.assets.find((a) => a.name === 'halted.json')!.url, 'application/octet-stream').catch(() => ({ reason: 'Halted by the publisher.' })) }) : undefined;
        const withHalt = halted ? { ...base, halted } : base;
        const asset = release.assets?.find((a) => a.name === 'augur-release.json');
        if (!wanted.has(version) || !asset) return withHalt;
        // Asked for as bytes, GitHub redirects to the file; fetch drops the token on the way.
        const manifest = await get(asset.url, 'application/octet-stream').catch(() => undefined);
        return isManifest(manifest) ? { ...withHalt, manifest } : withHalt;
      }),
    );
    return { releases: read, trust };
  };
};

/**
 * The deployment's read key: a token in secrets/github-read-key (or GITHUB_READ_KEY) that can read this
 * repository's packages, and GITHUB_READ_USER, the account it belongs to. Undefined without both.
 */
export const readKeyFromEnv = (env = process.env): ReadKey | undefined => {
  const file = env.GITHUB_READ_KEY_FILE ?? '/run/secrets/augur/github-read-key';
  const token = (existsSync(file) ? readFileSync(file, 'utf8').trim() : '') || env.GITHUB_READ_KEY || '';
  const user = env.GITHUB_READ_USER || '';
  return token && user ? { user, token } : undefined;
};

/** The registry's read-only token for GitHub's releases API (before read keys): a Docker secret, or RELEASE_FEED_TOKEN. */
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
  /** Whether the feed the releases came from can be trusted (ADR 0017). */
  trust?: FeedTrust;
}

/** Checks the feed once a day and when an admin asks, and keeps what it found. Never restarts anything. */
/** The release this server runs. `build: 'source'` when it was built from a checkout, not pulled. */
export interface Running {
  version: string;
  channel: Channel;
  build?: 'source';
}

export class UpdateChecker {
  readonly running: Running;
  readonly channel: Channel;
  readonly ring: Ring;
  /** Why the channel isn't the one asked for, when it isn't. */
  readonly channelNote?: string;
  private readonly feed?: ReleaseFeed;
  private readonly now: () => Date;
  private last: CheckResult = { releases: [] };
  private inFlight?: Promise<CheckResult>;
  private timer?: ReturnType<typeof setInterval>;

  constructor({ feed, running, channel, ring = 'preview', now = () => new Date() }: { feed?: ReleaseFeed; running: Running; channel?: Channel; ring?: Ring; now?: () => Date }) {
    this.feed = feed;
    this.running = running;
    this.ring = ring;
    // The workbench follows dev builds and a preview server preview, unless told otherwise; a production
    // server only ever stable, and only the workbench takes dev builds.
    const wanted = channel ?? (takesAugurDevBuilds(ring) ? 'dev' : takesPreview(ring) ? 'beta' : 'stable');
    this.channel = !takesPreview(ring) ? 'stable' : wanted === 'dev' && !takesAugurDevBuilds(ring) ? 'beta' : wanted;
    if (wanted !== this.channel) {
      this.channelNote = this.channel === 'stable' ? `${PRODUCTION_ONLY} RELEASE_CHANNEL=${wanted} is ignored.` : 'Only the workbench (SERVER_RING=dev) takes AUGUR’s dev builds, so this server follows Preview. RELEASE_CHANNEL=dev is ignored.';
    }
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
        const read = await feed(this.running.version);
        this.last = Array.isArray(read) ? { checkedAt: this.now().toISOString(), releases: read } : { checkedAt: this.now().toISOString(), releases: read.releases, ...(read.trust ? { trust: read.trust } : {}) };
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
  /** What changed in it, each change once (absent for a release made before changelogs were attached). */
  changes?: Change[];
  /** Halted by the publisher: listed, never offered. */
  halted?: Halt;
}

/**
 * A setting the updater makes up when a release needs it and the server hasn't got it: a long random
 * string, as infra/deploy/.env.example says of any whose name ends so (platform/services/updater).
 */
export const madeUpSetting = (key: string) => /_(SECRET|PASSWORD|TOKEN)$/.test(key) && key !== 'PLATFORM_ADMIN_PASSWORD';

/** Something a person has to do or know before upgrading. */
export type NeedsYou =
  | { kind: 'path'; version: string; message: string }
  | { kind: 'setting'; key: string; required: boolean; madeUp?: boolean; message: string }
  | { kind: 'breaking'; version: string; message: string }
  | { kind: 'app'; app: string; message: string }
  | { kind: 'unknown'; version: string; message: string }
  | { kind: 'halted'; version: string; message: string };

/** One part that changes in the upgrade. */
export interface PartChange {
  name: string;
  from?: string;
  to: string;
}

/** One upgrade in the Updates page's history: who asked, from and to, and how it ended. */
export interface HistoryEntry {
  id: string;
  from: string;
  version: string;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: string;
  state: Upgrade['state'];
  message?: string;
  finishedAt?: string;
  /** The backup the updater took first, when it says. */
  backup?: string;
}

/** An upgrade as the history shows it: without its images and steps, with the backup it took. */
export const historyEntry = (u: Upgrade): HistoryEntry => {
  const backup = u.steps.find((s) => s.step === 'backup' && s.state === 'done')?.message?.match(/(platform-\S+\.sql\.gz)/)?.[1];
  return {
    id: u.id,
    from: u.from,
    version: u.version,
    requestedBy: u.requestedBy,
    ...(u.requestedByName ? { requestedByName: u.requestedByName } : {}),
    requestedAt: u.requestedAt,
    state: u.state,
    ...(u.message ? { message: u.message } : {}),
    ...(u.finishedAt ? { finishedAt: u.finishedAt } : {}),
    ...(backup ? { backup } : {}),
  };
};

/** An earlier release this server could go back to, and why not when it can't. */
export interface GoBackTarget {
  version: string;
  channel: Channel;
  released?: string;
  /** Absent when it can go back straight: the code goes back, and the data stays as it is. */
  problem?: string;
  /** Going back across a breaking release: only by hand, restoring the backup taken before it. */
  breakingAfter?: string;
  halted?: Halt;
}

/** How many earlier releases the Updates page offers to go back to. */
const GO_BACK_LISTED = 5;

/**
 * The releases older than the running one that the server could go back to (docs/release-channels.md,
 * Going back). Straight back is only safe while no release between is breaking: within that, migrations
 * only add, so an older release still works on the tables a newer one left.
 */
export const goBackTargets = (checker: UpdateChecker): GoBackTarget[] => {
  const { running, channel } = checker;
  const releases = checker.result.releases;
  const onChannel = (r: FeedRelease) => follows(channel, r.channel);
  const older = releases.filter((r) => onChannel(r) && semver.lt(r.version, running.version)).sort((a, b) => semver.rcompare(a.version, b.version)).slice(0, GO_BACK_LISTED);
  return older.map((r) => {
    const base = { version: r.version, channel: r.channel, ...(r.released ? { released: r.released } : {}), ...(r.halted ? { halted: r.halted } : {}) };
    if (r.halted) return { ...base, problem: `AUGUR ${r.version} was halted by its publisher: ${r.halted.reason}` };
    // Every release after it, up to and including the running one: what going back undoes.
    const between = releases.filter((b) => semver.gt(b.version, r.version) && semver.lte(b.version, running.version));
    const breaking = between.filter((b) => b.manifest?.breaking.length).sort((a, b) => semver.compare(a.version, b.version))[0];
    if (breaking) {
      return { ...base, breakingAfter: breaking.version, problem: `AUGUR ${breaking.version} is breaking (${breaking.manifest!.breaking[0]}), so ${r.version} may not work on the tables it left. Go back by hand and restore the backup taken before upgrading to ${breaking.version} (docs/upgrade.md, Going back).` };
    }
    const unknown = between.find((b) => !b.manifest);
    if (unknown) return { ...base, problem: `AUGUR ${unknown.version}’s release file couldn’t be read, so whether going back past it is safe isn’t known.` };
    if (!r.manifest?.images || !Object.keys(r.manifest.images).length) return { ...base, problem: `AUGUR ${r.version}’s release file couldn’t be read or names no images, so the updater can’t run it.` };
    return base;
  });
};

/** What the Updates page shows (see contracts/registry.openapi.yaml). */
export interface UpdatesView {
  running: Running;
  channel: Channel;
  /** What kind of server this is (SERVER_RING), which bounds the channel. */
  ring: Ring;
  channelNote?: string;
  feed: 'on' | 'off';
  /** Whether the feed itself can be trusted: signed and in date, a mirror's, or not checked (ADR 0017). */
  feedTrust?: FeedTrust;
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
  /** Earlier releases to go back to, newest first, each with why not when it can't. */
  goBack: GoBackTarget[];
}

const summary = (r: FeedRelease): ReleaseSummary => ({
  version: r.version,
  channel: r.channel,
  ...(r.released ? { released: r.released } : {}),
  ...(r.notesUrl ? { notesUrl: r.notesUrl } : {}),
  breaking: r.manifest?.breaking ?? [],
  ...(r.manifest?.changelogs ? { changes: releaseChanges(r.manifest.changelogs) } : {}),
  ...(r.halted ? { halted: r.halted } : {}),
});

/** Whether a release's `upgradeFrom` lets the running version take it straight. */
const reachable = (r: FeedRelease, running: string) => r.manifest !== undefined && semver.satisfies(running, r.manifest.upgradeFrom, { includePrerelease: true });

/**
 * What an upgrade from the running release would take: the newest release on the channel, how to
 * get there, and what has to be done first. Pure, so the page and its tests agree.
 */
export const updatesView = ({ checker, apps }: { checker: UpdateChecker; apps: AppRecord[] }): UpdatesView => {
  const { running, channel } = checker;
  const { checkedAt, problem, releases, trust } = checker.result;
  const base = { running, channel, goBack: goBackTargets(checker), ring: checker.ring, ...(checker.channelNote ? { channelNote: checker.channelNote } : {}), feed: checker.on ? ('on' as const) : ('off' as const), ...(trust ? { feedTrust: trust } : {}), ...(checkedAt ? { checkedAt } : {}), ...(problem ? { problem } : {}) };
  const onChannel = (r: FeedRelease) => follows(channel, r.channel);
  // Halted releases stay listed, saying so, but are never offered (ADR 0018).
  const listed = releases.filter((r) => onChannel(r) && semver.gt(r.version, running.version)).sort((a, b) => semver.rcompare(a.version, b.version));
  const newer = listed.filter((r) => !r.halted);
  const newestBeta = releases.filter((r) => r.channel === 'beta' && !r.halted && semver.gt(r.version, newer[0]?.version ?? running.version)).sort((a, b) => semver.rcompare(a.version, b.version))[0];
  // Only a preview server can switch to it, so only one is told of it.
  const beta = channel === 'stable' && takesPreview(checker.ring) && newestBeta ? summary(newestBeta) : undefined;
  // Running a release its publisher halted: say so first, and where to go.
  const runningHalt = releases.find((r) => r.version === running.version)?.halted;
  const haltNeed = (to?: string): NeedsYou[] => {
    if (!runningHalt) return [];
    const back = goBackTargets(checker).find((t) => !t.problem)?.version;
    const where = to ? `Upgrade to ${to}.` : back ? `Go back to ${back}, or wait for a fixed release.` : 'Wait for a fixed release, or go back by hand (docs/upgrade.md, Going back).';
    return [{ kind: 'halted', version: running.version, message: `AUGUR ${running.version}, which this server runs, was halted by its publisher: ${sentence(runningHalt.reason)} ${where}` }];
  };
  if (!newer.length) return { ...base, newer: listed.map(summary), ...(beta ? { beta } : {}), needsYou: haltNeed() };

  const available = newer[0];
  const needsYou: NeedsYou[] = haltNeed(available.version);
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
      if (required && madeUpSetting(key)) {
        needsYou.push({ kind: 'setting', key, required, madeUp: true, message: `${key} is new. Upgrading from here makes one up; upgrading by hand, set it in .env (openssl rand -hex 32).` });
        continue;
      }
      needsYou.push({ kind: 'setting', key, required, message: required ? `Set ${key}: ${next.version} won’t start without it. Enter it when you upgrade, or put it in .env.` : `${key} is a new, optional setting.` });
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
    newer: listed.map(summary),
    ...(beta ? { beta } : {}),
    ...(next.manifest && reachable(next, running.version) ? { next: next.version } : {}),
    needsYou,
  };
};

/**
 * The dev build the workbench should upgrade to by itself, if any (docs/release-channels.md, "AUGUR dev
 * builds"): only on the workbench following dev builds, only a dev build, only when nothing needs a
 * person (a setting the updater can make up, or an optional one, doesn't), and never one asked for before:
 * one that didn't finish, or that an admin went back from, waits for an admin. Nothing starts by itself
 * until an admin has upgraded AUGUR on this server once (firstUpgradeProblem).
 */
export const automaticDevUpgrade = (view: UpdatesView, history: Pick<Upgrade, 'version' | 'state' | 'requestedBy'>[]): string | undefined => {
  if (!takesAugurDevBuilds(view.ring) || view.channel !== 'dev' || !view.next || !isDevBuild(view.next)) return undefined;
  if (firstUpgradeProblem(history)) return undefined;
  if (view.needsYou.some((n) => n.kind !== 'setting' || (n.required && !n.madeUp))) return undefined;
  if (history.some((u) => u.version === view.next)) return undefined;
  return view.next;
};

/**
 * The release AUGUR should upgrade to by itself under its desired state (ADR 0020), if any: the next
 * release when the policy is Automatic and reaches it, inside the pin, while a window is open, when
 * nothing needs a person, and never one asked for before (one that didn't finish waits for an admin), and not before an admin
 * has upgraded AUGUR on this server once (firstUpgradeProblem).
 * The workbench's dev builds go by automaticDevUpgrade instead.
 */
export const automaticUpgrade = (view: UpdatesView, state: DesiredState, history: Pick<Upgrade, 'version' | 'state' | 'requestedBy'>[], now: Date): string | undefined => {
  if (!view.next || isDevBuild(view.next)) return undefined;
  if (firstUpgradeProblem(history)) return undefined;
  if (automaticProblem(state, view.running.version, view.next) || !windowAt(state, now).open) return undefined;
  if (view.needsYou.some((n) => n.kind !== 'setting' || (n.required && !n.madeUp))) return undefined;
  if (history.some((u) => u.version === view.next)) return undefined;
  return view.next;
};

