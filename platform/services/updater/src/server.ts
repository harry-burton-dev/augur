/**
 * The real server: the deployment's own Compose project, driven with the docker CLI through the
 * Docker API the docker-proxy service passes on (DOCKER_HOST). The deploy folder is mounted at the
 * same path it has on the host (PLATFORM_DIR), so Compose's relative paths name the host's files.
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
  // nginx has no /healthz; the shell's page answering is the check.
  web: 'http://web:8080/',
};

/** Long enough for a pull of every image on a slow line. */
const COMMAND_MS = 20 * 60_000;

export class CommandFailed extends Error {}

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
      await command('cosign', ['verify', '--certificate-identity', signer.identity, '--certificate-oidc-issuer', signer.issuer, '--output', 'text', ref], env());
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
