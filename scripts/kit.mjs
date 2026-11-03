#!/usr/bin/env node
// The kit bundle AUGUR serves (ADR 0048): React, Common and Quill as one signed release of augur-kit,
// which the shell takes as @augur/kit-bundle and the web image serves at KIT_URL.
//
//   node scripts/kit.mjs pin      writes release/kit.json from the bundle installed (after bumping it)
//   node scripts/kit.mjs check    in CI: release/kit.json names the bundle installed, every file in it
//                                 matches its hash, and it serves what the SDK says the kit serves
//   node scripts/kit.mjs verify   in the Release and dev build workflows, before any image is built:
//                                 the bundle's kit.json is signed by augur-kit's Release workflow on main
//                                 (cosign), so every file its hashes vouch for came from there
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const PIN_FILE = 'release/kit.json';
const SHELL = 'platform/frontends/shell';
/** The repository whose Release workflow signs the kit. KIT_REPOSITORY overrides it, for a fork. */
export const KIT_REPOSITORY = process.env.KIT_REPOSITORY || 'harry-burton-dev/augur-kit';

export const sri = (bytes) => `sha384-${createHash('sha384').update(bytes).digest('base64')}`;

/** The installed bundle: its folder and its kit.json. */
export function installedKit(base = root) {
  const dir = join(base, SHELL, 'node_modules/@augur/kit-bundle/dist');
  const file = join(dir, 'kit.json');
  if (!existsSync(file)) throw new Error(`@augur/kit-bundle isn't installed in ${SHELL}: run pnpm install (with NODE_AUTH_TOKEN set).`);
  return { dir, kit: JSON.parse(readFileSync(file, 'utf8')), hash: sri(readFileSync(file)) };
}

/** What release/kit.json says for a bundle. */
export const pinFor = (kit, hash) => ({ version: kit.version, packages: kit.packages, kitJson: hash });

/** Everything wrong with an installed bundle against the pin and the SDK. */
export function problems({ dir, kit, hash }, pin, sharedModules, read = (f) => readFileSync(join(dir, f))) {
  const out = [];
  if (!pin) out.push(`${PIN_FILE} is missing. Run: node scripts/kit.mjs pin`);
  else if (pin.version !== kit.version || pin.kitJson !== hash) out.push(`${PIN_FILE} names kit ${pin.version}, but ${kit.version} is installed (or its kit.json differs). Run: node scripts/kit.mjs pin`);
  if (kit.schema !== 'augur.kit/v1') out.push(`kit.json is ${kit.schema}, not augur.kit/v1`);
  for (const [file, expected] of Object.entries(kit.integrity ?? {})) {
    let actual;
    try {
      actual = sri(read(file));
    } catch {
      actual = 'missing';
    }
    if (actual !== expected) out.push(`${file} doesn't match its hash in kit.json`);
  }
  // The SDK promises apps these; the bundle must serve every one it doesn't leave to /shared/.
  const served = new Set(Object.keys(kit.imports ?? {}));
  for (const s of ['react', 'react-dom', '@augur/kit-common', '@augur/app-kit']) if (!served.has(s)) out.push(`the kit doesn't serve ${s}`);
  for (const s of served) if (!sharedModules.includes(s)) out.push(`the kit serves ${s}, which the SDK's sharedModules doesn't list`);
  return out;
}

const readPin = () => (existsSync(join(root, PIN_FILE)) ? JSON.parse(readFileSync(join(root, PIN_FILE), 'utf8')) : undefined);

async function main() {
  const mode = process.argv[2];
  const installed = installedKit();
  if (mode === 'pin') {
    writeFileSync(join(root, PIN_FILE), `${JSON.stringify(pinFor(installed.kit, installed.hash), null, 2)}\n`);
    console.log(`✓ ${PIN_FILE}: kit ${installed.kit.version}`);
  } else if (mode === 'check') {
    const { sharedModules } = await import(pathToFileURL(join(root, 'platform/packages/mfe-sdk/dist/build.js')).href);
    const found = problems(installed, readPin(), sharedModules);
    if (found.length) {
      console.error(found.map((p) => `✗ ${p}`).join('\n'));
      process.exit(1);
    }
    console.log(`✓ Kit ${installed.kit.version} is pinned, whole and as the SDK says.`);
  } else if (mode === 'verify') {
    const signature = join(installed.dir, 'kit.json.sigstore.json');
    if (!existsSync(signature)) throw new Error(`Kit ${installed.kit.version} carries no signature: only a release of ${KIT_REPOSITORY} has one.`);
    execFileSync(
      'cosign',
      [
        'verify-blob', join(installed.dir, 'kit.json'), '--bundle', signature,
        '--certificate-oidc-issuer', 'https://token.actions.githubusercontent.com',
        '--certificate-identity', `https://github.com/${KIT_REPOSITORY}/.github/workflows/release.yml@refs/heads/main`,
      ],
      { stdio: 'inherit' },
    );
    const found = problems(installed, readPin(), Object.keys(installed.kit.imports));
    if (found.length) throw new Error(found.join('; '));
    console.log(`✓ Kit ${installed.kit.version} is signed by ${KIT_REPOSITORY} and every file matches.`);
  } else {
    console.error('usage: node scripts/kit.mjs pin|check|verify');
    process.exit(2);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
