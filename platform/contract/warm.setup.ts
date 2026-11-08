import { chromium, type FullConfig } from '@playwright/test';

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
    // The reference app on the contract draws its checks as notices, from its worker.
    const three = process.env.CONTRACT_TARGET === 'contract-3';
    await page.goto(three ? '/reference3' : '/reference');
    await page.locator(three ? '[data-app="reference3"] .augur-notice' : '[data-app="reference"] [data-check="user"]').first().waitFor({ timeout: 120_000 });
  } finally {
    await browser.close();
  }
}
