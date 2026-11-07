import { expect, test, type Page } from '@playwright/test';
import { folioOn, frozenBuild } from './builds';

/**
 * The app bar (PDR-020): on the desktop a bar of tiles, one per group of apps, each opening a start
 * menu; with an app open, the same bar docked as the rail, with Home, Apps, the open app and its pages.
 * Esc closes a start menu and never leaves an app; Home in the rail does. It checks the shell, not what
 * an app was built with, so it runs once, on today's build with Folio off.
 */
test.skip(frozenBuild !== undefined, 'The app bar is checked once, on today’s build.');
test.skip(folioOn, 'The app bar is checked once, with Folio off.');

const desk = (page: Page) => page.getByRole('navigation', { name: 'App bar', exact: true });
const rail = (page: Page) => page.getByRole('navigation', { name: 'App bar: Reference' });
const reference = (page: Page) => page.locator('[data-app="reference"]').first();

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test('the desktop shows the bar, and a group’s start menu opens an app beside the rail', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.aerie-shell')).toHaveAttribute('data-bar', 'desk');
  // Home and Reference have no category, so both are in Apps, a word from the shell, not the kit.
  await desk(page).getByRole('button', { name: 'Apps', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Apps' });
  await expect(menu.getByRole('menuitem')).toHaveText([/Home/, /Reference/]);
  await menu.getByRole('menuitem', { name: /Reference/ }).click();
  await expect(page).toHaveURL(/\/@me\/reference$/);
  await expect(reference(page).locator('[data-check="token"]')).toHaveText('ok');
  await expect(page.locator('.aerie-shell')).toHaveAttribute('data-bar', 'app');
  await expect(rail(page).getByRole('button', { name: 'Reference, you’re here' })).toBeVisible();
});

test('Esc closes a start menu and never leaves an app; Home in the rail goes back to the desktop', async ({ page }) => {
  await page.goto('/');
  await desk(page).getByRole('button', { name: 'Apps', exact: true }).press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);

  await page.goto('/reference');
  await expect(reference(page).locator('[data-check="token"]')).toHaveText('ok');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/@me\/reference$/);
  await expect(reference(page)).toHaveCount(1);
  await rail(page).getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/@me$/);
  await expect(reference(page)).toHaveCount(0);
  await expect(desk(page)).toBeVisible();
});

test('an app with no menu shows no page list in the rail', async ({ page }) => {
  await page.goto('/reference');
  await expect(rail(page)).toBeVisible();
  await expect(rail(page).locator('.aerie-bar-pages')).toHaveCount(0);
});

test('the bar keeps where it was moved to, through an app and back', async ({ page }) => {
  await page.goto('/');
  const grip = desk(page).getByRole('button', { name: /^Move the app bar/ });
  await grip.press('End');
  await expect(desk(page)).toContainText('App bar: bottom');
  const stop = () => page.evaluate(() => (document.querySelector('[data-shell]') as unknown as { shell: { settings: { barStop?: number } } }).shell.settings.barStop);
  expect(await stop()).toBe(3);
  await desk(page).getByRole('button', { name: 'Apps', exact: true }).click();
  await page.getByRole('menu').getByRole('menuitem', { name: /Reference/ }).click();
  await rail(page).getByRole('button', { name: 'Home', exact: true }).click();
  await expect(desk(page)).toContainText('App bar: bottom');
  expect(await stop()).toBe(3);
});

test('an address no app is at says so, and the bar still offers the way back', async ({ page }) => {
  await page.goto('/@me/nowhere');
  await expect(page.getByText('Nothing here')).toBeVisible();
  await expect(page.locator('.aerie-shell')).toHaveAttribute('data-bar', 'desk');
});
