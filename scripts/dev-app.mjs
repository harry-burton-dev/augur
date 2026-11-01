// Runs one app in a stand-in shell: the real shell and kit, signed in as a
// stand-in person, with the app's frontend from source and its service beside it.
//   pnpm dev:app <id>                      then open http://localhost:5173/<id>
//   DEV_ROLES=admin pnpm dev:app <id>      the stand-in person also has these roles
//   APP_SERVICE_PORT=8091 pnpm dev:app <id>
//   pnpm dev:app <id> --kit                also rebuilds the UI kit and its tokens as you change them, and reloads the page
//   DEV_PREVIEWS=all pnpm dev:app <id>     turns the app's feature previews on (or name them, comma separated)
//   DEV_HOST=0.0.0.0 pnpm dev:app <id>     open to other machines on the tailnet (*.ts.net), such as your phone
//   pnpm dev:app <id> --live               Live on the workbench: the workbench's shell loads the app's frontend from
//                                          here, for you alone (docs/release-channels.md, "Live on the workbench")
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const id = process.argv[2];
const kit = process.argv.includes('--kit');
const live = process.argv.includes('--live');
// pnpm is a .cmd shim on Windows, which only runs through a shell.
const windows = process.platform === 'win32';
const dir = id && join(root, 'apps', id);
if (!dir || !existsSync(join(dir, 'manifest.json')) || !existsSync(join(dir, 'frontend/src/entry.ts'))) {
  console.error(`✗ Usage: pnpm dev:app <id>, where apps/<id> has a manifest.json and frontend/src/entry.ts.`);
  process.exit(1);
}

// What the shell is built from (the SDK, the kit), so the stand-in uses the real thing, and Home, where the app's glance card goes.
execFileSync('pnpm', ['turbo', 'run', 'build', '--filter=@augur/shell^...', '--filter=@augur/home', '--output-logs=errors-only'], { cwd: root, stdio: 'inherit', shell: windows });

const port = process.env.APP_SERVICE_PORT ?? '8090';
const children = [];
const run = (args, env) => {
  const child = spawn('pnpm', args, { cwd: root, stdio: 'inherit', shell: windows, env: { ...process.env, ...env } });
  children.push(child);
  child.on('exit', (code) => {
    children.forEach((c) => c !== child && c.kill());
    process.exit(code ?? 0);
  });
};

const servicePkg = join(dir, 'service/package.json');
if (existsSync(servicePkg)) {
  const { name } = JSON.parse(readFileSync(servicePkg, 'utf8'));
  // No REGISTRY_URL or sign-in: the stand-in shell lists the app itself.
  run(['--filter', name, 'dev'], { PORT: port, REGISTRY_URL: '', SERVICE_CLIENT_SECRET: '' });
}
if (kit) {
  // Tokens, then the kit's TypeScript, then the shared modules the shell serves: each rebuilds when the one before changes.
  run(['--filter', '@augur/kit-common', 'exec', 'node', '--watch-path=tokens', 'scripts/build-tokens.mjs']);
  run(['--filter', '@augur/ui-kit', 'exec', 'tsc', '-p', 'tsconfig.json', '--watch', '--preserveWatchOutput']);
  run(['--filter', '@augur/shell', 'exec', 'vite', 'build', '-c', 'vite.shared.config.ts', '--mode', 'development', '--watch']);
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
      `     https://${host}/@fs${join(dir, 'frontend/src/entry.ts')}`,
      '  Only you see it, with the real sign-in, floors and data. Save a file and it reloads. Previews, Back to … stops it.',
      '',
    ].join('\n'),
  );
}
run(['--filter', '@augur/shell', 'dev'], { DEV_APP: dir, APP_SERVICE_URL: `http://localhost:${port}`, ...(kit ? { DEV_KIT: 'watch' } : {}), ...liveEnv });
process.on('SIGINT', () => children.forEach((c) => c.kill('SIGINT')));
