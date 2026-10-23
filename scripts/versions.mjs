// Keeps the versions that live outside package.json in step with it.
//   node scripts/versions.mjs sync    after `changeset version`: writes package versions where they're copied
//   node scripts/versions.mjs check   in CI: fails when anything is out of step
//
// package.json is the source of every release version; Changesets bumps it.
// What this covers:
//   - the SDK's SDK_VERSION constant (platform/packages/mfe-sdk/src/version.ts)
//   - each app's manifest.json `version`, from its frontend package (or its service when it has no frontend)
//   - each app's manifest `sdk` range, which must be valid and include the current SDK
//   - each OpenAPI contract: its info.version major is its server path (/v1) and the service's API_VERSION
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';

const mode = process.argv[2];
if (mode !== 'sync' && mode !== 'check') {
  console.error('Usage: node scripts/versions.mjs sync|check');
  process.exit(2);
}

const root = new URL('..', import.meta.url).pathname;
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const problems = [];
const changed = [];

/** Writes `next` to `path` when syncing, or notes the drift when checking. */
const expectFile = (path, next, what) => {
  const current = existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : '';
  if (current === next) return;
  if (mode === 'sync') {
    writeFileSync(join(root, path), next);
    changed.push(path);
  } else problems.push(`${path}: ${what}. Run: node scripts/versions.mjs sync`);
};

// ---- the SDK's own version ----

const sdkVersion = readJson('platform/packages/mfe-sdk/package.json').version;
expectFile(
  'platform/packages/mfe-sdk/src/version.ts',
  `// Written by scripts/versions.mjs from package.json; don't edit by hand.

/** This release of the SDK: the contract between the shell and apps. A shell runs apps whose \`sdk\` range it satisfies. */
export const SDK_VERSION = '${sdkVersion}';
`,
  `SDK_VERSION is not ${sdkVersion}`,
);

// ---- apps' manifests ----

for (const app of readdirSync(join(root, 'apps'), { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const dir = `apps/${app.name}`;
  if (!existsSync(join(root, dir, 'manifest.json'))) continue;
  const pkgPath = ['frontend', 'service'].map((p) => `${dir}/${p}/package.json`).find((p) => existsSync(join(root, p)));
  const manifest = readJson(`${dir}/manifest.json`);
  if (pkgPath) {
    const { version } = readJson(pkgPath);
    if (manifest.version !== version) {
      expectFile(`${dir}/manifest.json`, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`, `version is ${manifest.version}, but ${pkgPath} is ${version}`);
    }
  }
  if (!semver.validRange(manifest.sdk ?? '')) problems.push(`${dir}/manifest.json: sdk must be a semver range of @augur/mfe-sdk versions, such as ^${semver.major(sdkVersion)}.0.0`);
  else if (!semver.satisfies(sdkVersion, manifest.sdk, { includePrerelease: true }))
    problems.push(`${dir}/manifest.json: sdk "${manifest.sdk}" doesn't include the current SDK ${sdkVersion}, so the shell would refuse the app. Update the app for this SDK, then widen its range.`);
}

// ---- API contracts ----

for (const file of readdirSync(join(root, 'contracts')).filter((f) => f.endsWith('.openapi.yaml'))) {
  const service = file.replace('.openapi.yaml', '');
  const text = readFileSync(join(root, 'contracts', file), 'utf8');
  const version = text.match(/^info:\n(?:[ ].*\n)*?[ ]+version: (\S+)/m)?.[1];
  const server = text.match(/^servers:\n\s+- url: (\S+)/m)?.[1];
  if (!semver.valid(version)) {
    problems.push(`contracts/${file}: info.version "${version}" is not semver`);
    continue;
  }
  const prefix = `/v${semver.major(version)}`;
  if (server !== prefix) problems.push(`contracts/${file}: info.version is ${version}, so its server url should be ${prefix}, not ${server}`);
  const appTs = `platform/services/${service}/src/app.ts`;
  if (existsSync(join(root, appTs))) {
    const api = readFileSync(join(root, appTs), 'utf8').match(/API_VERSION = '([^']+)'/)?.[1];
    if (`/${api}` !== prefix) problems.push(`${appTs}: API_VERSION is ${api}, but contracts/${file} is ${version} (${prefix})`);
  }
}

if (changed.length) console.log(`Updated: ${changed.join(', ')}`);
if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
if (mode === 'check') console.log('Versions are in step.');
