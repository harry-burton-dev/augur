/**
 * The real server: the deployment's own Compose project, driven with the docker CLI through the
 * Docker API the docker-proxy service passes on (DOCKER_HOST). The deploy folder is mounted at the
 * same path it has on the host (PLATFORM_DIR), so Compose's relative paths name the host's files.
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, chmod, mkdir, mkdtemp, open, readdir, readFile, rename, rm, stat, statfs, writeFile, type FileHandle } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseRef, pullArtifactLayer, type ArtifactAuth } from './oci.ts';
import { partsFor } from './parts.ts';
import type { AppHost, PlatformPart, RunnerState } from './runner.ts';

/** The label the runner marks the apps' own networks with: `augur.network=app`. */
const APP_NETWORK_LABEL = 'augur.network';
/** A command's output, one entry a line. */
const lines = (said: string) => said.split('\n').map((l) => l.trim()).filter(Boolean);
import type { Journal, Server } from './upgrade.ts';

export interface ServerOptions {
  /** The deploy folder: compose.yml and .env. */
  dir: string;
  /** Where the Docker API is, e.g. tcp://docker-proxy:2375. */
  dockerHost: string;
  /** The docker CLI's own config (registry sign-ins), somewhere the updater can write. */
  dockerConfig: string;
  /** Who may sign AUGUR's images: the Release workflow's identity, and the issuer that vouches for it. */
  signer: { identity: string; issuer: string };
  /** Each service's health address inside the Compose network (parts.ts): the platform's own by default. */
  healthUrls?: Record<string, string>;
  /** The gateway inside the Compose network, whose /traffic the watch after an upgrade reads. */
  gatewayUrl?: string;
  /** The sign-in realm as the updater reaches it (OIDC_INTERNAL_URL, else OIDC_ISSUER), which the watch checks answers. */
  signInUrl?: string;
  /**
   * Really signs in, with a fresh token each time (the updater's own service sign-in): the watch's
   * sign-in check when there is one, since the realm's discovery page answers even when tokens can't
   * be issued. Without it only the discovery page is checked.
   */
  signIn?: () => Promise<unknown>;
}

/** Where the updater's image keeps the deploy files of the release it was built for (infra/service.Dockerfile). */
export const OWN_DEPLOY_DIR = '/augur/deploy';

/** Each file under `root`, by path inside it; undefined for one that isn't there. */
const readUnder = async (root: string, paths: string[]) => {
  const files: Record<string, Buffer | undefined> = {};
  for (const path of paths) files[path] = await readFile(join(root, path)).catch(() => undefined);
  return files;
};

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/** The open upgrade's journal in the deploy folder (upgrade.ts, Journal): it holds the old .env, so only the updater reads it. */
export const JOURNAL_FILE = '.updater-upgrade.json';
/** Beside .env while it's written in place: .env as it was, to put back should the write be cut short. */
export const ENV_BEFORE_UPGRADE = '.env.before-upgrade';

/** Long enough for a pull of every image on a slow line. */
const COMMAND_MS = 20 * 60_000;

export class CommandFailed extends Error {}

/**
 * A copy of Sigstore's trust root in the deploy folder, which the mirror script writes beside its feed
 * (docs/mirror.md). With it, signatures are checked with no network at all: against the Rekor bundle
 * each signature carries, and the certificates and logs the trust root names.
 */
export const TRUSTED_ROOT = 'releases/trusted_root.json';

/**
 * cosign's arguments to check `ref` was signed by `identity`, offline when there's a trust root to check against.
 * An identity that starts with `^` is a pattern (cosign's --certificate-identity-regexp), such as a workflow
 * on any of the branches releases are made from (releaseIdentity).
 */
export const verifyArgs = (identity: string, issuer: string, ref: string, trustedRoot?: string) => [
  'verify',
  identity.startsWith('^') ? '--certificate-identity-regexp' : '--certificate-identity',
  identity,
  '--certificate-oidc-issuer',
  issuer,
  ...(trustedRoot ? ['--offline=true', '--trusted-root', trustedRoot] : []),
  '--output',
  'text',
  ref,
];

/** The deploy folder's trust root, when it has one. */
const trustedRootIn = (dir: string) => access(join(dir, TRUSTED_ROOT)).then(
  () => join(dir, TRUSTED_ROOT),
  () => undefined,
);

/** Where a part's files are kept in the apps folder: files/<service>/<n>. */
export const PART_FILES = 'files';

/** Runs a command to its end within `ms`, whatever its exit code: what it said, out and error output together. */
export const runToEnd = (file: string, args: string[], env: Record<string, string>, ms: number) =>
  new Promise<{ code: number | 'timeout'; logs: string }>((resolve) => {
    execFile(file, args, { env, timeout: ms, killSignal: 'SIGKILL', maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      const logs = `${stdout}${stderr}`;
      if (!err) return resolve({ code: 0, logs });
      const e = err as NodeJS.ErrnoException & { killed?: boolean; code?: number | string };
      // Too much output stops it as surely as running out of time, but isn't that.
      if (e.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return resolve({ code: -1, logs: `${logs.slice(-4000)}\n(it said more than the runner keeps, and was stopped)` });
      resolve({ code: e.killed ? 'timeout' : typeof e.code === 'number' ? e.code : -1, logs: logs || e.message });
    });
  });

/** Runs a command and gives back its output; its error output becomes the error's message. */
export const command = (file: string, args: string[], env: Record<string, string>, input?: string) =>
  new Promise<string>((resolve, reject) => {
    const child = execFile(file, args, { env, timeout: COMMAND_MS, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (!err) return resolve(stdout);
      const said = `${stderr}`.trim().split('\n').filter(Boolean).slice(-3).join(' ') || `${stdout}`.trim().split('\n').slice(-1)[0];
      reject(new CommandFailed(said || `${file} ${args[0]} stopped (${err.code ?? err.signal}).`));
    });
    if (input !== undefined) child.stdin?.end(input);
  });

export const composeServer = ({ dir, dockerHost, dockerConfig, signer, healthUrls = partsFor().health, gatewayUrl = 'http://gateway:8080', signInUrl, signIn }: ServerOptions): Server & { login(registry: string, user: string, token: string): Promise<void>; replaceSelf(): Promise<void> } => {
  // Only what the CLIs need: a PLATFORM_VERSION here would win over the settings file.
  const env = (more: Record<string, string> = {}) => ({ PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: dockerConfig, DOCKER_HOST: dockerHost, DOCKER_CONFIG: dockerConfig, ...more });
  const envFile = join(dir, '.env');
  const compose = (args: string[], more?: Record<string, string>) => command('docker', ['compose', '-f', join(dir, 'compose.yml'), '--env-file', envFile, ...args], env(more));

  return {
    readEnv: () => readFile(envFile, 'utf8'),
    writeEnv: (text) => writeSettings(envFile, text),
    async hashDeployFiles(paths) {
      const files = await readUnder(dir, paths);
      return Object.fromEntries(paths.map((path) => [path, files[path] && sha256(files[path])]));
    },
    async ownDeployHashes(paths) {
      if (!(await access(OWN_DEPLOY_DIR).then(() => true, () => false))) return undefined;
      const files = await readUnder(OWN_DEPLOY_DIR, paths);
      return Object.fromEntries(paths.map((path) => [path, files[path] && sha256(files[path])]));
    },
    readDeployFiles: (paths) => readUnder(dir, paths),
    async releaseDeployFiles(ref, paths) {
      // A container made from the image, never started: its files are copied out, then it's removed.
      const id = (await command('docker', ['create', ref], env())).trim();
      const into = await mkdtemp(join(tmpdir(), 'augur-deploy-'));
      try {
        await command('docker', ['cp', `${id}:${OWN_DEPLOY_DIR}/.`, into], env());
        return await readUnder(into, paths);
      } finally {
        await command('docker', ['rm', id], env()).catch(() => undefined);
        await rm(into, { recursive: true, force: true });
      }
    },
    async writeDeployFiles(files) {
      for (const [path, bytes] of Object.entries(files)) {
        const to = join(dir, path);
        if (!bytes) {
          await rm(to, { force: true });
          continue;
        }
        // Keeps the file's mode, so the person running `pc` can still read it; scripts are runnable.
        const mode = await stat(to).then((s) => s.mode & 0o777, () => (path.endsWith('.sh') ? 0o755 : 0o644));
        await mkdir(dirname(to), { recursive: true });
        await writeFile(`${to}.tmp`, bytes, { mode });
        await chmod(`${to}.tmp`, mode);
        await rename(`${to}.tmp`, to);
      }
    },
    async services() {
      return (await compose(['config', '--services'])).split('\n').map((line) => line.trim()).filter(Boolean);
    },
    async mounting(paths) {
      // A file mounted on its own stays the old one inside a running container until it's made again.
      const config = JSON.parse(await compose(['config', '--format', 'json'])) as { services: Record<string, { volumes?: { type: string; source?: string }[] }> };
      const files = paths.map((path) => join(dir, path));
      return Object.entries(config.services)
        .filter(([, service]) => (service.volumes ?? []).some((v) => v.type === 'bind' && v.source && files.some((f) => f === v.source || f.startsWith(`${v.source}/`))))
        .map(([name]) => name);
    },
    async remove(services) {
      await compose(['rm', '--stop', '--force', ...services]);
    },
    async recreate(services) {
      await compose(['up', '-d', '--no-deps', '--force-recreate', ...services]);
    },
    async verifySignature(ref, identity = signer.identity) {
      await command('cosign', verifyArgs(identity, signer.issuer, ref, await trustedRootIn(dir)), env());
    },
    async backup() {
      const said = await compose(['exec', '-T', 'backup', '/bin/sh', '/backup/backup.sh', '--now']);
      const file = said.match(/backup: wrote \S*\/(platform-\S+\.sql\.gz)/)?.[1];
      if (!file) throw new CommandFailed('The backup container didn’t say where it wrote the backup.');
      return file;
    },
    async restoreTest() {
      await compose(['exec', '-T', 'backup', '/bin/sh', '/backup/backup.sh', '--restore-test']);
    },
    async pull(services, version) {
      await compose(['pull', '--quiet', ...services], { PLATFORM_VERSION: version });
    },
    async digests(service, version) {
      const config = JSON.parse(await compose(['config', '--format', 'json', service], { PLATFORM_VERSION: version })) as { services: Record<string, { image: string }> };
      const said = await command('docker', ['image', 'inspect', '--format', '{{json .RepoDigests}}', config.services[service].image], env());
      return JSON.parse(said) as string[];
    },
    async images(version) {
      const config = JSON.parse(await compose(['config', '--format', 'json'], { PLATFORM_VERSION: version })) as { services: Record<string, { image?: string }> };
      return Object.fromEntries(Object.entries(config.services).flatMap(([service, { image }]) => (image ? [[service, image]] : [])));
    },
    async up(services) {
      await compose(['up', '-d', '--no-deps', ...services]);
    },
    async health(service) {
      const url = healthUrls[service];
      if (!url) throw new Error(`The updater doesn’t know where ${service} answers.`);
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) return undefined;
      return url.endsWith('/healthz') ? ((await res.json()) as { version?: string }) : {};
    },
    async exitCode(service) {
      // One JSON object a line, or (older Compose) one array.
      const said = (await compose(['ps', '--all', '--format', 'json', service])).trim();
      const containers = (said.startsWith('[') ? JSON.parse(said) : said.split('\n').filter(Boolean).map((line) => JSON.parse(line))) as { State: string; ExitCode: number }[];
      const last = containers.at(-1);
      return last && last.State === 'exited' ? last.ExitCode : undefined;
    },
    async traffic(minutes) {
      const res = await fetch(`${gatewayUrl}/traffic?minutes=${minutes}`, { signal: AbortSignal.timeout(5_000) });
      // An older gateway has no /traffic: nothing to go on.
      if (!res.ok) return undefined;
      const counted = (await res.json()) as { requests: number; serverErrors: number; platform?: { requests: number; serverErrors: number } };
      // AUGUR is judged by its own services' calls; a gateway from before they were counted apart gives only the total.
      return counted.platform ?? { requests: counted.requests, serverErrors: counted.serverErrors };
    },
    async signInProblem() {
      if (signIn) {
        try {
          await Promise.race([signIn(), new Promise((_, fail) => setTimeout(() => fail(new Error('the sign-in service didn’t answer in 10 s.')), 10_000).unref())]);
          return undefined;
        } catch (err) {
          return (err as Error).message;
        }
      }
      if (!signInUrl) return undefined;
      try {
        const res = await fetch(`${signInUrl.replace(/\/$/, '')}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(5_000) });
        return res.ok ? undefined : `the sign-in service answered ${res.status}.`;
      } catch (err) {
        return `the sign-in service didn’t answer (${(err as Error).message}).`;
      }
    },
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    async freeBytes() {
      const disk = await statfs(dir);
      return Number(disk.bavail) * Number(disk.bsize);
    },
    async readJournal() {
      const text = await readFile(join(dir, JOURNAL_FILE), 'utf8').catch(() => undefined);
      return text ? (JSON.parse(text) as Journal) : undefined;
    },
    writeJournal: (journal) => writeWhole(join(dir, JOURNAL_FILE), JSON.stringify(journal) + '\n'),
    clearJournal: () => rm(join(dir, JOURNAL_FILE), { force: true }),
    async login(registry, user, token) {
      await command('docker', ['login', registry, '--username', user, '--password-stdin'], env(), token);
    },
    /**
     * Replaces this container with one on the version the settings now name. A one-off copy of the
     * new updater does it, since the CLI recreating a container can't be running inside it.
     */
    async replaceSelf() {
      await compose(['run', '-d', '--rm', '--no-deps', 'updater', 'node', 'dist/index.js', 'replace']);
    },
  };
};

/** Writes a file and makes sure it's on the disk before going on. */
const writeSynced = async (path: string, text: string | Uint8Array, mode: number, more?: (file: FileHandle) => Promise<void>) => {
  const file = await open(path, 'w', mode);
  try {
    await file.writeFile(text);
    await file.chmod(mode);
    await more?.(file);
    await file.sync();
  } finally {
    await file.close();
  }
};

/**
 * Writes over an existing file in the same inode: its mode, owner and ACL stay as they are, and it's never
 * chmod-ed or chown-ed, which only its owner may do (the updater may only read and write it through an ACL).
 */
const overwrite = async (path: string, text: string) => {
  const file = await open(path, 'r+');
  try {
    await file.truncate(0);
    await file.writeFile(text);
    await file.sync();
  } finally {
    await file.close();
  }
};

/** The folder's own entry for a rename, on the disk too; a file system that can't sync a folder is let be. */
const syncFolder = async (path: string) => {
  const folder = await open(dirname(path), 'r').catch(() => undefined);
  await folder?.sync().catch(() => undefined);
  await folder?.close();
};

/** Writes a file whole or not at all: to a temporary name first, then renamed over the old one. */
const writeWhole = async (path: string, text: string | Uint8Array, mode = 0o600) => {
  // One left by a write cut short may be read-only (a part's file), which a new write couldn't open.
  await rm(`${path}.tmp`, { force: true });
  await writeSynced(`${path}.tmp`, text, mode);
  await rename(`${path}.tmp`, path);
  await syncFolder(path);
};

export interface WriteSettingsOptions {
  /** Gives the new file the old one's owner; throws when it can't (the updater isn't root, say). */
  chown?: (file: FileHandle, uid: number, gid: number) => Promise<void>;
  /** The updater's own user. */
  uid?: number;
  /** Writes the file in place, when its owner can't be kept otherwise; never changes its mode or owner. */
  inPlace?: (path: string, text: string) => Promise<void>;
}

/**
 * Writes .env so a full disk or a crash can't leave it cut short: whole, to a temporary name, with the
 * old file's mode and owner (the person running `pc` still reads it), then renamed over it. When the
 * owner can't be kept and the file isn't the updater's own, it's written in place instead, the way it
 * always was, but only once the old text is written whole beside it (ENV_BEFORE_UPGRADE): read back
 * and checked, the new text is let stand; otherwise the old is put back, or left beside it to copy over.
 */
export const writeSettings = async (path: string, text: string, { chown = (file, uid, gid) => file.chown(uid, gid), uid = process.getuid?.() ?? -1, inPlace = overwrite }: WriteSettingsOptions = {}) => {
  const was = await stat(path).catch(() => undefined);
  const mode = was ? was.mode & 0o777 : 0o600;
  const tmp = `${path}.tmp`;
  let owned = true;
  try {
    await writeSynced(tmp, text, mode, async (file) => {
      if (!was) return;
      await chown(file, was.uid, was.gid).catch(() => {
        owned = was.uid === uid;
      });
    });
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
  if (owned) {
    await rename(tmp, path);
    await syncFolder(path);
    return;
  }
  await rm(tmp, { force: true });
  const old = await readFile(path, 'utf8');
  const copy = join(dirname(path), ENV_BEFORE_UPGRADE);
  await writeWhole(copy, old);
  if ((await readFile(copy, 'utf8')) !== old) throw new Error(`${ENV_BEFORE_UPGRADE} didn’t read back as .env has it, so .env wasn’t changed.`);
  const written = async (t: string) => {
    try {
      await inPlace(path, t);
      return (await readFile(path, 'utf8')) === t ? undefined : 'it read back other than written';
    } catch (err) {
      return (err as Error).message;
    }
  };
  const problem = await written(text);
  if (!problem) return rm(copy, { force: true });
  if (await written(old)) {
    throw new Error(`.env couldn’t be written (${problem}), or put back as it was. ${ENV_BEFORE_UPGRADE} holds it as it was: copy it over .env before anything else.`);
  }
  await rm(copy, { force: true });
  throw new Error(`.env couldn’t be written (${problem}), so it was put back as it was.`);
};

/**
 * The app runner's server: the apps' own Compose project, `augur-apps`, in the deploy folder's apps/
 * (compose.yml, a settings file per container and state.json, all written by the runner and never
 * by hand), driven with the same docker CLI as the platform's.
 */
/** The read key for a registry host, when the deployment has one for it (index.ts reads the secret files). */
export type RegistryAuth = (host: string) => ArtifactAuth | undefined;

export const composeAppHost = ({ dir, dockerHost, dockerConfig, signer, registryAuth = () => undefined }: Omit<ServerOptions, 'healthUrls'> & { registryAuth?: RegistryAuth }): AppHost => {
  const env = () => ({ PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: dockerConfig, DOCKER_HOST: dockerHost, DOCKER_CONFIG: dockerConfig });
  const appsDir = join(dir, 'apps');
  const apps = (args: string[]) => command('docker', ['compose', '-p', 'augur-apps', '-f', join(appsDir, 'compose.yml'), ...args], env());
  const platform = (args: string[]) => command('docker', ['compose', '-f', join(dir, 'compose.yml'), '--env-file', join(dir, '.env'), ...args], env());

  const docker = (args: string[]) => command('docker', args, env());

  return {
    readEnv: () => readFile(join(dir, '.env'), 'utf8'),
    async platformNetwork() {
      // The updater is one of the platform's containers (its hostname is its id), so its project's default network,
      // whatever the project is called, is the one Compose labels "default" among the networks it's on.
      const networks = Object.keys(JSON.parse(await docker(['container', 'inspect', '--format', '{{json .NetworkSettings.Networks}}', hostname()])) as object);
      for (const name of networks) {
        const role = await docker(['network', 'inspect', '--format', '{{index .Labels "com.docker.compose.network"}}', name]);
        if (role.trim() === 'default') return name;
      }
      return undefined;
    },
    async readState() {
      const text = await readFile(join(appsDir, 'state.json'), 'utf8').catch(() => undefined);
      return text ? (JSON.parse(text) as RunnerState) : { apps: {} };
    },
    async writeProject(state, project, files) {
      await mkdir(appsDir, { recursive: true, mode: 0o700 });
      // A version from before contract 3 has its settings file (secrets and all): readable by the updater alone, like .env.
      // A part's files are mounted into its container as Compose secrets, so the part's own user must read them; the
      // apps folder itself stays the updater's alone.
      const wanted = new Set<string>();
      for (const [path, text] of Object.entries(files)) {
        await mkdir(dirname(join(appsDir, path)), { recursive: true, mode: 0o700 });
        await writeWhole(join(appsDir, path), text, path.endsWith('.env') ? 0o600 : 0o444);
        wanted.add(path);
      }
      // A part's files that no version names any more go.
      for (const service of await readdir(join(appsDir, PART_FILES)).catch(() => [] as string[])) {
        for (const n of await readdir(join(appsDir, PART_FILES, service)).catch(() => [] as string[])) {
          if (!wanted.has(`${PART_FILES}/${service}/${n}`)) await rm(join(appsDir, PART_FILES, service, n), { force: true });
        }
        if (!(await readdir(join(appsDir, PART_FILES, service)).catch(() => [])).length) await rm(join(appsDir, PART_FILES, service), { recursive: true, force: true });
      }
      // So do the settings files of versions from before contract 3 that have gone: they hold secrets.
      for (const name of await readdir(appsDir)) if (name.endsWith('.env') && !wanted.has(name)) await rm(join(appsDir, name), { force: true });
      const header = '# Written by the app runner (the updater) from state.json. Don’t edit it: it is rewritten on every install.\n';
      // JSON is YAML, which Compose reads.
      await writeWhole(join(appsDir, 'compose.yml'), header + JSON.stringify(project, null, 2) + '\n', 0o644);
      await writeWhole(join(appsDir, 'state.json'), JSON.stringify(state, null, 2) + '\n');
    },
    async verifySignedBy(ref, identity) {
      await command('cosign', verifyArgs(identity, signer.issuer, ref, await trustedRootIn(dir)), env());
    },
    fetchArtifact(ref, mediaType, maxBytes) {
      return pullArtifactLayer({ ref, mediaType, maxBytes, auth: registryAuth(parseRef(ref).host) });
    },
    async backup() {
      const said = await platform(['exec', '-T', 'backup', '/bin/sh', '/backup/backup.sh', '--now']);
      const file = said.match(/backup: wrote \S*\/(platform-\S+\.sql\.gz)/)?.[1];
      if (!file) throw new CommandFailed('The backup container didn’t say where it wrote the backup.');
      return file;
    },
    async provisionStorage(app, options) {
      const connections = options?.connections ? ['-e', `APP_DATABASE_CONNECTIONS=${options.connections}`] : [];
      await platform(['run', '--rm', '--no-deps', '-e', `APP_STORAGE=${app}`, ...connections, 'storage']);
    },
    async ownNetworks() {
      // The networks the updater's own container is on are the deployment's, but for the apps' own, which it joins to see their health.
      const networks = Object.keys(JSON.parse(await docker(['container', 'inspect', '--format', '{{json .NetworkSettings.Networks}}', hostname()])) as object);
      const ranges: string[] = [];
      for (const name of networks) {
        const said = await docker(['network', 'inspect', '--format', `{{index .Labels "${APP_NETWORK_LABEL}"}}|{{range .IPAM.Config}}{{.Subnet}} {{end}}`, name]);
        const [label, subnets = ''] = said.trim().split('|');
        if (label === 'app') continue;
        ranges.push(...subnets.split(/\s+/).filter(Boolean));
      }
      return [...new Set(ranges)];
    },
    async appNetworks(wants) {
      // Each network and each container is tried on its own, so one that fails holds up no other; the reasons come together at the end.
      const problems: string[] = [];
      const attempt = async (what: string, work: () => Promise<unknown>) => {
        try {
          await work();
        } catch (err) {
          problems.push(`${what}: ${(err as Error).message.split('\n')[0]}`);
        }
      };
      const membersOf = async (name: string, all = false) =>
        all
          ? lines(await docker(['ps', '--all', '--no-trunc', '--filter', `network=${name}`, '--format', '{{.ID}}']))
          : Object.keys((JSON.parse((await docker(['network', 'inspect', '--format', '{{json .Containers}}', name])) || 'null') as object | null) ?? {});
      const self = (await docker(['container', 'inspect', '--format', '{{.Id}}', hostname()])).trim();
      const have = lines(await docker(['network', 'ls', '--filter', `label=${APP_NETWORK_LABEL}=app`, '--format', '{{.Name}}']));
      // The platform's parts are the containers of the updater's own Compose project, by service.
      const project = wants.length ? (await docker(['container', 'inspect', '--format', '{{index .Config.Labels "com.docker.compose.project"}}', self])).trim() : '';
      if (wants.length && !project) throw new Error('The app runner can’t tell which Compose project AUGUR runs as, so it can’t join the gateway to an app’s network: run the updater with docker compose.');
      const found = new Map<PlatformPart, string[]>();
      const containersOf = async (part: PlatformPart) => {
        if (!found.has(part))
          found.set(part, lines(await docker(['ps', '--no-trunc', '--filter', `label=com.docker.compose.project=${project}`, '--filter', `label=com.docker.compose.service=${part}`, '--format', '{{.ID}}'])));
        return found.get(part)!;
      };
      for (const want of wants) {
        await attempt(want.name, async () => {
          if (!have.includes(want.name)) {
            // Internal: nothing on it reaches beyond it (spec 10.4), but for an app's way out. Made here, not by Compose, as the platform's parts join it too.
            const made = await docker(['network', 'create', ...(want.internet ? [] : ['--internal']), '--label', `${APP_NETWORK_LABEL}=app`, '--label', `augur.app=${want.app}`, want.name]).then(
              () => true,
              () => false,
            );
            if (!made) {
              // Made meanwhile by another turn, or there already under that name: only the runner's own, internal network will do.
              const said = (await docker(['network', 'inspect', '--format', `{{.Internal}}|{{index .Labels "${APP_NETWORK_LABEL}"}}`, want.name])).trim();
              if (said !== `${!want.internet}|app`)
                throw new Error(`a network called ${want.name} is already there, and isn’t one the app runner made (${want.internet ? 'not internal' : 'internal'}, labelled ${APP_NETWORK_LABEL}=app): remove it with docker network rm ${want.name}`);
            }
          }
          const on = new Set(await membersOf(want.name));
          // The runner sees parts' health on the app's own network; its way out is the parts' alone.
          const joins: [string, string[]][] = want.internet ? [] : [[self, []]];
          for (const part of want.join) for (const id of await containersOf(part)) joins.push([id, ['--alias', part]]);
          for (const [id, alias] of joins)
            if (!on.has(id))
              await attempt(`joining ${alias[1] ?? 'the app runner'} to ${want.name}`, async () => {
                await docker(['network', 'connect', ...alias, want.name, id]).catch(async (err) => {
                  // Joined meanwhile is joined.
                  if (!(await membersOf(want.name)).includes(id)) throw err;
                });
              });
        });
      }
      // An app's network goes with the app's last version: whatever is on it leaves first, stopped containers too,
      // or one would name a network that's gone and fail to start.
      for (const name of have.filter((n) => !wants.some((w) => w.name === n)))
        await attempt(`removing ${name}`, async () => {
          for (const id of await membersOf(name, true)) await docker(['network', 'disconnect', '--force', name, id]).catch(() => undefined);
          await docker(['network', 'rm', name]);
        });
      if (problems.length) throw new Error(`The apps’ networks aren’t all as they should be. ${problems.join(' ')}`);
    },
    async imageUser(ref) {
      await docker(['pull', '--quiet', ref]);
      return (await docker(['image', 'inspect', '--format', '{{.Config.User}}', ref])).trim();
    },
    async runJob(service, ms) {
      // Named, so a run whose time is up is stopped and taken away: killing `compose run` leaves its container running.
      const name = `${service}-run`;
      await docker(['rm', '--force', name]).catch(() => undefined);
      const run = await runToEnd('docker', ['compose', '-p', 'augur-apps', '-f', join(appsDir, 'compose.yml'), 'run', '--rm', '--no-deps', '-T', '--name', name, service], env(), ms);
      if (run.code !== 0) await docker(['rm', '--force', name]).catch(() => undefined);
      return run;
    },
    async removeVolumes(names) {
      if (names.length) await docker(['volume', 'rm', '--force', ...names]);
    },
    async dropStorage(previewId) {
      await platform(['run', '--rm', '--no-deps', '-e', 'APP_STORAGE=', '-e', `APP_STORAGE_DROP=${previewId}`, 'storage']);
    },
    async start(services) {
      await apps(['pull', '--quiet', ...services]);
      await apps(['up', '-d', '--no-deps', ...services]);
    },
    async stop(services) {
      if (services.length) await apps(['rm', '--stop', '--force', ...services]);
    },
    async health(url) {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      return res.ok ? ((await res.json()) as { version?: string }) : undefined;
    },
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
};

