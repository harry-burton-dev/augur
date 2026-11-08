import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

/**
 * The real shell's dev server in its dev-app mode (signed in as a stand-in
 * person, the platform's endpoints answered in the browser) with the reference
 * app as its one app, served from source. The manifest's feature preview
 * `turned-on` is on for the stand-in person and `left-off` off. Each can be
 * set from outside (DEV_APP, DEV_PREVIEWS, CONTRACT_PORT), as for another app.
 */
process.env.DEV_APP ??= fileURLToPath(new URL('reference-app', import.meta.url));
process.env.DEV_PREVIEWS ??= 'turned-on';
const port = Number(process.env.CONTRACT_PORT ?? 5180);
export default defineConfig({
  testDir: 'tests',
  outputDir: 'test-results',
  timeout: 30_000,
  // Each check waits for a state; on a busy runner the shell can take longer than Playwright's 5 seconds to get there (PER-322).
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
  // Warms the dev server before the first test (warm.setup.ts).
  globalSetup: './warm.setup.ts',
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
      env: { ...(process.env as Record<string, string>) },
    },
  ],
});
