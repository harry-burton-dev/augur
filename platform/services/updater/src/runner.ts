/**
 * The app runner: installs, upgrades and removes apps, in a Compose project of their own
 * (`augur-apps`) that it writes and owns, beside the platform's. An admin asks the registry; the
 * runner does one job at a time and reports each step back (spec section 10).
 *
 * A release on app contract 3 carries one Score workload per part (spec section 4). Each part becomes
 * one Compose service, `app-<id>-<part>-<slot>`: its image by digest, the variables, command and files
 * its Score file names with every `${resources.*}` filled in by the provisioners (provisioners/), its
 * limits applied, a read-only root with `/tmp` in memory, no added powers and only the volumes its
 * resources are. A part gets nothing it didn't ask for: no service addresses, no store, no secrets.
 *
 * An install (a first install, an upgrade or going back alike) is blue/green: job parts run to
 * completion first, then the service and worker parts start in the slot the app isn't using, beside
 * the old ones, and only once every service part answers on the new version does the registry list it
 * and the gateway send calls to its inbound part. Until then the old version keeps serving, so a
 * version that doesn't come up changes nothing. The old one is stopped a few minutes later, once
 * shells have fetched the new manifest.
 *
 * A pull request's preview runs beside the app in containers of its own (`app-<id>-<part>-pr<n>`),
 * signed in as the app but with scratch storage of its own (`<id>-pr<n>`), and is never registered:
 * the registry gives its manifest, and the gateway sends calls to it, only for developers who chose
 * it. A newer build of the pull request replaces it in place; taking it away drops its storage.
 */
import { appSecretFor } from '@augur/service-kit';
import { isRelease2, type AppRelease2 } from '@augur/app-tools/release2';
import type { AppManifest3 } from '@augur/app-tools/validate';
import { envValue } from './env-file.ts';
import { ceilingProblems, PROVISIONERS, provisionParts, type AppSecrets, type Provisioned } from './provisioners/index.ts';
import {
  bytesOf,
  containerOf,
  DEFAULT_READY_SECONDS,
  HEALTH_PATH,
  milliCpuOf,
  PartRefused,
  partKind,
  partPort,
  partRefusals,
  readySeconds,
  substitute,
  volumeResource,
  type ScorePart,
} from './score.ts';
import { devBuildIdentity, isDevBuild, publishersFrom, releaseIdentity } from './signers.ts';

export { publishersFrom };

/** What the runner installs: an app's release file on contract 3 (app-tools' release2). */
export type AppRelease = AppRelease2;

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
/** One version of an app, as the runner keeps it. */
export interface RunningApp {
  slot: Slot;
  version: string;
  /** The release's parts, one Score workload each. */
  parts?: ScorePart[];
  /** The manifest it was registered with, so the runner can go back to it. */
  manifest?: AppManifest3;
  /** The repository whose release this is. */
  repository?: string;
  /** The old version, stopped once this time has passed. */
  until?: string;
  /** Before contract 3: one container from this image, with its settings file kept beside the project. */
  image?: string;
  storage?: { database: boolean; bucket: boolean };
}
/** A pull request's preview, as the runner keeps it. */
export interface RunningPreview {
  app: string;
  pr: number;
  version: string;
  parts?: ScorePart[];
  manifest?: AppManifest3;
  /** Before contract 3, as RunningApp's. */
  image?: string;
  storage?: { database: boolean; bucket: boolean };
}
/** What the runner runs, kept beside the project it writes (apps/state.json). */
export interface RunnerState {
  apps: Record<string, { active?: RunningApp; retiring?: RunningApp }>;
  /** By preview id (notes-pr12). Missing in a state written before previews. */
  previews?: Record<string, RunningPreview>;
}

/** What `compose run` of a job part said: its exit code (or that it ran out of time) and its output. */
export interface JobRun {
  code: number | 'timeout';
  logs: string;
}

/** What the runner does to the server. The real one drives Docker Compose (server.ts); tests use a fake. */
export interface AppHost {
  /** The deployment's settings file, .env. */
  readEnv(): Promise<string>;
  /** The network the platform's own containers share, as Docker names it, or undefined if it can't tell. */
  platformNetwork(): Promise<string | undefined>;
  /** The address ranges of the networks the deployment's own containers are on, such as 172.18.0.0/16. */
  ownNetworks(): Promise<string[]>;
  readState(): Promise<RunnerState>;
  /**
   * Writes the state, the apps' Compose project made from it and the files beside it, by path in the
   * apps folder: each part's files (`files/<service>/<n>`, mounted as Compose secrets) and, for a version
   * from before contract 3, its settings file. Files it wrote before and doesn't name now go.
   */
  writeProject(state: RunnerState, project: object, files: Record<string, string | Uint8Array>): Promise<void>;
  /** Throws unless `ref` (an image by digest) was signed by `identity` (a workflow's certificate identity). */
  verifySignedBy(ref: string, identity: string): Promise<void>;
  /** Pulls an image and gives the user its config runs as ('' when it sets none). */
  imageUser(ref: string): Promise<string>;
  /** Takes a fresh backup of the platform's database (apps' tables with it) and returns its file name. */
  backup(): Promise<string>;
  /** Runs the storage container for this app (or preview id) alone: its database login and schema, its bucket and key. */
  provisionStorage(app: string, options?: { connections?: number }): Promise<void>;
  /** Runs the storage container to take a preview's scratch storage away, data and all. */
  dropStorage(previewId: string): Promise<void>;
  /** Pulls and starts these services of the apps' project, leaving the others alone. */
  start(services: string[]): Promise<void>;
  /** Runs one of the project's job services to its end, within `ms`, and says how it ended. */
  runJob(service: string, ms: number): Promise<JobRun>;
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
  register(manifest: AppManifest3, secret: string): Promise<void>;
  /** Points the gateway at the app's inbound part (registry, PUT /v1/apps/:id/upstream); null forgets it. */
  setUpstream(app: string, url: string | null): Promise<void>;
}

export interface RunnerOptions {
  host: AppHost;
  calls: PlatformCalls;
  now?: () => Date;
}

/** The network the platform's project makes, when it's named `platform` and the updater can't ask: parts join it to reach the gateway, Postgres and Garage (P3b gives each app its own). */
export const DEFAULT_NETWORK = 'platform_default';
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
/** How many of a failed job's last log lines its step's message carries. */
const LOG_TAIL_LINES = 10;
/** Where every container may write besides its scratch folders (spec 4.13). */
const TMP = '/tmp';

/** One part's Compose service: app-<id>-<part>-<slot>, the slot being blue, green or a preview's pr<n>. */
export const partService = (app: string, part: string, slot: string) => `app-${app}-${part}-${slot}`;
/** A pull request's preview of an app: its storage is kept under this id. */
export const previewId = (app: string, pr: number) => `${app}-pr${pr}`;
const previewSlot = (pr: number) => `pr${pr}`;
/** Before contract 3, an app's one container. */
const legacyService = (app: string, slot: string) => `app-${app}-${slot}`;
const LEGACY_PORT = 8080;
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
 * An app's secrets: one named in .env wins (as the storage container does), otherwise worked out from
 * APP_SECRETS_KEY. Undefined without either, when the runner can't run apps.
 */
export const appSecrets = (env: string, app: string): AppSecrets | undefined => {
  const key = envValue(env, 'APP_SECRETS_KEY');
  const named = (suffix: string) => envValue(env, `${envPrefix(app)}_${suffix}`) || undefined;
  if (!key) return undefined;
  return {
    database: named('DATABASE_PASSWORD') ?? appSecretFor(key, app, 'database'),
    bucket: named('BUCKET_SECRET') ?? appSecretFor(key, app, 'bucket'),
    signIn: named('CLIENT_SECRET') ?? appSecretFor(key, app, 'sign-in'),
  };
};

/** One version of an app's parts, as the runner renders and runs them. */
interface Unit {
  app: string;
  /** blue, green, or a preview's pr<n>. */
  slot: string;
  storageId: string;
  version: string;
  manifest: AppManifest3;
  parts: ScorePart[];
}

/** The secrets of a unit: the app's sign-in, with its storage id's storage secrets. */
const unitSecrets = (env: string, unit: Pick<Unit, 'app' | 'storageId'>): AppSecrets => {
  const app = appSecrets(env, unit.app);
  if (!app) throw new Error('APP_SECRETS_KEY is not set in .env, so the runner can’t give apps their secrets.');
  return unit.storageId === unit.app ? app : { ...appSecrets(env, unit.storageId)!, signIn: app.signIn };
};

const provisioned = (unit: Unit, env: string) =>
  provisionParts({
    app: unit.app,
    storageId: unit.storageId,
    manifest: unit.manifest,
    parts: unit.parts,
    env,
    secrets: unitSecrets(env, unit),
  });

/** Score's map of target path → details, or its older list with `target` in each. */
const byTarget = <T extends object>(list: unknown): [string, T][] => (Array.isArray(list) ? list.map((f: T & { target: string }) => [f.target, f]) : (Object.entries(list ?? {}) as [string, T][]));

/** What one unit adds to the project, and the files written beside it. */
const renderUnit = (unit: Unit, env: string) => {
  const p: Provisioned = provisioned(unit, env);
  const services: Record<string, object> = {};
  const volumes: Record<string, object> = {};
  const secrets: Record<string, object> = {};
  const files: Record<string, string | Uint8Array> = {};
  for (const part of unit.parts) {
    const name = part.metadata.name;
    const service = partService(unit.app, name, unit.slot);
    const { spec } = containerOf(part);
    const fill = (text: unknown, where: Parameters<typeof substitute>[3], label: string) => substitute(String(text), name, p.outputs[name] ?? {}, where, label);
    const environment = Object.fromEntries(Object.entries(spec.variables ?? {}).map(([k, v]) => [k, fill(v, 'variable', `the variable ${k}`)]));
    const mounts: object[] = [];
    let n = 0;
    for (const [target, file] of byTarget<{
      content?: string;
      binaryContent?: string;
      source?: string;
      noExpand?: boolean;
    }>(spec.files)) {
      if (file.source !== undefined) throw new PartRefused(`${name}’s file ${target} comes from ${file.source} in its repository, which a release doesn’t carry: give its content instead.`);
      const text = file.binaryContent !== undefined ? Buffer.from(file.binaryContent, 'base64') : file.noExpand ? String(file.content ?? '') : fill(file.content ?? '', 'file', `the file ${target}`);
      const key = `${service}-file-${n}`;
      const path = `files/${service}/${n}`;
      files[path] = text;
      secrets[key] = { file: `./${path}` };
      mounts.push({ source: key, target });
      n += 1;
    }
    const volumeMounts: object[] = [];
    for (const [target, v] of byTarget<{
      source: string;
      path?: string;
      readOnly?: boolean;
    }>(spec.volumes)) {
      const resource = volumeResource(v.source);
      const volume = resource ? p.volumes[name]?.[resource] : undefined;
      if (!volume) throw new PartRefused(`${name} mounts ${v.source} at ${target}: a part mounts only its own augur-scratch or augur-files resources, as \${resources.<name>} (spec 4.7).`);
      if (v.path !== undefined) throw new PartRefused(`${name} mounts part of ${resource} (path ${v.path}) at ${target}: mount the whole folder.`);
      volumes[volume.name] = { name: volume.name, labels: volume.labels };
      volumeMounts.push({
        type: 'volume',
        source: volume.name,
        target,
        read_only: volume.readOnly || v.readOnly === true,
      });
    }
    const { limits } = spec.resources;
    const job = partKind(part) === 'job';
    services[service] = {
      image: spec.image,
      // A job runs once, when the runner runs it (`compose run`), never with `up`.
      ...(job ? { restart: 'no', profiles: ['jobs'] } : { restart: 'unless-stopped' }),
      ...(spec.command
        ? {
            entrypoint: spec.command.map((c, i) => fill(c, 'command', `its command (${i + 1})`)),
          }
        : {}),
      ...(spec.args
        ? {
            command: spec.args.map((a, i) => fill(a, 'command', `its arguments (${i + 1})`)),
          }
        : {}),
      environment,
      ...(mounts.length ? { secrets: mounts } : {}),
      ...(volumeMounts.length ? { volumes: volumeMounts } : {}),
      networks: ['platform'],
      mem_limit: bytesOf(limits.memory),
      cpus: milliCpuOf(limits.cpu)! / 1000,
      // Never privileged, no host folders, no added powers, nothing written but scratch and /tmp (spec 4.13, 10.5).
      read_only: true,
      tmpfs: [TMP],
      cap_drop: ['ALL'],
      security_opt: ['no-new-privileges:true'],
      labels: {
        'augur.app': unit.app,
        'augur.version': unit.version,
        'augur.part': name,
        'augur.kind': partKind(part),
        ...(unit.slot.startsWith('pr') ? { 'augur.preview': unit.slot.slice(2) } : {}),
      },
    };
  }
  return { services, volumes, secrets, files, provisioned: p };
};

/** A container from before contract 3, kept as it ran until it's removed or replaced: its settings file stays beside the project. */
const legacyContainer = (image: string, service: string, labels: Record<string, string>) => ({
  image,
  restart: 'unless-stopped',
  env_file: [`./${service}.env`],
  networks: ['platform'],
  cap_drop: ['ALL'],
  security_opt: ['no-new-privileges:true'],
  labels,
});

const unitOf = (app: string, running: RunningApp): Unit | undefined =>
  running.parts
    ? {
        app,
        slot: running.slot,
        storageId: app,
        version: running.version,
        manifest: running.manifest!,
        parts: running.parts,
      }
    : undefined;
const previewUnitOf = (id: string, p: RunningPreview): Unit | undefined =>
  p.parts
    ? {
        app: p.app,
        slot: previewSlot(p.pr),
        storageId: id,
        version: p.version,
        manifest: p.manifest!,
        parts: p.parts,
      }
    : undefined;

/**
 * The apps' Compose project: every part of every version the state names, on the platform's network,
 * with nothing more than it asked for; and the files its parts read, by path in the apps folder.
 */
export const appsProject = (state: RunnerState, env: string, network = DEFAULT_NETWORK) => {
  const services: Record<string, object> = {};
  const volumes: Record<string, object> = {};
  const secrets: Record<string, object> = {};
  const files: Record<string, string | Uint8Array> = {};
  const add = (unit: Unit) => {
    const r = renderUnit(unit, env);
    Object.assign(services, r.services);
    Object.assign(volumes, r.volumes);
    Object.assign(secrets, r.secrets);
    Object.assign(files, r.files);
  };
  for (const [app, { active, retiring }] of Object.entries(state.apps)) {
    for (const running of [active, retiring]) {
      if (!running) continue;
      const unit = unitOf(app, running);
      if (unit) add(unit);
      else if (running.image) services[legacyService(app, running.slot)] = legacyContainer(running.image, legacyService(app, running.slot), { 'augur.app': app, 'augur.version': running.version });
    }
  }
  for (const [id, p] of Object.entries(state.previews ?? {})) {
    const unit = previewUnitOf(id, p);
    if (unit) add(unit);
    else if (p.image)
      services[`app-${id}`] = legacyContainer(p.image, `app-${id}`, {
        'augur.app': p.app,
        'augur.version': p.version,
        'augur.preview': String(p.pr),
      });
  }
  const project = {
    name: 'augur-apps',
    services,
    networks: { platform: { external: true, name: network } },
    ...(Object.keys(volumes).length ? { volumes } : {}),
    ...(Object.keys(secrets).length ? { secrets } : {}),
  };
  return { project, files };
};

/** Every service of a version (jobs too, in case one was left behind), to stop. */
const servicesOf = (app: string, running: RunningApp) => (running.parts ? running.parts.map((p) => partService(app, p.metadata.name, running.slot)) : [legacyService(app, running.slot)]);
const previewServices = (id: string, p: RunningPreview) => (p.parts ? p.parts.map((part) => partService(p.app, part.metadata.name, previewSlot(p.pr))) : [`app-${id}`]);

/** Where each service part answers /healthz, by part. */
const healthUrls = (unit: Pick<Unit, 'app' | 'slot' | 'parts'>) =>
  unit.parts
    .filter((p) => partKind(p) === 'service')
    .map((p) => ({
      part: p,
      url: `http://${partService(unit.app, p.metadata.name, unit.slot)}:${partPort(p)}${HEALTH_PATH}`,
    }));
/** The inbound part's address, which the gateway sends /api/<id>/* to; null for an app without one. */
const inboundUrl = (unit: Pick<Unit, 'app' | 'slot' | 'parts'>) => {
  const inbound = unit.parts.find((p) => Object.values(p.resources ?? {}).some((r) => r.type === 'augur-gateway' && r.params?.inbound === true));
  return inbound ? `http://${partService(unit.app, inbound.metadata.name, unit.slot)}:${partPort(inbound)}` : null;
};
const upstreamOf = (app: string, running: RunningApp) => (running.parts ? inboundUrl({ app, slot: running.slot, parts: running.parts }) : `http://${legacyService(app, running.slot)}:${LEGACY_PORT}`);

class StepFailed extends Error {}

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err)).split('\n')[0].slice(0, 500);
/** The last lines of a job's output, for its step's message. */
const tail = (logs: string) =>
  logs
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-LOG_TAIL_LINES)
    .join(' | ')
    .slice(-400);
/** An image's user, as Docker reads it: unset, root and uid 0 all run as root (spec 4.13). */
export const runsAsRoot = (user: string) => ['', 'root', '0'].includes(user.trim().split(':')[0]!);

/** Why the runner won't run a release, before anything is verified or started. */
const releaseRefusal = (release: unknown, app: string): string | undefined => {
  if (!isRelease2(release)) return 'This release isn’t on app contract 3, the only one this AUGUR’s runner runs.';
  if (release.id !== app || release.manifest.id !== app) return `The release is for ${release.manifest.id}, not ${app}.`;
  // Plainly first, the one refusal spec 4.4 words: a type this AUGUR has no provisioner for.
  const unoffered = release.parts.flatMap((p) =>
    Object.entries(p.resources ?? {})
      .filter(([, r]) => !PROVISIONERS[r.type])
      .map(([name, r]) => `${p.metadata.name} asks for ${name} of type ${r.type}: resource type not offered by this AUGUR.`),
  );
  if (unoffered.length) return unoffered.join(' ');
  const refused = release.parts.flatMap(partRefusals);
  return refused.length ? refused.join(' ') : undefined;
};

export const appRunner = ({ host, calls, now = () => new Date() }: RunnerOptions) => {
  // APPS_NETWORK wins; otherwise the network the updater itself is on, asked once, since a project run under
  // another name (COMPOSE_PROJECT_NAME, -p) doesn't make platform_default.
  let found: Promise<string | undefined> | undefined;
  const network = async (env: string) => envValue(env, 'APPS_NETWORK') || (await (found ??= host.platformNetwork().catch(() => undefined))) || DEFAULT_NETWORK;
  const save = async (state: RunnerState, env: string) => {
    const { project, files } = appsProject(state, env, await network(env));
    await host.writeProject(state, project, files);
  };
  const readyDefault = (env: string) => Number(envValue(env, 'APP_READY_SECONDS')) || DEFAULT_READY_SECONDS;

  /** Stops old versions whose time is up. */
  const retireDue = async () => {
    const state = await host.readState();
    const due = Object.entries(state.apps).filter(([, a]) => a.retiring?.until && Date.parse(a.retiring.until) <= now().getTime());
    if (!due.length) return;
    await host.stop(due.flatMap(([app, a]) => servicesOf(app, a.retiring!)));
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
    await calls.setUpstream(app, upstreamOf(app, active));
  };

  /** The release to run, .env, and every part's image's signature checked: the start of an install and of a preview. */
  const verified = async (job: AppJob, report: JobReporter) => {
    const release = job.release;
    const refused = releaseRefusal(release, job.app);
    if (refused) throw new StepFailed(refused);
    const r = release as AppRelease;
    const env = await host.readEnv();
    if (!appSecrets(env, job.app)) throw new StepFailed('APP_SECRETS_KEY is not set in .env, so the runner can’t give the app its secrets (docs/upgrade.md, The app runner).');

    await report({ step: 'verify', state: 'running' });
    const publisher = `${r.signer.repository}/${r.signer.workflow}`;
    // Only the repositories and workflows the deployment lists are trusted to publish apps (spec 3.4).
    const trusted = publishersFrom(envValue(env, 'APP_PUBLISHERS'));
    const dev = job.pr === undefined && isDevBuild(r.version);
    // Only a dev or preview server takes dev builds, whatever the registry asked.
    if (dev && !['dev', 'preview'].includes(envValue(env, 'SERVER_RING') ?? ''))
      throw new StepFailed(`${r.version} is a dev build, and only a dev or preview server (SERVER_RING=dev or preview in .env) installs dev builds.`);
    // A preview or a dev build comes from its own workflow, in a repository whose releases are trusted.
    const own = job.pr !== undefined ? PREVIEW_WORKFLOW : dev ? DEV_WORKFLOW : undefined;
    const ok = own === undefined ? trusted.includes(publisher) : r.signer.workflow === own && trusted.some((t) => t.startsWith(`${r.signer.repository}/`));
    const what = job.pr !== undefined ? 'previews' : dev ? 'dev builds' : 'apps';
    if (!ok) throw new StepFailed(`${publisher} isn’t trusted to publish ${what} on this server. Add ${own === undefined ? 'it' : 'its repository'} to APP_PUBLISHERS in .env to trust it.`);
    for (const image of new Set(r.parts.map((p) => containerOf(p).spec.image))) {
      try {
        await host.verifySignedBy(image, dev ? devIdentity(r.signer.repository) : signerIdentity(publisher, job.pr));
      } catch (err) {
        const part = r.parts.find((p) => containerOf(p).spec.image === image)!.metadata.name;
        throw new StepFailed(`${part}’s image isn’t signed by ${publisher}${dev ? ' on dev' : ''}: ${reason(err)}`);
      }
    }
    // A dev build runs on the server's real data, and the first release from another repository takes
    // over the data the old one left: a backup first, to go back to.
    const running = job.action === 'install' ? (await host.readState()).apps[job.app]?.active : undefined;
    const handover = running !== undefined && running.repository !== r.signer.repository;
    if (dev || handover) {
      const why = dev ? 'a dev build needs' : `the move from ${running?.repository ?? 'where it came from'} to ${r.signer.repository} needs`;
      const file = await host.backup().catch((err) => {
        throw new StepFailed(`The backup ${why} first couldn’t be taken: ${reason(err)}`);
      });
      await report({
        step: 'verify',
        state: 'done',
        message: `${dev ? 'Signed on dev.' : `Signed in ${r.signer.repository}, where ${job.app} now comes from.`} Backup ${file} taken first.`,
      });
    } else await report({ step: 'verify', state: 'done' });
    return { release: r, env };
  };

  /**
   * Works out every part's outputs and checks the asks against the ceilings, then does the platform's
   * side: the storage container for a database or bucket. Nothing has started yet, so a refusal here
   * changes nothing (spec 10.3).
   */
  const provision = async (unit: Unit, env: string, report: JobReporter) => {
    await report({ step: 'storage', state: 'running' });
    let p: Provisioned;
    try {
      p = provisioned(unit, env);
      renderUnit(unit, env);
    } catch (err) {
      throw new StepFailed(err instanceof PartRefused ? err.message : reason(err));
    }
    const over = ceilingProblems(unit.parts, env, p.volumes);
    if (over.length) throw new StepFailed(`${over.join(' ')} Nothing was started.`);
    if (p.needs.includes('storage')) await host.provisionStorage(unit.storageId, p.connections ? { connections: p.connections } : undefined);
    const resources = unit.parts.flatMap((part) => Object.entries(part.resources ?? {}).map(([name, r]) => `${part.metadata.name}.${name} (${r.type})`));
    await report({
      step: 'storage',
      state: 'done',
      message: resources.length ? `Provisioned ${resources.join(', ')}.` : 'Its parts ask for nothing.',
    });
    return p;
  };

  /** Pulls each image and refuses one that runs as root (spec 4.13). */
  const checkImages = async (parts: ScorePart[]) => {
    for (const part of parts) {
      const { spec } = containerOf(part);
      const user = await host.imageUser(spec.image).catch((err) => {
        throw new StepFailed(`${part.metadata.name}’s image couldn’t be pulled: ${reason(err)}`);
      });
      if (runsAsRoot(user))
        throw new StepFailed(`${part.metadata.name}’s image runs as ${user.trim() ? user : 'root (it sets no user)'}: a part runs as a user other than root (spec 4.13). Set USER in its Dockerfile.`);
    }
  };

  /** Runs the job parts, in the release's order, each to exit 0 within its time (spec 10.6). */
  const runJobs = async (unit: Unit, env: string) => {
    const ran: string[] = [];
    for (const part of unit.parts.filter((p) => partKind(p) === 'job')) {
      const service = partService(unit.app, part.metadata.name, unit.slot);
      const seconds = readySeconds(part, readyDefault(env));
      const run = await host.runJob(service, seconds * 1000).catch((err): JobRun => ({ code: -1, logs: reason(err) }));
      if (run.code !== 0) {
        const how = run.code === 'timeout' ? `didn’t finish within ${seconds} s` : `exited ${run.code}`;
        const said = tail(run.logs);
        throw new StepFailed(`${part.metadata.name} (a job) ${how}${said ? `. Its last lines: ${said}` : ', saying nothing'}`);
      }
      ran.push(part.metadata.name);
    }
    return ran;
  };

  /** Waits for `url` to answer on `version` within `ms`; the answer it last gave when it doesn't in time. */
  const answers = async (url: string, version: string, ms: number) => {
    let seen: { version?: string } | undefined;
    for (let waited = 0; ; waited += POLL_MS) {
      seen = await host.health(url).catch(() => undefined);
      if (seen?.version === version) return { ready: true as const };
      if (waited >= ms) return { ready: false as const, seen };
      await host.wait(POLL_MS);
    }
  };

  /** Waits for every service part to answer on the version (spec 10.1); why one didn't, or nothing when all did. */
  const allReady = async (unit: Unit, env: string) => {
    for (const { part, url } of healthUrls(unit)) {
      const seconds = readySeconds(part, readyDefault(env));
      const health = await answers(url, unit.version, seconds * 1000);
      if (!health.ready) {
        return health.seen
          ? `The ${part.metadata.name} part of ${unit.manifest.name} came up on ${health.seen.version ?? 'an unknown version'}, not ${unit.version}.`
          : `The ${part.metadata.name} part of ${unit.manifest.name} ${unit.version} didn’t answer within ${seconds} s; its logs say why.`;
      }
    }
    return undefined;
  };

  /** Why a service part stopped answering on the version within APP_WATCH_MS (two misses in a row), or nothing when they kept answering. */
  const stillAnswering = async (unit: Unit) => {
    const urls = healthUrls(unit);
    let misses = 0;
    for (let watched = APP_WATCH_EVERY_MS; watched <= APP_WATCH_MS; watched += APP_WATCH_EVERY_MS) {
      await host.wait(APP_WATCH_EVERY_MS);
      let problem: string | undefined;
      for (const { part, url } of urls) {
        const seen = await host.health(url).catch(() => undefined);
        if (seen?.version !== unit.version) {
          problem = seen
            ? `the ${part.metadata.name} part answered on ${seen.version ?? 'an unknown version'} after the switch.`
            : `the ${part.metadata.name} part stopped answering after the switch.`;
          break;
        }
      }
      misses = problem ? misses + 1 : 0;
      if (problem && misses >= APP_WATCH_MISSES) return problem;
    }
    return undefined;
  };

  /** Starts a unit's parts: images checked, jobs run, then its service and worker parts. Throws, having taken nothing away, on a failure. */
  const startUnit = async (unit: Unit, env: string, report: JobReporter) => {
    await checkImages(unit.parts);
    const jobs = await runJobs(unit, env);
    const long = unit.parts.filter((p) => partKind(p) !== 'job').map((p) => partService(unit.app, p.metadata.name, unit.slot));
    if (long.length) {
      try {
        await host.start(long);
      } catch (err) {
        throw new StepFailed(`${long.join(', ')} wouldn’t start: ${reason(err)}`);
      }
    }
    await report({
      step: 'start',
      state: 'done',
      ...(jobs.length ? { message: `Ran ${jobs.join(', ')} to the end first.` } : {}),
    });
  };

  const install = async (job: AppJob, report: JobReporter) => {
    const app = job.app;
    const { release, env } = await verified(job, report);
    const state = await host.readState();
    const current = state.apps[app] ?? {};
    const slot: Slot = current.active?.slot === 'blue' ? 'green' : 'blue';
    const unit: Unit = {
      app,
      slot,
      storageId: app,
      version: release.version,
      manifest: release.manifest,
      parts: release.parts,
    };

    await provision(unit, env, report);

    await report({ step: 'sign-in', state: 'running' });
    const secrets = appSecrets(env, app)!;
    await calls.setCredential(app, secrets.signIn);
    await report({ step: 'sign-in', state: 'done' });

    await report({ step: 'start', state: 'running' });
    // A version still winding down gives up its slot to the new one now.
    if (current.retiring) {
      await host.stop(servicesOf(app, current.retiring));
      delete current.retiring;
    }
    const candidate: RunningApp = {
      slot,
      version: release.version,
      parts: release.parts,
      manifest: release.manifest,
      repository: release.signer.repository,
    };
    const withCandidate: RunnerState = {
      ...state,
      apps: { ...state.apps, [app]: { ...current, retiring: candidate } },
    };
    // Written as retiring with no end, so a runner that restarts now still knows the containers are there.
    await save(withCandidate, env);
    const names = servicesOf(app, candidate);
    /** Takes the new containers away again, leaving the old ones serving. */
    const undo = async () => {
      await host.stop(names).catch(() => undefined);
      const restored: RunnerState = { ...state, apps: { ...state.apps } };
      if (current.active) restored.apps[app] = { active: current.active };
      else delete restored.apps[app];
      await save(restored, env).catch(() => undefined);
    };
    const stillServing = current.active ? ` ${current.active.version} is still serving.` : '';
    try {
      await startUnit(unit, env, report);
    } catch (err) {
      await undo();
      throw new StepFailed(`${reason(err)}${stillServing}`);
    }

    await report({ step: 'health', state: 'running' });
    const notReady = await allReady(unit, env);
    if (notReady) {
      await undo();
      throw new StepFailed(`${notReady}${stillServing}`);
    }
    await report({ step: 'health', state: 'done' });

    await report({ step: 'switch', state: 'running' });
    try {
      await calls.register(release.manifest, secrets.signIn);
      await calls.setUpstream(app, inboundUrl(unit));
      await report({ step: 'switch', state: 'done' });
    } catch (err) {
      const refused = `The registry didn’t take ${release.version}: ${reason(err)}`;
      // The new version may be serving by now, so it stops only once the gateway has left it.
      await goBack(app, current.active, secrets.signIn).catch((back) => {
        throw new StepFailed(`${refused} Going back to ${current.active?.version} didn’t work either, so ${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} still running: ${reason(back)}`);
      });
      await undo();
      throw new StepFailed(refused);
    }

    // An upgrade is watched while the old version still runs; a first install has nothing to go back to.
    if (current.active) {
      const old = current.active;
      // Kept with an end past the watch, so a runner that restarts meanwhile stops it in time, as after any switch.
      await save(
        {
          ...state,
          apps: {
            ...state.apps,
            [app]: {
              active: candidate,
              retiring: {
                ...old,
                until: new Date(now().getTime() + APP_WATCH_MS + RETIRE_MS).toISOString(),
              },
            },
          },
        },
        env,
      );
      await report({
        step: 'watch',
        state: 'running',
        message: `Watching ${release.manifest.name} ${release.version} for ${APP_WATCH_MS / 60_000} minutes; ${old.version} is still running to go back to.`,
      });
      const problem = await stillAnswering(unit);
      if (problem) {
        const why = `${release.manifest.name} ${release.version}: ${problem}`;
        if (!old.manifest) {
          throw new StepFailed(`${why} It didn’t go back by itself: ${old.version} was installed before the runner kept what it needs to go back. Install ${old.version} again from Admin → Apps.`);
        }
        try {
          await calls.register(old.manifest, secrets.signIn);
          await calls.setUpstream(app, upstreamOf(app, old));
        } catch (err) {
          throw new StepFailed(`${why} Going back to ${old.version} didn’t work: ${reason(err)}`);
        }
        await host.stop(names).catch(() => undefined);
        await save({ ...state, apps: { ...state.apps, [app]: { active: old } } }, env);
        throw new StepFailed(`${why} Back on ${old.version} by itself.`);
      }
      await report({ step: 'watch', state: 'done' });
    }

    const until = new Date(now().getTime() + RETIRE_MS).toISOString();
    const next: RunnerState = {
      ...state,
      apps: {
        ...state.apps,
        [app]: {
          active: candidate,
          ...(current.active ? { retiring: { ...current.active, until } } : {}),
        },
      },
    };
    await save(next, env);
    await report({
      step: 'retire',
      state: 'done',
      outcome: 'done',
      message: current.active
        ? `${release.manifest.name} ${release.version} is serving; ${current.active.version} stops at ${until.slice(11, 16)} UTC.`
        : `${release.manifest.name} ${release.version} is installed.`,
    });
  };

  /** Runs a pull request's build beside the app, replacing the pull request's last one. */
  const preview = async (job: AppJob, report: JobReporter) => {
    if (job.pr === undefined) throw new StepFailed('The job names no pull request.');
    const { release, env } = await verified(job, report);
    const id = previewId(job.app, job.pr);
    const unit: Unit = {
      app: job.app,
      slot: previewSlot(job.pr),
      storageId: id,
      version: release.version,
      manifest: release.manifest,
      parts: release.parts,
    };
    await provision(unit, env, report);

    await report({ step: 'start', state: 'running' });
    const state = await host.readState();
    const had = state.previews?.[id];
    // One build a pull request: its last makes way for this one.
    if (had) await host.stop(previewServices(id, had));
    const next: RunnerState = {
      ...state,
      previews: {
        ...state.previews,
        [id]: {
          app: job.app,
          pr: job.pr,
          version: release.version,
          parts: release.parts,
          manifest: release.manifest,
        },
      },
    };
    await save(next, env);
    /** Takes the containers away; the pull request has no preview until its next build. */
    const undo = async () => {
      await host.stop(previewServices(id, next.previews![id]!)).catch(() => undefined);
      const { [id]: _, ...others } = next.previews!;
      await save({ ...next, previews: others }, env).catch(() => undefined);
    };
    try {
      await startUnit(unit, env, report);
    } catch (err) {
      await undo();
      throw new StepFailed(reason(err));
    }

    await report({ step: 'health', state: 'running' });
    const notReady = await allReady(unit, env);
    if (notReady) {
      await undo();
      throw new StepFailed(notReady);
    }
    await report({ step: 'health', state: 'done' });
    const upstream = inboundUrl(unit);
    await report({
      step: 'switch',
      state: 'done',
      outcome: 'done',
      ...(upstream ? { upstream } : {}),
      message: `Pull request ${job.pr}’s build ${release.version} is running for ${release.manifest.name}’s developers.`,
    });
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
      await host.stop(previewServices(id, had));
      const { [id]: _, ...others } = state.previews!;
      await save({ ...state, previews: others }, await host.readEnv());
    }
    // A build from before contract 3 that never got as far as storage has none to drop.
    if (!had || had.parts || had.storage?.database || had.storage?.bucket) await host.dropStorage(id);
    await report({
      step: 'remove',
      state: 'done',
      outcome: 'done',
      message: had ? `Pull request ${job.pr}’s preview and its scratch data are gone.` : `Nothing of pull request ${job.pr} was running.`,
    });
  };

  const remove = async (job: AppJob, report: JobReporter) => {
    await report({ step: 'remove', state: 'running' });
    const state = await host.readState();
    const running = state.apps[job.app];
    if (running) {
      await host.stop([running.active, running.retiring].filter((r): r is RunningApp => Boolean(r)).flatMap((r) => servicesOf(job.app, r)));
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
        await host.stop(servicesOf(job.app, started)).catch(() => undefined);
        delete state.apps[job.app].retiring;
        if (!state.apps[job.app].active) delete state.apps[job.app];
        await save(state, env).catch(() => undefined);
      }
      await report({
        step: 'start',
        state: 'failed',
        outcome: 'failed',
        message: 'The app runner restarted partway through. Whatever was serving before still is; ask again.',
      });
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
      await report({
        step,
        state: 'failed',
        outcome: 'failed',
        message: reason(err),
      });
      return 'failed';
    }
  };

  return { run, retireDue };
};
