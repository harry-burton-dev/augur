import { chromium, type FullConfig } from '@playwright/test';
import { check, reference } from './tests/reference';

/**
 * Opens the reference app once before any test, so the shell's dev server has compiled the shell, the
 * kit and the app before the first test's clock starts. A cold Vite server takes longer than a test's
 * checks wait, and on a busy runner the first test failed on its first check (PER-322).
 */
export default async function warm(config: FullConfig) {
  const { baseURL, launchOptions } = config.projects[0]!.use;
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage({ baseURL });
    // The reference app draws its checks as notices, from its worker.
    await page.goto(`/${reference.id}`);
    await check(page, 'person').waitFor({ timeout: 120_000 });
  } finally {
    await browser.close();
  }
}
