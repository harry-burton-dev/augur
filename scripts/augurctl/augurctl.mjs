#!/usr/bin/env node
// augurctl: AUGUR deployments declared in files (deployments/<name>.yaml, deployment.schema.json beside this).
// It reaches each server only over ssh (or on this machine, `ssh: local`), with the server's own docker,
// and never prints a secret. sops decrypts and encrypts a deployment's secrets file.
//   augurctl check                 every file in --dir (default ./deployments) against the schema and the settings
//   augurctl init <name>           make the deployment's secrets file, encrypted with sops (.sops.yaml says for whom)
//   augurctl plan <name>           how the server differs from its file; exits 0 when it doesn't, 2 when it does
//   augurctl status [<name>...]    each server's release, health, last backup, last upgrade and apps
//   augurctl up <name>             install a new server from the release's deploy bundle, then start it
// Changing a running server's release or apps goes through the server's own Deployment page for now.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { fillSecrets, readEnv } from '../preflight.mjs';
import { repoFrom } from '../repo.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
export const SCHEMA = JSON.parse(readFileSync(join(here, 'deployment.schema.json'), 'utf8'));
export const SETTINGS = JSON.parse(readFileSync(join(root, 'infra/deploy/settings.schema.json'), 'utf8'));
const validate = new Ajv({ allErrors: true, strict: false }).compile(SCHEMA);

/** The setting's description in the settings schema, by name or pattern. */
const settingOf = (key, settings = SETTINGS) =>
  settings.properties?.[key] ?? Object.entries(settings.patternProperties ?? {}).find(([p]) => new RegExp(p).test(key))?.[1];
export const isSecret = (key, settings = SETTINGS) => Boolean(settingOf(key, settings)?.writeOnly);

/** What's wrong with one deployment file, as sentences; none when it's fine. */
export const problems = (doc, file, settings = SETTINGS) => {
  if (!validate(doc)) return validate.errors.map((e) => `${file}: ${e.instancePath || '/'} ${e.message}`);
  const out = [];
  if (basename(file).replace(/\.ya?ml$/, '') !== doc.name) out.push(`${file}: its name is ${doc.name}, but the file is named otherwise.`);
  for (const key of Object.keys(doc.settings ?? {})) {
    if (!settingOf(key, settings)) out.push(`${file}: ${key} isn't a setting AUGUR knows (infra/deploy/settings.schema.json).`);
    else if (isSecret(key, settings)) out.push(`${file}: ${key} is a secret, so it belongs in the secrets file, not settings.`);
    else if (['PLATFORM_VERSION', 'SERVER_RING'].includes(key)) out.push(`${file}: ${key} comes from ${key === 'SERVER_RING' ? 'ring' : 'release'}, not settings.`);
  }
  const ids = (doc.apps ?? []).map((a) => a.id);
  for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) out.push(`${file}: ${id} is listed twice in apps.`);
  return out;
};

/** The .env values the file asks for: its settings, plus the release and ring. */
export const desiredEnv = (doc) => ({ ...(doc.settings ?? {}), ...(doc.release !== 'follow' ? { PLATFORM_VERSION: doc.release } : {}), SERVER_RING: doc.ring });

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/**
 * How the server differs from its file, one line each. `actual.env` holds the server's plain values and, for
 * secrets, their sha256 only; `actual.apps` the versions its app runner runs, by id.
 */
export const diff = (doc, actual, secrets = {}) => {
  const lines = [];
  for (const [key, want] of Object.entries(desiredEnv(doc))) {
    const have = actual.env[key];
    if (have !== want) lines.push(`~ ${key}: ${have === undefined || have === '' ? '(not set)' : have} → ${want}`);
  }
  for (const [key, value] of Object.entries(secrets)) {
    if (actual.env[key] === undefined) lines.push(`+ ${key}: (secret, not set on the server)`);
    else if (actual.env[key] !== sha256(value)) lines.push(`~ ${key}: (secret, differs from the secrets file)`);
  }
  if (actual.appsRead === false) return [...lines, `? apps: the server's app runner state (infra/deploy/apps/state.json) can't be read by this ssh user, so apps aren't compared.`];
  const want = Object.fromEntries((doc.apps ?? []).map((a) => [a.id, a.version]));
  for (const [id, version] of Object.entries(want)) if (actual.apps[id] !== version) lines.push(`${actual.apps[id] ? '~' : '+'} app ${id}: ${actual.apps[id] ?? '(not installed)'} → ${version}`);
  for (const [id, version] of Object.entries(actual.apps)) if (!(id in want)) lines.push(`- app ${id}: ${version} (installed, not in the file)`);
  return lines;
};

/** A word for sh's single quotes. */
export const q = (text) => `'${String(text).replace(/'/g, `'\\''`)}'`;

/**
 * The script the server runs for plan and status: each section after a line `@@<name>`. Values of the keys in
 * `plain` are printed; of the keys in `hashed`, only their sha256. Keys are checked names, so they're safe in it.
 */
export const factsScript = (dir, plain, hashed) => {
  for (const k of [...plain, ...hashed]) if (!/^[A-Z][A-Z0-9_]*$/.test(k)) throw new Error(`Not a setting name: ${k}`);
  return [
    'set -u',
    `cd ${q(dir)} || { echo "@@error"; echo "No folder ${dir.replace(/[^A-Za-z0-9_./-]/g, '')} on the server."; exit 0; }`,
    'env=infra/deploy/.env',
    // As readEnv reads a value: the last line for the key, trimmed, without matching quotes.
    `get() { sed -n "s/^$1=//p" "$env" 2>/dev/null | tail -n 1 | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\\(.*\\)"$/\\1/' -e "s/^'\\(.*\\)'$/\\1/"; }`,
    'pc() { docker compose -f infra/deploy/compose.yml --env-file "$env" "$@"; }',
    'echo "@@env"',
    `for k in ${plain.join(' ')}; do grep -q "^$k=" "$env" 2>/dev/null && printf '%s=%s\\n' "$k" "$(get "$k")"; done`,
    `for k in ${hashed.join(' ')}; do grep -q "^$k=" "$env" 2>/dev/null && printf '%s=%s\\n' "$k" "$(get "$k" | tr -d '\\n' | sha256sum | cut -d' ' -f1)"; done`,
    // No apps folder, or none in it yet, is no apps; a folder this user can't read prints nothing.
    'echo "@@apps"; if [ ! -d infra/deploy/apps ]; then echo \'{"apps":{}}\'; else { cat infra/deploy/apps/state.json 2>/dev/null || sudo -n cat infra/deploy/apps/state.json 2>/dev/null || { [ -r infra/deploy/apps ] && [ -x infra/deploy/apps ] && echo \'{"apps":{}}\'; } || true; }; fi; echo',
    'echo "@@backup"; cat infra/deploy/backups/status/last-backup.json 2>/dev/null; echo',
    'echo "@@ps"; pc ps --all --format json 2>/dev/null || true',
    'echo "@@upgrade"; pc exec -T postgres psql -U platform -d platform -tAc "select row_to_json(u) from (select from_version, version, state, message, finished_at from registry.upgrades order by requested_at desc limit 1) u" 2>/dev/null || true',
  ].join('\n');
};

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

/** The bundle's signers: AUGUR's release and dev build workflows, on a branch releases are made from (the updater's signers.ts). */
export const bundleIdentity = (repo) =>
  `^https://github\\.com/${repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\.github/workflows/(release|augur-dev)\\.yml@refs/heads/(main|preview|production|release/[a-z][a-z0-9-]*-[0-9]+\\.[0-9]+)$`;

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
    'docker compose -f infra/deploy/compose.yml --env-file infra/deploy/.env up -d >&2',
  ].join('\n');

/** One .env line. A value with anything but plain characters is single-quoted, which Compose takes literally (no $ or #). */
const line$ = (key, value) => {
  if (/^[A-Za-z0-9_./:@+,=-]*$/.test(value)) return `${key}=${value}`;
  if (/['\n]/.test(value)) throw new Error(`${key} has a quote or a line break in it, which .env can't hold: change it in the file or the secrets file.`);
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
  const file = ['yaml', 'yml'].map((ext) => join(dir, `${name}.${ext}`)).find(existsSync);
  if (!file) throw new Error(`No deployment ${name} in ${dir}.`);
  const doc = parse(readFileSync(file, 'utf8'));
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
const fetchBundle = (version, repo = repoFrom()) => {
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
const factsOf = (doc, secretKeys = []) =>
  readFacts(onHost(doc.host, factsScript(doc.host.dir, ['PLATFORM_VERSION', ...Object.keys(desiredEnv(doc))], secretKeys)));

const main = () => {
  const args = process.argv.slice(2);
  const at = args.indexOf('--dir');
  // Where the person ran it: under pnpm the script runs in AUGUR's folder, and INIT_CWD says where they were.
  const dir = resolve(process.env.INIT_CWD ?? process.cwd(), at >= 0 ? args.splice(at, 2)[1] : 'deployments');
  const [command, ...names] = args;
  const all = () => (existsSync(dir) ? [...new Set(readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => f.replace(/\.ya?ml$/, '')))].sort() : []);
  if (command === 'check') {
    const names = all();
    if (!names.length) throw new Error(`No deployment files in ${dir}: run it from the folder that holds deployments/, or pass --dir.`);
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
    const keys = Object.entries(SETTINGS.properties).filter(([, s]) => s['x-generate']).map(([k]) => `${k}=`);
    const { text, filled } = fillSecrets(`${keys.join('\n')}\n`, SETTINGS);
    writeFileSync(target, execFileSync('sops', ['--encrypt', '--input-type', 'dotenv', '--output-type', 'dotenv', '--filename-override', target, '/dev/stdin'], { input: text, encoding: 'utf8', cwd: dirname(file) }), { mode: 0o600 });
    return console.log(`Wrote ${target}: ${filled.length} secrets, encrypted with sops. Add the ones only you know (TS_AUTHKEY, PLATFORM_ADMIN_PASSWORD) with sops ${doc.secrets}.`);
  }
  if (command === 'plan') {
    const loaded = load(dir, names[0]);
    const secrets = secretsOf(loaded);
    const lines = diff(loaded.doc, factsOf(loaded.doc, Object.keys(secrets)), secrets);
    if (!lines.length) return console.log(`${loaded.doc.name}: no changes. The server is as its file says.`);
    console.log(`${loaded.doc.name}: ${lines.length} difference${lines.length === 1 ? '' : 's'} (server → file):\n${lines.join('\n')}`);
    process.exit(2);
  }
  if (command === 'status') {
    for (const name of names.length ? names : all()) {
      try {
        const { doc } = load(dir, name);
        console.log(statusLine(doc, factsOf(doc)));
      } catch (e) {
        console.log(`${name}: can't be read: ${e.message.split('\n')[0]}`);
      }
    }
    return;
  }
  if (command === 'up') {
    const loaded = load(dir, names[0]);
    const { doc } = loaded;
    if (doc.release === 'follow') throw new Error(`${doc.name} follows its ring: name the release to install first in release.`);
    const secrets = secretsOf(loaded);
    const example = onHost(doc.host, unpackScript(doc), fetchBundle(doc.release));
    onHost(doc.host, startScript(doc, newEnv(example, { ...desiredEnv(doc), ...secrets })));
    return console.log(`${doc.name} is installed and starting. Sign in as in AUGUR's docs, Install AUGUR, step 5; then augurctl plan ${doc.name}.`);
  }
  console.error('Usage: augurctl check | init <name> | plan <name> | status [<name>...] | up <name>   [--dir <deployments folder>]');
  process.exit(64);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
