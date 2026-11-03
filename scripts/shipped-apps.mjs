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
//                                    in CI, no network: the file is well formed
// Reads the app repositories with APP_RELEASES_TOKEN, as the release feed does; without it, through the GitHub CLI.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';

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
  }
  return problems;
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
    readShipped(file);
    return console.log(`${SHIPPED_FILE} is in order.`);
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
