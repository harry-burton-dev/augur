// The AUGUR release: one version over every part of the platform, so a deployment can say
// "we're on AUGUR 0.2.0" and an updater knows exactly what that means.
//   node scripts/augur-release.mjs version   after `changeset version`: writes release/augur-release.json, and the
//                                            registry's augur-version.ts, so a running registry knows its own release
//   node scripts/augur-release.mjs check     in CI: fails when the release file is out of step with the parts
//   node scripts/augur-release.mjs pending   in the Release workflow: prints version=, channel= and new=true|false (not released yet)
//   node scripts/augur-release.mjs publish <images.json>
//                                            in the Release workflow, after infra/release-images.sh: makes the GitHub release
//                                            augur@<version>, which tags it, with the release file and its images attached
//
// Parts are the packages under platform/ (services, frontends, packages) and those of the apps that ship
// with AUGUR (PILLAR_APPS). Each keeps its own version and changelog; the AUGUR version moves when any of them does:
//   - a part's major bump (or a part removed) is breaking: deployments must be on the previous AUGUR
//     release before taking this one (`upgradeFrom`), and the release lists why under `breaking`
//   - any other new feature (a minor bump, or a new part) is a feature
//   - anything else is a fix
// While AUGUR is 0.x (the beta channel), breaking changes and features both bump the minor and fixes
// the patch, as semver allows before 1.0. From 1.0 on: major, minor, patch.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import semver from 'semver';

const root = new URL('..', import.meta.url).pathname;
const RELEASE_FILE = 'release/augur-release.json';
const DEPLOY_DIR = 'infra/deploy';
const ENV_EXAMPLE = `${DEPLOY_DIR}/.env.example`;
const VERSION_FILE = 'platform/services/registry/src/augur-version.ts';
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

/**
 * The apps that ship with AUGUR (pillar apps), by their folder under apps/. Each is an ordinary app,
 * but the release builds its images and pins its versions, so its packages are parts too.
 */
export const PILLAR_APPS = ['folio'];

/** Every part of the platform, by package name, with its version and where it lives. */
export const readParts = () => {
  const parts = {};
  const groups = [...['packages', 'services', 'frontends'].map((g) => `platform/${g}`), ...PILLAR_APPS.map((app) => `apps/${app}`)];
  for (const group of groups) {
    for (const dir of readdirSync(join(root, group), { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const path = `${group}/${dir.name}`;
      if (!existsSync(join(root, path, 'package.json'))) continue;
      const { name, version } = readJson(`${path}/package.json`);
      parts[name] = { version, path };
    }
  }
  return parts;
};

/** The deployment's settings: every key in .env.example, and the ones it must set (not commented out). */
export const readSettings = () => {
  const all = [];
  const required = [];
  for (const line of readFileSync(join(root, ENV_EXAMPLE), 'utf8').split('\n')) {
    const match = line.match(/^(#\s*)?([A-Z][A-Z0-9_]*)=/);
    if (!match) continue;
    all.push(match[2]);
    if (!match[1]) required.push(match[2]);
  }
  return { all, required };
};

/** The next release, from the last one and the parts as they are now. Returns the last one unchanged when nothing moved. */
export const nextRelease = (previous, parts, settings, today) => {
  const before = previous?.parts ?? {};
  const changed = [];
  const breaking = [];
  let feature = false;
  for (const [name, part] of Object.entries(parts)) {
    const was = before[name]?.version;
    if (was === part.version) continue;
    changed.push(name);
    if (!was) feature = true;
    else if (semver.major(part.version) > semver.major(was)) breaking.push(`${name} ${was} → ${part.version}`);
    else if (semver.minor(part.version) > semver.minor(was) || semver.major(part.version) !== semver.major(was)) feature = true;
  }
  for (const name of Object.keys(before)) if (!parts[name]) breaking.push(`${name} removed`);

  const shape = Object.fromEntries(Object.entries(parts).map(([name, { version }]) => [name, { version }]));
  if (!previous) {
    return { version: '0.1.0', channel: 'beta', released: today, upgradeFrom: '>=0.1.0', changed: Object.keys(parts), breaking: [], settings: { ...settings, added: [], removed: [] }, parts: shape };
  }
  const settingsAdded = settings.all.filter((k) => !previous.settings.all.includes(k));
  const settingsRemoved = previous.settings.all.filter((k) => !settings.all.includes(k));
  if (!changed.length && !breaking.length && !settingsAdded.length && !settingsRemoved.length) return previous;

  const beta = semver.major(previous.version) === 0;
  const bump = breaking.length ? (beta ? 'minor' : 'major') : feature ? 'minor' : 'patch';
  return {
    version: semver.inc(previous.version, bump),
    channel: beta ? 'beta' : 'stable',
    released: today,
    // Breaking: go through the previous release first. Otherwise, whatever could reach the previous one can reach this one.
    upgradeFrom: breaking.length ? `>=${previous.version}` : previous.upgradeFrom,
    changed,
    breaking,
    settings: { ...settings, added: settingsAdded, removed: settingsRemoved },
    parts: shape,
  };
};

/**
 * The server's own files in infra/deploy as this release has them, by sha256 and path inside it.
 * When they differ from the server's, the updater writes the release's, which its updater image
 * carries, after checking each against these (platform/services/updater). Two aren't counted: `.env.example`,
 * since the server has its own `.env` and `settings` says what that needs, and `compose.build.yml`,
 * which builds images from a checkout instead of running a release's.
 */
const NOT_DEPLOYED = [ENV_EXAMPLE, `${DEPLOY_DIR}/compose.build.yml`];
export const deployFiles = (tracked) =>
  Object.fromEntries(
    tracked
      .filter((path) => path.startsWith(`${DEPLOY_DIR}/`) && !NOT_DEPLOYED.includes(path))
      .sort()
      .map((path) => [path.slice(DEPLOY_DIR.length + 1), createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]),
  );

/** The registry's copy of the release it ships in: Admin's Updates page compares the feed with it. */
export const versionModule = (release) =>
  `// Written by scripts/augur-release.mjs from ${RELEASE_FILE}; don't edit by hand.\n\n` +
  `/** The AUGUR release this registry ships in. */\n` +
  `export const AUGUR_RELEASE = { version: '${release.version}', channel: '${release.channel}' } as const;\n`;

const write = (release) => {
  mkdirSync(join(root, 'release'), { recursive: true });
  writeFileSync(join(root, RELEASE_FILE), `${JSON.stringify(release, null, 2)}\n`);
  writeFileSync(join(root, VERSION_FILE), versionModule(release));
};

/** The section of a part's CHANGELOG.md for one version, without its heading. */
export const changelogFor = (path, version) => {
  const file = join(root, path, 'CHANGELOG.md');
  if (!existsSync(file)) return '';
  const text = readFileSync(file, 'utf8');
  const start = text.indexOf(`\n## ${version}\n`);
  if (start < 0) return '';
  const body = text.slice(start + `\n## ${version}\n`.length);
  const end = body.search(/\n## /);
  return (end < 0 ? body : body.slice(0, end)).trim().replace(/^### /gm, '#### ');
};

export const notes = (release, parts) => {
  const lines = [`AUGUR ${release.version} (${release.channel}).`, ''];
  if (release.upgradeFrom) lines.push(`Upgrades from AUGUR ${release.upgradeFrom.replace('>=', '')} or later.`, '');
  if (release.breaking.length) lines.push('### Breaking', '', ...release.breaking.map((b) => `- ${b}`), '');
  if (release.settings.added.length) lines.push('### New settings', '', `Add to your \`.env\` before upgrading (see \`${ENV_EXAMPLE}\`). The updater makes up a required one ending in _SECRET, _PASSWORD or _TOKEN itself:`, '', ...release.settings.added.map((k) => `- \`${k}\`${release.settings.required.includes(k) ? ' (required)' : ''}`), '');
  if (release.settings.removed.length) lines.push('### Removed settings', '', ...release.settings.removed.map((k) => `- \`${k}\``), '');
  lines.push('### What changed', '');
  for (const name of release.changed) {
    const { version } = release.parts[name];
    lines.push(`#### ${name} ${version}`, '', changelogFor(parts[name]?.path ?? '', version) || '_No changelog entry._', '');
  }
  lines.push('### Running it', '', `Upgrade from Admin → Updates, or by hand: set \`PLATFORM_VERSION=${release.version}\` in \`infra/deploy/.env\`, check out \`augur@${release.version}\` for the deploy files, then pull and start: [docs/upgrade.md](../../blob/main/docs/upgrade.md).`);
  return lines.join('\n');
};

const main = () => {
  const mode = process.argv[2];
  const parts = readParts();
  const previous = existsSync(join(root, RELEASE_FILE)) ? readJson(RELEASE_FILE) : undefined;

  if (mode === 'version') {
    const next = nextRelease(previous, parts, readSettings(), new Date().toISOString().slice(0, 10));
    if (next === previous) return console.log(`AUGUR stays at ${previous.version}: no part changed.`);
    write(next);
    console.log(`AUGUR ${previous?.version ?? '(none)'} → ${next.version}${next.breaking.length ? ' (breaking)' : ''}.`);
  } else if (mode === 'check') {
    const problems = [];
    if (!previous) problems.push(`${RELEASE_FILE} is missing. Run: node scripts/augur-release.mjs version`);
    else {
      // A part added or removed since the last release is fine: the next release takes it in or out.
      // A part's version changing outside the Version packages PR isn't.
      for (const [name, { version }] of Object.entries(parts)) {
        const released = previous.parts[name]?.version;
        if (released && released !== version) problems.push(`${name} is ${version}, but ${RELEASE_FILE} says ${released}`);
      }
      const shipped = existsSync(join(root, VERSION_FILE)) ? readFileSync(join(root, VERSION_FILE), 'utf8') : '';
      if (shipped !== versionModule(previous)) problems.push(`${VERSION_FILE} doesn't match ${RELEASE_FILE}`);
    }
    if (problems.length) {
      console.error(problems.map((p) => `✗ ${p}. Versions only change in the Version packages PR, which runs: node scripts/augur-release.mjs version`).join('\n'));
      process.exit(1);
    }
    console.log(`AUGUR release ${previous.version} is in step.`);
  } else if (mode === 'pending' || mode === 'publish') {
    if (!previous) throw new Error(`${RELEASE_FILE} is missing.`);
    const tag = `augur@${previous.version}`;
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    const released = Boolean(git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`));
    if (mode === 'pending') return console.log(`version=${previous.version}\nchannel=${previous.channel}\nnew=${!released}`);
    if (released) return console.log(`${tag} is already released.`);
    // What the release names by digest, so an updater runs exactly what was built and signed,
    // and the deploy files it was built with, so an updater can tell whether the server's still fit.
    const images = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : {};
    const deploy = deployFiles(git('ls-files', DEPLOY_DIR).split('\n'));
    const dir = mkdtempSync(join(tmpdir(), 'augur-release-'));
    const asset = join(dir, 'augur-release.json');
    writeFileSync(asset, `${JSON.stringify({ ...previous, images, deploy }, null, 2)}\n`);
    const notesFile = join(dir, 'notes.md');
    writeFileSync(notesFile, notes(previous, parts));
    execFileSync(
      'gh',
      ['release', 'create', tag, '--target', git('rev-parse', 'HEAD'), '--title', `AUGUR ${previous.version}${previous.channel === 'beta' ? ' (beta)' : ''}`, '--notes-file', notesFile, ...(previous.channel === 'beta' ? ['--prerelease'] : ['--latest']), asset],
      { cwd: root, stdio: 'inherit' },
    );
    console.log(`Released ${tag}.`);
  } else {
    console.error('Usage: node scripts/augur-release.mjs version|check|pending|publish <images.json>');
    process.exit(2);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
