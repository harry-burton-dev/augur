/**
 * The app runner: installs, upgrades and removes the apps that don't ship with AUGUR, in a Compose
 * project of their own (`augur-apps`) that it writes and owns, beside the platform's. An admin asks
 * the registry; the runner does one job at a time and reports each step back.
 *
 * An install (a first install, an upgrade or going back alike) is blue/green: the new version starts
 * in the slot the app isn't using, beside the old one, and only once it answers on its new version
 * does the registry list it and the gateway send it calls. Until then the old version keeps serving,
 * so a version that doesn't come up changes nothing. The old one is stopped a few minutes later, once
 * shells have fetched the new manifest.
 *
 * A pull request's preview runs beside the app in a container of its own (`app-<id>-pr<n>`), signed
 * in as the app but with scratch storage of its own (`<id>-pr<n>`), and is never registered: the
 * registry gives its manifest, and the gateway sends calls to it, only for developers who chose it.
 * A newer build of the pull request replaces it in place; taking it away drops its storage.
 */
import { appSecretFor } from '@augur/service-kit';
import { envValue } from './env-file.ts';
import { devBuildIdentity, isDevBuild, releaseIdentity } from './signers.ts';

/** What an app's release file says (scripts/app-release.mjs); only what the runner reads. */
export interface AppRelease {
  id: string;
  version: string;
  manifest: { id: string; name: string; version: string; storage?: { database?: boolean; bucket?: boolean } } & Record<string, unknown>;
  service: { image: string } | null;
  signer: { repository: string; workflow: string };
}

/** A job from the registry (GET /v1/app-runner/next). */
export interface AppJob {
  id: string;
  app: string;
  action: 'install' | 'remove' | 'preview' | 'preview-remove';
  release?: AppRelease;
  /** For a preview: its pull request. */
  pr?: number;
  state: 'requested' | 'running';
}

export type JobStep = 'verify' | 'storage' | 'sign-in' | 'start' | 'health' | 'switch' | 'watch' | 'retire' | 'remove';
export interface JobReport {
  step: JobStep;
  state: 'running' | 'done' | 'failed';
  message?: string;
  outcome?: 'done' | 'failed';
  /** With a preview's outcome: where it answers. */
  upstream?: string;
}
export type JobReporter = (report: JobReport) => Promise<void>;

type Slot = 'blue' | 'green';
/** One of an app's containers, as the runner keeps it. */
export interface RunningApp {
  slot: Slot;
  version: string;
  image: string;
  /** Whether it was given a database login and a bucket. */
  storage: { database: boolean; bucket: boolean };
  /** The old version, stopped once this time has passed. */
  until?: string;
  /** The manifest it was registered with, so the runner can go back to it. Absent for versions installed by an older runner. */
  manifest?: AppRelease['manifest'];
  /** The repository whose release this is. Absent for versions installed by an older runner. */
  repository?: string;
}
/** A pull request's preview, as the runner keeps it. */
export interface RunningPreview {
  app: string;
  pr: number;
  version: string;
  image: string;
  storage: RunningApp['storage'];
}
/** What the runner runs, kept beside the project it writes (apps/state.json). */
export interface RunnerState {
  apps: Record<string, { active?: RunningApp; retiring?: RunningApp }>;
  /** By preview id (notes-pr12). Missing in a state written before previews. */
  previews?: Record<string, RunningPreview>;
}

/** What the runner does to the server. The real one drives Docker Compose (server.ts); tests use a fake. */
export interface AppHost {
  /** The deployment's settings file, .env. */
  readEnv(): Promise<string>;
  /** The network the platform's own containers share, as Docker names it, or undefined if it can't tell. */
  platformNetwork(): Promise<string | undefined>;
  readState(): Promise<RunnerState>;
  /** Writes the state, the apps' Compose project made from it and each container's settings file. */
  writeProject(state: RunnerState, project: object, envFiles: Record<string, string>): Promise<void>;
  /** Throws unless `ref` (an image by digest) was signed by `identity` (a workflow's certificate identity). */
  verifySignedBy(ref: string, identity: string): Promise<void>;
  /** Takes a fresh backup of the platform's database (apps' tables with it) and returns its file name. */
  backup(): Promise<string>;
  /** Runs the storage container for this app (or preview id) alone: its database login and schema, its bucket and key. */
  provisionStorage(app: string): Promise<void>;
  /** Runs the storage container to take a preview's scratch storage away, data and all. */
  dropStorage(previewId: string): Promise<void>;
  /** Pulls and starts these services of the apps' project, leaving the others alone. */
  start(services: string[]): Promise<void>;
  /** Stops and removes these services' containers. */
  stop(services: string[]): Promise<void>;
  /** What a service's /healthz says, or undefined while it doesn't answer. */
  health(url: string): Promise<{ version?: string } | undefined>;
  wait(ms: number): Promise<void>;
}

/** The platform's side, asked as the updater, or as the app with the sign-in the runner gave it. */
export interface PlatformCalls {
  /** Sets the app's sign-in secret (identity, PUT /v1/admin/apps/:id/credential). */
  setCredential(app: string, secret: string): Promise<void>;
  /** Registers the release's manifest, signed in as the app itself. */
  register(manifest: AppRelease['manifest'], secret: string): Promise<void>;
  /** Points the gateway at the app's service (registry, PUT /v1/apps/:id/upstream); null forgets it. */
  setUpstream(app: string, url: string | null): Promise<void>;
}

export interface RunnerOptions {
  host: AppHost;
  calls: PlatformCalls;
  /** The workflows trusted to sign apps, as `owner/repo/.github/workflows/<file>`, besides those in APP_PUBLISHERS. */
  publishers: string[];
  /**
   * Apps that live in their own repositories, as release/app-repos.json lists them: app id → `owner/repo`.
   * That repository is trusted to sign that app, and only that app (ADR 0047).
   */
  appRepos?: Record<string, string>;
  /** The OIDC issuer that vouches for each signature. */
  issuer?: string;
  now?: () => Date;
}

/** The port every app's service listens on in its container. */
export const APP_PORT = 8080;
/** The network the platform's project makes, when it's named `platform` and the updater can't ask: apps join it to reach the gateway, Postgres and Garage. */
export const DEFAULT_NETWORK = 'platform_default';
/** How long a new version has to answer on its version. */
export const READY_MS = 180_000;
/** How long the old version keeps running after the switch, for shells still holding the old manifest. */
export const RETIRE_MS = 10 * 60_000;
const POLL_MS = 3_000;
/**
 * How long a new version of an installed app is watched after the switch, and how often (ADR 0020):
 * the old version is still running for RETIRE_MS, so going back is only a switch away. Two misses in
 * a row and it goes back.
 */
export const APP_WATCH_MS = 5 * 60_000;
export const APP_WATCH_EVERY_MS = 30_000;
const APP_WATCH_MISSES = 2;

export const serviceName = (app: string, slot: Slot) => `app-${app}-${slot}`;
export const upstreamOf = (app: string, slot: Slot) => `http://${serviceName(app, slot)}:${APP_PORT}`;
/** A pull request's preview of an app: its storage is kept under this id, and its container is app-<id>. */
export const previewId = (app: string, pr: number) => `${app}-pr${pr}`;
const previewService = (id: string) => `app-${id}`;
const previewUpstream = (id: string) => `http://${previewService(id)}:${APP_PORT}`;
/** The prefix of an app's own settings in .env, as the storage container reads them: "team-notes" → TEAM_NOTES. */
const envPrefix = (app: string) => app.toUpperCase().replace(/-/g, '_');
/**
 * A workflow's certificate identity, as cosign checks it: the workflow file on a branch releases are
 * made from (main, preview or production), or for a pull request's build, on that pull request's merge
 * ref, so a build is only ever taken as the pull request it says it is.
 */
export const signerIdentity = (publisher: string, pr?: number) => (pr === undefined ? releaseIdentity(publisher) : `https://github.com/${publisher}@refs/pull/${pr}/merge`);
/** The workflow that builds pull requests' previews, in a repository trusted to publish apps. */
export const PREVIEW_WORKFLOW = '.github/workflows/app-preview.yml';
/** The workflow that builds every merge into main, in a repository trusted to publish apps. */
export const DEV_WORKFLOW = '.github/workflows/app-dev.yml';
/** A dev build's version: <next patch>-dev.<run>. */
export { isDevBuild };
/** A dev build's certificate identity: the dev workflow, on main. */
export const devIdentity = (repository: string) => devBuildIdentity(`${repository}/${DEV_WORKFLOW}`);

/**
 * release/app-repos.json, as this release ships it: which repository publishes each app that lives in
 * its own (ADR 0047). Anything that isn't an app id mapped to `owner/repo` is left out.
 */
export const appReposFrom = (json: unknown): Record<string, string> => {
  const apps = (json as { apps?: unknown } | null)?.apps;
  if (!apps || typeof apps !== 'object') return {};
  return Object.fromEntries(
    Object.entries(apps as Record<string, unknown>).filter(
      (e): e is [string, string] => /^[a-z][a-z0-9-]{1,39}$/.test(e[0]) && typeof e[1] === 'string' && /^[\w.-]+\/[\w.-]+$/.test(e[1]),
    ),
  );
};

/** APP_PUBLISHERS in .env: `owner/repo` (its release.yml) or `owner/repo/.github/workflows/<file>`, space or comma separated. */
export const publishersFrom = (setting = '') =>
  setting
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((p) => (p.split('/').length === 2 ? `${p}/.github/workflows/release.yml` : p));

/**
 * An app's secrets: one named in .env wins (as the storage container does), otherwise worked out from
 * APP_SECRETS_KEY. Undefined without either, when the runner can't run apps.
 */
export const appSecrets = (env: string, app: string) => {
  const key = envValue(env, 'APP_SECRETS_KEY');
  const named = (suffix: string) => envValue(env, `${envPrefix(app)}_${suffix}`) || undefined;
  if (!key) return undefined;
  return {
    database: named('DATABASE_PASSWORD') ?? appSecretFor(key, app, 'database'),
    bucket: named('BUCKET_SECRET') ?? appSecretFor(key, app, 'bucket'),
    signIn: named('CLIENT_SECRET') ?? appSecretFor(key, app, 'sign-in'),
  };
};

/**
 * The settings each container gets: where the platform is, its own sign-in and its own storage. A
 * preview signs in as its app, with the storage of its preview id, and is told it's a preview.
 */
export const containerEnv = (env: string, app: string, storage: RunningApp['storage'], preview?: { pr: number }): Record<string, string> => {
  const secrets = appSecrets(env, app);
  if (!secrets) throw new Error('APP_SECRETS_KEY is not set in .env, so the runner can’t give apps their secrets.');
  const storageId = preview ? previewId(app, preview.pr) : app;
  const kept = preview ? appSecrets(env, storageId)! : secrets;
  const platformUrl = envValue(env, 'PLATFORM_URL') ?? '';
  return {
    NODE_ENV: 'production',
    PORT: String(APP_PORT),
    IDENTITY_URL: 'http://identity:8081',
    EVENTS_URL: 'http://events:8084',
    REGISTRY_URL: 'http://registry:8082',
    MODELS_URL: 'http://models:8085',
    GATEWAY_URL: 'http://gateway:8080',
    OIDC_ISSUER: `${platformUrl}/sso/realms/platform`,
    OIDC_INTERNAL_URL: 'http://keycloak:8080/sso/realms/platform',
    SERVICE_CLIENT_SECRET: secrets.signIn,
    // The runner registers each version itself, once it's healthy (service kit's registerApp).
    APP_REGISTERED_BY: 'runner',
    ...(preview ? { APP_PREVIEW: `pr-${preview.pr}` } : {}),
    ...(storage.database ? { DATABASE_URL: `postgres://app_${storageId.replace(/-/g, '_')}:${encodeURIComponent(kept.database)}@postgres:5432/platform` } : {}),
    ...(storage.bucket ? { S3_ENDPOINT: 'http://garage:3900', S3_BUCKET: storageId, S3_SECRET_ACCESS_KEY: kept.bucket } : {}),
  };
};

/** The apps' Compose project: every container the state names, on the platform's network, with nothing more than it needs. */
export const appsProject = (state: RunnerState, network = DEFAULT_NETWORK) => {
  const services: Record<string, object> = {};
  for (const [app, { active, retiring }] of Object.entries(state.apps)) {
    for (const running of [active, retiring]) {
      if (!running) continue;
      const name = serviceName(app, running.slot);
      services[name] = container(running.image, name, { 'augur.app': app, 'augur.version': running.version });
    }
  }
  for (const [id, p] of Object.entries(state.previews ?? {})) {
    services[previewService(id)] = container(p.image, previewService(id), { 'augur.app': p.app, 'augur.version': p.version, 'augur.preview': String(p.pr) });
  }
  return { name: 'augur-apps', services, networks: { platform: { external: true, name: network } } };
};

const container = (image: string, envFile: string, labels: Record<string, string>) => ({
  image,
  restart: 'unless-stopped',
  env_file: [`./${envFile}.env`],
  networks: ['platform'],
  // Never privileged, no host folders, no added powers.
  cap_drop: ['ALL'],
  security_opt: ['no-new-privileges:true'],
  labels,
});

const envFileText = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n';

/** Each container's settings file, by service name. */
const envFilesFor = (state: RunnerState, env: string) => {
  const files: Record<string, string> = {};
  for (const [app, { active, retiring }] of Object.entries(state.apps)) {
    for (const running of [active, retiring]) if (running) files[serviceName(app, running.slot)] = envFileText(containerEnv(env, app, running.storage));
  }
  for (const [id, p] of Object.entries(state.previews ?? {})) files[previewService(id)] = envFileText(containerEnv(env, p.app, p.storage, { pr: p.pr }));
  return files;
};

class StepFailed extends Error {}

/** Why a container didn't become ready: it answered on another version, or not at all. */
const notReady = (release: AppRelease, seen?: { version?: string }) =>
  seen
    ? `${release.manifest.name} came up on ${seen.version ?? 'an unknown version'}, not ${release.version}.`
    : `${release.manifest.name} ${release.version} didn’t answer within ${READY_MS / 1000} s; its logs say why.`;
const reason = (err: unknown) => (err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 500);

export const appRunner = ({ host, calls, publishers, appRepos = {}, now = () => new Date() }: RunnerOptions) => {
  // APPS_NETWORK wins; otherwise the network the updater itself is on, asked once, since a project run under
  // another name (COMPOSE_PROJECT_NAME, -p) doesn't make platform_default.
  let found: Promise<string | undefined> | undefined;
  const network = async (env: string) =>
    envValue(env, 'APPS_NETWORK') || (await (found ??= host.platformNetwork().catch(() => undefined))) || DEFAULT_NETWORK;
  const save = async (state: RunnerState, env: string) => host.writeProject(state, appsProject(state, await network(env)), envFilesFor(state, env));

  /** Stops old versions whose time is up. */
  const retireDue = async () => {
    const state = await host.readState();
    const due = Object.entries(state.apps).filter(([, a]) => a.retiring?.until && Date.parse(a.retiring.until) <= now().getTime());
    if (!due.length) return;
    await host.stop(due.map(([app, a]) => serviceName(app, a.retiring!.slot)));
    for (const [, a] of due) delete a.retiring;
    await save(state, await host.readEnv());
  };

  /**
   * Puts the registry and the gateway back on the version that was serving before a switch, or, on a
   * first install, leaves the gateway nowhere to send calls. It holds whichever side of the switch things
   * stopped on, so nobody needs to know. Throws only when the gateway may still be on the new version.
   */
  const goBack = async (app: string, active: RunningApp | undefined, signIn: string) => {
    if (!active) return void (await calls.setUpstream(app, null).catch(() => undefined));
    if (active.manifest) await calls.register(active.manifest, signIn).catch(() => undefined);
    await calls.setUpstream(app, upstreamOf(app, active.slot));
  };

  /** The release to run, .env, and the signature checked: the start of an install and of a preview. */
  const verified = async (job: AppJob, report: JobReporter) => {
    const release = job.release;
    if (!release?.service) throw new StepFailed('The job names no release with a service to run.');
    const env = await host.readEnv();
    if (!appSecrets(env, job.app)) throw new StepFailed('APP_SECRETS_KEY is not set in .env, so the runner can’t give the app its secrets (docs/upgrade.md, The app runner).');

    await report({ step: 'verify', state: 'running' });
    const publisher = `${release.signer.repository}/${release.signer.workflow}`;
    const home = appRepos[job.app];
    // An app with its own repository is published by that repository, and no other (ADR 0047).
    if (home && release.signer.repository !== home) throw new StepFailed(`${job.app} is published from ${home}, so a release signed in ${release.signer.repository} isn’t taken.`);
    const trusted = [...publishers, ...(home ? publishersFrom(home) : []), ...publishersFrom(envValue(env, 'APP_PUBLISHERS'))];
    const dev = job.pr === undefined && isDevBuild(release.version);
    // Only a dev or preview server takes dev builds, whatever the registry asked.
    if (dev && !['dev', 'preview'].includes(envValue(env, 'SERVER_RING') ?? '')) throw new StepFailed(`${release.version} is a dev build, and only a dev or preview server (SERVER_RING=dev or preview in .env) installs dev builds.`);
    // A preview or a dev build comes from its own workflow, in a repository whose releases are trusted.
    const own = job.pr !== undefined ? PREVIEW_WORKFLOW : dev ? DEV_WORKFLOW : undefined;
    const ok = own === undefined ? trusted.includes(publisher) : release.signer.workflow === own && trusted.some((t) => t.startsWith(`${release.signer.repository}/`));
    const what = job.pr !== undefined ? 'previews' : dev ? 'dev builds' : 'apps';
    if (!ok) throw new StepFailed(`${publisher} isn’t trusted to publish ${what} on this server. Add ${own === undefined ? 'it' : 'its repository'} to APP_PUBLISHERS in .env to trust it.`);
    try {
      await host.verifySignedBy(release.service.image, dev ? devIdentity(release.signer.repository) : signerIdentity(publisher, job.pr));
    } catch (err) {
      throw new StepFailed(`The service image isn’t signed by ${publisher}${dev ? ' on dev' : ''}: ${reason(err)}`);
    }
    // A dev build runs on the server's real data, and the first release from another repository (an app
    // moving into its own, ADR 0047) takes over the data the old one left: a backup first, to go back to.
    const running = job.action === 'install' ? (await host.readState()).apps[job.app]?.active : undefined;
    const handover = running !== undefined && running.repository !== release.signer.repository;
    if (dev || handover) {
      const why = dev ? 'a dev build needs' : `the move from ${running?.repository ?? 'where it came from'} to ${release.signer.repository} needs`;
      const file = await host.backup().catch((err) => {
        throw new StepFailed(`The backup ${why} first couldn’t be taken: ${reason(err)}`);
      });
      await report({ step: 'verify', state: 'done', message: `${dev ? 'Signed on dev.' : `Signed in ${release.signer.repository}, where ${job.app} now comes from.`} Backup ${file} taken first.` });
    } else await report({ step: 'verify', state: 'done' });
    return { release: release as AppRelease & { service: { image: string } }, env };
  };

  /** Waits for `url` to answer on `version`; the answer it last gave when it doesn't in time. */
  const answers = async (url: string, version: string) => {
    let seen: { version?: string } | undefined;
    for (let waited = 0; ; waited += POLL_MS) {
      seen = await host.health(url).catch(() => undefined);
      if (seen?.version === version) return { ready: true as const };
      if (waited >= READY_MS) return { ready: false as const, seen };
      await host.wait(POLL_MS);
    }
  };

  /** Why `url` stopped answering on `version` within APP_WATCH_MS (two misses in a row), or nothing when it kept answering. */
  const stillAnswering = async (url: string, version: string) => {
    let misses = 0;
    for (let watched = APP_WATCH_EVERY_MS; watched <= APP_WATCH_MS; watched += APP_WATCH_EVERY_MS) {
      await host.wait(APP_WATCH_EVERY_MS);
      const seen = await host.health(url).catch(() => undefined);
      misses = seen?.version === version ? 0 : misses + 1;
      if (misses >= APP_WATCH_MISSES) return seen ? `answered on ${seen.version ?? 'an unknown version'} after the switch.` : 'stopped answering after the switch.';
    }
    return undefined;
  };

  const install = async (job: AppJob, report: JobReporter) => {
    const app = job.app;
    const { release, env } = await verified(job, report);

    const storage = { database: Boolean(release.manifest.storage?.database), bucket: Boolean(release.manifest.storage?.bucket) };
    if (storage.database || storage.bucket) {
      await report({ step: 'storage', state: 'running' });
      await host.provisionStorage(app);
      await report({ step: 'storage', state: 'done' });
    }

    await report({ step: 'sign-in', state: 'running' });
    const secrets = appSecrets(env, app)!;
    await calls.setCredential(app, secrets.signIn);
    await report({ step: 'sign-in', state: 'done' });

    await report({ step: 'start', state: 'running' });
    const state = await host.readState();
    const current = state.apps[app] ?? {};
    // A version still winding down gives up its slot to the new one now.
    if (current.retiring) {
      await host.stop([serviceName(app, current.retiring.slot)]);
      delete current.retiring;
    }
    const slot: Slot = current.active?.slot === 'blue' ? 'green' : 'blue';
    const candidate: RunningApp = { slot, version: release.version, image: release.service.image, storage, manifest: release.manifest, repository: release.signer.repository };
    const withCandidate: RunnerState = { ...state, apps: { ...state.apps, [app]: { ...current, retiring: candidate } } };
    // Written as retiring with no end, so a runner that restarts now still knows the container is there.
    await save(withCandidate, env);
    const name = serviceName(app, slot);
    /** Takes the new container away again, leaving the old one serving. */
    const undo = async () => {
      await host.stop([name]).catch(() => undefined);
      const restored: RunnerState = { ...state, apps: { ...state.apps } };
      if (current.active) restored.apps[app] = { active: current.active };
      else delete restored.apps[app];
      await save(restored, env).catch(() => undefined);
    };
    try {
      await host.start([name]);
    } catch (err) {
      await undo();
      throw new StepFailed(`${name} wouldn’t start: ${reason(err)}`);
    }
    await report({ step: 'start', state: 'done' });

    await report({ step: 'health', state: 'running' });
    const health = await answers(`${upstreamOf(app, slot)}/healthz`, release.version);
    if (!health.ready) {
      await undo();
      throw new StepFailed(`${notReady(release, health.seen)} ${current.active ? `${current.active.version} is still serving.` : ''}`.trim());
    }
    await report({ step: 'health', state: 'done' });

    await report({ step: 'switch', state: 'running' });
    try {
      await calls.register(release.manifest, secrets.signIn);
      await calls.setUpstream(app, upstreamOf(app, slot));
      await report({ step: 'switch', state: 'done' });
    } catch (err) {
      const refused = `The registry didn’t take ${release.version}: ${reason(err)}`;
      // The new version may be serving by now, so it stops only once the gateway has left it.
      await goBack(app, current.active, secrets.signIn).catch((back) => {
        throw new StepFailed(`${refused} Going back to ${current.active?.version} didn’t work either, so ${name} is still running: ${reason(back)}`);
      });
      await undo();
      throw new StepFailed(refused);
    }

    // An upgrade is watched while the old version still runs; a first install has nothing to go back to.
    if (current.active) {
      const old = current.active;
      // Kept with an end past the watch, so a runner that restarts meanwhile stops it in time, as after any switch.
      await save({ ...state, apps: { ...state.apps, [app]: { active: candidate, retiring: { ...old, until: new Date(now().getTime() + APP_WATCH_MS + RETIRE_MS).toISOString() } } } }, env);
      await report({ step: 'watch', state: 'running', message: `Watching ${release.manifest.name} ${release.version} for ${APP_WATCH_MS / 60_000} minutes; ${old.version} is still running to go back to.` });
      const problem = await stillAnswering(`${upstreamOf(app, slot)}/healthz`, release.version);
      if (problem) {
        const why = `${release.manifest.name} ${release.version} ${problem}`;
        if (!old.manifest) {
          throw new StepFailed(`${why} It didn’t go back by itself: ${old.version} was installed before the runner kept what it needs to go back. Install ${old.version} again from Admin → Apps.`);
        }
        try {
          await calls.register(old.manifest, secrets.signIn);
          await calls.setUpstream(app, upstreamOf(app, old.slot));
        } catch (err) {
          throw new StepFailed(`${why} Going back to ${old.version} didn’t work: ${reason(err)}`);
        }
        await host.stop([name]).catch(() => undefined);
        await save({ ...state, apps: { ...state.apps, [app]: { active: old } } }, env);
        throw new StepFailed(`${why} Back on ${old.version} by itself.`);
      }
      await report({ step: 'watch', state: 'done' });
    }

    const until = new Date(now().getTime() + RETIRE_MS).toISOString();
    const next: RunnerState = { ...state, apps: { ...state.apps, [app]: { active: candidate, ...(current.active ? { retiring: { ...current.active, until } } : {}) } } };
    await save(next, env);
    await report({
      step: 'retire',
      state: 'done',
      outcome: 'done',
      message: current.active ? `${release.manifest.name} ${release.version} is serving; ${current.active.version} stops at ${until.slice(11, 16)} UTC.` : `${release.manifest.name} ${release.version} is installed.`,
    });
  };

  /** Runs a pull request's build beside the app, replacing the pull request's last one. */
  const preview = async (job: AppJob, report: JobReporter) => {
    if (job.pr === undefined) throw new StepFailed('The job names no pull request.');
    const { release, env } = await verified(job, report);
    const id = previewId(job.app, job.pr);
    const name = previewService(id);
    const storage = { database: Boolean(release.manifest.storage?.database), bucket: Boolean(release.manifest.storage?.bucket) };
    if (storage.database || storage.bucket) {
      await report({ step: 'storage', state: 'running', message: `Scratch storage ${id}, apart from ${release.manifest.name}’s own` });
      await host.provisionStorage(id);
      await report({ step: 'storage', state: 'done' });
    }

    await report({ step: 'start', state: 'running' });
    const state = await host.readState();
    const had = state.previews?.[id];
    // One container a pull request: its last build makes way for this one.
    if (had) await host.stop([name]);
    const next: RunnerState = { ...state, previews: { ...state.previews, [id]: { app: job.app, pr: job.pr, version: release.version, image: release.service.image, storage } } };
    await save(next, env);
    /** Takes the container away; the pull request has no preview until its next build. */
    const undo = async () => {
      await host.stop([name]).catch(() => undefined);
      const { [id]: _, ...others } = next.previews!;
      await save({ ...next, previews: others }, env).catch(() => undefined);
    };
    try {
      await host.start([name]);
    } catch (err) {
      await undo();
      throw new StepFailed(`${name} wouldn’t start: ${reason(err)}`);
    }
    await report({ step: 'start', state: 'done' });

    await report({ step: 'health', state: 'running' });
    const health = await answers(`${previewUpstream(id)}/healthz`, release.version);
    if (!health.ready) {
      await undo();
      throw new StepFailed(notReady(release, health.seen));
    }
    await report({ step: 'health', state: 'done' });
    await report({ step: 'switch', state: 'done', outcome: 'done', upstream: previewUpstream(id), message: `Pull request ${job.pr}’s build ${release.version} is running for ${release.manifest.name}’s developers.` });
  };

  /** Takes a pull request's preview away, with its scratch storage. */
  const removePreview = async (job: AppJob, report: JobReporter) => {
    if (job.pr === undefined) throw new StepFailed('The job names no pull request.');
    await report({ step: 'remove', state: 'running' });
    const id = previewId(job.app, job.pr);
    const state = await host.readState();
    const had = state.previews?.[id];
    // One the state doesn't name isn't in the Compose project either, so Compose would refuse to stop it.
    if (had) {
      await host.stop([previewService(id)]);
      const { [id]: _, ...others } = state.previews!;
      await save({ ...state, previews: others }, await host.readEnv());
    }
    // A build that never got as far as storage has none to drop.
    if (!had || had.storage.database || had.storage.bucket) await host.dropStorage(id);
    await report({ step: 'remove', state: 'done', outcome: 'done', message: had ? `Pull request ${job.pr}’s preview and its scratch data are gone.` : `Nothing of pull request ${job.pr} was running.` });
  };

  const remove = async (job: AppJob, report: JobReporter) => {
    await report({ step: 'remove', state: 'running' });
    const state = await host.readState();
    const running = state.apps[job.app];
    if (running) {
      await host.stop([running.active, running.retiring].filter((r): r is RunningApp => Boolean(r)).map((r) => serviceName(job.app, r.slot)));
      delete state.apps[job.app];
      await save(state, await host.readEnv());
    }
    // An app that never registered has no upstream to forget.
    await calls.setUpstream(job.app, null).catch(() => undefined);
    await report({
      step: 'remove',
      state: 'done',
      outcome: 'done',
      message: running ? 'Its containers are gone. Its data stays; remove the app in Admin → Apps to take it out of the catalogue.' : 'Nothing of it was running.',
    });
  };

  /** Runs one job to its end, reporting each step; a failure leaves what was running before. */
  const run = async (job: AppJob, report: JobReporter): Promise<'done' | 'failed'> => {
    if (job.state === 'running') {
      // Only this runner works on jobs, so one already under way means it stopped partway through.
      // A new version it had started but not finished switching to (retiring, with no end) is taken away.
      const state = await host.readState();
      const started = job.pr === undefined ? state.apps[job.app]?.retiring : undefined;
      if (started && !started.until) {
        const env = await host.readEnv();
        // It may have stopped after the switch. If this throws, the job stays running and comes back here.
        await goBack(job.app, state.apps[job.app].active, appSecrets(env, job.app)!.signIn);
        await host.stop([serviceName(job.app, started.slot)]).catch(() => undefined);
        delete state.apps[job.app].retiring;
        if (!state.apps[job.app].active) delete state.apps[job.app];
        await save(state, env).catch(() => undefined);
      }
      await report({ step: 'start', state: 'failed', outcome: 'failed', message: 'The app runner restarted partway through. Whatever was serving before still is; ask again.' });
      return 'failed';
    }
    const work = { install, remove, preview, 'preview-remove': removePreview }[job.action];
    let step: JobStep = job.action === 'install' || job.action === 'preview' ? 'verify' : 'remove';
    const tracked: JobReporter = async (r) => {
      step = r.step;
      await report(r);
    };
    try {
      if (!work) throw new StepFailed(`This app runner doesn’t know how to ${job.action}.`);
      await work(job, tracked);
      return 'done';
    } catch (err) {
      await report({ step, state: 'failed', outcome: 'failed', message: reason(err) });
      return 'failed';
    }
  };

  return { run, retireDue };
};
