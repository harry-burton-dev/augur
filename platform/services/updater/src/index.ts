/**
 * AUGUR's updater for a Docker Compose deployment: asks the registry every half minute whether an
 * admin has asked for an upgrade, and runs it (upgrade.ts). With APP_SECRETS_KEY in .env it is the
 * app runner too: it installs, upgrades and removes apps an admin asks for (runner.ts). Optional:
 * it's the `updater` profile in infra/deploy/compose.yml, and docs/upgrade.md says what it needs.
 *   node dist/index.js           watch for upgrades
 *   node dist/index.js replace   replace the updater's own container (see server.ts)
 */
import { existsSync, readFileSync } from 'node:fs';
import { commonSettings, loadConfigOrExit, platformCredentialsFromEnv, serviceAuthFromEnv } from '@augur/service-kit';
import { envValue } from './env-file.ts';
import { appRunnerClient, registryClient } from './registry.ts';
import { appRunner } from './runner.ts';
import { composeAppHost, composeServer } from './server.ts';
import { runUpgrade, UPDATER, Withdrawn } from './upgrade.ts';

// Every setting the updater reads, checked before it starts (in production, a missing one stops it).
loadConfigOrExit('updater', [
  commonSettings.registry,
  commonSettings.issuer,
  commonSettings.issuerInside,
  commonSettings.clientSecret,
  { name: 'DOCKER_HOST', about: 'the Docker API the updater drives (the docker-proxy).', required: true },
  { name: 'PLATFORM_DIR', about: 'the deployment folder’s full path on the server.', required: true },
  { name: 'GITHUB_READ_USER', about: 'the GitHub account the deployment’s read key (secrets/github-read-key) belongs to, for private images.' },
  { name: 'IMAGE_PULL_USER', about: 'before read keys: who the pull token in secrets/image-pull-token belongs to.' },
  { name: 'APP_SECRETS_KEY', about: 'the key apps’ secrets are made from, for the app runner.', secret: true },
]);

const POLL_MS = 30_000;
/** This repository's Release workflow, which signs every image it publishes (infra/release-images.sh). */
const RELEASE_SIGNER = 'https://github.com/harry-burton-dev/im-platform/.github/workflows/release.yml@refs/heads/main';
const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
/** The deployment's read key, which the registry checks for releases with too (docs/upgrade.md). */
const READ_KEY_FILE = '/run/secrets/augur/github-read-key';
/** Before read keys: a pull token for a private image registry. */
const PULL_TOKEN_FILE = '/run/secrets/augur/image-pull-token';

const log = (message: string, more: Record<string, unknown> = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), service: 'updater', msg: message, ...more }));

// Compose passes a setting left out of .env as empty, so an empty one means the default.
const setting = (key: string, fallback = '') => process.env[key] || fallback;
const PLATFORM_DIR = setting('PLATFORM_DIR');
const DOCKER_HOST = setting('DOCKER_HOST', 'tcp://docker-proxy:2375');
const REGISTRY_URL = setting('REGISTRY_URL', 'http://registry:8082');
const IDENTITY_URL = setting('IDENTITY_URL', 'http://identity:8081');
const IMAGE_SIGNER = setting('IMAGE_SIGNER', RELEASE_SIGNER);
const GITHUB_READ_USER = setting('GITHUB_READ_USER');
const IMAGE_PULL_USER = setting('IMAGE_PULL_USER');
if (!PLATFORM_DIR) throw new Error('PLATFORM_DIR is not set: the updater needs the deploy folder’s path on the host (docs/upgrade.md).');
const signer = { identity: IMAGE_SIGNER, issuer: setting('IMAGE_SIGNER_ISSUER', GITHUB_ISSUER) };
const server = composeServer({ dir: PLATFORM_DIR, dockerHost: DOCKER_HOST, dockerConfig: '/tmp/docker', signer });

if (process.argv[2] === 'replace') {
  // Lets the updater that started this finish saying how the upgrade went first.
  await server.wait(5_000);
  await server.up([UPDATER]);
  log('replaced the updater');
  process.exit(0);
}

const credentials = platformCredentialsFromEnv('updater');
if (!credentials) throw new Error('SERVICE_CLIENT_SECRET is not set: the updater signs in to the registry as platform-updater (UPDATER_CLIENT_SECRET in .env).');
const registry = registryClient({ registryUrl: REGISTRY_URL, credentials });
const apps = appRunnerClient({ registryUrl: REGISTRY_URL, identityUrl: IDENTITY_URL, credentials, oidc: serviceAuthFromEnv() });
// The workflow that signs AUGUR's own images is trusted to sign apps too; APP_PUBLISHERS in .env adds others.
const runner = appRunner({
  host: composeAppHost({ dir: PLATFORM_DIR, dockerHost: DOCKER_HOST, dockerConfig: '/tmp/docker', signer }),
  calls: apps.calls,
  publishers: [IMAGE_SIGNER.replace(/^https:\/\/github\.com\//, '').replace(/@.*$/, '')],
});

const readFile = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8').trim() : '');

/**
 * Signs the docker CLI in to the image registry, when the images are private: with the deployment's
 * read key, or a pull token from before read keys. A mirror (PLATFORM_IMAGES elsewhere) has its own
 * pull token, as docs/mirror.md says.
 */
const signIn = async () => {
  const images = envValue(await server.readEnv(), 'PLATFORM_IMAGES') || 'ghcr.io/harry-burton-dev/im-platform';
  const host = images.split('/')[0]!;
  const key = readFile(READ_KEY_FILE);
  if (key && GITHUB_READ_USER && host === 'ghcr.io') return server.login(host, GITHUB_READ_USER, key);
  const token = readFile(PULL_TOKEN_FILE);
  if (token && IMAGE_PULL_USER) await server.login(host, IMAGE_PULL_USER, token);
};

const once = async () => {
  const target = await registry.target();
  if (!target) return;
  const report = registry.reporter(target.id);
  if (target.state === 'running') {
    // Only this updater runs upgrades, so one already under way means it stopped partway through.
    await report({ step: 'roll-back', state: 'failed', outcome: 'failed', message: `The updater restarted partway through the upgrade to ${target.version}. Check Admin → Status, and docs/upgrade.md, Going back.` });
    return;
  }
  log('upgrading', { from: target.from, to: target.version });
  await signIn();
  const outcome = await runUpgrade(target, server, report);
  log('upgrade ended', { outcome, to: target.version });
  if (outcome === 'done' && target.images[UPDATER]) await server.replaceSelf();
};

/** One turn of the app runner: stops old versions whose time is up, then does the next job, if any. Off without APP_SECRETS_KEY. */
const appsOnce = async () => {
  if (!envValue(await server.readEnv(), 'APP_SECRETS_KEY')) return;
  await runner.retireDue();
  const job = await apps.next();
  if (!job) return;
  log('app job', { app: job.app, action: job.action, version: job.release?.version });
  await signIn();
  const outcome = await runner.run(job, apps.reporter(job.id));
  log('app job ended', { app: job.app, action: job.action, outcome });
};

log('watching for upgrades', { registry: REGISTRY_URL, dir: PLATFORM_DIR });
for (;;) {
  try {
    await once();
  } catch (err) {
    log(err instanceof Withdrawn ? 'the upgrade was withdrawn' : 'upgrade check failed', { error: (err as Error).message });
  }
  try {
    await appsOnce();
  } catch (err) {
    log(err instanceof Withdrawn ? 'the app job was withdrawn' : 'app runner check failed', { error: (err as Error).message });
  }
  await server.wait(POLL_MS);
}
