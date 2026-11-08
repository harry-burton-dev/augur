// The AUGUR release: one version over every part of the platform, so a deployment can say
// "we're on AUGUR 0.2.0" and an updater knows exactly what that means.
//   node scripts/augur-release.mjs version   after `changeset version`: writes release/augur-release.json, and the
//                                            registry's augur-version.ts, so a running registry knows its own release
//   node scripts/augur-release.mjs check     in CI: fails when the release file is out of step with the parts
//   node scripts/augur-release.mjs pending   in the Release workflow: prints version=, channel= and new=true|false (not released yet)
//   node scripts/augur-release.mjs publish <images.json>
//                                            in the Release workflow, after infra/release-images.sh: makes the GitHub release
//                                            augur@<version>, which tags it, with the release file and its images attached
//   node scripts/augur-release.mjs dev <run>  in the AUGUR dev builds workflow, in its checkout only: writes a dev build's
//                                            release file (<next patch>-dev.<run>, from the changesets waiting) and prints its version
//   node scripts/augur-release.mjs devs-clean [<tag>...]
//                                            deletes AUGUR's older dev builds, keeping the newest DEV_BUILDS_KEPT and those named
//
// Parts are the packages under platform/ (services, frontends, packages) and the @augur packages they
// take from other repositories (the kit). No app ships with AUGUR (ADR 0075). Each keeps its own version and changelog; the AUGUR version moves when any of them does:
//   - a part's major bump (or a part removed) is breaking: deployments must be on the previous AUGUR
//     release before taking this one (`upgradeFrom`), and the release lists why under `breaking`
//   - any other new feature (a minor bump, or a new part) is a feature
//   - anything else is a fix
// While AUGUR is 0.x (the beta channel), breaking changes and features both bump the minor and fixes
// the patch, as semver allows before 1.0. From 1.0 on: major, minor, patch.
//
// Each new minor or major AUGUR version also takes a release name, the next one in release/names.json
// ("AUGUR 0.14 Avocet"); a patch keeps its release's name. The version is still what everything
// compares: the name is only shown beside it.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import semver from 'semver';
import { NOTES_FILE, stamp } from './upgrade-notes.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const RELEASE_FILE = 'release/augur-release.json';
const DEPLOY_DIR = 'infra/deploy';
const ENV_EXAMPLE = `${DEPLOY_DIR}/.env.example`;
const VERSION_FILE = 'platform/services/registry/src/augur-version.ts';
const NAMES_FILE = 'release/names.json';
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

/** Every part of the platform, by package name, with its version and where it lives. */
export const readParts = () => {
  const parts = {};
  const groups = ['packages', 'services', 'frontends'].map((g) => `platform/${g}`);
  for (const group of groups) {
    for (const dir of readdirSync(join(root, group), { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const path = `${group}/${dir.name}`;
      if (!existsSync(join(root, path, 'package.json'))) continue;
      const { name, version } = readJson(`${path}/package.json`);
      parts[name] = { version, path };
    }
  }
  return { ...readExternalParts(parts), ...parts };
};

/**
 * The parts AUGUR takes as packages from other repositories (the kit, ADR 0046): every @augur dependency
 * of a part that comes from a registry (an `npm:` alias), at the version installed, or else the lowest its
 * range allows.
 */
export const readExternalParts = (parts) => {
  const external = {};
  for (const { path } of Object.values(parts)) {
    const pkg = readJson(`${path}/package.json`);
    for (const [name, spec] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      const alias = /^npm:(@[^@/]+\/[^@]+)@(.+)$/.exec(String(spec));
      if (!name.startsWith('@augur/') || !alias) continue;
      // Where it is installed: its published CHANGELOG.md is there too, for the release notes.
      const dir = `${path}/node_modules/${name}`;
      const installed = existsSync(join(root, dir, 'package.json'));
      const version = installed ? readJson(`${dir}/package.json`).version : semver.minVersion(alias[2])?.version;
      if (version && !(external[name] && semver.gt(external[name].version, version))) external[name] = { version, path: installed ? dir : `npm:${alias[1]}`, external: true };
    }
  }
  return external;
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

/** The release names, in the order they're taken. */
export const readNames = () => (existsSync(join(root, NAMES_FILE)) ? readJson(NAMES_FILE).names : []);

/**
 * The name of the release after `previous` at `version`: a patch keeps its name, a new minor or major
 * takes the next unused one (the first, after a release that had none). Undefined once the list runs out.
 */
export const releaseName = (previous, version, names) => {
  if (previous && semver.major(version) === semver.major(previous.version) && semver.minor(version) === semver.minor(previous.version)) return previous.name;
  const at = previous?.name ? names.indexOf(previous.name) + 1 : 0;
  return names[at];
};

/** The next release, from the last one and the parts as they are now. Returns the last one unchanged when nothing moved. */
export const nextRelease = (previous, parts, settings, today, names = []) => {
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
    return { version: '0.1.0', ...(names[0] ? { name: names[0] } : {}), channel: 'beta', released: today, upgradeFrom: '>=0.1.0', changed: Object.keys(parts), breaking: [], settings: { ...settings, added: [], removed: [] }, parts: shape };
  }
  const settingsAdded = settings.all.filter((k) => !previous.settings.all.includes(k));
  const settingsRemoved = previous.settings.all.filter((k) => !settings.all.includes(k));
  if (!changed.length && !breaking.length && !settingsAdded.length && !settingsRemoved.length) return previous;

  const beta = semver.major(previous.version) === 0;
  const bump = breaking.length ? (beta ? 'minor' : 'major') : feature ? 'minor' : 'patch';
  const version = semver.inc(previous.version, bump);
  const name = releaseName(previous, version, names);
  return {
    version,
    ...(name ? { name } : {}),
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

/** How many of AUGUR's dev builds stay released: the workbench only ever wants the newest, and one or two to go back to. */
export const DEV_BUILDS_KEPT = 3;
const DEV = /-dev\.\d+$/;

/** A changeset's bumps, by package, and what it says. Undefined for anything that isn't one. */
export const parseChangeset = (text) => {
  const m = /^---\n([\s\S]*?)\n?---\n?([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n'));
  if (!m) return undefined;
  const bumps = {};
  for (const line of m[1].split('\n')) {
    const bump = /^\s*["']?([^"':\s]+)["']?\s*:\s*(major|minor|patch)\s*$/.exec(line);
    if (bump) bumps[bump[1]] = bump[2];
  }
  return { bumps, summary: m[2].trim() };
};

/** The changesets waiting in .changeset: what the next Version packages PR would release. */
export const pendingChangesets = (dir = join(root, '.changeset')) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => {
      const changeset = parseChangeset(readFileSync(join(dir, f), 'utf8'));
      return changeset && { id: f.slice(0, -'.md'.length), ...changeset };
    })
    .filter(Boolean);

const KIND_HEADINGS = { major: 'Major Changes', minor: 'Minor Changes', patch: 'Patch Changes' };

/**
 * A dev build of AUGUR: what dev is now, before its Version packages PR. Its version is the next patch
 * after the last release, then the run, so it sorts above the release it follows and below the next.
 * Its parts keep the last release's versions (nothing is versioned yet), and what changed, what's
 * breaking and each part's changelog come from the changesets waiting, in Changesets' own format.
 */
export const devBuild = (previous, parts, settings, changesets, run, today) => {
  if (!previous) throw new Error(`${RELEASE_FILE} is missing.`);
  if (!/^\d+$/.test(String(run))) throw new Error('The run is a number.');
  const base = semver.parse(previous.version);
  const next = base.prerelease.length ? `${base.major}.${base.minor}.${base.patch}` : semver.inc(previous.version, 'patch');
  const changed = [...new Set(changesets.flatMap((c) => Object.keys(c.bumps)))].filter((name) => parts[name]).sort();
  const breaking = changesets.flatMap((c) => Object.entries(c.bumps).filter(([name, kind]) => kind === 'major' && parts[name]).map(([name]) => `${name}: ${c.summary.split('\n')[0]}`));
  const changelogs = Object.fromEntries(
    changed.map((name) => [
      name,
      Object.entries(KIND_HEADINGS)
        .map(([kind, heading]) => {
          const lines = changesets.filter((c) => c.bumps[name] === kind).map((c) => `- ${c.summary.replace(/\n/g, '\n  ')}`);
          return lines.length ? `#### ${heading}\n\n${lines.join('\n')}` : '';
        })
        .filter(Boolean)
        .join('\n\n'),
    ]),
  );
  return {
    version: `${next}-dev.${run}`,
    channel: 'dev',
    released: today,
    upgradeFrom: breaking.length ? `>=${previous.version}` : previous.upgradeFrom,
    changed,
    breaking,
    settings: { ...settings, added: settings.all.filter((k) => !previous.settings.all.includes(k)), removed: previous.settings.all.filter((k) => !settings.all.includes(k)) },
    parts: Object.fromEntries(Object.entries(parts).map(([name, { version }]) => [name, { version }])),
    changelogs,
  };
};

/**
 * The deploy-test.json a new AUGUR release is made with: pending (passed: null) until the deploy test
 * replaces it with its result (.github/workflows/deploy-test.yml, --clobber). The feed doesn't offer a
 * beta whose result isn't a pass (scripts/publish-feed.mjs), so no feed published meanwhile offers it.
 * A dev build has no deploy test, so none.
 */
export const pendingDeployTest = ({ version, channel, run, at }) =>
  channel === 'dev' ? undefined : { schema: 'augur.deploy-test/v1', version, from: null, passed: null, run: run ?? null, at };

/** Which of AUGUR's dev build tags to delete: all but the newest `kept` and those in `keep`. */
export const oldDevBuilds = (tags, keep = [], kept = DEV_BUILDS_KEPT) =>
  tags
    .filter((t) => t.startsWith('augur@') && DEV.test(t) && semver.valid(t.slice('augur@'.length)))
    .sort((a, b) => semver.rcompare(a.slice('augur@'.length), b.slice('augur@'.length)))
    .slice(kept)
    .filter((t) => !keep.includes(t));

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

/** How a release is called in its GitHub release and notes: "AUGUR 0.14.0 Avocet". */
export const titleOf = (release) => `${release.version}${release.name ? ` ${release.name}` : ''}`;

const write = (release) => {
  mkdirSync(join(root, 'release'), { recursive: true });
  writeFileSync(join(root, RELEASE_FILE), `${JSON.stringify(release, null, 2)}\n`);
  writeFileSync(join(root, VERSION_FILE), versionModule(release));
};

/** The section of a part's CHANGELOG.md for one version, without its heading. */
export const changelogFor = (path, version) => {
  if (!path) return '';
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
  if (release.channel === 'dev') {
    const lines = [`A dev build of AUGUR: dev at ${process.env.RELEASE_TARGET?.slice(0, 7) ?? 'this commit'}, before its Version packages PR. Only the workbench (SERVER_RING=dev) runs it, after a backup. It is not a release.`, ''];
    if (release.breaking.length) lines.push('### Breaking', '', ...release.breaking.map((b) => `- ${b}`), '');
    if (release.settings.added.length) lines.push('### New settings', '', ...release.settings.added.map((k) => `- \`${k}\`${release.settings.required.includes(k) ? ' (required)' : ''}`), '');
    lines.push('### Waiting to be released', '');
    for (const name of release.changed) lines.push(`#### ${name}`, '', release.changelogs?.[name] || '_No changeset._', '');
    if (!release.changed.length) lines.push('_Nothing: no changesets are waiting._');
    return lines.join('\n');
  }
  const lines = [`AUGUR ${titleOf(release)} (${release.channel}).`, ''];
  if (release.upgradeFrom) lines.push(`Upgrades from AUGUR ${release.upgradeFrom.replace('>=', '')} or later.`, '');
  if (release.breaking.length) lines.push('### Breaking', '', ...release.breaking.map((b) => `- ${b}`), '');
  if (release.settings.added.length) lines.push('### New settings', '', `Add to your \`.env\` before upgrading (see \`${ENV_EXAMPLE}\`). The updater makes up a required one ending in _SECRET, _PASSWORD or _TOKEN itself:`, '', ...release.settings.added.map((k) => `- \`${k}\`${release.settings.required.includes(k) ? ' (required)' : ''}`), '');
  if (release.settings.removed.length) lines.push('### Removed settings', '', ...release.settings.removed.map((k) => `- \`${k}\``), '');
  lines.push('### What changed', '');
  for (const name of release.changed) {
    const { version } = release.parts[name];
    lines.push(`#### ${name} ${version}`, '', changelogFor(parts[name]?.path ?? '', version) || '_No changelog entry._', '');
  }
  lines.push('### Running it', '', `Upgrade from Admin → Upgrade Centre, or by hand: set \`PLATFORM_VERSION=${release.version}\` in \`infra/deploy/.env\`, check out \`augur@${release.version}\` for the deploy files, then pull and start: [docs/upgrade.md](../../blob/HEAD/docs/upgrade.md).`);
  return lines.join('\n');
};

const main = () => {
  const mode = process.argv[2];
  const parts = readParts();
  const previous = existsSync(join(root, RELEASE_FILE)) ? readJson(RELEASE_FILE) : undefined;

  if (mode === 'version') {
    const names = readNames();
    const next = nextRelease(previous, parts, readSettings(), new Date().toISOString().slice(0, 10), names);
    if (next === previous) return console.log(`AUGUR stays at ${previous.version}: no part changed.`);
    write(next);
    // Each upgrade note added since the last release says it came in this one (docs/upgrade.md).
    const notes = join(root, NOTES_FILE);
    writeFileSync(notes, stamp(readFileSync(notes, 'utf8'), next.version));
    console.log(`AUGUR ${previous?.version ?? '(none)'} → ${titleOf(next)}${next.breaking.length ? ' (breaking)' : ''}.`);
    if (!next.name && names.length) console.warn(`::warning::${NAMES_FILE} has no name left for AUGUR ${next.version}: add more at the end.`);
  } else if (mode === 'dev') {
    // In this checkout only: the images, the registry's own idea of its release and the release say the dev build's version.
    const build = devBuild(previous, parts, readSettings(), pendingChangesets(), process.argv[3], new Date().toISOString().slice(0, 10));
    write(build);
    console.log(build.version);
  } else if (mode === 'devs-clean') {
    const tags = JSON.parse(execFileSync('gh', ['release', 'list', '--limit', '500', '--json', 'tagName'], { cwd: root, encoding: 'utf8' })).map((r) => r.tagName);
    for (const tag of oldDevBuilds(tags, process.argv.slice(3))) {
      execFileSync('gh', ['release', 'delete', tag, '--yes', '--cleanup-tag'], { cwd: root, stdio: 'inherit' });
      console.log(`Deleted ${tag}.`);
    }
  } else if (mode === 'check') {
    const problems = [];
    if (!previous) problems.push(`${RELEASE_FILE} is missing. Run: node scripts/augur-release.mjs version`);
    else {
      // A part added or removed since the last release is fine: the next release takes it in or out.
      // A part's version changing outside the Version packages PR isn't.
      // A package from another repository (the kit) moves with a pull request here that bumps it.
      for (const [name, { version, external }] of Object.entries(parts)) {
        if (external) continue;
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
    // Each changed part's changelog for its new version, which Admin → Upgrade Centre shows (registry's changes.ts).
    const changelogs = previous.channel === 'dev' ? previous.changelogs ?? {} : Object.fromEntries(previous.changed.map((name) => [name, changelogFor(parts[name]?.path ?? '', previous.parts[name].version)]).filter(([, text]) => text));
    writeFileSync(asset, `${JSON.stringify({ ...previous, images, deploy, changelogs }, null, 2)}\n`);
    const pending = pendingDeployTest({ version: previous.version, channel: previous.channel, run: process.env.GITHUB_RUN_ID, at: new Date().toISOString() });
    const testFile = join(dir, 'deploy-test.json');
    if (pending) writeFileSync(testFile, `${JSON.stringify(pending, null, 2)}\n`);
    const notesFile = join(dir, 'notes.md');
    writeFileSync(notesFile, notes(previous, parts));
    // Every release starts as a pre-release, the beta channel, until the Promote workflow makes it stable
    // (scripts/promote.mjs); only then may it be the latest. A dev build always is one.
    execFileSync(
      'gh',
      ['release', 'create', tag, '--target', git('rev-parse', 'HEAD'), '--title', `AUGUR ${titleOf(previous)}${previous.channel === 'beta' ? ' (beta)' : previous.channel === 'dev' ? ' (dev build)' : ''}`, '--notes-file', notesFile, '--prerelease', asset, ...(pending ? [testFile] : [])],
      { cwd: root, stdio: 'inherit' },
    );
    console.log(`Released ${tag}.`);
  } else {
    console.error('Usage: node scripts/augur-release.mjs version|check|pending|publish <images.json>|dev <run>|devs-clean [<tag>...]');
    process.exit(2);
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
