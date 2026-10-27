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
 */
import { appSecretFor } from '@augur/service-kit';
import { envValue } from './env-file.ts';

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
  action: 'install' | 'remove';
  release?: AppRelease;
  state: 'requested' | 'running';
}

export type JobStep = 'verify' | 'storage' | 'sign-in' | 'start' | 'health' | 'switch' | 'retire' | 'remove';
export interface JobReport {
  step: JobStep;
  state: 'running' | 'done' | 'failed';
  message?: string;
  outcome?: 'done' | 'failed';
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
}
/** What the runner runs, kept beside the project it writes (apps/state.json). */
export interface RunnerState {
  apps: Record<string, { active?: RunningApp; retiring?: RunningApp }>;
}

/** What the runner does to the server. The real one drives Docker Compose (server.ts); tests use a fake. */
export interface AppHost {
  /** The deployment's settings file, .env. */
  readEnv(): Promise<string>;
  readState(): Promise<RunnerState>;
  /** Writes the state, the apps' Compose project made from it and each container's settings file. */
  writeProject(state: RunnerState, project: object, envFiles: Record<string, string>): Promise<void>;
  /** Throws unless `ref` (an image by digest) was signed by `identity` (a workflow's certificate identity). */
  verifySignedBy(ref: string, identity: string): Promise<void>;
  /** Runs the storage container for this app alone: its database login and schema, its bucket and key. */
  provisionStorage(app: string): Promise<void>;
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
  /** The OIDC issuer that vouches for each signature. */
  issuer?: string;
  now?: () => Date;
}

/** The port every app's service listens on in its container. */
export const APP_PORT = 8080;
/** The network the platform's project makes: apps join it to reach the gateway, Postgres and Garage. */
export const DEFAULT_NETWORK = 'platform_default';
/** How long a new version has to answer on its version. */
export const READY_MS = 180_000;
/** How long the old version keeps running after the switch, for shells still holding the old manifest. */
export const RETIRE_MS = 10 * 60_000;
const POLL_MS = 3_000;

export const serviceName = (app: string, slot: Slot) => `app-${app}-${slot}`;
export const upstreamOf = (app: string, slot: Slot) => `http://${serviceName(app, slot)}:${APP_PORT}`;
/** The prefix of an app's own settings in .env, as the storage container reads them: "team-notes" → TEAM_NOTES. */
const envPrefix = (app: string) => app.toUpperCase().replace(/-/g, '_');
/** A workflow's certificate identity, as cosign checks it: the workflow file on the main branch. */
export const signerIdentity = (publisher: string) => `https://github.com/${publisher}@refs/heads/main`;

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

/** The settings each container gets: where the platform is, its own sign-in and its own storage. */
export const containerEnv = (env: string, app: string, storage: RunningApp['storage']): Record<string, string> => {
  const secrets = appSecrets(env, app);
  if (!secrets) throw new Error('APP_SECRETS_KEY is not set in .env, so the runner can’t give apps their secrets.');
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
    ...(storage.database ? { DATABASE_URL: `postgres://app_${app.replace(/-/g, '_')}:${encodeURIComponent(secrets.database)}@postgres:5432/platform` } : {}),
    ...(storage.bucket ? { S3_ENDPOINT: 'http://garage:3900', S3_BUCKET: app, S3_SECRET_ACCESS_KEY: secrets.bucket } : {}),
  };
};

/** The apps' Compose project: every container the state names, on the platform's network, with nothing more than it needs. */
export const appsProject = (state: RunnerState, network = DEFAULT_NETWORK) => {
  const services: Record<string, object> = {};
  for (const [app, { active, retiring }] of Object.entries(state.apps)) {
    for (const running of [active, retiring]) {
      if (!running) continue;
      const name = serviceName(app, running.slot);
      services[name] = {
        image: running.image,
        restart: 'unless-stopped',
        env_file: [`./${name}.env`],
        networks: ['platform'],
        // Never privileged, no host folders, no added powers.
        cap_drop: ['ALL'],
        security_opt: ['no-new-privileges:true'],
        labels: { 'augur.app': app, 'augur.version': running.version },
      };
    }
  }
  return { name: 'augur-apps', services, networks: { platform: { external: true, name: network } } };
};

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
  return files;
};

class StepFailed extends Error {}
const reason = (err: unknown) => (err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 500);

export const appRunner = ({ host, calls, publishers, now = () => new Date() }: RunnerOptions) => {
  const save = async (state: RunnerState, env: string) => host.writeProject(state, appsProject(state, envValue(env, 'APPS_NETWORK') || DEFAULT_NETWORK), envFilesFor(state, env));

  /** Stops old versions whose time is up. */
  const retireDue = async () => {
    const state = await host.readState();
    const due = Object.entries(state.apps).filter(([, a]) => a.retiring?.until && Date.parse(a.retiring.until) <= now().getTime());
    if (!due.length) return;
    await host.stop(due.map(([app, a]) => serviceName(app, a.retiring!.slot)));
    for (const [, a] of due) delete a.retiring;
    await save(state, await host.readEnv());
  };

  const install = async (job: AppJob, report: JobReporter) => {
    const release = job.release;
    if (!release?.service) throw new StepFailed('The job names no release with a service to run.');
    const app = job.app;
    const env = await host.readEnv();
    if (!appSecrets(env, app)) throw new StepFailed('APP_SECRETS_KEY is not set in .env, so the runner can’t give the app its secrets (docs/upgrade.md, The app runner).');

    await report({ step: 'verify', state: 'running' });
    const publisher = `${release.signer.repository}/${release.signer.workflow}`;
    const trusted = [...publishers, ...publishersFrom(envValue(env, 'APP_PUBLISHERS'))];
    if (!trusted.includes(publisher)) throw new StepFailed(`${publisher} isn’t trusted to publish apps on this server. Add it to APP_PUBLISHERS in .env to trust it.`);
    try {
      await host.verifySignedBy(release.service.image, signerIdentity(publisher));
    } catch (err) {
      throw new StepFailed(`The service image isn’t signed by ${publisher}: ${reason(err)}`);
    }
    await report({ step: 'verify', state: 'done' });

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
    const candidate: RunningApp = { slot, version: release.version, image: release.service.image, storage };
    const withCandidate: RunnerState = { apps: { ...state.apps, [app]: { ...current, retiring: candidate } } };
    // Written as retiring with no end, so a runner that restarts now still knows the container is there.
    await save(withCandidate, env);
    const name = serviceName(app, slot);
    /** Takes the new container away again, leaving the old one serving. */
    const undo = async () => {
      await host.stop([name]).catch(() => undefined);
      const restored: RunnerState = { apps: { ...state.apps } };
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
    let seen: string | undefined;
    for (let waited = 0; ; waited += POLL_MS) {
      const health = await host.health(`${upstreamOf(app, slot)}/healthz`).catch(() => undefined);
      seen = health?.version;
      if (health && seen === release.version) break;
      if (waited >= READY_MS) {
        await undo();
        throw new StepFailed(
          health
            ? `${release.manifest.name} came up on ${seen ?? 'an unknown version'}, not ${release.version}. ${current.active ? `${current.active.version} is still serving.` : ''}`.trim()
            : `${release.manifest.name} ${release.version} didn’t answer within ${READY_MS / 1000} s; its logs say why. ${current.active ? `${current.active.version} is still serving.` : ''}`.trim(),
        );
      }
      await host.wait(POLL_MS);
    }
    await report({ step: 'health', state: 'done' });

    await report({ step: 'switch', state: 'running' });
    try {
      await calls.register(release.manifest, secrets.signIn);
      await calls.setUpstream(app, upstreamOf(app, slot));
    } catch (err) {
      if (current.active) await calls.setUpstream(app, upstreamOf(app, current.active.slot)).catch(() => undefined);
      await undo();
      throw new StepFailed(`The registry didn’t take ${release.version}: ${reason(err)}`);
    }
    await report({ step: 'switch', state: 'done' });

    const until = new Date(now().getTime() + RETIRE_MS).toISOString();
    const next: RunnerState = { apps: { ...state.apps, [app]: { active: candidate, ...(current.active ? { retiring: { ...current.active, until } } : {}) } } };
    await save(next, env);
    await report({
      step: 'retire',
      state: 'done',
      outcome: 'done',
      message: current.active ? `${release.manifest.name} ${release.version} is serving; ${current.active.version} stops at ${until.slice(11, 16)} UTC.` : `${release.manifest.name} ${release.version} is installed.`,
    });
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
      // A new version it had started but not switched to (retiring, with no end) is taken away.
      const state = await host.readState();
      const started = state.apps[job.app]?.retiring;
      if (started && !started.until) {
        await host.stop([serviceName(job.app, started.slot)]).catch(() => undefined);
        delete state.apps[job.app].retiring;
        if (!state.apps[job.app].active) delete state.apps[job.app];
        await save(state, await host.readEnv()).catch(() => undefined);
      }
      await report({ step: 'start', state: 'failed', outcome: 'failed', message: 'The app runner restarted partway through. Whatever was serving before still is; ask again.' });
      return 'failed';
    }
    let step: JobStep = job.action === 'install' ? 'verify' : 'remove';
    const tracked: JobReporter = async (r) => {
      step = r.step;
      await report(r);
    };
    try {
      await (job.action === 'install' ? install(job, tracked) : remove(job, tracked));
      return 'done';
    } catch (err) {
      await report({ step, state: 'failed', outcome: 'failed', message: reason(err) });
      return 'failed';
    }
  };

  return { run, retireDue };
};
