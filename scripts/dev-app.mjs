// Runs one app in a stand-in shell: the real shell and kit, signed in as a
// stand-in person, with the app's frontend from source and its service beside it.
//   pnpm dev:app <id>                      then open http://localhost:5173/<id>
//   DEV_ROLES=admin pnpm dev:app <id>      the stand-in person also has these roles
//   APP_SERVICE_PORT=8091 pnpm dev:app <id>
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const id = process.argv[2];
const dir = id && join(root, 'apps', id);
if (!dir || !existsSync(join(dir, 'manifest.json')) || !existsSync(join(dir, 'frontend/src/entry.ts'))) {
  console.error(`✗ Usage: pnpm dev:app <id>, where apps/<id> has a manifest.json and frontend/src/entry.ts.`);
  process.exit(1);
}

// What the shell is built from (the SDK, the kit), so the stand-in uses the real thing.
execFileSync('pnpm', ['turbo', 'run', 'build', '--filter=@platform/shell^...', '--output-logs=errors-only'], { cwd: root, stdio: 'inherit' });

const port = process.env.APP_SERVICE_PORT ?? '8090';
const children = [];
const run = (args, env) => {
  const child = spawn('pnpm', args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  children.push(child);
  child.on('exit', (code) => {
    children.forEach((c) => c !== child && c.kill());
    process.exit(code ?? 0);
  });
};

const servicePkg = join(dir, 'service/package.json');
if (existsSync(servicePkg)) {
  const { name } = JSON.parse(readFileSync(servicePkg, 'utf8'));
  // No REGISTRY_URL or SERVICE_TOKEN: the stand-in shell lists the app itself.
  run(['--filter', name, 'dev'], { PORT: port, REGISTRY_URL: '', SERVICE_TOKEN: '' });
}
run(['--filter', '@platform/shell', 'dev'], { DEV_APP: dir, APP_SERVICE_URL: `http://localhost:${port}` });
process.on('SIGINT', () => children.forEach((c) => c.kill('SIGINT')));
