#!/usr/bin/env node
// Publishes AUGUR's library packages (every package in platform/packages) to GitHub Packages, so
// apps in their own repositories can build against them (ADR 0012, docs/versioning.md).
//
// GitHub's npm registry only takes packages scoped to the repository's owner, so @augur/<name> is
// published as @<owner>/augur-<name>. App repositories alias it back, and their imports don't change:
//   "@augur/mfe-sdk": "npm:@<owner>/augur-mfe-sdk@^1.9.0"
// The scope comes from PACKAGE_SCOPE, or else the repository's owner; the registry from PACKAGE_REGISTRY.
//
// node scripts/publish-packages.mjs [--dry-run]
// Run by the Release workflow once the Version packages PR has merged, after the packages are built.
// A version that's already in the registry is skipped, so running it again does nothing.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const OWN_SCOPE = '@augur/';
export const DEFAULT_REGISTRY = 'https://npm.pkg.github.com';
const LIBRARIES = 'platform/packages';

/** @augur/mfe-sdk → @<scope>/augur-mfe-sdk. */
export function publishedName(name, scope) {
  if (!name.startsWith(OWN_SCOPE)) throw new Error(`${name} isn't an ${OWN_SCOPE} package`);
  return `@${scope.toLowerCase()}/augur-${name.slice(OWN_SCOPE.length)}`;
}

/** An @augur dependency becomes an alias, so it installs under its own name in the consumer. */
export function aliasDependencies(deps, scope) {
  if (!deps) return deps;
  return Object.fromEntries(
    Object.entries(deps).map(([name, range]) =>
      name.startsWith(OWN_SCOPE) && !String(range).startsWith('npm:')
        ? [name, `npm:${publishedName(name, scope)}@${range}`]
        : [name, range],
    ),
  );
}

/** The package.json that goes into the registry, from the packed one. */
export function publishedManifest(pkg, { scope, registry = DEFAULT_REGISTRY, repository }) {
  const { private: _private, devDependencies: _dev, scripts: _scripts, ...rest } = pkg;
  const out = { ...rest, name: publishedName(pkg.name, scope) };
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    if (pkg[field]) out[field] = aliasDependencies(pkg[field], scope);
  }
  // GitHub links a package to its repository through this field; it also sets who may read it.
  if (repository) out.repository = { type: 'git', url: `git+https://github.com/${repository}.git`, directory: pkg.__directory };
  delete out.__directory;
  out.publishConfig = { registry };
  return out;
}

/**
 * The npm dist-tag for a publish: main is "latest"; a hotfix on release/<unit>-<major>.<minor> gets its
 * own tag, so a patch to an older line never becomes what a fresh install picks.
 */
export function distTag(branch) {
  const line = /^release\/([a-z][a-z0-9-]*-\d+\.\d+)$/.exec(branch ?? '');
  return line ? `release-${line[1]}` : 'latest';
}

/** The library packages to publish: every package directory in platform/packages with a files list. */
export function libraries(root = '.') {
  const dir = join(root, LIBRARIES);
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'package.json')))
    .map((d) => ({ directory: `${LIBRARIES}/${d.name}`, pkg: JSON.parse(readFileSync(join(dir, d.name, 'package.json'), 'utf8')) }))
    .filter(({ pkg }) => pkg.name?.startsWith(OWN_SCOPE) && Array.isArray(pkg.files));
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function isPublished(name, version, npmrc, registry) {
  try {
    return run('npm', ['view', `${name}@${version}`, 'version', '--registry', registry, '--userconfig', npmrc]).trim() === version;
  } catch (err) {
    if (/E404|404 Not Found|is not in this registry/.test(String(err.stderr ?? err.message))) return false;
    throw err;
  }
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const repository = process.env.GITHUB_REPOSITORY;
  const scope = process.env.PACKAGE_SCOPE || process.env.GITHUB_REPOSITORY_OWNER || repository?.split('/')[0];
  const registry = process.env.PACKAGE_REGISTRY || DEFAULT_REGISTRY;
  if (!scope) throw new Error('Set PACKAGE_SCOPE (or run in GitHub Actions) to name the scope to publish under.');
  const token = process.env.NODE_AUTH_TOKEN;
  if (!token && !dryRun) throw new Error('NODE_AUTH_TOKEN must be a token that can write packages.');

  const work = mkdtempSync(join(tmpdir(), 'augur-packages-'));
  const npmrc = join(work, '.npmrc');
  writeFileSync(npmrc, `${new URL(registry).href.replace(/^https?:/, '')}:_authToken=${token ?? ''}\n`);
  const tag = distTag(process.env.GITHUB_REF_NAME);

  const done = [];
  for (const { directory, pkg } of libraries()) {
    const name = publishedName(pkg.name, scope);
    if (!dryRun && isPublished(name, pkg.version, npmrc, registry)) {
      console.log(`${name}@${pkg.version} is already published`);
      continue;
    }
    // pnpm pack applies the files list and resolves workspace: ranges; the manifest is then rewritten.
    const out = join(work, pkg.name.slice(OWN_SCOPE.length));
    mkdirSync(out, { recursive: true });
    const tarball = run('pnpm', ['pack', '--pack-destination', out], { cwd: directory }).trim().split('\n').pop();
    run('tar', ['-xzf', tarball, '-C', out]);
    const manifestPath = join(out, 'package', 'package.json');
    const packed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    writeFileSync(manifestPath, `${JSON.stringify(publishedManifest({ ...packed, __directory: directory }, { scope, registry, repository }), null, 2)}\n`);
    const args = ['publish', join(out, 'package'), '--tag', tag, '--registry', registry, '--userconfig', npmrc];
    if (dryRun) args.push('--dry-run');
    run('npm', args, { stdio: 'inherit' });
    done.push(`${name}@${pkg.version}`);
  }
  console.log(done.length ? `Published (${tag}): ${done.join(', ')}` : 'Nothing new to publish');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
