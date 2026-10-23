// Checks a server can move to the AUGUR release in this checkout, before anything stops.
// Run on the server after checking out the release's tag and before changing PLATFORM_VERSION:
//   docker run --rm -v "$PWD:/augur:ro" -w /augur node:22-alpine node scripts/preflight.mjs
// (or `node scripts/preflight.mjs` where Node is installed). Exits 1 when the upgrade must not go ahead.
// It needs nothing from npm, so it runs from a bare checkout.
//
// What it checks, against the server's infra/deploy/.env (--env <file> for another):
//   - the version the server is on (its PLATFORM_VERSION) can upgrade straight to this one (`upgradeFrom`)
//   - every setting this release needs is set
// and it lists what this release breaks and the settings it no longer reads.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

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

const main = () => {
  const at = process.argv.indexOf('--env');
  const envFile = at > 0 ? process.argv[at + 1] : join(root, 'infra/deploy/.env');
  const releaseFile = join(root, 'release/augur-release.json');
  if (!existsSync(releaseFile)) {
    console.error('✗ No release/augur-release.json here: check out an augur@<version> tag first.');
    process.exit(1);
  }
  if (!existsSync(envFile)) {
    console.error(`✗ No ${envFile}.`);
    process.exit(1);
  }
  const release = JSON.parse(readFileSync(releaseFile, 'utf8'));
  const { errors, notes } = preflight(release, readEnv(readFileSync(envFile, 'utf8')));
  console.log(`AUGUR ${release.version} (${release.channel})`);
  for (const n of notes) console.log(`- ${n}`);
  for (const e of errors) console.error(`✗ ${e}`);
  if (errors.length) process.exit(1);
  console.log(`✓ Ready: set PLATFORM_VERSION=${release.version}, then pc pull && pc up -d --remove-orphans.`);
};

if (import.meta.url === `file://${process.argv[1]}`) main();
