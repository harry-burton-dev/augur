import { createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kitDir, readKit } from '@augur/kit-bundle';
import { isSharedModule } from '@augur/mfe-sdk/build';
import react from '@vitejs/plugin-react';
import { defineConfig, normalizePath, type Plugin, type ProxyOptions } from 'vite';

/**
 * Local stand-in for where apps are hosted: /apps/<id>/* is served from that
 * app's built frontend. In the cloud each app is deployed on its own and the
 * registry's entry URL points there. APP_DIST lists extra apps as id=dir pairs.
 */
/**
 * DEV_ALSO: other apps beside the one `pnpm dev:app` opens, as `<app folder>=<its service's url>`
 * pairs, comma separated. Each is served from its built frontend and put in the stand-in's catalogue.
 * The contract tests use it to run the reference app beside an app that ships with AUGUR.
 */
const devAlso = (process.env.DEV_ALSO ?? '')
  .split(',')
  .map((pair) => pair.trim())
  .filter(Boolean)
  .map((pair) => {
    const dir = resolve(pair.slice(0, pair.indexOf('=')));
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { id: string; [key: string]: unknown };
    return { manifest, dist: join(dir, 'frontend', 'dist'), service: pair.slice(pair.indexOf('=') + 1) };
  });

const appDirs: Record<string, string> = {
  home: fileURLToPath(new URL('../home/dist', import.meta.url)),
  admin: fileURLToPath(new URL('../admin/dist', import.meta.url)),
  ...Object.fromEntries(devAlso.map((a) => [a.manifest.id, a.dist])),
  ...Object.fromEntries(
    (process.env.APP_DIST ?? '')
      .split(',')
      .map((pair) => pair.trim().split('='))
      .filter(([id, dir]) => id && dir)
      .map(([id, dir]) => [id, resolve(dir)]),
  ),
};

const serveApps = (): Plugin => ({
  name: 'serve-apps',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const m = req.url?.match(/^\/apps\/([\w-]+)\/([^?]*)/);
      const dir = m && appDirs[m[1]];
      if (!m || !dir) return next();
      const file = normalize(join(dir, m[2]));
      if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
        res.statusCode = 404;
        return res.end();
      }
      res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
      createReadStream(file).pipe(res);
    });
  },
});

/**
 * What the shell and every app share through the import map at the top of index.html (ADR 0003):
 *
 * - React, Common and Quill come from the kit bundle (@augur/kit-bundle, ADR 0048). The built page
 *   names them under the kit URL as a placeholder, `@KIT_URL@<version>/`, which the web container fills
 *   in from KIT_URL when it starts (infra/deploy/kit-url.envsh), with each file's hash as its integrity.
 *   The build also copies the bundle into kit/<version>/, where KIT_URL points by default (/kit/), and
 *   writes index.html with that default and index.template.html with the placeholder.
 * - Lit and the Lit kit come from shared-build/ (built by vite.shared.config.ts), served at /shared/.
 *
 * In dev both are served from where they were built (the kit from its development build), and the
 * shell's own imports of them resolve to those same files rather than to Vite's copies.
 */
export const KIT_URL_PLACEHOLDER = '@KIT_URL@';
const kit = readKit();
const sharedModulesMap = (): Plugin => {
  const dir = fileURLToPath(new URL('./shared-build/', import.meta.url));
  let dev = false;
  let outDir = 'dist';
  const shared = () => {
    const file = join(dir, 'importmap.json');
    if (!existsSync(file)) throw new Error('shared-build/ is missing: run `pnpm --filter @augur/shell build:shared` first.');
    const { imports } = JSON.parse(readFileSync(file, 'utf8')) as { imports: Record<string, string> };
    return dev ? Object.fromEntries(Object.entries(imports).map(([s, url]) => [s, url.replace(/^\/shared\//, '/shared-build/')])) : imports;
  };
  const kitBase = () => `${dev ? '/kit/' : KIT_URL_PLACEHOLDER}${kit.version}/`;
  const kitBuild = () => (dev ? kit.dev : kit);
  const importMap = () => {
    const base = kitBase();
    const kitImports = Object.fromEntries(Object.entries(kitBuild().imports).map(([s, file]) => [s, `${base}${file}`]));
    // Every module of the bundle, chunks too, is held to its hash: a kit URL that serves anything else is refused.
    const integrity = dev
      ? undefined
      : Object.fromEntries(Object.entries(kit.integrity).filter(([file]) => file.endsWith('.js') && !file.startsWith('dev/')).map(([file, hash]) => [`${base}${file}`, hash]));
    // shared-build/ comes last: in production it serves react/jsx-dev-runtime in place of the kit's (vite.shared.config.ts).
    return { imports: { ...kitImports, ...shared() }, ...(integrity ? { integrity } : {}) };
  };
  return {
    name: 'shared-modules',
    enforce: 'pre',
    // `pnpm dev:app <id> --kit` rebuilds the Lit kit and shared-build/ as they change: the page reloads with the new import map.
    configureServer(server) {
      // The kit bundle, as the web image serves it at /kit/.
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/^\/kit\/([^/]+)\/([^?]*)/);
        if (!m || m[1] !== kit.version) return next();
        const file = normalize(join(kitDir, m[2]));
        if (!file.startsWith(normalize(kitDir)) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/json');
        createReadStream(file).pipe(res);
      });
      if (process.env.DEV_KIT !== 'watch') return;
      const map = join(dir, 'importmap.json');
      server.watcher.add(map);
      server.watcher.on('change', (file) => file === map && server.ws.send({ type: 'full-reload' }));
    },
    config: (_config, { command }) => {
      dev = command === 'serve';
      return dev
        ? // Aerie and the kit stay out of Vite's pre-bundled deps, so their imports of React resolve
          // to the kit's own files (resolveId, below), not to a second copy of React bundled in.
          { optimizeDeps: { exclude: ['@augur/shell-kit', '@augur/kit-common', '@augur/app-kit'] } }
        : { build: { rollupOptions: { external: isSharedModule } } };
    },
    configResolved: (config) => {
      outDir = resolve(config.root, config.build.outDir);
    },
    resolveId(id) {
      if (!dev || !isSharedModule(id)) return;
      const fromKit = kit.dev.imports[id];
      return fromKit ? join(kitDir, fromKit) : join(dir, shared()[id].slice('/shared-build/'.length));
    },
    generateBundle() {
      for (const fileName of readdirSync(dir)) this.emitFile({ type: 'asset', fileName: `shared/${fileName}`, source: readFileSync(join(dir, fileName)) });
      // The production bundle, where the default KIT_URL (/kit/) finds it. Its development build stays out.
      for (const file of Object.keys(kit.integrity).filter((f) => !f.startsWith('dev/'))) {
        this.emitFile({ type: 'asset', fileName: `kit/${kit.version}/${file}`, source: readFileSync(join(kitDir, file)) });
      }
      this.emitFile({ type: 'asset', fileName: `kit/${kit.version}/kit.json`, source: readFileSync(join(kitDir, 'kit.json')) });
    },
    transformIndexHtml: () => {
      const base = kitBase();
      return [
        { tag: 'script', attrs: { type: 'importmap' }, children: JSON.stringify(importMap()), injectTo: 'head-prepend' },
        // Where the kit is, for the shell to show (Settings, About) and to name when it can't be loaded.
        { tag: 'meta', attrs: { name: 'augur-kit', content: JSON.stringify({ version: kit.version, url: base }) }, injectTo: 'head-prepend' },
        ...kitBuild().styles.map((file) => ({
          tag: 'link',
          attrs: { rel: 'stylesheet', href: `${base}${file}`, ...(dev ? {} : { integrity: kit.integrity[file], crossorigin: 'anonymous' }) },
          injectTo: 'head-prepend' as const,
        })),
        { tag: 'script', children: KIT_FAILED, injectTo: 'head-prepend' },
      ];
    },
    // index.template.html keeps the placeholder for the web container; index.html has the default, /kit/.
    writeBundle() {
      const page = join(outDir, 'index.html');
      if (dev || !existsSync(page)) return;
      const html = readFileSync(page, 'utf8');
      writeFileSync(join(outDir, 'index.template.html'), html);
      writeFileSync(page, html.replaceAll(KIT_URL_PLACEHOLDER, '/kit/'));
    },
  };
};

/**
 * If the shell's code or the kit can't be loaded, nothing of the shell runs, so a small script in the
 * page says why instead of leaving it blank, and names the setting and who can change it.
 */
const KIT_FAILED = `addEventListener('error',function(e){var t=e.target,m=document.querySelector('meta[name="augur-kit"]');if(!m||!t||!(t.tagName==='SCRIPT'&&t.type==='module'||t.tagName==='LINK'&&t.rel==='stylesheet'))return;if(document.getElementById('augur-kit-failed'))return;var k=JSON.parse(m.content),p=document.createElement('p');p.id='augur-kit-failed';p.setAttribute('role','alert');p.style.cssText='font:16px/1.5 system-ui,sans-serif;max-width:40em;margin:4em auto;padding:0 1em';p.textContent='AUGUR could not load its UI kit '+k.version+' from '+k.url+': the address could not be reached, or what it sent was not the kit this release pinned. A deployment admin can change KIT_URL in the .env file on the server.';(document.body||document.documentElement).appendChild(p)},true);`;

/**
 * `pnpm dev:app <id>` sets DEV_APP to the app's folder: the shell opens with
 * src/dev-app.tsx instead of main.tsx, signed in as a stand-in person, with the
 * app's source as its entry. Calls to /api/<id> go to the app's service (at
 * APP_SERVICE_URL) carrying that person, as the gateway would send them.
 */
/** The stand-in's floors, as src/dev-app/standin.ts gives them to the shell. */
const DEV_FLOORS: Record<string, { kind: string; role: string }> = { 'dev-me': { kind: 'personal', role: 'lead' }, 'dev-org': { kind: 'org', role: 'member' } };

const devApp = (dir: string | undefined) => {
  if (!dir) return undefined;
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { id: string; [key: string]: unknown };
  const roles = (process.env.DEV_ROLES ?? '').split(',').map((r) => r.trim()).filter(Boolean);
  // DEV_APP_ENTRY serves a built entry instead of the source (the contract tests mount frozen builds).
  // DEV_PREVIEWS turns the app's feature previews on for the stand-in person: ids, comma separated, or `all`.
  const previews = ((manifest.previews ?? []) as { id: string }[]).map((p) => p.id);
  const asked = (process.env.DEV_PREVIEWS ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  const previewsOn = asked.includes('all') ? previews : previews.filter((p) => asked.includes(p));
  const app = { ...manifest, entry: process.env.DEV_APP_ENTRY ?? `/@fs/${normalizePath(resolve(dir, 'frontend/src/entry.ts')).replace(/^\//, '')}`, ...(previewsOn.length ? { previewsOn } : {}) };
  const caller = {
    'x-user-id': 'dev-person',
    'x-user-name': encodeURIComponent('Dev Person'),
    'x-user-email': encodeURIComponent('dev.person@example.test'),
    'x-user-departments': 'Development',
    'x-user-roles': [...roles, ...(typeof manifest.requiredRole === 'string' ? [manifest.requiredRole] : [])].map(encodeURIComponent).join(','),
  };
  const plugin: Plugin = {
    name: 'dev-app',
    apply: 'serve',
    transformIndexHtml: (html) => html.replace('/src/main.tsx', '/src/dev-app.tsx'),
  };
  /** Sends /api/<id> to an app's service carrying the stand-in person, as the gateway would. */
  const proxyTo = (id: string, target: string): Record<string, ProxyOptions> => ({
    [`/api/${id}`]: {
      target,
      rewrite: (path: string) => path.slice(`/api/${id}`.length) || '/',
      headers: caller,
      // The gateway checks the floor an app names and says what it is and the person's role
      // there; the stand-in does the same for its own floors (devFloors in src/dev-app/standin.ts).
      configure: (proxy) =>
        proxy.on('proxyReq', (req) => {
          req.removeHeader('x-workspace-kind');
          req.removeHeader('x-workspace-role');
          const floor = DEV_FLOORS[String(req.getHeader('x-workspace-id') ?? '')];
          if (!floor) {
            req.removeHeader('x-workspace-id');
            return;
          }
          req.setHeader('x-workspace-kind', floor.kind);
          req.setHeader('x-workspace-role', floor.role);
        }),
    },
  });
  return {
    plugin,
    define: { __DEV_APP__: JSON.stringify(app), __DEV_ALSO__: JSON.stringify(devAlso.map((a) => a.manifest)), __DEV_ROLES__: JSON.stringify(roles) },
    proxy: {
      ...proxyTo(manifest.id, process.env.APP_SERVICE_URL ?? 'http://localhost:8090'),
      ...Object.assign({}, ...devAlso.map((a) => proxyTo(a.manifest.id, a.service))),
    },
  };
};

/** The shell's release, from its package.json, shown in Settings. */
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const dev = devApp(process.env.DEV_APP);

export default defineConfig({
  plugins: [sharedModulesMap(), react(), serveApps(), dev?.plugin],
  define: { __SHELL_VERSION__: JSON.stringify(version), ...dev?.define },
  server: {
    port: 5173,
    // DEV_HOST=0.0.0.0 opens it to other machines, such as your phone or the preview server, on the tailnet (*.ts.net) or DEV_ALLOWED_HOSTS.
    ...(process.env.DEV_HOST
      ? { host: process.env.DEV_HOST, allowedHosts: ['.ts.net', ...(process.env.DEV_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean)] }
      : {}),
    // Live on the workbench (`pnpm dev:app <id> --live`): the workbench's shell loads the app's entry from
    // here, through `tailscale serve` at https://<DEV_LIVE_HOST>, so its pages on *.ts.net may fetch it, and
    // the reload socket goes back to this machine rather than to the page's own address.
    ...(process.env.DEV_LIVE_HOST
      ? { cors: { origin: /^https:\/\/[a-z0-9.-]+\.ts\.net$/ }, hmr: { host: process.env.DEV_LIVE_HOST, protocol: 'wss', clientPort: 443 } }
      : {}),
    // The app's own service first: the first matching prefix wins.
    proxy: { ...dev?.proxy, '/api': process.env.GATEWAY_URL ?? 'http://localhost:8080' },
  },
});
