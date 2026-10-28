/**
 * One upgrade, start to end: check the release fits the server, take a backup and prove it
 * restores, pull the release's images and check they are the ones it names, then restart each
 * part on them in turn. When a part doesn't come back on its new version, every part goes back
 * to the release it was on. Each step is reported to the registry, which shows it on Admin's
 * Updates page.
 *
 * Outcomes: `done` (on the new release), `rolled-back` (on the release it started from, whether
 * or not anything was restarted) and `failed` (it couldn't go back either: someone has to look).
 */
import { createHash, randomBytes } from 'node:crypto';
import { envQuoted, envValue, withEnvValue } from './env-file.ts';

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
}

export type Step = 'preflight' | 'backup' | 'pull' | 'roll-forward' | 'verify' | 'roll-back';
export type Outcome = 'done' | 'rolled-back' | 'failed';

export interface Report {
  step: Step;
  state: 'running' | 'done' | 'failed';
  message?: string;
  outcome?: Outcome;
}

/** Tells the registry how a step went. Throws Withdrawn when the upgrade isn't open any more. */
export type Reporter = (report: Report) => Promise<void>;

/** The upgrade was cancelled, or ended, before the updater got to it. */
export class Withdrawn extends Error {}

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
  /** Throws unless `ref` (an image by digest) was signed by AUGUR's Release workflow. */
  verifySignature(ref: string): Promise<void>;
  /** Takes a fresh backup and returns its file name. */
  backup(): Promise<string>;
  /** Throws unless the newest backup restores. */
  restoreTest(): Promise<void>;
  /** Pulls these services' images for `version`, without starting anything. */
  pull(services: string[], version: string): Promise<void>;
  /** The digests a service's image for `version` is known by, once pulled. */
  digests(service: string, version: string): Promise<string[]>;
  /** Recreates these services on the version the settings file names, leaving the others alone. */
  up(services: string[]): Promise<void>;
  /** What a service's /healthz says, or undefined while it doesn't answer. */
  health(service: string): Promise<{ version?: string } | undefined>;
  /** How a one-off job's container ended: its exit code, or undefined while it runs. */
  exitCode(service: string): Promise<number | undefined>;
  wait(ms: number): Promise<void>;
}

/**
 * The parts the updater restarts, in order: storage's set-up first (it gives apps their database
 * logins and buckets, then stops), then the services others call, then the apps that ship with
 * AUGUR, the front door last.
 */
export const ROLL_ORDER = ['storage', 'identity', 'registry', 'events', 'models', 'folio', 'folio-worker', 'auspex', 'atlas', 'gateway', 'web'] as const;
/** Parts that do their work and stop, rather than serve: ready once they've stopped without an error. */
const JOBS = new Set<string>(['storage']);
/** Parts that work in the background and answer nothing: ready once they're running and stay up. */
const WORKERS = new Set<string>(['folio-worker']);
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
/** How long a part has to come back on its new version. */
export const READY_MS = 120_000;
const POLL_MS = 2_000;

const digestOf = (ref: string) => ref.slice(ref.lastIndexOf('@') + 1);

/** Where the deployment pulls images from: PLATFORM_IMAGES, or where the release put them. */
const imageRepo = (env: string, ref: string) => envValue(env, 'PLATFORM_IMAGES') || ref.slice(0, ref.lastIndexOf('/'));

class StepFailed extends Error {}

/** Waits until each service answers with the version the release gives it (any version when it gives none). */
const ready = async (server: Server, services: readonly string[], versionOf: (service: string) => string | undefined) => {
  for (const service of services) {
    if (JOBS.has(service)) {
      await finished(server, service);
      continue;
    }
    if (WORKERS.has(service)) {
      await running(server, service);
      continue;
    }
    const want = versionOf(service);
    let seen: string | undefined;
    for (let waited = 0; ; waited += POLL_MS) {
      const health = await server.health(service).catch(() => undefined);
      seen = health?.version;
      if (health && (!want || health.version === want)) break;
      if (waited >= READY_MS) {
        throw new StepFailed(health ? `${service} came back on ${seen ?? 'an unknown version'}, not ${want}.` : `${service} didn’t answer within ${READY_MS / 1000} s.`);
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

/** What went wrong, for the page: a message we wrote, or the first line of anything else. */
const reason = (err: unknown) => (err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 500);

export const runUpgrade = async (target: Target, server: Server, report: Reporter): Promise<Outcome> => {
  const services = ROLL_ORDER.filter((s) => target.images[s]);
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
      if (!target.deploy || !target.parts) throw new StepFailed(`AUGUR ${target.version}’s release file couldn’t be read, or names no deploy files, so whether it fits this server isn’t known. Upgrade by hand (docs/upgrade.md).`);
      // The release's deploy files that differ from the server's are written by the updater, as long as
      // the server's are still as the running release left them: one changed by hand is never overwritten.
      const onDisk = await server.hashDeployFiles(Object.keys(target.deploy));
      const changed = Object.entries(target.deploy).filter(([path, hash]) => onDisk[path] !== hash).map(([path]) => path);
      if (changed.length) {
        const own = await server.ownDeployHashes(changed);
        if (!own || !target.images[UPDATER]) {
          throw new StepFailed(`AUGUR ${target.version} changes the server’s own files (${changed.join(', ')}), and this updater can’t write them, so it’s upgraded by hand: check out augur@${target.version} and follow docs/upgrade.md.`);
        }
        const edited = changed.filter((path) => onDisk[path] !== undefined && onDisk[path] !== own[path]);
        if (edited.length) {
          throw new StepFailed(
            `${edited.join(', ')} ${edited.length > 1 ? 'have' : 'has'} been changed on the server since AUGUR ${target.from}, and ${target.version} changes ${edited.length > 1 ? 'them' : 'it'} too. Put ${edited.length > 1 ? 'them' : 'it'} back as augur@${target.from} has ${edited.length > 1 ? 'them' : 'it'} (git checkout), or upgrade by hand (docs/upgrade.md).`,
          );
        }
        changedFiles = Object.fromEntries(changed.map((path) => [path, undefined]));
      }
      // Settings entered on the Updates page go in as entered; a secret the release needs is made up.
      for (const [key, value] of Object.entries(target.settings ?? {})) {
        if (key === 'PLATFORM_VERSION' || !value) continue;
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
        await server.verifySignature(local).catch((err) => {
          throw new StepFailed(`The ${service} image isn’t signed by AUGUR’s Release workflow, so nothing was run: ${reason(err)}`);
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
      const running = new Set(await server.services());
      pulledFirst = Object.keys(target.images).filter((service) => running.has(service));
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
  } catch (err) {
    // Nothing has restarted yet: the server is still on the release it was.
    if (err instanceof Withdrawn) throw err;
    const message = `Nothing was changed. ${reason(err)}`;
    await report({ step, state: 'failed', message, outcome: 'rolled-back' });
    return 'rolled-back';
  }

  // Parts this release adds, and the rest of what the deployment runs (the database, sign-in, storage).
  let fresh: string[] = [];
  let others: string[] = [];
  try {
    await run('roll-forward', async () => {
      const paths = Object.keys(changedFiles);
      if (paths.length) await server.writeDeployFiles(changedFiles);
      await server.writeEnv(withEnvValue(settings, 'PLATFORM_VERSION', target.version));
      const now = await server.services();
      const rolled = new Set<string>([...services, UPDATER, DOCKER_PROXY]);
      // Parts new in this release: pulled now that the new compose.yml names them.
      fresh = Object.keys(target.images).filter((service) => !pulledFirst.includes(service) && now.includes(service));
      if (fresh.length) await pullAndCheck(server, target, fresh);
      const added = fresh.filter((service) => !rolled.has(service));
      // First what the parts stand on: Compose recreates only those whose settings or image changed,
      // and those that mount a file just written are made again so they read it.
      others = now.filter((service) => !rolled.has(service) && !added.includes(service));
      const remount = paths.length ? (await server.mounting(paths)).filter((service) => others.includes(service)) : [];
      if (others.length) await server.up(others);
      if (remount.length) await server.recreate(remount);
      for (const service of services) {
        await server.up([service]);
        await ready(server, [service], versionOf);
      }
      if (added.length) await server.up(added);
      const notes = [paths.length ? `wrote ${paths.join(', ')}` : '', enteredKeys.length ? `set ${enteredKeys.join(', ')} as entered` : '', madeKeys.length ? `made up ${madeKeys.join(', ')} in .env` : '', added.length ? `started ${added.join(', ')}` : ''].filter(Boolean);
      return notes.length ? `${notes.join('; ')}.` : undefined;
    });
    // Every part again, now that all of them are on it: one that came up early may have fallen over since.
    step = 'verify';
    await report({ step, state: 'running' });
    await ready(server, services, versionOf);
    await report({ step, state: 'done', message: `Running AUGUR ${target.version}.`, outcome: 'done' });
    return 'done';
  } catch (err) {
    if (err instanceof Withdrawn) throw err;
    const why = reason(err);
    await report({ step, state: 'failed', message: why }).catch(() => undefined);
    return rollBack(target, server, report, before, services, why, backup, { oldFiles, fresh, others });
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
  services: readonly string[],
  why: string,
  backup?: string,
  { oldFiles = {}, fresh = [], others = [] }: { oldFiles?: Record<string, Buffer | undefined>; fresh?: string[]; others?: string[] } = {},
): Promise<Outcome> => {
  const kept = backup ? ` If ${target.from} has trouble with data ${target.version} changed, restore ${backup} (docs/upgrade.md, Going back).` : '';
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
    const back = services.filter((service) => !fresh.includes(service));
    await server.up(back);
    await ready(server, back, () => undefined);
  } catch (err) {
    await report({ step: 'roll-back', state: 'failed', message: `Back on ${target.from} didn’t work either: ${reason(err)} The upgrade had stopped because ${why}${kept}`, outcome: 'failed' });
    return 'failed';
  }
  await report({ step: 'roll-back', state: 'done', message: `Back on ${target.from}: ${why}${kept}`, outcome: 'rolled-back' });
  return 'rolled-back';
};
