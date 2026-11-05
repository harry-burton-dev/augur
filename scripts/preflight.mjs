// Checks a server before AUGUR is installed on it or moved to the release in this checkout, before
// anything starts or stops. It needs nothing from npm, so it runs from a bare checkout with only Docker:
//   docker run --rm -v "$PWD:/augur:ro" -w /augur node:22-alpine node scripts/preflight.mjs [--install]
// (or `node scripts/preflight.mjs` where Node is installed). Exits 1 when the install or upgrade must not go ahead.
//
// An upgrade (the default), against the server's infra/deploy/.env (--env <file> for another):
//   - the version the server is on (its PLATFORM_VERSION) can upgrade straight to this one (`upgradeFrom`)
//   - every setting this release needs is set
// and it lists what this release breaks and the settings it no longer reads.
//
// A fresh install (--install; docs/deploy.md, "First start") checks the .env against
// infra/deploy/settings.schema.json, as a list: the release checked out is the one PLATFORM_VERSION names;
// every required setting is set and each value fits its pattern, length or choices; no two secrets are the
// same; PLATFORM_URL is this machine's address on the tailnet; the read key is complete; and the host's
// memory and disk. --fill-secrets first writes a random value into each blank secret the schema marks
// `x-generate` (mount the checkout read-write for it: drop the `:ro`). It never changes a value that's set.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync, statfsSync, writeFileSync } from 'node:fs';
import { totalmem } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** "1.2.3" → [1, 2, 3]; anything after the numbers is ignored. */
const parse = (v) => (/^(\d+)\.(\d+)\.(\d+)/.exec(v ?? '') ?? []).slice(1).map(Number);
export const compare = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};
const isVersion = (v) => parse(v).length === 3;

/** KEY=value lines of a .env file; quotes around a value are dropped. */
export const readEnv = (text) =>
  Object.fromEntries(
    text
      .split('\n')
      .map((line) => /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.replace(/^(['"])(.*)\1$/, '$2')]),
  );

/** What stands between a server with this .env and the release. `errors` stop the upgrade; `notes` are for reading. */
export const preflight = (release, env) => {
  const errors = [];
  const notes = [];
  const from = env.PLATFORM_VERSION;
  const min = release.upgradeFrom?.replace(/^>=\s*/, '');

  if (!from || !isVersion(from)) {
    notes.push(from ? `PLATFORM_VERSION is "${from}", not a release, so the upgrade path isn't checked.` : "PLATFORM_VERSION isn't set yet: this server built its own images before. See \"Images from releases\" in docs/upgrade.md.");
  } else if (compare(from, release.version) === 0) {
    notes.push(`Already on ${release.version}.`);
  } else if (compare(from, release.version) > 0) {
    notes.push(`${release.version} is older than ${from}: this is going back. Follow "Going back" in docs/upgrade.md.`);
  } else if (min && compare(from, min) < 0) {
    errors.push(`${release.version} upgrades from ${min} or later, and this server is on ${from}. Upgrade to ${min} first (augur@${min}), then to ${release.version}.`);
  }

  const missing = (release.settings?.required ?? []).filter((key) => key !== 'PLATFORM_VERSION' && !env[key]);
  if (missing.length) errors.push(`Set ${missing.join(', ')} in .env first (see infra/deploy/.env.example).`);
  const stale = (release.settings?.removed ?? []).filter((key) => key in env);
  if (stale.length) notes.push(`${stale.join(', ')} ${stale.length === 1 ? 'is' : 'are'} no longer read; you can remove ${stale.length === 1 ? 'it' : 'them'} from .env.`);
  for (const b of release.breaking ?? []) notes.push(`Breaking: ${b}.`);
  return { errors, notes };
};

/** The size a server is held to (the alpha's staging host: 4 vCPU, 16 GB, 200 GB). Under it is a note, not a stop. */
export const HOST_SIZE = { memoryGB: 16, diskGB: 200 };
const GB = 1024 ** 3;

const secretKeys = (schema) => Object.entries(schema.properties ?? {}).filter(([, s]) => s.writeOnly).map(([k]) => k);

/** `env`'s text with each blank `x-generate` secret given 64 random hex characters. Set values are kept. */
export const fillSecrets = (text, schema, random = () => randomBytes(32).toString('hex')) => {
  const env = readEnv(text);
  const filled = Object.entries(schema.properties ?? {})
    .filter(([key, s]) => s['x-generate'] && !env[key])
    .map(([key]) => key);
  let out = text;
  for (const key of filled) {
    const line = new RegExp(`^[ \\t]*#?[ \\t]*${key}[ \\t]*=.*$`, 'm');
    out = line.test(out) ? out.replace(line, `${key}=${random()}`) : `${out}${out.endsWith('\n') || !out ? '' : '\n'}${key}=${random()}\n`;
  }
  return { text: out, filled };
};

/** What a value breaks of its setting's pattern, length, choices or format, if anything. */
const misfit = (key, value, setting) => {
  if (setting.enum && !setting.enum.includes(value)) return `${key} is "${value}"; it can be ${setting.enum.join(', ')}.`;
  const secret = setting.writeOnly;
  const shown = secret ? 'it' : `"${value}"`;
  if (setting.minLength && value.length < setting.minLength) return `${key} is ${value.length} characters; it needs at least ${setting.minLength}${setting['x-generate'] ? ' (--fill-secrets makes one, after you blank it)' : ''}.`;
  if (setting.pattern && !new RegExp(setting.pattern).test(value)) {
    if (key === 'PLATFORM_URL') return `PLATFORM_URL is ${shown}; it must be https:// and the address alone, with no path or trailing slash.`;
    if (key === 'TS_AUTHKEY') return 'TS_AUTHKEY doesn\u2019t look like a Tailscale auth key (tskey-…); make one under Settings → Keys in the Tailscale admin console.';
    return `${key} doesn\u2019t fit ${setting.pattern}${/0-9a-f/.test(setting.pattern) ? ' (64 hex characters: openssl rand -hex 32)' : ''}.`;
  }
  if (setting.format === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return `${key} is ${shown}, which isn\u2019t an email address.`;
  return undefined;
};

/**
 * The fresh-install checks, as a list. Each is `{ ok, text }`, with `stop` when it fails the install and
 * `note` when it is only for reading. `host` is what the server has: `memoryBytes`, `freeDiskBytes`,
 * `envReadableByOthers`, and `readKey` (whether infra/deploy/secrets/github-read-key is there).
 */
export const installChecks = ({ release, schema, env, host = {} }) => {
  const checks = [];
  const pass = (text) => checks.push({ ok: true, text });
  const stop = (text) => checks.push({ ok: false, stop: true, text });
  const note = (text) => checks.push({ ok: false, note: true, text });
  const props = schema.properties ?? {};
  const patterns = Object.entries(schema.patternProperties ?? {}).map(([p, s]) => [new RegExp(p), s]);
  const lookup = (key) => props[key] ?? patterns.find(([re]) => re.test(key))?.[1];

  // The release.
  if (!env.PLATFORM_VERSION) stop(`PLATFORM_VERSION isn\u2019t set: set it to ${release.version}, the release checked out here.`);
  else if (env.PLATFORM_VERSION !== release.version) stop(`PLATFORM_VERSION is ${env.PLATFORM_VERSION}, but the checkout is augur@${release.version}: check out augur@${env.PLATFORM_VERSION}, or set PLATFORM_VERSION=${release.version}.`);
  else pass(`Release: augur@${release.version} (${release.channel}) is checked out, and PLATFORM_VERSION names it.`);

  // Every required setting, and every value set, fits the schema.
  const required = [...new Set([...(schema.required ?? []), ...(release.settings?.required ?? [])])];
  const missing = required.filter((key) => !env[key]);
  const generated = missing.filter((key) => props[key]?.['x-generate']);
  const byHand = missing.filter((key) => !props[key]?.['x-generate']);
  if (byHand.length) stop(`Set ${byHand.join(', ')} in .env (docs/deploy.md, First start).`);
  if (generated.length) stop(`${generated.length} secret${generated.length === 1 ? '' : 's'} still blank (${generated.join(', ')}): run this again with --fill-secrets.`);
  if (!missing.length) pass(`Settings: all ${required.length} required settings are set.`);
  const misfits = Object.entries(env)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => (lookup(key) ? misfit(key, value, lookup(key)) : undefined))
    .filter(Boolean);
  for (const m of misfits) stop(m);
  const unknown = Object.keys(env).filter((key) => !lookup(key) && !/_FILE$/.test(key));
  if (unknown.length) note(`${unknown.join(', ')} ${unknown.length === 1 ? 'isn\u2019t a setting' : 'aren\u2019t settings'} this release knows (a typo?); nothing reads ${unknown.length === 1 ? 'it' : 'them'}.`);

  // No two secrets the same: one leaked can't open another.
  const seen = new Map();
  for (const key of secretKeys(schema)) if (env[key]) seen.set(env[key], [...(seen.get(env[key]) ?? []), key]);
  const shared = [...seen.values()].filter((keys) => keys.length > 1);
  for (const keys of shared) stop(`${keys.join(' and ')} are the same: give each its own (blank them and use --fill-secrets).`);
  if (!shared.length && !misfits.length) pass('Secrets: each is its own, and each fits.');

  // The address: this machine on the tailnet.
  const hostName = env.TS_HOSTNAME || props.TS_HOSTNAME?.default || 'platform';
  const url = /^https:\/\/([^/:]+)$/.exec(env.PLATFORM_URL ?? '');
  if (url) {
    const [machine, ...rest] = url[1].split('.');
    if (rest.join('.').endsWith('ts.net') && machine !== hostName) stop(`PLATFORM_URL names the machine ${machine}, but TS_HOSTNAME is ${hostName}: make them the same.`);
    else pass(`Address: ${env.PLATFORM_URL}, the machine ${hostName} on your tailnet.`);
  }

  // The ring, and what follows from it.
  const ring = env.SERVER_RING || 'production';
  pass(`Ring: ${ring}${env.SERVER_RING ? '' : ' (SERVER_RING isn\u2019t set; set preview for a staging server)'}.`);
  if (env.SEED_ALLOWED === 'true') note(`SEED_ALLOWED=true: sample data can be added here. Only where nobody real works${ring === 'production' ? ', and this is a production server' : ''}.`);

  // The read key: both halves or neither.
  if (env.GITHUB_READ_USER && !host.readKey) stop('GITHUB_READ_USER is set, but infra/deploy/secrets/github-read-key isn\u2019t there (docs/upgrade.md, The read key).');
  else if (!env.GITHUB_READ_USER && host.readKey) stop('infra/deploy/secrets/github-read-key is there, but GITHUB_READ_USER isn\u2019t set: set it to the account the key belongs to.');
  else if (env.GITHUB_READ_USER) pass(`Read key: ${env.GITHUB_READ_USER}'s, in infra/deploy/secrets/github-read-key.`);
  else note('No read key (GITHUB_READ_USER): fine while the release\u2019s packages are public; the Upgrade Centre can\u2019t see private ones without it (docs/upgrade.md, The read key).');

  // Later, but worth knowing now.
  if (!env.DEPLOYMENT_ID) note(`Not reporting to Backstage yet (DEPLOYMENT_ID${env.PORTAL_URL ? '' : ', PORTAL_URL'}): set it up after the first start (docs/deploy.md, Finish setting up).`);
  if (!env.OFFSITE_REPOSITORY) note('Backups stay on this server until the off-server copy is set up (docs/deploy.md, Off-server copy).');
  if (!env.SMTP_HOST) note('No email relay (SMTP_HOST): nobody can reset a forgotten password; admins pass on one-time passwords (docs/deploy.md, Email).');

  // The host.
  if (host.envReadableByOthers) stop('.env can be read by every user on this server: chmod 600 infra/deploy/.env.');
  if (host.memoryBytes !== undefined) {
    const gb = host.memoryBytes / GB;
    if (gb < HOST_SIZE.memoryGB * 0.9) note(`Memory: ${gb.toFixed(1)} GB, under the ${HOST_SIZE.memoryGB} GB AUGUR's limits are sized for; lower them in .env (docs/deploy.md, Logs, memory and health).`);
    else pass(`Memory: ${gb.toFixed(0)} GB.`);
  }
  if (host.freeDiskBytes !== undefined) {
    const gb = host.freeDiskBytes / GB;
    if (gb < HOST_SIZE.diskGB * 0.25) note(`Disk: ${gb.toFixed(0)} GB free. Backups, the WAL archive and apps' files grow; ${HOST_SIZE.diskGB} GB is the size a server is held to.`);
    else pass(`Disk: ${gb.toFixed(0)} GB free.`);
  }
  return checks;
};

const fileHost = (envFile) => {
  const host = { readKey: existsSync(join(root, 'infra/deploy/secrets/github-read-key')), memoryBytes: totalmem() };
  try {
    const fs = statfsSync(root);
    host.freeDiskBytes = fs.bavail * fs.bsize;
  } catch {
    // An old Node: the disk isn't checked.
  }
  try {
    host.envReadableByOthers = Boolean(statSync(envFile).mode & 0o004);
  } catch {
    // Read below, where a missing file stops it.
  }
  return host;
};

const main = () => {
  const args = process.argv.slice(2);
  const at = args.indexOf('--env');
  const envFile = at >= 0 ? args[at + 1] : join(root, 'infra/deploy/.env');
  const install = args.includes('--install');
  const releaseFile = join(root, 'release/augur-release.json');
  if (!existsSync(releaseFile)) {
    console.error('✗ No release/augur-release.json here: check out an augur@<version> tag first.');
    process.exit(1);
  }
  if (!existsSync(envFile)) {
    console.error(`✗ No ${envFile}.${install ? ' Make it with cp infra/deploy/.env.example infra/deploy/.env.' : ''}`);
    process.exit(1);
  }
  const release = JSON.parse(readFileSync(releaseFile, 'utf8'));
  const schema = JSON.parse(readFileSync(join(root, 'infra/deploy/settings.schema.json'), 'utf8'));

  if (args.includes('--fill-secrets')) {
    const { text, filled } = fillSecrets(readFileSync(envFile, 'utf8'), schema);
    if (filled.length) {
      writeFileSync(envFile, text, { mode: 0o600 });
      console.log(`Filled ${filled.length} secret${filled.length === 1 ? '' : 's'} in ${envFile}: ${filled.join(', ')}.`);
    } else console.log('No blank secrets to fill.');
  }

  const env = readEnv(readFileSync(envFile, 'utf8'));
  if (install) {
    const checks = installChecks({ release, schema, env, host: fileHost(envFile) });
    console.log(`Installing AUGUR ${release.version} (${release.channel}):`);
    for (const c of checks) (c.stop ? console.error : console.log)(`${c.ok ? '✓' : c.stop ? '✗' : '-'} ${c.text}`);
    if (checks.some((c) => c.stop)) {
      console.error('Not ready: fix each ✗, then run this again.');
      process.exit(1);
    }
    console.log('✓ Ready: start AUGUR (docs/deploy.md, First start, step 5).');
    return;
  }

  const { errors, notes } = preflight(release, env);
  console.log(`AUGUR ${release.version} (${release.channel})`);
  for (const n of notes) console.log(`- ${n}`);
  for (const e of errors) console.error(`✗ ${e}`);
  if (errors.length) process.exit(1);
  console.log(`✓ Ready: set PLATFORM_VERSION=${release.version}, then pc pull && pc up -d --remove-orphans.`);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
