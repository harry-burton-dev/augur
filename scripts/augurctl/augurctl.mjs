#!/usr/bin/env node
// augurctl: AUGUR deployments declared in files (deployments/<name>.yaml, deployment.schema.json beside this).
// It reaches each server only over ssh (or on this machine, `ssh: local`), with the server's own docker,
// and never prints a secret. sops decrypts and encrypts a deployment's secrets file.
//   augurctl check                 every file in --dir (default ./deployments) against the schema and the settings
//   augurctl init <name>           make the deployment's secrets file, encrypted with sops (.sops.yaml says for whom)
//   augurctl plan <name>           how the server differs from its file; exits 0 when it doesn't, 2 when it does
//   augurctl status [<name>...]    each server's release, health, last backup, last upgrade and apps
//   augurctl up <name>             install a new server from the release's deploy bundle, then start it
//   augurctl set <name>            move a running server to its file through its gateway, as the fleet's client
//                                  (ADR 0100); --dry-run says what it would ask, --remove removes apps the file leaves out
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import semver from 'semver';
import { parse } from 'yaml';
import { fillSecrets, readEnv } from '../preflight.mjs';
import { AUGUR_REPOSITORIES, releaseIdentity } from '../mirror-release.mjs';
import { AUGUR_HOME } from '../repo.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
export const SCHEMA = JSON.parse(readFileSync(join(here, 'deployment.schema.json'), 'utf8'));
export const SETTINGS = JSON.parse(readFileSync(join(root, 'infra/deploy/settings.schema.json'), 'utf8'));
const validate = new Ajv({ allErrors: true, strict: false }).compile(SCHEMA);

/** The setting's description in the settings schema, by name or pattern. */
const settingOf = (key, settings = SETTINGS) =>
  settings.properties?.[key] ?? Object.entries(settings.patternProperties ?? {}).find(([p]) => new RegExp(p).test(key))?.[1];
/** A secret by the settings schema, or by its name when the schema doesn't know it (a key left over from an older release). */
const SECRET_NAME = /_(SECRET|PASSWORD|TOKEN|KEY|AUTHKEY)$/;
export const isSecret = (key, settings = SETTINGS) => {
  const setting = settingOf(key, settings);
  return setting ? Boolean(setting.writeOnly) : SECRET_NAME.test(key);
};

/** What's wrong with one deployment file, as sentences; none when it's fine. */
export const problems = (doc, file, settings = SETTINGS) => {
  if (!validate(doc)) return validate.errors.map((e) => `${file}: ${e.instancePath || '/'} ${e.message}`);
  const out = [];
  if (basename(file).replace(/\.ya?ml$/, '') !== doc.name) out.push(`${file}: its name is ${doc.name}, but the file is named otherwise.`);
  for (const key of Object.keys(doc.settings ?? {})) {
    if (isSecret(key, settings)) out.push(`${file}: ${key} is a secret${settingOf(key, settings) ? '' : ' by its name'}, so it belongs in the secrets file, not settings.`);
    else if (!settingOf(key, settings)) out.push(`${file}: ${key} isn't a setting AUGUR knows (infra/deploy/settings.schema.json).`);
    else if (['PLATFORM_VERSION', 'SERVER_RING'].includes(key)) out.push(`${file}: ${key} comes from ${key === 'SERVER_RING' ? 'ring' : 'release'}, not settings.`);
  }
  const ids = (doc.apps ?? []).map((a) => a.id);
  for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) out.push(`${file}: ${id} is listed twice in apps.`);
  return out;
};

/** The .env values the file asks for: its settings, plus the release and ring. */
export const desiredEnv = (doc) => ({ ...(doc.settings ?? {}), ...(doc.release !== 'follow' ? { PLATFORM_VERSION: doc.release } : {}), SERVER_RING: doc.ring });

/**
 * How the server differs from its file, one line each, never with a secret's value. `actual.env` is the
 * server's .env as readEnv reads it; `actual.apps` the versions its app runner runs, by id.
 */
export const diff = (doc, actual, secrets = {}) => {
  const lines = [];
  for (const [key, want] of Object.entries(desiredEnv(doc))) {
    const have = actual.env[key];
    if (have !== want) lines.push(`~ ${key}: ${have === undefined || have === '' ? '(not set)' : have} → ${want}`);
  }
  for (const [key, value] of Object.entries(secrets)) {
    if (actual.env[key] === undefined) lines.push(`+ ${key}: (secret, not set on the server)`);
    else if (actual.env[key] !== value) lines.push(`~ ${key}: (secret, differs from the secrets file)`);
  }
  if (actual.appsRead === false) return [...lines, `? apps: the server's app runner state (infra/deploy/apps/state.json) can't be read by this ssh user, so apps aren't compared.`];
  const want = Object.fromEntries((doc.apps ?? []).map((a) => [a.id, a.version]));
  for (const [id, version] of Object.entries(want)) if (actual.apps[id] !== version) lines.push(`${actual.apps[id] ? '~' : '+'} app ${id}: ${actual.apps[id] ?? '(not installed)'} → ${version}`);
  for (const [id, version] of Object.entries(actual.apps)) if (!(id in want)) lines.push(`- app ${id}: ${version} (installed, not in the file)`);
  return lines;
};

/**
 * What `set` asks the server for, from its file, the registry's overview and the app runner (ADR 0100): AUGUR's
 * release first, one release at a time as the registry takes them, and the apps only once AUGUR runs the file's
 * release and nothing of AUGUR's is under way, so they're never installed on a moving AUGUR. Each step is one call
 * through the gateway, and its `then` is said only when the server takes it. While AUGUR waits, the app steps come
 * back as `later`, for a dry run to show. An app the file leaves out is removed only when `remove` is asked, and never
 * a default app (DEFAULT_APPS), which the server keeps while the deployment names it.
 */
export const setSteps = (doc, overview, { remove = false, jobs = [], defaults = [] } = {}) => {
  const steps = [];
  const notes = [];
  const augur = overview.units.find((u) => u.unit === 'augur');
  // waits: AUGUR is moving, or set asks it to; stuck: it differs from the file and set can't move it there.
  let waits = false;
  let stuck = false;
  if (augur?.open) {
    waits = true;
    notes.push(`AUGUR's upgrade to ${augur.open.version ?? 'a new release'} is ${augur.open.state}: the apps wait for it. Run set again once it's done.`);
  } else if (augur && doc.release !== 'follow' && augur.running !== doc.release) {
    waits = true;
    stuck = true;
    const { next } = augur;
    if (semver.valid(doc.release) && semver.lt(doc.release, augur.running))
      notes.push(`The file says AUGUR ${doc.release}, older than the ${augur.running} the server runs. set never takes AUGUR back: go back on the server's Deployment page, or change the file's release.`);
    else if (!next) notes.push(`The file says AUGUR ${doc.release}, and the server offers no release after ${augur.running} yet${augur.halted ? ' (its release is halted)' : ''}. Run set again once the feed has it.`);
    else if (semver.valid(doc.release) && semver.gt(next, doc.release))
      notes.push(`The file says AUGUR ${doc.release}, but the server's next release after ${augur.running} is ${next}, and AUGUR upgrades one release at a time. Change the file's release to one it reaches.`);
    else {
      stuck = false;
      steps.push({ say: `upgrade AUGUR ${augur.running} → ${next}${next === doc.release ? '' : ` (on the way to ${doc.release})`}`, method: 'PUT', path: '/api/registry/v1/platform/upgrade', body: { version: next } });
    }
  }
  const appSteps = [];
  const appNotes = [];
  const apps = new Map(overview.units.filter((u) => u.unit !== 'augur').map((u) => [u.unit, u]));
  // A preview's job (a pull request's build) runs beside the app's own and never holds up an install.
  const busy = new Map(jobs.filter((j) => j.pr === undefined && (j.state === 'requested' || j.state === 'running')).map((j) => [j.app, j.state]));
  for (const { id, version } of doc.apps ?? []) {
    const unit = apps.get(id);
    const open = unit?.open?.state ?? busy.get(id);
    if (open) appNotes.push(`${id}: a job is ${open} already; set leaves it.`);
    else if (unit?.running !== version) appSteps.push({ say: unit ? `app ${id} ${unit.running} → ${version}` : `install app ${id} ${version}`, method: 'POST', path: JOBS, body: { action: 'install', app: id, version } });
  }
  const listed = new Set((doc.apps ?? []).map((a) => a.id));
  for (const [id, unit] of apps) {
    if (listed.has(id)) continue;
    const open = unit.open?.state ?? busy.get(id);
    if (open) appNotes.push(`${id} ${unit.running} isn't in the file, and a job is ${open} for it already; set leaves it.`);
    else if (defaults.includes(id)) appNotes.push(`${id} ${unit.running} is one of the deployment's default apps (DEFAULT_APPS) and not in the file: the server keeps it while DEFAULT_APPS names it.`);
    else if (remove) appSteps.push({ say: `remove app ${id} ${unit.running}`, method: 'POST', path: JOBS, body: { action: 'remove', app: id } });
    else appNotes.push(`${id} ${unit.running} is installed but not in the file: set removes an app only with --remove.`);
  }
  if (!waits) return { steps: appSteps, later: [], notes: [...notes, ...appNotes], stuck };
  // What the apps need is said once AUGUR is there: an app's note now could send someone to act too soon.
  if (appSteps.length || appNotes.length) notes.push(stuck ? "The apps wait until AUGUR runs the file's release." : "The apps wait for AUGUR's upgrade. Run set again once it's done.");
  return { steps, later: stuck ? [] : appSteps, notes, stuck };
};

/** The fleet's client's secret, from the deployment's secrets: what `set` signs in with. */
export const FLEET_SECRET = 'FLEET_CLIENT_SECRET';
const FLEET_CLIENT_ID = 'platform-fleet';
const JOBS = '/api/registry/v1/app-runner/jobs';

/** A word for sh's single quotes. */
export const q = (text) => `'${String(text).replace(/'/g, `'\\''`)}'`;

/**
 * The script the server runs for plan and status: each section after a line `@@<name>`. The .env comes back
 * whole and is read here with readEnv, as the preflight reads it; augurctl never prints its secrets.
 */
export const factsScript = (dir) =>
  [
    'set -u',
    `cd ${q(dir)} || { echo "@@error"; echo "No folder ${dir.replace(/[^A-Za-z0-9_./-]/g, '')} on the server."; exit 0; }`,
    'pc() { docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env "$@"; }',
    'echo "@@env"; cat infra/deploy/.env 2>/dev/null; echo',
    // No apps folder, or one without state.json yet, is no apps; a state.json this user can't read prints nothing.
    'echo "@@apps"; a=infra/deploy/apps; if [ ! -d "$a" ] || { [ -r "$a" ] && [ -x "$a" ] && [ ! -e "$a/state.json" ]; }; then echo \'{"apps":{}}\'; else cat "$a/state.json" 2>/dev/null || sudo -n cat "$a/state.json" 2>/dev/null || true; fi; echo',
    'echo "@@backup"; cat infra/deploy/backups/status/last-backup.json 2>/dev/null; echo',
    'echo "@@ps"; pc ps --all --format json 2>/dev/null || true',
    'echo "@@upgrade"; pc exec -T postgres psql -U platform -d platform -tAc "select row_to_json(u) from (select from_version, version, state, message, finished_at from registry.upgrades order by requested_at desc limit 1) u" 2>/dev/null || true',
  ].join('\n');

const json = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** What the facts script printed, read back. */
export const readFacts = (out) => {
  const sections = {};
  let name;
  for (const line of out.split('\n')) {
    const m = /^@@([a-z]+)$/.exec(line);
    if (m) sections[(name = m[1])] = [];
    else if (name) sections[name].push(line);
  }
  const text = (n) => (sections[n] ?? []).join('\n').trim();
  if (sections.error) throw new Error(text('error'));
  const state = json(text('apps'));
  const apps = Object.fromEntries(Object.entries(state?.apps ?? {}).flatMap(([id, a]) => (a?.active?.version ? [[id, a.active.version]] : [])));
  // `compose ps --format json` prints one object per line (newer Compose) or one array (older).
  const ps = text('ps').startsWith('[') ? (json(text('ps')) ?? []) : text('ps').split('\n').map(json).filter(Boolean);
  return { env: readEnv(text('env')), apps, appsRead: Boolean(state), backup: json(text('backup')), ps, upgrade: json(text('upgrade')) };
};

/** One server's status, one line. */
export const statusLine = (doc, f) => {
  const running = f.ps.filter((c) => c.State === 'running');
  const unwell = f.ps.filter((c) => /unhealthy/.test(c.Health ?? c.Status ?? '') || (c.State !== 'running' && c.ExitCode !== 0 && c.State !== 'created'));
  const backup = !f.backup ? 'no backup yet' : `${f.backup.ok ? 'backup ok' : 'backup FAILED'} ${String(f.backup.at ?? '').slice(0, 16)}`;
  const u = f.upgrade;
  const upgrade = !u ? 'no upgrade yet' : `upgrade ${u.from_version}→${u.version} ${u.state}${u.message && u.state !== 'done' ? ` (${u.message})` : ''}`;
  const apps = Object.entries(f.apps).map(([id, v]) => `${id} ${v}`).join(', ') || (f.appsRead ? 'no apps' : 'apps unreadable');
  return `${doc.name} (${doc.ring}): ${f.env.PLATFORM_VERSION ?? '?'} · ${running.length} running${unwell.length ? `, ${unwell.length} unwell: ${unwell.map((c) => c.Service).join(', ')}` : ''} · ${backup} · ${upgrade} · ${apps}`;
};

/**
 * Who may have signed a deploy bundle, as the updater trusts them (signers.ts): the Release workflow on a branch
 * releases are made from, or the dev build workflow on main or dev, in AUGUR's repository under either name.
 */
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const bundleIdentity = (repo) => {
  const repos = AUGUR_REPOSITORIES.includes(repo.toLowerCase()) ? AUGUR_REPOSITORIES : [repo];
  const dev = `^(?:${repos.map((r) => escape(`https://github.com/${r}/.github/workflows/augur-dev.yml`)).join('|')})@refs/heads/(main|dev)$`;
  return `(?:${releaseIdentity(repos.map((r) => `${r}/.github/workflows/release.yml`))})|(?:${dev})`;
};

/**
 * Installing a new server (AUGUR's docs, Install AUGUR): the deploy bundle, checked here with cosign, goes to the
 * server on stdin; there it's unpacked and its sums checked, and its .env.example printed. Then, with the .env made
 * from that, the preflight runs on a copy, which becomes .env only once it passes, so a failed install can be run again.
 */
export const unpackScript = (doc) =>
  [
    'set -eu',
    `mkdir -p ${q(doc.host.dir)} && cd ${q(doc.host.dir)}`,
    `if [ -e infra/deploy/.env ]; then echo "${doc.name} is installed already (infra/deploy/.env is there): use augurctl plan." >&2; exit 3; fi`,
    // Nothing runs here yet, so what an earlier try unpacked goes first: only secrets/ and backups/ are kept.
    'if [ -d infra/deploy ]; then find infra/deploy -mindepth 1 -maxdepth 1 ! -name secrets ! -name backups -exec rm -rf {} +; fi',
    'cat > bundle.tar.gz && tar -xzf bundle.tar.gz && rm -f bundle.tar.gz && sha256sum --quiet -c SHA256SUMS >&2',
    'cat infra/deploy/.env.example',
  ].join('\n');
export const startScript = (doc, env) =>
  [
    'set -eu',
    `cd ${q(doc.host.dir)}`,
    `umask 077 && cat > infra/deploy/.env.augurctl <<'AUGURCTL_ENV'\n${env}AUGURCTL_ENV`,
    'docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/augur" -w /augur node:22-alpine node scripts/preflight.mjs --install --fill-secrets --env infra/deploy/.env.augurctl >&2',
    'mv infra/deploy/.env.augurctl infra/deploy/.env',
    `docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env up -d >&2 || { echo "AUGUR's settings are in place, but it didn't start: fix what Docker said, then run docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env up -d in ${doc.host.dir.replace(/[^A-Za-z0-9_./-]/g, '')}." >&2; exit 4; }`,
  ].join('\n');

/** One .env line. A value with anything but plain characters is single-quoted, which Compose takes literally (no $ or #). */
const line$ = (key, value) => {
  if (/^[A-Za-z0-9_./:@+,=-]*$/.test(value)) return `${key}=${value}`;
  if (/['\r\n]/.test(value)) throw new Error(`${key} has a quote or a line break in it, which .env can't hold: change it in the file or the secrets file.`);
  return `${key}='${value}'`;
};

/** The .env a new server starts with: .env.example's lines, with the file's values and secrets in place, then any it doesn't list. */
export const newEnv = (example, values) => {
  const left = { ...values };
  const lines = (example.trimEnd() ? example.trimEnd().split('\n') : []).map((line) => {
    const m = /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(line);
    if (!m || !(m[1] in left)) return line;
    const value = left[m[1]];
    delete left[m[1]];
    return line$(m[1], value);
  });
  return `${[...lines, ...Object.entries(left).map(([k, v]) => line$(k, v))].join('\n').trimEnd()}\n`;
};

// ---- What touches the world: files, ssh and sops.

const load = (dir, name) => {
  const files = ['yaml', 'yml'].map((ext) => join(dir, `${name}.${ext}`)).filter(existsSync);
  if (!files.length) throw new Error(`No deployment ${name} in ${dir}.`);
  if (files.length > 1) throw new Error(`${name} has two files, ${files.map((f) => basename(f)).join(' and ')}: keep one.`);
  const [file] = files;
  let doc;
  try {
    doc = parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${file}: isn't YAML: ${e.message.split('\n')[0]}`, { cause: e });
  }
  const found = problems(doc, file);
  if (found.length) throw new Error(found.join('\n'));
  return { doc, file };
};
const secretsOf = ({ doc, file }) => {
  if (!doc.secrets) return {};
  // sops finds its .sops.yaml from the folder it runs in: the deployment files' own.
  return readEnv(execFileSync('sops', ['--decrypt', '--input-type', 'dotenv', '--output-type', 'dotenv', resolve(dirname(file), doc.secrets)], { encoding: 'utf8', cwd: dirname(file) }));
};
/** Runs `script` on the host. With `input`, the script is sh -c's argument and `input` its stdin. */
const onHost = (host, script, input) => {
  const argv = input === undefined ? ['sh', '-s'] : ['sh', '-c', script];
  const options = { input: input ?? script, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'], maxBuffer: 1 << 26 };
  return host.ssh === 'local' ? execFileSync(argv[0], argv.slice(1), options) : execFileSync('ssh', ['-o', 'BatchMode=yes', host.ssh, ...argv.slice(0, 2), ...(input === undefined ? [] : [q(script)])], options);
};
/** The release's deploy bundle, fetched and its signature checked here. */
// Releases come from AUGUR's repository: AUGUR_REPO for a fork, never GITHUB_REPOSITORY, which in a fleet's own workflow is the fleet.
const fetchBundle = (version, repo = process.env.AUGUR_REPO || AUGUR_HOME) => {
  try {
    execFileSync('cosign', ['version'], { stdio: 'ignore' });
  } catch {
    throw new Error("cosign isn't installed here, and up checks each release's deploy bundle with it before the server gets it (AUGUR's docs, Run deployments from files).");
  }
  const work = mkdtempSync(join(tmpdir(), 'augurctl-'));
  const base = `https://github.com/${repo}/releases/download/augur%40${version}/augur-deploy-${version}.tar.gz`;
  try {
    execFileSync('curl', ['-fsSL', '-o', join(work, 'b.tar.gz'), base, '-o', join(work, 'b.sigstore.json'), `${base}.sigstore.json`], { stdio: 'inherit' });
    execFileSync('cosign', ['verify-blob', '--bundle', join(work, 'b.sigstore.json'), '--certificate-identity-regexp', bundleIdentity(repo), '--certificate-oidc-issuer', 'https://token.actions.githubusercontent.com', join(work, 'b.tar.gz')], { stdio: ['ignore', 'ignore', 'inherit'] });
    return readFileSync(join(work, 'b.tar.gz'));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
};
const factsOf = (doc) => readFacts(onHost(doc.host, factsScript(doc.host.dir)));

/** The registry, through the server's gateway, as the fleet's client (platform-fleet, ADR 0100). */
const fleetOf = async (doc, secrets) => {
  const url = doc.settings?.PLATFORM_URL;
  if (!url) throw new Error(`${doc.name} names no PLATFORM_URL in settings, so set can't reach it.`);
  if (!secrets[FLEET_SECRET]) throw new Error(`${doc.name}'s secrets have no ${FLEET_SECRET}: add one (augurctl init makes it for a new server), set it on the server, then run set.`);
  const ask = async (path, init) => {
    const to = new URL(path, url);
    let res;
    try {
      res = await fetch(to, { ...init, signal: AbortSignal.timeout(30_000) });
    } catch (e) {
      throw new Error(`${doc.name} can't be reached at ${to.origin} (${e.cause?.message ?? e.message}). Is PLATFORM_URL right, and can this machine reach it?`, { cause: e });
    }
    const text = await res.text();
    return { status: res.status, body: json(text) ?? { message: text.slice(0, 200) } };
  };
  const form = new URLSearchParams({ grant_type: 'client_credentials', client_id: FLEET_CLIENT_ID, client_secret: secrets[FLEET_SECRET] });
  const token = await ask('/api/identity/v1/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
  if (token.status !== 200 || !token.body.access_token) {
    const why = token.body.error_description ?? token.body.message ?? 'no token';
    // 400 and 401 are the sign-in service saying no to the client; anything else is the server, not the secret.
    throw new Error(token.status === 400 || token.status === 401 ? `${doc.name} refused the fleet's client (${token.status}): ${why}. Is ${FLEET_SECRET} on the server the one in its secrets?` : `${doc.name} couldn't sign the fleet's client in (${token.status}): ${why}`);
  }
  return (method, path, body) => ask(path, { method, headers: { authorization: `Bearer ${token.body.access_token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
};

/** set: asks the server, as the fleet's client, for what its file says it runs. */
const set = async (loaded, { dryRun, remove }) => {
  const { doc } = loaded;
  const call = await fleetOf(doc, secretsOf(loaded));
  const read = async (path) => {
    const res = await call('GET', path);
    if (res.status !== 200) throw new Error(`${doc.name} answered ${res.status} for ${path}: ${res.body.message ?? ''}`);
    return res.body;
  };
  const [overview, runner, jobs] = await Promise.all([read('/api/registry/v1/platform/overview'), read('/api/registry/v1/app-runner/apps'), read(JOBS)]);
  const { steps, later, notes, stuck } = setSteps(doc, overview, { remove, jobs: jobs.jobs ?? [], defaults: (runner.defaultApps ?? []).map((d) => d.app) });
  let refused = 0;
  for (const step of steps) {
    if (dryRun) {
      console.log(`would ${step.say}`);
      continue;
    }
    const res = await call(step.method, step.path, step.body);
    if (res.status < 300) console.log(`✓ ${step.say}: asked`);
    else {
      refused++;
      console.log(`✗ ${step.say}: ${res.body.message ?? res.status}`);
    }
  }
  if (dryRun) for (const step of later) console.log(`then, once AUGUR is there, would ${step.say}`);
  for (const note of notes) console.log(`· ${note}`);
  if (!steps.length && !later.length && !notes.length) console.log(`${doc.name}: nothing to ask. The server runs what its file says.`);
  else if (steps.length && !dryRun && !refused) console.log(`Follow it with augurctl status ${doc.name}.`);
  if (refused) process.exit(1);
  // Like plan's 2: the server still differs from its file, and set can't move it there.
  if (stuck) process.exit(2);
};

const main = async () => {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? Boolean(args.splice(i, 1)) : false;
  };
  const dryRun = flag('--dry-run');
  const remove = flag('--remove');
  const at = args.indexOf('--dir');
  // Where the person ran it: under pnpm the script runs in AUGUR's folder, and INIT_CWD says where they were.
  const dir = resolve(process.env.INIT_CWD ?? process.cwd(), at >= 0 ? args.splice(at, 2)[1] : 'deployments');
  const [command, ...names] = args;
  const unknown = args.find((a) => a.startsWith('-'));
  if (unknown || ((dryRun || remove) && command !== 'set') || (command === 'set' && names.length !== 1)) {
    console.error(unknown ? `augurctl: ${unknown} isn't an option.` : command === 'set' && names.length !== 1 ? 'augurctl set takes one deployment.' : `augurctl ${command ?? ''}: --dry-run and --remove are for set only.`);
    process.exit(64);
  }
  const all = () => {
    const found = existsSync(dir) ? [...new Set(readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => f.replace(/\.ya?ml$/, '')))].sort() : [];
    if (!found.length) throw new Error(`No deployment files in ${dir}: run it from the folder that holds deployments/, or pass --dir.`);
    return found;
  };
  if (command === 'check') {
    const names = all();
    const found = names.flatMap((name) => {
      try {
        load(dir, name);
        return [];
      } catch (e) {
        return e.message.split('\n');
      }
    });
    for (const p of found) console.error(`✗ ${p}`);
    if (found.length) process.exit(1);
    return console.log(`✓ ${names.length} deployment file${names.length === 1 ? '' : 's'} in ${dir}, each as AUGUR's schema and settings say.`);
  }
  if (command === 'init') {
    const { doc, file } = load(dir, names[0]);
    if (!doc.secrets) throw new Error(`${file} names no secrets file.`);
    const target = resolve(dirname(file), doc.secrets);
    if (existsSync(target)) throw new Error(`${target} is there already: augurctl never replaces secrets.`);
    // And the fleet's client's secret, so set can change the server once it's up (ADR 0100).
    const keys = [...Object.entries(SETTINGS.properties).filter(([, s]) => s['x-generate']).map(([k]) => `${k}=`), `${FLEET_SECRET}=`];
    const made = { ...SETTINGS, properties: { ...SETTINGS.properties, [FLEET_SECRET]: { ...SETTINGS.properties[FLEET_SECRET], 'x-generate': true } } };
    const { text, filled } = fillSecrets(`${keys.join('\n')}\n`, made);
    writeFileSync(target, execFileSync('sops', ['--encrypt', '--input-type', 'dotenv', '--output-type', 'dotenv', '--filename-override', target, '/dev/stdin'], { input: text, encoding: 'utf8', cwd: dirname(file) }), { mode: 0o600 });
    return console.log(`Wrote ${target}: ${filled.length} secrets, encrypted with sops. Add the ones only you know (TS_AUTHKEY, PLATFORM_ADMIN_PASSWORD) with sops ${doc.secrets}.`);
  }
  if (command === 'plan') {
    const loaded = load(dir, names[0]);
    const secrets = secretsOf(loaded);
    const lines = diff(loaded.doc, factsOf(loaded.doc), secrets);
    if (!lines.length) return console.log(`${loaded.doc.name}: no changes. The server is as its file says.`);
    console.log(`${loaded.doc.name}: ${lines.length} difference${lines.length === 1 ? '' : 's'} (server → file):\n${lines.join('\n')}`);
    process.exit(2);
  }
  if (command === 'status') {
    let unread = 0;
    for (const name of names.length ? names : all()) {
      try {
        const { doc } = load(dir, name);
        console.log(statusLine(doc, factsOf(doc)));
      } catch (e) {
        unread++;
        console.log(`${name}: can't be read: ${e.message.split('\n')[0]}`);
      }
    }
    // Any server that couldn't be read makes the run fail, so a script checking the exit code notices.
    if (unread) process.exit(1);
    return;
  }
  if (command === 'up') {
    const loaded = load(dir, names[0]);
    const { doc } = loaded;
    if (doc.release === 'follow') throw new Error(`${doc.name} follows its ring: name the release to install first in release.`);
    const secrets = secretsOf(loaded);
    if (onHost(doc.host, `[ -e ${q(`${doc.host.dir}/infra/deploy/.env`)} ] && echo installed || true`).trim()) throw new Error(`${doc.name} is installed already (infra/deploy/.env is there): use augurctl plan.`);
    const example = onHost(doc.host, unpackScript(doc), fetchBundle(doc.release));
    onHost(doc.host, startScript(doc, newEnv(example, { ...desiredEnv(doc), ...secrets })));
    return console.log(`${doc.name} is installed and starting. Sign in as in AUGUR's docs, Install AUGUR, step 5; then augurctl plan ${doc.name}.`);
  }
  if (command === 'set') return set(load(dir, names[0]), { dryRun, remove });
  console.error('Usage: augurctl check | init <name> | plan <name> | status [<name>...] | up <name> | set <name> [--dry-run] [--remove]   [--dir <deployments folder>]');
  process.exit(64);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
}
