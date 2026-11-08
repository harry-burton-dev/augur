import { expect, test, type Page } from '@playwright/test';
import { check, failOnPageErrors, rail, reference } from './reference';

/**
 * The app bar (PDR-020): on the desktop a bar of tiles, one per group of apps, each opening a start
 * menu; with an app open, the same bar docked as the rail, with Home, Apps, the open app and its pages.
 * Esc closes a start menu and never leaves an app; Home in the rail does. The rail's pages are the
 * places the app's manifest declares (`contributes.places`), drawn before its code runs.
 */
const desk = (page: Page) => page.getByRole('navigation', { name: 'App bar', exact: true });
const app = (page: Page) => page.locator(`[data-app="${reference.id}"]`);
const { id, name } = reference;

failOnPageErrors();

test('the desktop shows the bar, and a group’s start menu opens an app beside the rail', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.aerie-shell')).toHaveAttribute('data-bar', 'desk');
  // Home and Reference have no category, so both are in Apps, a word from the shell, not the kit.
  await desk(page).getByRole('button', { name: 'Apps', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Apps' });
  await expect(menu.getByRole('menuitem')).toHaveText([/Home/, new RegExp(name)]);
  await menu.getByRole('menuitem', { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(new RegExp(`/@me/${id}$`));
  await expect(check(page, 'person')).toBeVisible();
  await expect(page.locator('.aerie-shell')).toHaveAttribute('data-bar', 'app');
  await expect(rail(page).getByRole('button', { name: `${name}, you’re here` })).toBeVisible();
});

test('Esc closes a start menu and never leaves an app; Home in the rail goes back to the desktop', async ({ page }) => {
  await page.goto('/');
  await desk(page).getByRole('button', { name: 'Apps', exact: true }).press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);

  await page.goto(`/${id}`);
  await expect(check(page, 'person')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(new RegExp(`/@me/${id}$`));
  await expect(check(page, 'person')).toBeVisible();
  await rail(page).getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/@me$/);
  await expect(app(page)).toHaveCount(0);
  await expect(desk(page)).toBeVisible();
});

test('the rail lists the places the app’s manifest declares, and each opens where it says', async ({ page }) => {
  await page.goto(`/${id}/somewhere`);
  await expect(check(page, 'path')).toContainText('/somewhere');
  const pages = rail(page).locator('.aerie-bar-pages');
  const places = reference.contributes.places;
  for (const place of places) await expect(pages.getByRole('button', { name: place.label })).toBeVisible();
  // A place with no path opens at its id; the one at `/` opens the app's root.
  const byId = places.find((p) => !p.path)!;
  const root = places.find((p) => p.path === '/')!;
  await pages.getByRole('button', { name: byId.label }).click();
  await expect(page).toHaveURL(new RegExp(`/@me/${id}/${byId.id}$`));
  await expect(check(page, 'path')).toContainText(`/${byId.id}`);
  await pages.getByRole('button', { name: root.label }).click();
  await expect(page).toHaveURL(new RegExp(`/@me/${id}$`));
});

test('the bar keeps where it was moved to, through an app and back', async ({ page }) => {
  await page.goto('/');
  const grip = desk(page).getByRole('button', { name: /^Move the app bar/ });
  await grip.press('End');
  await expect(desk(page)).toContainText('App bar: bottom');
  const stop = () => page.evaluate(() => (document.querySelector('[data-shell]') as unknown as { shell: { settings: { barStop?: number } } }).shell.settings.barStop);
  expect(await stop()).toBe(3);
  await desk(page).getByRole('button', { name: 'Apps', exact: true }).click();
  await page.getByRole('menu').getByRole('menuitem', { name: new RegExp(name) }).click();
  await rail(page).getByRole('button', { name: 'Home', exact: true }).click();
  await expect(desk(page)).toContainText('App bar: bottom');
  expect(await stop()).toBe(3);
});

test('an address no app is at says so, and the bar still offers the way back', async ({ page }) => {
  await page.goto('/@me/nowhere');
  await expect(page.getByText('Nothing here')).toBeVisible();
  await expect(page.locator('.aerie-shell')).toHaveAttribute('data-bar', 'desk');
});
