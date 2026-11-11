import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { check, failOnPageErrors, press, reference } from './reference';

/**
 * Accessibility: axe on the real shell, on the desktop and its app bar, a start menu, the reference app
 * with the rail, and the stream, failing on any serious or critical finding (alpha goal 16, ADR 0063).
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function serious(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.impact} ${v.id}: ${v.help} at ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

failOnPageErrors();

test('the desktop and its app bar have nothing serious for axe, a page title and one main landmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'App bar', exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/AUGUR/);
  await expect(page.getByRole('main')).toHaveCount(1);
  expect(await serious(page)).toEqual([]);
});

test('an app has nothing serious for axe, and its name in the page title', async ({ page }) => {
  await page.goto(`/${reference.id}`);
  await expect(check(page, 'person')).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(reference.name));
  await expect(page.getByRole('main')).toHaveCount(1);
  expect(await serious(page)).toEqual([]);
});

// With Home on the desktop, Reference is the one app the bar offers, as a tile, so no start menu opens here.
test('the desktop, holding Home behind the logo button, has nothing serious for axe', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-app="home"]')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'App bar', exact: true }).locator('.aerie-bar-logo')).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

test('the stream has nothing serious for axe', async ({ page }) => {
  await page.goto(`/${reference.id}`);
  await press(page, 'Notify');
  await page.getByRole('button', { name: /notifications/i }).first().click();
  expect(await serious(page)).toEqual([]);
});
