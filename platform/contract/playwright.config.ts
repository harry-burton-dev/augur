import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * The real shell's dev server in its dev-app mode (signed in as a stand-in
 * person, the platform's endpoints answered in the browser) with the reference
 * app as its one app. run.mjs runs this once per build of the reference app,
 * side by side, each on its own port and with its own results folder.
 */
const port = Number(process.env.CONTRACT_PORT ?? 5180);
// With CONTRACT_FOLIO=on, Folio (which ships with AUGUR) is in the catalogue too: its built frontend,
// and its service on this port, keeping everything in memory.
const folioPort = process.env.CONTRACT_FOLIO === 'on' ? Number(process.env.CONTRACT_FOLIO_PORT ?? 8190) : undefined;
export default defineConfig({
  testDir: 'tests',
  outputDir: `test-results/${process.env.CONTRACT_TARGET ?? 'source'}${folioPort ? '-folio' : ''}`,
  timeout: 30_000,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    // Where a browser is already installed (PLAYWRIGHT_CHROMIUM), use it.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
  },
  webServer: [
    {
      command: `pnpm --filter @augur/shell dev --port ${port} --strictPort`,
      url: `http://localhost:${port}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: { ...(process.env as Record<string, string>), ...(folioPort ? { DEV_ALSO: `${resolve('../../apps/folio')}=http://localhost:${folioPort}` } : {}) },
    },
    ...(folioPort
      ? [
          {
            command: 'node ../../apps/folio/service/dist/index.js',
            url: `http://localhost:${folioPort}/healthz`,
            reuseExistingServer: false,
            timeout: 60_000,
            stdout: 'ignore' as const,
            stderr: 'pipe' as const,
            env: { ...(process.env as Record<string, string>), PORT: String(folioPort), NODE_ENV: 'development' },
          },
        ]
      : []),
  ],
});
