import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Local stand-in for where apps are hosted: /apps/<id>/* is served from that
 * app's built frontend. In the cloud each app is deployed on its own and the
 * registry's entry URL points there. APP_DIST lists extra apps as id=dir pairs.
 */
const appDirs: Record<string, string> = {
  home: fileURLToPath(new URL('../home/dist', import.meta.url)),
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

/** The shell's release, from its package.json, shown in Settings. */
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react(), serveApps()],
  define: { __SHELL_VERSION__: JSON.stringify(version) },
  server: {
    port: 5173,
    proxy: { '/api': process.env.GATEWAY_URL ?? 'http://localhost:8080' },
  },
});
