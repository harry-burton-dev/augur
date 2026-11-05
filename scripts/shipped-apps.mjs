// The apps that ship with AUGUR (pillar apps) live in their own repositories and release there (ADR 0047).
// release/shipped-apps.json pins the release of each that this AUGUR release ships, and the Release and
// dev builds workflows take that release's images rather than building the app again (ADR 0049):
//   node scripts/shipped-apps.mjs pin <id> <version>
//                                    moves an app's pin to its release app/<id>@<version>: checks the release is
//                                    there and signed in the app's repository, writes its packages' versions as
//                                    the AUGUR parts it brings, and adds a changeset so the next Version packages
//                                    pull request moves AUGUR's version
//   node scripts/shipped-apps.mjs resolve
//                                    in infra/release-images.sh: prints each pinned release's service image, by
//                                    digest, as its app-release.json names it, after checking the file and who
//                                    signed it, as JSON { <id>: { repo, version, tag, service, build } }
//   node scripts/shipped-apps.mjs check
//                                    no network: the file is well formed, and the compose files run each app and
//                                    its workers as it says (pnpm check:release runs the same check in CI)
// Reads the app repositories with APP_RELEASES_TOKEN, as the release feed does; without it, through the GitHub CLI.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';
import { parse as parseYaml } from 'yaml';

const root = new URL('..', import.meta.url).pathname;
export const SHIPPED_FILE = 'release/shipped-apps.json';
/** The app-release.json schema these pins understand (@augur/app-tools). */
const APP_RELEASE_SCHEMA = 'augur.app-release/v1';
/** The workflow that signs an app's releases in its own repository (the app template's). */
export const APP_RELEASE_WORKFLOW = '.github/workflows/release.yml';
const ID = /^[a-z][a-z0-9-]{1,39}$/;
const REPO = /^[\w.-]+\/[\w.-]+$/;
const DIGEST = /@sha256:[0-9a-f]{64}$/;

/** What's wrong with release/shipped-apps.json, as sentences; empty when nothing is. */
export const problemsOf = (json) => {
  const problems = [];
  const ports = new Map();
  const apps = json?.apps;
  if (!apps || typeof apps !== 'object') return [`${SHIPPED_FILE} has no "apps".`];
  for (const [id, pin] of Object.entries(apps)) {
    if (!ID.test(id)) problems.push(`"${id}" isn't an app id.`);
    if (!REPO.test(String(pin?.repo))) problems.push(`${id}: "repo" must be owner/repo.`);
    if (!semver.valid(pin?.version)) problems.push(`${id}: "${pin?.version}" isn't a version.`);
    else if (semver.prerelease(pin.version)?.some((p) => p === 'dev' || p === 'pr')) problems.push(`${id}: ${pin.version} is a dev build or a preview; AUGUR ships releases only.`);
    if (!pin?.parts || !Object.keys(pin.parts).length) problems.push(`${id}: "parts" names none of its packages. Run: node scripts/shipped-apps.mjs pin ${id} ${pin?.version ?? '<version>'}`);
    for (const [name, version] of Object.entries(pin?.parts ?? {})) if (!semver.valid(version)) problems.push(`${id}: part ${name} has "${version}", not a version.`);
    for (const [image, dockerfile] of Object.entries(pin?.build ?? {})) {
      if (!ID.test(image)) problems.push(`${id}: "${image}" can't name an image.`);
      if (typeof dockerfile !== 'string' || dockerfile.startsWith('/') || dockerfile.includes('..')) problems.push(`${id}: ${image}'s Dockerfile must be a path inside the app's repository.`);
    }
    if (!Number.isInteger(pin?.port) || pin.port < 1024 || pin.port > 65535) problems.push(`${id}: "port" must be the port its service answers on in the Compose network (1024 to 65535).`);
    else if (ports.has(pin.port)) problems.push(`${id}: port ${pin.port} is ${ports.get(pin.port)}'s too.`);
    else ports.set(pin.port, id);
    const workers = pin?.workers ?? [];
    if (!Array.isArray(workers)) problems.push(`${id}: "workers" must list image names.`);
    else {
      for (const worker of workers) if (!(worker in (pin?.build ?? {}))) problems.push(`${id}: its worker "${worker}" isn't one of the images in its "build".`);
      // The updater tells each part came back by what it is: a service answers /healthz, a worker stays up.
      for (const image of Object.keys(pin?.build ?? {})) if (!workers.includes(image)) problems.push(`${id}: ${image} is built but isn't in "workers", so the updater wouldn't know how to tell it came back.`);
    }
  }
  const images = Object.entries(apps).flatMap(([id, pin]) => [id, ...Object.keys(pin?.build ?? {})]);
  for (const image of new Set(images)) if (images.filter((i) => i === image).length > 1) problems.push(`"${image}" is named by two apps' images.`);
  return problems;
};

/**
 * The images the shipped apps run, in the order the updater restarts them: each app's service (named by its
 * id), then its workers.
 */
export const shippedImages = (json) =>
  Object.entries(json.apps).flatMap(([id, pin]) => [{ image: id, app: id, role: 'service', port: pin.port }, ...(pin.workers ?? []).map((image) => ({ image, app: id, role: 'worker' }))]);

/** The compose files that run the shipped apps, beside this file, and whether each is an overlay of another. */
export const COMPOSE_FILES = { 'infra/deploy/compose.yml': 'deployment', 'infra/docker-compose.yml': 'local', 'infra/deploy/compose.build.yml': 'overlay' };

/** The image a compose service runs as one of AUGUR's (`${PLATFORM_IMAGES...}/<name>:<tag>`), by name; undefined for any other. */
const augurImage = (service) => (typeof service?.image === 'string' && service.image.startsWith('${PLATFORM_IMAGES') ? /\}\/([a-z][a-z0-9-]*):/.exec(service.image)?.[1] : undefined);
const envOf = (service) => (Array.isArray(service?.environment) ? Object.fromEntries(service.environment.map((e) => String(e).split(/=(.*)/s).slice(0, 2))) : (service?.environment ?? {}));
/** A list setting's words, leaving out what .env adds (`${...}`). */
const words = (value) => String(value ?? '').replace(/\$\{[^}]*\}/g, ' ').split(/[\s,]+/).filter(Boolean);

/**
 * What's wrong with a compose file against release/shipped-apps.json, as sentences. Compose can't read the
 * file, so each names the apps itself; this holds them to it. `kind`: "deployment" or "local" run every
 * part, an "overlay" (compose.build.yml) only changes how parts are built. `platform`: the platform's own
 * parts, which may run AUGUR's images without being shipped apps.
 */
export const composeProblems = (json, file, text, kind, platform) => {
  const problems = [];
  const services = parseYaml(text, { merge: true })?.services ?? {};
  const shipped = shippedImages(json);
  const ids = Object.keys(json.apps);
  for (const { image, app, role, port } of shipped) {
    const service = services[image];
    if (!service) {
      problems.push(`${file} has no ${image} service, and release/shipped-apps.json ships it (${app}'s ${role}).`);
      continue;
    }
    if (augurImage(service) !== image) problems.push(`${file}: ${image} doesn't run AUGUR's ${image} image (\${PLATFORM_IMAGES...}/${image}:<version>).`);
    if (kind === 'overlay') {
      if (service.build) problems.push(`${file}: ${image} is built here, but it comes from ${app}'s release (ADR 0049).`);
      continue;
    }
    if (role !== 'service') continue;
    const said = envOf(service).PORT;
    if (String(said) !== String(port)) problems.push(`${file}: ${image} answers on PORT ${said ?? '(none)'}, and release/shipped-apps.json says ${port}.`);
    const check = JSON.stringify(service.healthcheck?.test ?? '');
    if (service.healthcheck && !check.includes(`:${port}/healthz`)) problems.push(`${file}: ${image}'s healthcheck doesn't ask port ${port}'s /healthz.`);
  }
  for (const [name, service] of Object.entries(services)) {
    const image = augurImage(service) ?? name;
    if (!augurImage(service) && kind !== 'overlay') continue;
    if (!platform.includes(image) && !shipped.some((s) => s.image === image)) problems.push(`${file}: ${name} runs AUGUR's ${image} image, which is neither a platform part nor in release/shipped-apps.json.`);
  }
  if (kind === 'overlay') return problems;
  const pillars = words(envOf(services.registry).PILLAR_APPS);
  if (pillars.slice().sort().join() !== ids.slice().sort().join()) problems.push(`${file}: the registry's PILLAR_APPS is "${pillars.join(' ')}", and release/shipped-apps.json ships ${ids.join(' ')}.`);
  const upstreams = Object.fromEntries(words(envOf(services.gateway).APP_UPSTREAMS).map((u) => u.split(/=(.*)/s).slice(0, 2)));
  for (const [id, pin] of Object.entries(json.apps)) {
    if (upstreams[id] !== `http://${id}:${pin.port}`) problems.push(`${file}: the gateway's APP_UPSTREAMS has ${id}=${upstreams[id] ?? '(nothing)'}, not ${id}=http://${id}:${pin.port}.`);
  }
  for (const id of Object.keys(upstreams)) if (!ids.includes(id)) problems.push(`${file}: the gateway's APP_UPSTREAMS names ${id}, which isn't in release/shipped-apps.json.`);
  // The service that gives Keycloak its clients' secrets (identity's realm job, keycloak-config, since ADR 0057).
  const [secretsBy, secrets] = Object.entries(services).map(([name, s]) => [name, envOf(s).SERVICE_CLIENT_SECRETS]).find(([, v]) => v) ?? ['identity', ''];
  const clients = words(secrets).map((c) => c.split('=')[0]);
  for (const id of ids) if (!clients.includes(`app-${id}`)) problems.push(`${file}: ${secretsBy}'s SERVICE_CLIENT_SECRETS has no app-${id}, so ${id} can't sign in.`);
  for (const id of words(envOf(services.storage).APP_STORAGE)) if (!ids.includes(id)) problems.push(`${file}: storage's APP_STORAGE names ${id}, which isn't in release/shipped-apps.json; other apps' storage goes in .env.`);
  return problems;
};

/** The platform's own parts that run its images: each service under platform/services, AUGUR's Keycloak and the front door. */
export const platformParts = (dir = join(root, 'platform/services')) => [...readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name), 'keycloak', 'web'];

/** What's wrong with every compose file against release/shipped-apps.json. */
export const layoutProblems = (json = readShipped()) => {
  const platform = platformParts();
  return Object.entries(COMPOSE_FILES).flatMap(([file, kind]) =>
    existsSync(join(root, file)) ? composeProblems(json, file, readFileSync(join(root, file), 'utf8'), kind, platform) : [`${file} is missing.`],
  );
};

/** release/shipped-apps.json, checked. */
export const readShipped = (file = join(root, SHIPPED_FILE)) => {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const problems = problemsOf(json);
  if (problems.length) throw new Error(problems.join('\n'));
  return json;
};

/** The AUGUR parts the shipped apps bring: each pinned release's packages, by name, with no folder here. */
export const shippedParts = (json) => {
  const parts = {};
  for (const [id, pin] of Object.entries(json.apps)) for (const [name, version] of Object.entries(pin.parts)) parts[name] = { version, path: '', app: id };
  return parts;
};

/** The tag an app's release has in its repository (@augur/app-tools). */
export const tagOf = (id, version) => `app/${id}@${version}`;

/**
 * What's wrong with an app's app-release.json for the pin `id` → `pin`, as sentences: it must be that app at
 * that version, signed by its own repository's release workflow, with its service image named by digest.
 */
export const releaseProblems = (id, pin, release) => {
  const problems = [];
  if (release?.schema !== APP_RELEASE_SCHEMA) problems.push(`${id}: its app-release.json is ${release?.schema ?? 'of no schema'}, not ${APP_RELEASE_SCHEMA}.`);
  if (release?.id !== id) problems.push(`${id}: the release is of "${release?.id}".`);
  if (release?.version !== pin.version) problems.push(`${id}: the release is ${release?.version}, not ${pin.version}.`);
  if (release?.signer?.repository !== pin.repo || release?.signer?.workflow !== APP_RELEASE_WORKFLOW) {
    problems.push(`${id}: the release says it was signed by ${release?.signer?.repository}/${release?.signer?.workflow}, not ${pin.repo}/${APP_RELEASE_WORKFLOW}.`);
  }
  if (!DIGEST.test(release?.service?.image ?? '')) problems.push(`${id}: the release has no service image named by digest; AUGUR ships an app's service image, which carries its frontend.`);
  return problems;
};

/** The certificate identity of an app's release signature: its repository's release workflow on main. */
export const releaseIdentity = (repo) => `https://github.com/${repo}/${APP_RELEASE_WORKFLOW}@refs/heads/main`;

const token = () => (process.env.APP_RELEASES_TOKEN ?? '').replace(/[\r\n]/g, '');
const github = async (url, accept = 'application/vnd.github+json') => {
  const t = token();
  // On a laptop with no token set: the GitHub CLI, signed in as whoever runs it.
  if (!t) {
    const said = execFileSync('gh', ['api', '-H', `Accept: ${accept}`, url.replace('https://api.github.com', '')], { encoding: 'utf8', maxBuffer: 32 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
    return accept === 'application/vnd.github+json' ? JSON.parse(said) : said;
  }
  const res = await fetch(url.startsWith('https:') ? url : `https://api.github.com${url}`, {
    headers: { accept, 'user-agent': 'augur-shipped-apps', ...(t ? { authorization: `Bearer ${t}` } : {}) },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${url}${res.status === 404 || res.status === 401 ? ' (is APP_RELEASES_TOKEN set, and can it read that repository?)' : ''}.`);
  return accept === 'application/vnd.github+json' ? res.json() : res.text();
};

/** An app's release and its app-release.json, from its repository. */
const fetchRelease = async (id, pin) => {
  const tag = tagOf(id, pin.version);
  const release = await github(`/repos/${pin.repo}/releases/tags/${encodeURIComponent(tag)}`);
  const asset = release.assets?.find((a) => a.name === 'app-release.json');
  if (!asset) throw new Error(`${pin.repo} has release ${tag}, but it carries no app-release.json.`);
  const file = JSON.parse(await github(asset.url, 'application/octet-stream'));
  const problems = releaseProblems(id, pin, file);
  if (problems.length) throw new Error(problems.join('\n'));
  return { tag, release, file };
};

/** Every package.json in the app's repository at `tag`, one folder down (service/, frontend/): name → version. */
const partsAt = async (repo, tag) => {
  const ref = encodeURIComponent(tag);
  const entries = await github(`/repos/${repo}/contents?ref=${ref}`);
  const parts = {};
  for (const dir of entries.filter((e) => e.type === 'dir' && !e.name.startsWith('.'))) {
    const pkg = await github(`/repos/${repo}/contents/${dir.name}/package.json?ref=${ref}`, 'application/vnd.github.raw+json').catch(() => undefined);
    if (!pkg) continue;
    const { name, version, private: own } = JSON.parse(pkg);
    if (name && version && own !== false) parts[name] = version;
  }
  return parts;
};

const main = async () => {
  const [mode, id, version] = process.argv.slice(2);
  const file = join(root, SHIPPED_FILE);
  if (mode === 'check') {
    const problems = layoutProblems(readShipped(file));
    if (problems.length) {
      console.error(problems.map((p) => `✗ ${p}`).join('\n'));
      process.exit(1);
    }
    return console.log(`${SHIPPED_FILE} is in order, and the compose files run what it ships.`);
  }
  if (mode === 'resolve') {
    const json = readShipped(file);
    const out = {};
    for (const [app, pin] of Object.entries(json.apps)) {
      const { tag, file: release } = await fetchRelease(app, pin);
      out[app] = { repo: pin.repo, version: pin.version, tag, service: release.service.image, identity: releaseIdentity(pin.repo), build: pin.build ?? {} };
    }
    return console.log(JSON.stringify(out, null, 2));
  }
  if (mode === 'pin') {
    if (!id || !version) throw new Error('Usage: node scripts/shipped-apps.mjs pin <id> <version>');
    const json = JSON.parse(readFileSync(file, 'utf8'));
    const was = json.apps?.[id];
    if (!was) throw new Error(`${id} isn't in ${SHIPPED_FILE}. Add it there by hand first, with its "repo".`);
    const pin = { ...was, version };
    const { tag, file: release } = await fetchRelease(id, pin);
    pin.parts = await partsAt(pin.repo, tag);
    json.apps[id] = pin;
    writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
    const name = release.manifest?.name ?? id;
    const changeset = join(root, '.changeset', `ship-${id}-${version.replace(/[^0-9a-z]+/gi, '-')}.md`);
    writeFileSync(changeset, `---\n---\n\nAUGUR ships ${name} ${version}${was.version !== version ? ` (was ${was.version})` : ''}, released in ${pin.repo}.\n`);
    return console.log(`${id} pinned to ${tag}; parts ${Object.entries(pin.parts).map(([n, v]) => `${n} ${v}`).join(', ')}. Wrote ${changeset.slice(root.length)}.`);
  }
  console.error('Usage: node scripts/shipped-apps.mjs pin <id> <version>|resolve|check');
  process.exit(2);
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
