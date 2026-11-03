// Keeps the reference app built against this SDK minor (2.0, 2.1…), so every
// later shell is tested against it. Run after a release that bumps the SDK's minor:
//   pnpm --filter @augur/contract-tests freeze
// A build byte-for-byte the newest one kept adds nothing to test, so it isn't kept:
// that folder already stands for this minor too.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const { version } = JSON.parse(readFileSync(join(here, '../packages/mfe-sdk/package.json'), 'utf8'));
const release = version.split('.').slice(0, 2).join('.');
const frozen = join(here, 'frozen');
const dir = join(frozen, `sdk-${release}`);
if (existsSync(dir)) {
  console.log(`frozen/sdk-${release} is already kept; builds are never replaced.`);
  process.exit(0);
}
const built = join(here, 'dist/entry.js');
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const newest = (existsSync(frozen) ? readdirSync(frozen) : [])
  .filter((name) => existsSync(join(frozen, name, 'entry.js')))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .at(-1);
if (newest && hash(join(frozen, newest, 'entry.js')) === hash(built)) {
  console.log(`The reference app built against SDK ${version} is byte-for-byte frozen/${newest}, which stands for it: nothing to commit.`);
  process.exit(0);
}
mkdirSync(dir, { recursive: true });
copyFileSync(built, join(dir, 'entry.js'));
console.log(`Kept the reference app built against SDK ${version} in frozen/sdk-${release}. Commit it.`);
