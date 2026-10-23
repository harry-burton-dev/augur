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
import { envValue, withEnvValue } from './env-file.ts';

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
 * logins and buckets, then stops), then the services others call, the front door last.
 */
export const ROLL_ORDER = ['storage', 'identity', 'registry', 'events', 'models', 'gateway', 'web'] as const;
/** Parts that do their work and stop, rather than serve: ready once they've stopped without an error. */
const JOBS = new Set<string>(['storage']);
/** Itself: pulled with the rest, and replaced only after the upgrade has ended (see index.ts). */
export const UPDATER = 'updater';
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

/** What went wrong, for the page: a message we wrote, or the first line of anything else. */
const reason = (err: unknown) => (err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 500);

export const runUpgrade = async (target: Target, server: Server, report: Reporter): Promise<Outcome> => {
  const services = ROLL_ORDER.filter((s) => target.images[s]);
  const versionOf = (service: string) => (service === 'web' ? undefined : target.parts?.[`@augur/${service}`]);
  const before = await server.readEnv();
  let step: Step = 'preflight';
  let backup: string | undefined;

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
      const unknown = Object.keys(target.images).filter((s) => s !== UPDATER && !services.includes(s as (typeof services)[number]));
      if (unknown.length) throw new StepFailed(`AUGUR ${target.version} has parts the updater doesn’t know how to restart (${unknown.join(', ')}). Upgrade by hand (docs/upgrade.md).`);
      const onDisk = await server.hashDeployFiles(Object.keys(target.deploy));
      const changed = Object.entries(target.deploy).filter(([path, hash]) => onDisk[path] !== hash).map(([path]) => path);
      if (changed.length) {
        throw new StepFailed(`AUGUR ${target.version} changes the server’s own files (${changed.join(', ')}), so it’s upgraded by hand: check out augur@${target.version} and follow docs/upgrade.md.`);
      }
      const missing = (target.required ?? []).filter((key) => key !== 'PLATFORM_VERSION' && !envValue(before, key));
      if (missing.length) throw new StepFailed(`Set ${missing.join(', ')} in .env first: AUGUR ${target.version} won’t start without ${missing.length > 1 ? 'them' : 'it'}.`);
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
      const pulled = Object.keys(target.images);
      await server.pull(pulled, target.version).catch((err) => {
        throw new StepFailed(`The images couldn’t be pulled: ${reason(err)}`);
      });
      for (const service of pulled) {
        const known = (await server.digests(service, target.version)).map(digestOf);
        if (!known.includes(digestOf(target.images[service]))) {
          throw new StepFailed(`The ${service} image pulled for ${target.version} isn’t the one the release names, so nothing was run.`);
        }
      }
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
      await server.writeEnv(withEnvValue(before, 'PLATFORM_VERSION', target.version));
      for (const service of services) {
        await server.up([service]);
        await ready(server, [service], versionOf);
      }
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
    return rollBack(target, server, report, before, services, why, backup);
  }
};

/** Puts every part back on the release it was on. The data stays as the new release left it: see docs/upgrade.md, Going back. */
const rollBack = async (target: Target, server: Server, report: Reporter, before: string, services: readonly string[], why: string, backup?: string): Promise<Outcome> => {
  const kept = backup ? ` If ${target.from} has trouble with data ${target.version} changed, restore ${backup} (docs/upgrade.md, Going back).` : '';
  try {
    await report({ step: 'roll-back', state: 'running' }).catch(() => undefined);
    await server.writeEnv(before);
    await server.up([...services]);
    await ready(server, services, () => undefined);
  } catch (err) {
    await report({ step: 'roll-back', state: 'failed', message: `Back on ${target.from} didn’t work either: ${reason(err)} The upgrade had stopped because ${why}${kept}`, outcome: 'failed' });
    return 'failed';
  }
  await report({ step: 'roll-back', state: 'done', message: `Back on ${target.from}: ${why}${kept}`, outcome: 'rolled-back' });
  return 'rolled-back';
};
