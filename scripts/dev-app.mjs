// Runs one app in a stand-in shell: the real shell and kit, signed in as a
// stand-in person, with the app's frontend from source and its service beside it.
//   pnpm dev:app <id>                      an app in apps/<id>; then open http://localhost:5173/<id>
//   pnpm dev:app ../augur-<id>             an app in its own repository, made from augur-app-template
//   DEV_ROLES=admin pnpm dev:app <id>      the stand-in person also has these roles
//   APP_SERVICE_PORT=8091 pnpm dev:app <id>
//   DEV_PREVIEWS=all pnpm dev:app <id>     turns the app's feature previews on (or name them, comma separated)
//   DEV_HOST=0.0.0.0 pnpm dev:app <id>     open to other machines on the tailnet (*.ts.net), such as your phone
//   pnpm dev:app <id> --live               Live on the workbench: the workbench's shell loads the app's frontend from
//                                          here, for you alone (docs/release-channels.md, "Live on the workbench")
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const arg = process.argv[2];
const live = process.argv.includes('--live');
// pnpm is a .cmd shim on Windows, which only runs through a shell.
const windows = process.platform === 'win32';
// An app's own repository is named by its path (it has a slash, or starts with a dot); an app in apps/ by its id.
// INIT_CWD is where `pnpm dev:app` was typed, so a relative path means what it says there.
const dir = arg && (isAbsolute(arg) || /[\\/]|^\./.test(arg) ? resolve(process.env.INIT_CWD ?? process.cwd(), arg) : join(root, 'apps', arg));
const entry = dir && ['frontend/src/entry.tsx', 'frontend/src/entry.ts'].map((e) => join(dir, e)).find((e) => existsSync(e));
if (!dir || !existsSync(join(dir, 'manifest.json')) || !entry) {
  console.error(`✗ Usage: pnpm dev:app <id or path>: apps/<id>, or an app's own repository, with a manifest.json and frontend/src/entry.tsx (or entry.ts).`);
  process.exit(1);
}
if (process.argv.includes('--kit')) {
  // The Lit kit it rebuilt went with SDK 2. The kits (Common, Quill, Aerie) are in the augur-kit repository.
  console.error('✗ --kit is gone: the kits are in the augur-kit repository. Work on them in its Storybook, then bump the kit here.');
  process.exit(1);
}
const { id } = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

// What the shell is built from (the SDK, the kit), so the stand-in uses the real thing, and Home, where the app's glance card goes.
execFileSync('pnpm', ['turbo', 'run', 'build', '--filter=@augur/shell^...', '--filter=@augur/home', '--output-logs=errors-only'], { cwd: root, stdio: 'inherit', shell: windows });

const port = process.env.APP_SERVICE_PORT ?? '8090';
const children = [];
const run = (args, env, cwd = root) => {
  const child = spawn('pnpm', args, { cwd, stdio: 'inherit', shell: windows, env: { ...process.env, ...env } });
  children.push(child);
  child.on('exit', (code) => {
    children.forEach((c) => c !== child && c.kill());
    process.exit(code ?? 0);
  });
};

// The service's own dev script, in its own folder: in this workspace or in the app's own repository.
if (existsSync(join(dir, 'service/package.json'))) {
  // No REGISTRY_URL or sign-in: the stand-in shell lists the app itself, and sends its stand-in person as plain
  // x-user-* headers, which the service believes only because it is told to here.
  run(['dev'], { PORT: port, REGISTRY_URL: '', SERVICE_CLIENT_SECRET: '', AUGUR_INSECURE_DEV_CALLERS: '1' }, join(dir, 'service'));
}
// Live on the workbench: this machine's name on the tailnet, which `tailscale serve` answers on with https.
let liveEnv = {};
if (live) {
  let host = process.env.DEV_LIVE_HOST;
  if (!host) {
    try {
      host = JSON.parse(execFileSync('tailscale', ['status', '--json'], { encoding: 'utf8' })).Self?.DNSName?.replace(/\.$/, '');
    } catch {
      // No tailscale CLI here: say how to name it.
    }
  }
  if (!host) {
    console.error('✗ --live needs this machine’s name on the tailnet. Install Tailscale, or set DEV_LIVE_HOST=<machine>.<tailnet>.ts.net.');
    process.exit(1);
  }
  liveEnv = { DEV_HOST: process.env.DEV_HOST ?? '0.0.0.0', DEV_LIVE_HOST: host };
  console.log(
    [
      '',
      'Live on the workbench:',
      '  1. Once, in another terminal: tailscale serve --bg 5173',
      `  2. On the workbench, open the shell's Previews, find ${id}, and paste into "Live from my machine":`,
      `     https://${host}/@fs${entry}`,
      '  Only you see it, with the real sign-in, floors and data. Save a file and it reloads. Previews, Back to … stops it.',
      '',
    ].join('\n'),
  );
}
run(['--filter', '@augur/shell', 'dev'], { DEV_APP: dir, APP_SERVICE_URL: `http://localhost:${port}`, ...liveEnv });
process.on('SIGINT', () => children.forEach((c) => c.kill('SIGINT')));
