// The AUGUR release: one version over every part of the platform, so a deployment can say
// "we're on AUGUR 0.2.0" and an updater knows exactly what that means.
//   node scripts/augur-release.mjs version   after `changeset version`: writes release/augur-release.json
//   node scripts/augur-release.mjs check     in CI: fails when the release file is out of step with the parts
//   node scripts/augur-release.mjs publish   in the Release workflow: makes the GitHub release augur@<version>, which tags it
//
// Parts are the packages under platform/ (services, frontends, packages). Each keeps its own version and
// changelog; the AUGUR version moves when any of them does:
//   - a part's major bump (or a part removed) is breaking: deployments must be on the previous AUGUR
//     release before taking this one (`upgradeFrom`), and the release lists why under `breaking`
//   - any other new feature (a minor bump, or a new part) is a feature
//   - anything else is a fix
// While AUGUR is 0.x (the beta channel), breaking changes and features both bump the minor and fixes
// the patch, as semver allows before 1.0. From 1.0 on: major, minor, patch.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import semver from 'semver';

const root = new URL('..', import.meta.url).pathname;
const RELEASE_FILE = 'release/augur-release.json';
const ENV_EXAMPLE = 'infra/deploy/.env.example';
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

/** Every part of the platform, by package name, with its version and where it lives. */
export const readParts = () => {
  const parts = {};
  for (const group of ['packages', 'services', 'frontends']) {
    for (const dir of readdirSync(join(root, 'platform', group), { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const path = `platform/${group}/${dir.name}`;
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

const write = (release) => {
  mkdirSync(join(root, 'release'), { recursive: true });
  writeFileSync(join(root, RELEASE_FILE), `${JSON.stringify(release, null, 2)}\n`);
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
  if (release.settings.added.length) lines.push('### New settings', '', `Add to your \`.env\` before upgrading (see \`${ENV_EXAMPLE}\`):`, '', ...release.settings.added.map((k) => `- \`${k}\`${release.settings.required.includes(k) ? ' (required)' : ''}`), '');
  if (release.settings.removed.length) lines.push('### Removed settings', '', ...release.settings.removed.map((k) => `- \`${k}\``), '');
  lines.push('### What changed', '');
  for (const name of release.changed) {
    const { version } = release.parts[name];
    lines.push(`#### ${name} ${version}`, '', changelogFor(parts[name]?.path ?? '', version) || '_No changelog entry._', '');
  }
  lines.push('Upgrading: [docs/upgrade.md](../../blob/main/docs/upgrade.md).');
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
    }
    if (problems.length) {
      console.error(problems.map((p) => `✗ ${p}. Versions only change in the Version packages PR, which runs: node scripts/augur-release.mjs version`).join('\n'));
      process.exit(1);
    }
    console.log(`AUGUR release ${previous.version} is in step.`);
  } else if (mode === 'publish') {
    if (!previous) throw new Error(`${RELEASE_FILE} is missing.`);
    const tag = `augur@${previous.version}`;
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    if (git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`)) return console.log(`${tag} is already released.`);
    const notesFile = join(tmpdir(), `${tag.replace('@', '-')}-notes.md`);
    writeFileSync(notesFile, notes(previous, parts));
    execFileSync(
      'gh',
      ['release', 'create', tag, '--target', git('rev-parse', 'HEAD'), '--title', `AUGUR ${previous.version}${previous.channel === 'beta' ? ' (beta)' : ''}`, '--notes-file', notesFile, ...(previous.channel === 'beta' ? ['--prerelease'] : ['--latest']), `${join(root, RELEASE_FILE)}#augur-release.json`],
      { cwd: root, stdio: 'inherit' },
    );
    console.log(`Released ${tag}.`);
  } else {
    console.error('Usage: node scripts/augur-release.mjs version|check|publish');
    process.exit(2);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
