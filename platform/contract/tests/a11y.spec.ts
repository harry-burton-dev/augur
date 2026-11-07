import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Accessibility: axe on the real shell, on the desktop and its app bar, a start menu, the reference app with the rail, and the stream, failing on any
 * serious or critical finding (alpha goal 16, ADR 0063). It checks the shell, not each SDK release, so it
 * runs once, on the reference app built from source with Folio off, inside the contract job.
 */
test.skip(process.env.CONTRACT_TARGET !== undefined && process.env.CONTRACT_TARGET !== 'source', 'Checked once, on the build from source.');
test.skip(process.env.CONTRACT_FOLIO === 'on', 'Checked once, with Folio off.');

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function serious(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.impact} ${v.id}: ${v.help} at ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test('the desktop and its app bar have nothing serious for axe, a page title and one main landmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'App bar', exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/AUGUR/);
  await expect(page.getByRole('main')).toHaveCount(1);
  expect(await serious(page)).toEqual([]);
});

test('an app has nothing serious for axe, and its name in the page title', async ({ page }) => {
  await page.goto('/reference');
  await expect(page.locator('[data-app="reference"] [data-check="token"]').first()).toHaveText('ok');
  await expect(page).toHaveTitle(/Reference/);
  await expect(page.getByRole('main')).toHaveCount(1);
  expect(await serious(page)).toEqual([]);
});

test('a start menu has nothing serious for axe', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'App bar', exact: true }).locator('.aerie-bar-tile').first().click();
  await expect(page.getByRole('menu')).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

test('the stream has nothing serious for axe', async ({ page }) => {
  await page.goto('/reference');
  await page.locator('[data-app="reference"] [data-action="notify"]').click();
  await page.getByRole('button', { name: /notifications/i }).first().click();
  expect(await serious(page)).toEqual([]);
});
