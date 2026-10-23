// Keeps the reference app built against this SDK minor (1.0, 1.1…), so every
// later shell is tested against it. Run after a release that bumps the SDK's minor:
//   pnpm --filter @augur/contract-tests freeze
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const { version } = JSON.parse(readFileSync(join(here, '../packages/mfe-sdk/package.json'), 'utf8'));
const release = version.split('.').slice(0, 2).join('.');
const dir = join(here, 'frozen', `sdk-${release}`);
if (existsSync(dir)) {
  console.log(`frozen/sdk-${release} is already kept; builds are never replaced.`);
  process.exit(0);
}
mkdirSync(dir, { recursive: true });
copyFileSync(join(here, 'dist/entry.js'), join(dir, 'entry.js'));
console.log(`Kept the reference app built against SDK ${version} in frozen/sdk-${release}. Commit it.`);
