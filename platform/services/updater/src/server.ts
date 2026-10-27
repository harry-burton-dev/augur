/**
 * The real server: the deployment's own Compose project, driven with the docker CLI through the
 * Docker API the docker-proxy service passes on (DOCKER_HOST). The deploy folder is mounted at the
 * same path it has on the host (PLATFORM_DIR), so Compose's relative paths name the host's files.
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppHost, RunnerState } from './runner.ts';
import type { Server } from './upgrade.ts';

export interface ServerOptions {
  /** The deploy folder: compose.yml and .env. */
  dir: string;
  /** Where the Docker API is, e.g. tcp://docker-proxy:2375. */
  dockerHost: string;
  /** The docker CLI's own config (registry sign-ins), somewhere the updater can write. */
  dockerConfig: string;
  /** Who may sign AUGUR's images: the Release workflow's identity, and the issuer that vouches for it. */
  signer: { identity: string; issuer: string };
  /** Each service's health address inside the Compose network. */
  healthUrls?: Record<string, string>;
}

/** Where each part answers inside the Compose network (infra/deploy/compose.yml). */
export const HEALTH_URLS: Record<string, string> = {
  identity: 'http://identity:8081/healthz',
  registry: 'http://registry:8082/healthz',
  events: 'http://events:8084/healthz',
  models: 'http://models:8085/healthz',
  gateway: 'http://gateway:8080/healthz',
  folio: 'http://folio:8083/healthz',
  // nginx has no /healthz; the shell's page answering is the check.
  web: 'http://web:8080/',
};

/** Long enough for a pull of every image on a slow line. */
const COMMAND_MS = 20 * 60_000;

export class CommandFailed extends Error {}

/**
 * A copy of Sigstore's trust root in the deploy folder, which the mirror script writes beside its feed
 * (docs/mirror.md). With it, signatures are checked with no network at all: against the Rekor bundle
 * each signature carries, and the certificates and logs the trust root names.
 */
export const TRUSTED_ROOT = 'releases/trusted_root.json';

/** cosign's arguments to check `ref` was signed by `identity`, offline when there's a trust root to check against. */
export const verifyArgs = (identity: string, issuer: string, ref: string, trustedRoot?: string) => [
  'verify',
  '--certificate-identity',
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

export const composeServer = ({ dir, dockerHost, dockerConfig, signer, healthUrls = HEALTH_URLS }: ServerOptions): Server & { login(registry: string, user: string, token: string): Promise<void>; replaceSelf(): Promise<void> } => {
  // Only what the CLIs need: a PLATFORM_VERSION here would win over the settings file.
  const env = (more: Record<string, string> = {}) => ({ PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: dockerConfig, DOCKER_HOST: dockerHost, DOCKER_CONFIG: dockerConfig, ...more });
  const envFile = join(dir, '.env');
  const compose = (args: string[], more?: Record<string, string>) => command('docker', ['compose', '-f', join(dir, 'compose.yml'), '--env-file', envFile, ...args], env(more));

  return {
    readEnv: () => readFile(envFile, 'utf8'),
    // Written in place, so it keeps its owner and permissions: the person running `pc` still reads it.
    writeEnv: (text) => writeFile(envFile, text),
    async hashDeployFiles(paths) {
      const hashes: Record<string, string | undefined> = {};
      for (const path of paths) {
        hashes[path] = await readFile(join(dir, path)).then(
          (bytes) => createHash('sha256').update(bytes).digest('hex'),
          () => undefined,
        );
      }
      return hashes;
    },
    async verifySignature(ref) {
      await command('cosign', verifyArgs(signer.identity, signer.issuer, ref, await trustedRootIn(dir)), env());
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
    async up(services) {
      await compose(['up', '-d', '--no-deps', ...services]);
    },
    async health(service) {
      const url = healthUrls[service];
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
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
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

/** Writes a file whole or not at all: to a temporary name first, then renamed over the old one. */
const writeWhole = async (path: string, text: string, mode = 0o600) => {
  await writeFile(`${path}.tmp`, text, { mode });
  await chmod(`${path}.tmp`, mode);
  await rename(`${path}.tmp`, path);
};

/**
 * The app runner's server: the apps' own Compose project, `augur-apps`, in the deploy folder's apps/
 * (compose.yml, a settings file per container and state.json, all written by the runner and never
 * by hand), driven with the same docker CLI as the platform's.
 */
export const composeAppHost = ({ dir, dockerHost, dockerConfig, signer }: Omit<ServerOptions, 'healthUrls'>): AppHost => {
  const env = () => ({ PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: dockerConfig, DOCKER_HOST: dockerHost, DOCKER_CONFIG: dockerConfig });
  const appsDir = join(dir, 'apps');
  const apps = (args: string[]) => command('docker', ['compose', '-p', 'augur-apps', '-f', join(appsDir, 'compose.yml'), ...args], env());
  const platform = (args: string[]) => command('docker', ['compose', '-f', join(dir, 'compose.yml'), '--env-file', join(dir, '.env'), ...args], env());

  return {
    readEnv: () => readFile(join(dir, '.env'), 'utf8'),
    async readState() {
      const text = await readFile(join(appsDir, 'state.json'), 'utf8').catch(() => undefined);
      return text ? (JSON.parse(text) as RunnerState) : { apps: {} };
    },
    async writeProject(state, project, envFiles) {
      await mkdir(appsDir, { recursive: true, mode: 0o700 });
      // Each container's settings hold its secrets: readable by the updater alone, like .env.
      for (const [name, text] of Object.entries(envFiles)) await writeWhole(join(appsDir, `${name}.env`), text);
      const header = '# Written by the app runner (the updater) from state.json. Don’t edit it: it is rewritten on every install.\n';
      // JSON is YAML, which Compose reads.
      await writeWhole(join(appsDir, 'compose.yml'), header + JSON.stringify(project, null, 2) + '\n', 0o644);
      await writeWhole(join(appsDir, 'state.json'), JSON.stringify(state, null, 2) + '\n');
    },
    async verifySignedBy(ref, identity) {
      await command('cosign', verifyArgs(identity, signer.issuer, ref, await trustedRootIn(dir)), env());
    },
    async provisionStorage(app) {
      await platform(['run', '--rm', '--no-deps', '-e', `APP_STORAGE=${app}`, 'storage']);
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

