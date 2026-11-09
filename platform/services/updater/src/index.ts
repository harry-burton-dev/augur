/**
 * AUGUR's updater for a Docker Compose deployment: asks the registry every half minute whether an
 * admin has asked for an upgrade, and runs it (upgrade.ts). With APP_SECRETS_KEY in .env it is the
 * app runner too: it installs, upgrades and removes apps an admin asks for (runner.ts). Optional:
 * it's the `updater` profile in infra/deploy/compose.yml, and docs/upgrade.md says what it needs.
 *   node dist/index.js           watch for upgrades
 *   node dist/index.js replace   replace the updater's own container (see server.ts)
 *   node dist/index.js check     one look of the watch after an upgrade, now: prints what it found
 *                                as one JSON line and exits 1 when anything is wrong (upgrade.ts, checkOnce)
 */
import { existsSync, readFileSync } from 'node:fs';
import { clientCredentials, commonSettings, loadConfigOrExit, platformClientId, platformCredentialsFromEnv, serviceAuthFromEnv, startupLog } from '@augur/service-kit';
import { envValue } from './env-file.ts';
import { appRunnerClient, registryClient } from './registry.ts';
import { appRunner } from './runner.ts';
import { partsFor } from './parts.ts';
import { composeAppHost, composeServer } from './server.ts';
import { AUGUR_REPOSITORIES, augurDevIdentity, releaseIdentity, repositoryOfIdentity } from './signers.ts';
import { afterRestart, checkOnce, lookAfterWatch, runUpgrade, UPDATER, Withdrawn } from './upgrade.ts';

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
  { name: 'IMAGE_SIGNER', about: 'who must sign AUGUR’s images and the apps the runner installs, for AUGUR published from a fork (default: the publisher’s Release workflow).' },
  { name: 'IMAGE_SIGNER_ISSUER', about: 'who issues that signer’s certificates (default: GitHub Actions).' },
  { name: 'AUGUR_DEV_SIGNER', about: 'who must sign AUGUR’s dev builds (default: the dev builds workflow in IMAGE_SIGNER’s repository, or the publisher’s).' },
]);

const POLL_MS = 30_000;
/** AUGUR's Release workflow, which signs every image it publishes (infra/release-images.sh), on any branch releases are made from, under the repository's name now or before. */
const RELEASE_WORKFLOWS = AUGUR_REPOSITORIES.map((repository) => `${repository}/.github/workflows/release.yml`);
const RELEASE_SIGNER = releaseIdentity(RELEASE_WORKFLOWS);
const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
/** The deployment's read key, which the registry checks for releases with too (docs/upgrade.md). */
const READ_KEY_FILE = '/run/secrets/augur/github-read-key';
/** Before read keys: a pull token for a private image registry. */
const PULL_TOKEN_FILE = '/run/secrets/augur/image-pull-token';

const startup = startupLog('updater');
const log = (message: string, more: Record<string, unknown> = {}) => startup.info(message, more);

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
/**
 * Who signs AUGUR's dev builds, which only a dev server runs: the dev builds workflow on main, in the
 * repository IMAGE_SIGNER names when a fork sets it, else in the publisher's.
 */
const AUGUR_DEV_SIGNER = setting('AUGUR_DEV_SIGNER', augurDevIdentity(repositoryOfIdentity(IMAGE_SIGNER) ?? AUGUR_REPOSITORIES));
const signer = { identity: IMAGE_SIGNER, issuer: setting('IMAGE_SIGNER_ISSUER', GITHUB_ISSUER) };
// The watch after an upgrade checks the sign-in realm answers, as the updater reaches it inside Docker.
const signInUrl = setting('OIDC_INTERNAL_URL') || setting('OIDC_ISSUER') || undefined;
// It also really signs in, as the updater, with a fresh token each time: that needs Keycloak and its database.
const serviceSecret = process.env.SERVICE_CLIENT_SECRET;
const signInCheck = serviceSecret
  ? () => clientCredentials({ tokenUrl: serviceAuthFromEnv().tokenUrl, clientId: platformClientId('updater'), clientSecret: serviceSecret })()
  : undefined;
// The platform's own parts: no app ships with AUGUR (ADR 0075), so the updater refuses an upgrade of a server
// that runs any other part of AUGUR's (upgrade.ts).
const parts = partsFor();
const server = composeServer({ dir: PLATFORM_DIR, dockerHost: DOCKER_HOST, dockerConfig: '/tmp/docker', signer, signInUrl, signIn: signInCheck, healthUrls: parts.health });

if (process.argv[2] === 'replace') {
  // Lets the updater that started this finish saying how the upgrade went first.
  await server.wait(5_000);
  await server.up([UPDATER]);
  log('replaced the updater');
  process.exit(0);
}

if (process.argv[2] === 'check') {
  // The parts this deployment runs, as its compose.yml names them; every part AUGUR has, if that can't be read.
  const named = await server.services().catch(() => [...parts.order]);
  const result = await checkOnce(server, parts.order.filter((service) => named.includes(service)), undefined, parts);
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

const credentials = platformCredentialsFromEnv('updater');
if (!credentials) throw new Error('SERVICE_CLIENT_SECRET is not set: the updater signs in to the registry as platform-updater (UPDATER_CLIENT_SECRET in .env).');
const registry = registryClient({ registryUrl: REGISTRY_URL, credentials });
const apps = appRunnerClient({ registryUrl: REGISTRY_URL, identityUrl: IDENTITY_URL, credentials, oidc: serviceAuthFromEnv() });
// Only the repositories APP_PUBLISHERS in .env lists may publish apps (spec 3.4); the runner reads it on every job.
const readFile = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8').trim() : '');

// A release's frontend bundle is pulled straight from the image registry, with the same read key the images use.
const registryAuth = (host: string) => {
  const key = readFile(READ_KEY_FILE);
  if (key && GITHUB_READ_USER && host === 'ghcr.io') return { user: GITHUB_READ_USER, token: key };
  const token = readFile(PULL_TOKEN_FILE);
  return token && IMAGE_PULL_USER ? { user: IMAGE_PULL_USER, token } : undefined;
};
const appHost = composeAppHost({ dir: PLATFORM_DIR, dockerHost: DOCKER_HOST, dockerConfig: '/tmp/docker', signer, registryAuth });
const runner = appRunner({ host: appHost, calls: apps.calls });


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

/** The registry's reporter for an upgrade, which also keeps the last failure it was told, so the log can say why. */
const reporterFor = (id: string) => {
  const send = registry.reporter(id);
  let why: string | undefined;
  const report: typeof send = async (r) => {
    if (r.state === 'failed' && r.message) why = r.message;
    return send(r);
  };
  return { report, why: () => why };
};

const once = async () => {
  const target = await registry.target();
  if (!target) return;
  const { report, why } = reporterFor(target.id);
  if (target.state === 'running') {
    // Only this updater runs upgrades, so one already under way means it stopped partway through: it goes
    // back from what it wrote down, when it can (upgrade.ts, afterRestart).
    log('restarted partway through an upgrade', { from: target.from, to: target.version });
    // Going back may need an image the docker CLI has to sign in for.
    await signIn().catch(() => undefined);
    const outcome = await afterRestart(target, server, report, { parts });
    log('upgrade ended', { outcome, to: target.version, ...(outcome === 'done' ? {} : { why: why() }) });
    return;
  }
  log('upgrading', { from: target.from, to: target.version });
  await signIn();
  const outcome = await runUpgrade(target, server, report, { devIdentity: AUGUR_DEV_SIGNER, parts });
  log('upgrade ended', { outcome, to: target.version, ...(outcome === 'done' ? {} : { why: why() }) });
  if (outcome === 'done' && target.images[UPDATER]) await server.replaceSelf();
};

/** The light watch after a quiet watch: one look when the registry says one is due (ADR 0020, amended 2 Nov). */
const afterWatchOnce = async () => {
  const look = await registry.afterWatch();
  if (!look) return;
  await registry.afterLook(await lookAfterWatch(look, server));
};

/**
 * Tells the registry the deployment's own networks, once it has heard them: no app's address may be on
 * one (the registry's address rule; until it hears them, Docker's default range stands in).
 */
let networksSaid = false;
const sayNetworks = async () => {
  if (networksSaid) return;
  await apps.setOwnNetworks(await appHost.ownNetworks());
  networksSaid = true;
  log('told the registry the deployment’s own networks');
};

/** One turn of the app runner: stops old versions whose time is up, then does the next job, if any. Off without APP_SECRETS_KEY. */
const appsOnce = async () => {
  if (!envValue(await server.readEnv(), 'APP_SECRETS_KEY')) return;
  await sayNetworks().catch((err) => log('couldn’t tell the registry the deployment’s own networks', { error: (err as Error).message }));
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
    await afterWatchOnce();
  } catch (err) {
    log('light watch check failed', { error: (err as Error).message });
  }
  try {
    await appsOnce();
  } catch (err) {
    log(err instanceof Withdrawn ? 'the app job was withdrawn' : 'app runner check failed', { error: (err as Error).message });
  }
  await server.wait(POLL_MS);
}
