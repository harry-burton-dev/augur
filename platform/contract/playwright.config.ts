import { defineConfig } from '@playwright/test';

/**
 * The real shell's dev server in its dev-app mode (signed in as a stand-in
 * person, the platform's endpoints answered in the browser) with the reference
 * app as its one app. run.mjs runs this once per build of the reference app,
 * side by side, each on its own port and with its own results folder.
 */
const port = Number(process.env.CONTRACT_PORT ?? 5180);
export default defineConfig({
  testDir: 'tests',
  outputDir: `test-results/${process.env.CONTRACT_TARGET ?? 'source'}`,
  timeout: 30_000,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    // Where a browser is already installed (PLAYWRIGHT_CHROMIUM), use it.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
  },
  webServer: {
    command: `pnpm --filter @augur/shell dev --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
