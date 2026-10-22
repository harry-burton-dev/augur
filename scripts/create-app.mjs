// Starts a new app: a frontend, a service, a manifest and a changeset, in apps/<id>.
//   pnpm create-app <id> [--name "Display name"]
// Then: pnpm dev:app <id>. See docs/build-an-app.md.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const template = join(root, 'scripts/templates/app');
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--name');
const nameAt = args.indexOf('--name');
const titleCase = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};
if (!id) fail('Usage: pnpm create-app <id> [--name "Display name"]');
// The registry's own rule for app ids, and the platform's apps keep theirs.
if (!/^[a-z][a-z0-9-]{1,39}$/.test(id)) fail(`"${id}" can't be an app id: use 2 to 40 lowercase letters, digits and dashes, starting with a letter.`);
if (['home', 'admin'].includes(id)) fail(`"${id}" is one of the platform's own apps.`);
const dir = join(root, 'apps', id);
if (existsSync(dir)) fail(`apps/${id} already exists.`);
const name = nameAt >= 0 ? args[nameAt + 1] : titleCase(id);
if (!name) fail('--name needs a value.');

// The app works with the SDK as it is now, and any later 1.x.
const sdkVersion = JSON.parse(readFileSync(join(root, 'platform/packages/mfe-sdk/package.json'), 'utf8')).version;
const fill = (text) => text.replaceAll('__ID__', id).replaceAll('__NAME__', name).replaceAll('__SDK__', `^${sdkVersion}`);

cpSync(template, dir, { recursive: true });
const walk = (d) => {
  for (const entry of readdirSync(d)) {
    const path = join(d, entry);
    if (statSync(path).isDirectory()) walk(path);
    else writeFileSync(path, fill(readFileSync(path, 'utf8')));
  }
};
walk(dir);

writeFileSync(
  join(root, '.changeset', `new-app-${id}.md`),
  `---\n"@apps/${id}": minor\n"@apps/${id}-frontend": minor\n---\n\n${name}: a new app on the platform.\n`,
);

console.log(`Created apps/${id} and .changeset/new-app-${id}.md. Installing…`);
execFileSync('pnpm', ['install', '--no-frozen-lockfile'], { cwd: root, stdio: 'inherit' });
console.log(`
${name} is ready.

  pnpm dev:app ${id}        open it in a stand-in shell at http://localhost:5173/${id}
  pnpm --filter "@apps/${id}*" test

Next: docs/build-an-app.md`);
