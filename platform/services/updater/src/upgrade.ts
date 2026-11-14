/**
 * One upgrade, start to end: check the release fits the server, take a backup and prove it
 * restores, pull the release's images and check they are the ones it names, then restart each
 * part on them in turn. When a part doesn't come back on its new version, every part goes back
 * to the release it was on. Each step is reported to the registry, which shows it on Admin's
 * Updates page.
 *
 * When the registry asks for it (`watch`), the upgrade isn't done until the new release has run for
 * WATCH_MS with sign-in working and few calls failing at the gateway (ADR 0020); if it falls over in
 * that time, the server goes back by itself, unless a breaking release lies between.
 *
 * Once any part has restarted on the new release it may have changed the data, so with a breaking
 * release between, nothing goes back by itself from then on.
 *
 * Before anything changes, the updater writes down what it needs to go back (the journal, in the deploy
 * folder), so an updater that restarts partway through can still go back (afterRestart).
 *
 * Outcomes: `done` (on the new release), `rolled-back` (on the release it started from, whether
 * or not anything was restarted) and `failed` (it couldn't go back either: someone has to look).
 */
import { createHash, randomBytes } from 'node:crypto';
import { isDevBuild } from './signers.ts';
import { envQuoted, envValue, withEnvValue } from './env-file.ts';
import { partsFor, type Parts } from './parts.ts';

/** What the registry hands the updater for the open upgrade (GET /v1/platform/upgrade/target). */
export interface Target {
  id: string;
  from: string;
  version: string;
  /** Each part's image by digest, keyed by its Compose service. */
  images: Record<string, string>;
  state: 'requested' | 'running';
  /** Each part's version in the release, by package name. */
  parts?: Record<string, string>;
  /** Settings the release won't start without. */
  required?: string[];
  /** The release's files in infra/deploy, by path inside it, as sha256. */
  deploy?: Record<string, string>;
  /** Settings the admin entered on the Updates page when they asked, for .env. */
  settings?: Record<string, string>;
  /**
   * Watch the new release before calling it done (ADR 0020). `breakingSince`: a breaking release
   * between, which makes going back by itself unsafe, so a problem is reported for a person instead.
   */
  watch?: { breakingSince?: string };
}

export type Step = 'preflight' | 'backup' | 'pull' | 'roll-forward' | 'verify' | 'watch' | 'roll-back';
export type Outcome = 'done' | 'rolled-back' | 'failed';

export interface Report {
  step: Step;
  state: 'running' | 'done' | 'failed';
  message?: string;
  outcome?: Outcome;
  /** How many of AUGUR's calls the watch judged by, so the registry knows when it was too quiet. */
  calls?: number;
}

/** Tells the registry how a step went. Throws Withdrawn when the upgrade isn't open any more. */
export type Reporter = (report: Report) => Promise<void>;

/** The upgrade was cancelled, or ended, before the updater got to it. */
export class Withdrawn extends Error {}

/**
 * What the updater writes down before an upgrade changes anything, so that one restarted partway through
 * can go back: the settings and deploy files as they were, and how far it had got. It holds the old .env.
 */
export interface Journal {
  id: string;
  from: string;
  version: string;
  /** .env as it was. */
  before: string;
  /** The deploy files the upgrade writes, as they were (base64), null for one that wasn't there. */
  oldFiles: Record<string, string | null>;
  /** Whether the release's deploy files have been written. */
  filesWritten: boolean;
  /** The parts the upgrade restarts, in order. */
  services: string[];
  /** Parts the release adds, the rest of what the deployment runs, and parts it stopped. */
  fresh: string[];
  others: string[];
  left: string[];
  breakingSince?: string;
  /** Whether any part had been restarted on the new release, which may have changed the data. */
  restarted: boolean;
  /** The step it had got to: in verify or the watch, every part is on the new release. */
  step?: Step;
  backup?: string;
}

/** What the updater does to the server. The real one drives Docker Compose (server.ts); tests use a fake. */
export interface Server {
  readEnv(): Promise<string>;
  writeEnv(text: string): Promise<void>;
  /** The sha256 of each file, by path inside infra/deploy; undefined for one that isn't there. */
  hashDeployFiles(paths: string[]): Promise<Record<string, string | undefined>>;
  /**
   * The sha256 of each of the running release's own deploy files, which this updater's image carries;
   * undefined when it carries none (an updater from before it did).
   */
  ownDeployHashes(paths: string[]): Promise<Record<string, string | undefined> | undefined>;
  /** The server's deploy files as they are now; undefined for one that isn't there. */
  readDeployFiles(paths: string[]): Promise<Record<string, Buffer | undefined>>;
  /** These deploy files as the release's updater image (`ref`, by digest, already pulled) carries them. */
  releaseDeployFiles(ref: string, paths: string[]): Promise<Record<string, Buffer | undefined>>;
  /** Writes each deploy file whole, or removes it when it's undefined. */
  writeDeployFiles(files: Record<string, Buffer | undefined>): Promise<void>;
  /** The services the deployment runs, as its compose.yml and settings have them now. */
  services(): Promise<string[]>;
  /** The services that mount any of these deploy files (or a folder holding one). */
  mounting(paths: string[]): Promise<string[]>;
  /** Stops and removes these services' containers. */
  remove(services: string[]): Promise<void>;
  /** Makes these services' containers again, changed or not, so they read files written since they started. */
  recreate(services: string[]): Promise<void>;
  /** Throws unless `ref` (an image by digest) was signed by AUGUR's Release workflow, or by `identity` when given. */
  verifySignature(ref: string, identity?: string): Promise<void>;
  /** Takes a fresh backup and returns its file name. */
  backup(): Promise<string>;
  /** Throws unless the newest backup restores. */
  restoreTest(): Promise<void>;
  /** Pulls these services' images for `version`, without starting anything. */
  pull(services: string[], version: string): Promise<void>;
  /** The digests a service's image for `version` is known by, once pulled. */
  digests(service: string, version: string): Promise<string[]>;
  /** The image each service names for `version`, as the compose.yml on the server has it now. */
  images(version: string): Promise<Record<string, string>>;
  /** Recreates these services on the version the settings file names, leaving the others alone. */
  up(services: string[]): Promise<void>;
  /** What a service's /healthz says, or undefined while it doesn't answer. */
  health(service: string): Promise<{ version?: string } | undefined>;
  /** How calls through the gateway answered in the last `minutes`; undefined when it can't be asked. */
  traffic(minutes: number): Promise<{ requests: number; serverErrors: number } | undefined>;
  /** Why signing in wouldn't work now (the sign-in service doesn't answer for the realm), or nothing. */
  signInProblem(): Promise<string | undefined>;
  /** How a one-off job's container ended: its exit code, or undefined while it runs. */
  exitCode(service: string): Promise<number | undefined>;
  wait(ms: number): Promise<void>;
  /** The bytes free on the deploy folder's disk; undefined when it can't be told. */
  freeBytes(): Promise<number | undefined>;
  /** The open upgrade's journal, written whole; undefined when there is none. */
  readJournal(): Promise<Journal | undefined>;
  writeJournal(journal: Journal): Promise<void>;
  clearJournal(): Promise<void>;
}

/** Itself: pulled with the rest, and replaced only after the upgrade has ended (see index.ts). */
export const UPDATER = 'updater';
/** Its line to Docker: left running through an upgrade, which it carries. */
const DOCKER_PROXY = 'docker-proxy';

/**
 * A setting the updater makes up itself when a release needs it and the server hasn't got it: a long
 * random string, as infra/deploy/.env.example says of any whose name ends so.
 */
export const madeUp = (key: string) => /_(SECRET|PASSWORD|TOKEN)$/.test(key) && key !== 'PLATFORM_ADMIN_PASSWORD';
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
/**
 * How long a part has to come back on its new version, and a one-off job to finish. Identity, the
 * registry and events migrate their databases on their first start of a new release, which can take
 * minutes on a big one.
 */
export const READY_MS = 5 * 60_000;
const POLL_MS = 2_000;

/** How long a new release is watched before the upgrade is done, and how often it's looked at (ADR 0020). */
export const WATCH_MS = 10 * 60_000;
export const WATCH_EVERY_MS = 30_000;
/** More than this share of the gateway's calls failing (5xx) means the release isn't working... */
export const ERROR_RATE = 0.05;
/** ...once there have been enough calls to tell. */
export const MIN_CALLS = 20;
/** Sign-in failing this many looks in a row means it's down, not a blip. */
export const SIGN_IN_LOOKS = 2;

/** The least free space the deploy folder's disk needs for an upgrade: the backup and the new images usually land there. */
export const MIN_FREE_BYTES = 2 * 1024 ** 3;
const gib = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GiB`;

/**
 * Settings that decide what the server trusts or where it pulls from. Only .env on the server sets
 * them: an upgrade that asks to is refused, whatever the registry passed on. The list mirrors the
 * registry's (registry/src/updates.ts), with what the updater itself reads besides; COMPOSE_* settings
 * decide which files and project Compose uses.
 */
export const TRUST_SETTINGS = new Set([
  'SERVER_RING',
  'RELEASE_CHANNEL',
  'ALLOW_PR_PREVIEWS',
  'IMAGE_SIGNER',
  'IMAGE_SIGNER_ISSUER',
  'AUGUR_DEV_SIGNER',
  'FEED_SIGNER',
  'APP_PUBLISHERS',
  'CALLER_SIGNING_KEY',
  'RELEASE_FEED_URL',
  'APP_FEED_URL',
  'PIPELINE_FEED_URL',
  'PLATFORM_IMAGES',
  'PLATFORM_DIR',
  'APPS_NETWORK',
  'APP_SECRETS_KEY',
  'GITHUB_READ_USER',
  'IMAGE_PULL_USER',
  'UPDATER_CLIENT_SECRET',
]);
const trustSetting = (key: string) => TRUST_SETTINGS.has(key) || key.startsWith('COMPOSE_');
/** A plain setting's name, as .env.example writes them. */
const SETTING_NAME = /^[A-Z][A-Z0-9_]*$/;

const digestOf = (ref: string) => ref.slice(ref.lastIndexOf('@') + 1);

/** Where the deployment pulls images from: PLATFORM_IMAGES, or where the release put them. */
const imageRepo = (env: string, ref: string) => envValue(env, 'PLATFORM_IMAGES') || ref.slice(0, ref.lastIndexOf('/'));

class StepFailed extends Error {}

/** Waits until each service answers with the version the release gives it (any version when it gives none). */
const ready = async (server: Server, parts: Parts, services: readonly string[], versionOf: (service: string) => string | undefined) => {
  for (const service of services) {
    if (parts.roles[service] === 'job') {
      await finished(server, service);
      continue;
    }
    if (parts.roles[service] === 'worker') {
      await running(server, service);
      continue;
    }
    const want = versionOf(service);
    const allowed = parts.readyMs[service] ?? READY_MS;
    let seen: string | undefined;
    for (let waited = 0; ; waited += POLL_MS) {
      const health = await server.health(service).catch(() => undefined);
      seen = health?.version;
      if (health && (!want || health.version === want)) break;
      if (waited >= allowed) {
        throw new StepFailed(health ? `${service} came back on ${seen ?? 'an unknown version'}, not ${want}.` : `${service} didn’t answer within ${allowed / 1000} s.`);
      }
      await server.wait(POLL_MS);
    }
  }
};

const finished = async (server: Server, service: string) => {
  for (let waited = 0; ; waited += POLL_MS) {
    const code = await server.exitCode(service).catch(() => undefined);
    if (code === 0) return;
    if (code !== undefined) throw new StepFailed(`${service} stopped with an error (exit code ${code}); its logs say why.`);
    if (waited >= READY_MS) throw new StepFailed(`${service} didn’t finish within ${READY_MS / 1000} s.`);
    await server.wait(POLL_MS);
  }
};

/** A worker has nothing to ask: it's ready when it's still running a little after it started. */
const running = async (server: Server, service: string) => {
  await server.wait(POLL_MS);
  const code = await server.exitCode(service).catch(() => undefined);
  if (code !== undefined) throw new StepFailed(`${service} stopped (exit code ${code}); its logs say why.`);
};

/** What's wrong with AUGUR's calls in the last `minutes`, when enough of them failed to judge by; else nothing. */
const tooManyErrors = (calls: { requests: number; serverErrors: number }, minutes: number) =>
  calls.requests >= MIN_CALLS && calls.serverErrors / calls.requests > ERROR_RATE
    ? `${calls.serverErrors} of the ${calls.requests} calls to AUGUR’s services in the last ${minutes} minute${minutes === 1 ? '' : 's'} failed, more than ${ERROR_RATE * 100}%.`
    : undefined;

/**
 * Watches the new release for WATCH_MS: sign-in must keep working, every part must stay ready, and
 * AUGUR's own calls through the gateway must mostly succeed. Throws StepFailed with what it saw when
 * any stops being so. Says how many calls it judged by, so a quiet watch (fewer than MIN_CALLS, as
 * in a night-time window) isn't taken for one that saw errors stay low.
 */
const watch = async (server: Server, parts: Parts, services: readonly string[], versionOf: (service: string) => string | undefined): Promise<{ calls?: number }> => {
  let signInMisses = 0;
  let judged: number | undefined;
  for (let watched = WATCH_EVERY_MS; watched <= WATCH_MS; watched += WATCH_EVERY_MS) {
    await server.wait(WATCH_EVERY_MS);
    const problem = await server.signInProblem().catch((err) => reason(err));
    signInMisses = problem ? signInMisses + 1 : 0;
    if (signInMisses >= SIGN_IN_LOOKS) throw new StepFailed(`Signing in stopped working after the upgrade: ${problem}`);
    // The gateway restarted in the upgrade, so everything it counted is since then.
    const minutes = Math.min(10, Math.ceil(watched / 60_000));
    const calls = await server.traffic(minutes).catch(() => undefined);
    const failing = calls && tooManyErrors(calls, minutes);
    if (failing) throw new StepFailed(failing);
    if (calls) judged = calls.requests;
    // Every part must stay up, not only be up at the start: a part that falls over meanwhile is seen.
    if (watched % (2 * 60_000) === 0) await ready(server, parts, services, versionOf);
  }
  await ready(server, parts, services, versionOf);
  return { calls: judged };
};

/** How the watch went, in a sentence, saying when there were too few calls to judge errors by. */
export const watchedSentence = (version: string, { calls }: { calls?: number }) => {
  const held = `AUGUR ${version} ran for ${WATCH_MS / 60_000} minutes with sign-in working and every part ready`;
  if (calls === undefined) return `${held}. The gateway doesn’t count calls yet, so errors weren’t judged.`;
  if (calls < MIN_CALLS) return `${held}. Too quiet to judge errors: ${calls} call${calls === 1 ? '' : 's'} to AUGUR’s services, and it takes ${MIN_CALLS}, so a light watch goes on until there are, for up to a day.`;
  return `${held}, and AUGUR’s services answered ${calls} calls with few errors.`;
};

/** The light watch's next look, from the registry (registry.ts, afterWatch). */
export interface AfterWatchLook {
  id: string;
  version: string;
  minutes: number;
}

/**
 * One look of the light watch after a quiet watch (ADR 0020, amended 2 Nov): AUGUR's own calls since
 * the last look, and whether sign-in works. The registry keeps the count and decides when it ends.
 */
export const lookAfterWatch = async (look: AfterWatchLook, server: Pick<Server, 'traffic' | 'signInProblem'>) => {
  const calls = await server.traffic(look.minutes).catch(() => undefined);
  const signInProblem = await server.signInProblem().catch((err) => reason(err));
  return { id: look.id, calls: calls?.requests ?? 0, serverErrors: calls?.serverErrors ?? 0, ...(signInProblem ? { signInProblem } : {}) };
};

/** What a part's look found now: nothing when it's ready, else why not. Nothing is waited for. */
const partProblem = async (server: Pick<Server, 'health' | 'exitCode'>, parts: Parts, service: string) => {
  const role = parts.roles[service];
  if (role === 'job' || role === 'worker') {
    // A job still running, or one Compose doesn't know of here, isn't a problem yet; a worker must not have stopped.
    const code = await server.exitCode(service).catch(() => undefined);
    if (code === undefined || (role === 'job' && code === 0)) return undefined;
    return `${service} stopped${role === 'job' ? ' with an error' : ''} (exit code ${code}); its logs say why.`;
  }
  const health = await server.health(service).catch(() => undefined);
  return health ? undefined : `${service} doesn’t answer.`;
};

/** What one look found: whether all was well, what was looked at, and each problem in a sentence. */
export interface CheckResult {
  ok: boolean;
  checked: { signIn: true; parts: string[]; calls: { minutes: number; requests: number; serverErrors: number } | null };
  problems: string[];
}

/**
 * One look of the watch after an upgrade, on demand (`node dist/index.js check`): sign-in works, each
 * of `services` is ready now, and AUGUR's own calls through the gateway in the last `minutes` mostly
 * succeeded. The watch lets sign-in miss once and waits for parts to come back; one look doesn't, so
 * anything wrong now is a problem. The deploy test breaks AUGUR on purpose and needs this to see it
 * (The deploy test in the AUGUR handbook, 03 Architecture/Engineering). `parts`: what each part is (parts.ts), with the apps that ship with this release.
 */
export const checkOnce = async (server: Pick<Server, 'signInProblem' | 'traffic' | 'health' | 'exitCode'>, services: readonly string[], minutes = WATCH_MS / 60_000, parts: Parts = partsFor()): Promise<CheckResult> => {
  const problems: string[] = [];
  const signIn = await server.signInProblem().catch((err) => reason(err));
  if (signIn) problems.push(`Signing in doesn’t work: ${signIn}`);
  const calls = await server.traffic(minutes).catch(() => undefined);
  const failing = calls && tooManyErrors(calls, minutes);
  if (failing) problems.push(failing);
  for (const service of services) {
    const problem = await partProblem(server, parts, service);
    if (problem) problems.push(problem);
  }
  return {
    ok: !problems.length,
    checked: { signIn: true, parts: [...services], calls: calls ? { minutes, requests: calls.requests, serverErrors: calls.serverErrors } : null },
    problems,
  };
};

/** What went wrong, for the page: a message we wrote, or the first line of anything else. */
const reason = (err: unknown) => (err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 500);

/**
 * `devIdentity`: who signs AUGUR's dev builds (signers.ts). Only a dev server (SERVER_RING=dev, the
 * workbench) runs one, and only with images signed by that workflow on dev.
 * `parts`: the parts this updater restarts (parts.ts), with the apps that ship with this release.
 */
export const runUpgrade = async (target: Target, server: Server, report: Reporter, { devIdentity, parts = partsFor() }: { devIdentity?: string; parts?: Parts } = {}): Promise<Outcome> => {
  const services = parts.order.filter((s) => target.images[s]);
  // A platform service's part is @augur/<service>; an app that ships with AUGUR is @apps/<its id>.
  const versionOf = (service: string) => (service === 'web' ? undefined : (target.parts?.[`@augur/${service}`] ?? target.parts?.[`@apps/${service}`]));
  const before = await server.readEnv();
  let step: Step = 'preflight';
  let backup: string | undefined;
  // The release's deploy files that differ from the server's, as the release has them, and as the server had them.
  let changedFiles: Record<string, Buffer | undefined> = {};
  let oldFiles: Record<string, Buffer | undefined> = {};
  // Settings the release needs that the updater makes up, and the services it pulled before writing new files.
  let settings = before;
  const madeKeys: string[] = [];
  const enteredKeys: string[] = [];
  let pulledFirst: string[] = [];
  let switched: string[] = [];
  // Parts this release adds, the rest of what the deployment runs (the database, sign-in, storage), and parts it stops.
  let fresh: string[] = [];
  let others: string[] = [];
  let left: string[] = [];
  // Once a part has restarted on the new release, its data may have changed.
  let restarted = false;
  let filesWritten = false;
  const note = () =>
    server.writeJournal({
      id: target.id,
      from: target.from,
      version: target.version,
      before,
      oldFiles: Object.fromEntries(Object.entries(oldFiles).map(([path, bytes]) => [path, bytes ? bytes.toString('base64') : null])),
      filesWritten,
      services: [...services],
      fresh,
      others,
      left,
      ...(target.watch?.breakingSince ? { breakingSince: target.watch.breakingSince } : {}),
      restarted,
      step,
      ...(backup ? { backup } : {}),
    });

  const run = async (name: Step, work: () => Promise<string | void>) => {
    step = name;
    await report({ step, state: 'running' });
    const message = await work();
    await report({ step, state: 'done', ...(message ? { message } : {}) });
  };

  try {
    await run('preflight', async () => {
      if (envValue(before, 'PLATFORM_VERSION') !== target.from) {
        throw new StepFailed(`The server’s settings say it runs ${envValue(before, 'PLATFORM_VERSION') ?? 'no version'}, not ${target.from}. Set PLATFORM_VERSION in .env to what it runs.`);
      }
      const dev = isDevBuild(target.version);
      if (dev && envValue(before, 'SERVER_RING') !== 'dev') {
        throw new StepFailed(`${target.version} is a dev build of AUGUR, and only the workbench (SERVER_RING=dev in .env) runs those.`);
      }
      if (dev && !devIdentity) throw new StepFailed(`${target.version} is a dev build of AUGUR, and this updater doesn’t know who signs those.`);
      const free = await server.freeBytes().catch(() => undefined);
      if (free !== undefined && free < MIN_FREE_BYTES) {
        throw new StepFailed(`The deploy folder’s disk has ${gib(free)} free, and an upgrade needs ${gib(MIN_FREE_BYTES)}: the backup and the new images go there. Make room (old backups, docker image prune), then ask again.`);
      }
      if (!target.deploy || !target.parts) throw new StepFailed(`AUGUR ${target.version}’s release file couldn’t be read, or names no deploy files, so whether it fits this server isn’t known. Upgrade by hand (docs/upgrade.md).`);
      // A part the server runs that this updater doesn't know would be restarted with the rest but never
      // checked to come back: refused, so nothing is half upgraded. A part new in the release is started once
      // its compose.yml is in place (roll-forward), and the release's own updater knows it from then on.
      const running = new Set(await server.services());
      const unknown = Object.keys(target.images).filter((service) => service !== UPDATER && !parts.roles[service] && running.has(service));
      if (unknown.length) {
        throw new StepFailed(
          `AUGUR ${target.version} has ${unknown.length > 1 ? 'images' : 'an image'} for ${unknown.join(', ')}, which this server runs, and this updater doesn’t know how to restart ${unknown.length > 1 ? 'them' : 'it'} or tell ${unknown.length > 1 ? 'they' : 'it'} came back. Upgrade by hand (docs/upgrade.md).`,
        );
      }
      // The release's deploy files that differ from the server's are written by the updater, as long as
      // the server's are still as the running release left them: one changed by hand is never overwritten.
      const onDisk = await server.hashDeployFiles(Object.keys(target.deploy));
      const changed = Object.entries(target.deploy).filter(([path, hash]) => onDisk[path] !== hash).map(([path]) => path);
      if (changed.length) {
        const own = await server.ownDeployHashes(changed);
        if (!own || !target.images[UPDATER]) {
          throw new StepFailed(`AUGUR ${target.version} changes the server’s own files (${changed.join(', ')}), and this updater can’t write them, so it’s upgraded by hand: unpack augur@${target.version}’s deploy bundle and follow docs/upgrade.md.`);
        }
        const edited = changed.filter((path) => onDisk[path] !== undefined && onDisk[path] !== own[path]);
        if (edited.length) {
          throw new StepFailed(
            `${edited.join(', ')} ${edited.length > 1 ? 'have' : 'has'} been changed on the server since AUGUR ${target.from}, and ${target.version} changes ${edited.length > 1 ? 'them' : 'it'} too. Put ${edited.length > 1 ? 'them' : 'it'} back as augur@${target.from} has ${edited.length > 1 ? 'them' : 'it'} (from its deploy bundle, or git checkout), or upgrade by hand (docs/upgrade.md).`,
          );
        }
        changedFiles = Object.fromEntries(changed.map((path) => [path, undefined]));
      }
      // Settings entered on the Updates page go in as entered; a secret the release needs is made up.
      // Only new plain settings: one that decides trust, or one the server already has, is changed in .env by hand.
      const asked = Object.keys(target.settings ?? {}).filter((key) => key !== 'PLATFORM_VERSION');
      const odd = asked.find((key) => !SETTING_NAME.test(key));
      if (odd !== undefined) throw new StepFailed(`The upgrade asks to set ${JSON.stringify(odd.slice(0, 60))}, which isn’t a setting’s name (capitals, digits and _), so it didn’t go ahead. Ask again from the Updates page.`);
      const trusted = asked.filter(trustSetting);
      if (trusted.length) {
        const them = trusted.length > 1 ? 'them' : 'it';
        throw new StepFailed(
          `The upgrade asks to set ${trusted.join(', ')}, which ${trusted.length > 1 ? 'decide' : 'decides'} what this server trusts or where it pulls from. Only .env on the server sets ${them}, so the upgrade didn’t go ahead: set ${them} there yourself if you meant to, then ask again.`,
        );
      }
      const existing = asked.filter((key) => target.settings![key] && envValue(before, key) && envValue(before, key) !== target.settings![key]);
      if (existing.length) {
        const them = existing.length > 1 ? 'them' : 'it';
        throw new StepFailed(`The upgrade asks to change ${existing.join(', ')}, which .env already sets. An upgrade only adds settings: change ${them} in .env on the server if you meant to, then ask again.`);
      }
      for (const [key, value] of Object.entries(target.settings ?? {})) {
        if (key === 'PLATFORM_VERSION' || !value || envValue(before, key) === value) continue;
        const written = envQuoted(value);
        if (written === undefined) throw new StepFailed(`The value entered for ${key} can’t go in .env as it is (it has a quote or a line break). Put it in .env yourself, then ask again.`);
        settings = withEnvValue(settings, key, written);
        enteredKeys.push(key);
      }
      const missing = (target.required ?? []).filter((key) => key !== 'PLATFORM_VERSION' && !envValue(settings, key));
      const needYou = missing.filter((key) => !madeUp(key));
      if (needYou.length) {
        throw new StepFailed(`AUGUR ${target.version} won’t start without ${needYou.join(', ')}. Enter ${needYou.length > 1 ? 'them' : 'it'} when you ask for the upgrade on the Updates page, or set ${needYou.length > 1 ? 'them' : 'it'} in .env.`);
      }
      for (const key of missing) {
        settings = withEnvValue(settings, key, randomBytes(32).toString('hex'));
        madeKeys.push(key);
      }
      for (const [service, ref] of Object.entries(target.images)) {
        const local = `${imageRepo(before, ref)}/${service}@${digestOf(ref)}`;
        await server.verifySignature(local, dev ? devIdentity : undefined).catch((err) => {
          throw new StepFailed(`The ${service} image isn’t signed by AUGUR’s ${dev ? 'dev builds workflow on dev' : 'Release workflow'}, so nothing was run: ${reason(err)}`);
        });
      }
    });

    await run('backup', async () => {
      backup = await server.backup().catch((err) => {
        throw new StepFailed(`The backup couldn’t be taken: ${reason(err)}`);
      });
      await server.restoreTest().catch((err) => {
        throw new StepFailed(`${backup} was taken but didn’t restore in the test, so the upgrade didn’t go ahead: ${reason(err)}`);
      });
      return `${backup}, restored and checked`;
    });

    await run('pull', async () => {
      // A part new in this release is pulled once its compose.yml is in place (roll-forward).
      // So is a part whose image the server's compose.yml names as someone else's (Keycloak's own, say,
      // before the release brings AUGUR's): pulled now, it would fetch that image and fail the digest check.
      const running = new Set(await server.services());
      const named = await server.images(target.version);
      const ours = (service: string) => named[service]?.startsWith(`${imageRepo(before, target.images[service]!)}/${service}:`) ?? false;
      pulledFirst = Object.keys(target.images).filter((service) => running.has(service) && ours(service));
      switched = Object.keys(target.images).filter((service) => running.has(service) && !ours(service));
      await pullAndCheck(server, target, pulledFirst);
      const paths = Object.keys(changedFiles);
      if (!paths.length) return;
      const updater = `${imageRepo(before, target.images[UPDATER]!)}/${UPDATER}@${digestOf(target.images[UPDATER]!)}`;
      const files = await server.releaseDeployFiles(updater, paths).catch((err) => {
        throw new StepFailed(`The release’s deploy files couldn’t be read from its updater image: ${reason(err)}`);
      });
      const wrong = paths.filter((path) => !files[path] || sha256(files[path]!) !== target.deploy![path]);
      if (wrong.length) throw new StepFailed(`The release’s updater image carries ${wrong.join(', ')} other than the release file says, so nothing was changed.`);
      changedFiles = files;
      oldFiles = await server.readDeployFiles(paths);
      return `${paths.join(', ')} to be updated`;
    });
    // Parts the release doesn't have, such as one added after it when going back: stopped in roll-forward
    // while the compose.yml that names them is still in place.
    left = (await server.services()).filter((service) => parts.order.includes(service) && !parts.kept.includes(service) && !target.images[service]);
    // Written down before anything changes, so an updater that restarts from here on can go back.
    await note().catch((err) => {
      throw new StepFailed(`The updater couldn’t write down the upgrade in the deploy folder, which it needs to go back if it restarts partway through: ${reason(err)}`);
    });
  } catch (err) {
    // Nothing has restarted yet: the server is still on the release it was.
    if (err instanceof Withdrawn) throw err;
    const message = `Nothing was changed. ${reason(err)}`;
    await report({ step, state: 'failed', message, outcome: 'rolled-back' });
    return 'rolled-back';
  }

  try {
    await run('roll-forward', async () => {
      const paths = Object.keys(changedFiles);
      if (left.length) await server.remove(left);
      if (paths.length) {
        await server.writeDeployFiles(changedFiles);
        filesWritten = true;
        await note();
      }
      await server.writeEnv(withEnvValue(settings, 'PLATFORM_VERSION', target.version));
      const now = await server.services();
      const rolled = new Set<string>([...services, UPDATER, DOCKER_PROXY]);
      // Parts new in this release: pulled now that the new compose.yml names them.
      fresh = Object.keys(target.images).filter((service) => !pulledFirst.includes(service) && !switched.includes(service) && now.includes(service));
      // And parts that move onto AUGUR's image, now that the new compose.yml names it. Going back puts them on the old one again.
      const late = [...switched.filter((service) => now.includes(service)), ...fresh];
      if (late.length) await pullAndCheck(server, target, late);
      const added = fresh.filter((service) => !rolled.has(service));
      // First what the parts stand on: Compose recreates only those whose settings or image changed,
      // and those that mount a file just written are made again so they read it.
      others = now.filter((service) => !rolled.has(service) && !added.includes(service));
      const remount = paths.length ? (await server.mounting(paths)).filter((service) => others.includes(service)) : [];
      // From here on parts run on the new release and may migrate their data: noted before the first starts.
      restarted = true;
      await note().catch((err) => {
        restarted = false;
        throw err;
      });
      if (others.length) await server.up(others);
      if (remount.length) await server.recreate(remount);
      for (const service of services) {
        await server.up([service]);
        await ready(server, parts, [service], versionOf);
      }
      if (added.length) await server.up(added);
      const notes = [left.length ? `stopped ${left.join(', ')}, which ${target.version} doesn’t have` : '', paths.length ? `wrote ${paths.join(', ')}` : '', enteredKeys.length ? `set ${enteredKeys.join(', ')} as entered` : '', madeKeys.length ? `made up ${madeKeys.join(', ')} in .env` : '', added.length ? `started ${added.join(', ')}` : ''].filter(Boolean);
      return notes.length ? `${notes.join('; ')}.` : undefined;
    });
    // Every part again, now that all of them are on it: one that came up early may have fallen over since.
    step = 'verify';
    // Not knowing the step only makes a message after a restart less exact: never a reason to stop.
    await note().catch(() => undefined);
    await report({ step, state: 'running' });
    await ready(server, parts, services, versionOf);
    if (!target.watch) {
      await report({ step, state: 'done', message: `Running AUGUR ${target.version}.`, outcome: 'done' });
      return 'done';
    }
    await report({ step, state: 'done', message: `Running AUGUR ${target.version}.` });
    step = 'watch';
    await note().catch(() => undefined);
    await report({ step, state: 'running', message: `Watching sign-in, every part and AUGUR’s calls for ${WATCH_MS / 60_000} minutes.` });
    const watched = await watch(server, parts, services, versionOf);
    await report({ step, state: 'done', message: watchedSentence(target.version, watched), outcome: 'done', ...(watched.calls !== undefined ? { calls: watched.calls } : {}) });
    return 'done';
  } catch (err) {
    if (err instanceof Withdrawn) throw err;
    const why = reason(err);
    // A breaking release between, and a part restarted on the new one: going back by itself could leave
    // data the old release can't read.
    if (restarted && target.watch?.breakingSince) {
      await report({ step, state: 'failed', message: `${why} ${notBack(target.version, target.watch.breakingSince, step === 'verify' || step === 'watch')}`, outcome: 'failed' }).catch(() => undefined);
      return 'failed';
    }
    await report({ step, state: 'failed', message: why }).catch(() => undefined);
    return rollBack(target, server, report, before, parts, services, why, backup, { oldFiles, fresh, others, left });
  } finally {
    await server.clearJournal().catch(() => undefined);
  }
};

/** Why the server was left as it is for a person: a breaking release between. `all`: every part had restarted on the new release. */
const notBack = (version: string, breakingSince: string, all: boolean) =>
  `${all ? `AUGUR ${version} is still running` : `The server is partly on AUGUR ${version}`}: it didn’t go back by itself, because ${breakingSince} between is breaking. See docs/upgrade-went-back.md before you do anything.`;

/**
 * An upgrade the registry says is under way when the updater starts: only this updater runs upgrades, so
 * it stopped partway through (a reboot, say). With the journal it wrote, it goes back, unless a part had
 * restarted on the new release and a breaking release lies between; without one, a person has to look.
 */
export const afterRestart = async (target: Target, server: Server, report: Reporter, { parts = partsFor() }: { parts?: Parts } = {}): Promise<Outcome> => {
  let unreadable: string | undefined;
  const journal = await server.readJournal().catch((err) => {
    unreadable = reason(err);
    return undefined;
  });
  if (unreadable !== undefined) {
    await report({ step: 'roll-back', state: 'failed', outcome: 'failed', message: `The updater restarted partway through the upgrade to ${target.version}, and what it wrote down couldn’t be read (${unreadable}). Check Deployment, Health, and docs/upgrade-went-back.md.` });
    return 'failed';
  }
  try {
    // The journal is written before anything changes, so without this upgrade's it stopped while checking, backing up or pulling.
    if (!journal || journal.id !== target.id) {
      await report({ step: 'roll-back', state: 'failed', outcome: 'rolled-back', message: `Nothing was changed. The updater restarted before the upgrade to ${target.version} changed anything (while it checked, backed up or pulled). Ask for it again on the Updates page.` });
      return 'rolled-back';
    }
    const all = journal.step === 'verify' || journal.step === 'watch';
    if (journal.restarted && journal.breakingSince) {
      await report({ step: journal.step ?? 'roll-forward', state: 'failed', outcome: 'failed', message: `The updater restarted partway through the upgrade to ${journal.version}. ${notBack(journal.version, journal.breakingSince, all)}` });
      return 'failed';
    }
    const why =
      journal.step === 'watch'
        ? `The updater restarted during the watch of ${journal.version}, so the watch couldn’t finish and it went back.`
        : journal.step === 'verify'
          ? `The updater restarted before it had checked every part on ${journal.version}, so it went back.`
          : `The updater restarted partway through the upgrade to ${journal.version}, so it went back.`;
    const oldFiles = Object.fromEntries(Object.entries(journal.oldFiles).map(([path, text]) => [path, text === null ? undefined : Buffer.from(text, 'base64')]));
    return await rollBack({ ...target, from: journal.from, version: journal.version }, server, report, journal.before, parts, journal.services, why, journal.backup, {
      oldFiles,
      fresh: journal.fresh,
      others: journal.others,
      left: journal.left,
    });
  } finally {
    await server.clearJournal().catch(() => undefined);
  }
};

/** Pulls these services' images for the release and checks each is the one it names, by digest. */
const pullAndCheck = async (server: Server, target: Target, pulled: string[]) => {
  await server.pull(pulled, target.version).catch((err) => {
    throw new StepFailed(`The images couldn’t be pulled: ${reason(err)}`);
  });
  for (const service of pulled) {
    const known = (await server.digests(service, target.version)).map(digestOf);
    if (!known.includes(digestOf(target.images[service]!))) {
      throw new StepFailed(`The ${service} image pulled for ${target.version} isn’t the one the release names, so nothing was run.`);
    }
  }
};

/** Puts every part back on the release it was on. The data stays as the new release left it: see docs/upgrade.md, Going back. */
const rollBack = async (
  target: Target,
  server: Server,
  report: Reporter,
  before: string,
  parts: Parts,
  services: readonly string[],
  why: string,
  backup?: string,
  { oldFiles = {}, fresh = [], others = [], left = [] }: { oldFiles?: Record<string, Buffer | undefined>; fresh?: string[]; others?: string[]; left?: string[] } = {},
): Promise<Outcome> => {
  const kept = backup
    ? ` If ${target.from} has trouble with data ${target.version} changed, restore ${backup}: docs/upgrade-went-back.md says how, and what to check first.`
    : ' docs/upgrade-went-back.md says what to check.';
  try {
    await report({ step: 'roll-back', state: 'running' }).catch(() => undefined);
    // Parts the release added go first, while its compose.yml still names them.
    if (fresh.length) await server.remove(fresh);
    const paths = Object.keys(oldFiles);
    if (paths.length) await server.writeDeployFiles(oldFiles);
    await server.writeEnv(before);
    if (others.length) await server.up(others);
    if (paths.length) {
      const remount = (await server.mounting(paths)).filter((service) => others.includes(service));
      if (remount.length) await server.recreate(remount);
    }
    const back = [...services.filter((service) => !fresh.includes(service)), ...left];
    await server.up(back);
    await ready(server, parts, back, () => undefined);
  } catch (err) {
    await report({ step: 'roll-back', state: 'failed', message: `Back on ${target.from} didn’t work either: ${reason(err)} The upgrade had stopped because ${why}${kept}`, outcome: 'failed' });
    return 'failed';
  }
  await report({ step: 'roll-back', state: 'done', message: `Back on ${target.from}: ${why}${kept}`, outcome: 'rolled-back' });
  return 'rolled-back';
};
