import { expect, test, type Page } from '@playwright/test';
import { folioOn, since } from './builds';

/**
 * Folio ships with AUGUR and is switched on in every deployment, but an admin can turn it off.
 * Either way the shell, Home, Find and other apps keep working: run.mjs runs every check with
 * Folio in the catalogue (its built frontend and its service) and without it, as when it's off.
 */
const reference = (page: Page) => page.locator('[data-app="reference"]').first();
const check = (page: Page, name: string) => reference(page).locator(`[data-check="${name}"]`);
const press = (page: Page, action: string) => reference(page).locator(`[data-action="${action}"]`).click();
const notifications = (page: Page) =>
  page.evaluate(() => (document.querySelector('ui-shell') as unknown as { notifications: { title: string }[] }).notifications.map((n) => n.title));

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test.describe('with Folio on', () => {
  test.skip(!folioOn, 'Folio is off in this run');

  test('Home places Folio’s card, from its own service, beside the other apps’', async ({ page }) => {
    await page.goto('/@me/home');
    const card = page.locator('[data-app="home"] [data-card="folio"]');
    await expect(card).toContainText('New to you');
    await expect(card.locator('ui-button', { hasText: 'Published to you' })).toBeVisible();
  });

  test('Folio opens at its address', async ({ page }) => {
    await page.goto('/@me/folio/libraries');
    await expect(page.locator('[data-app="folio"]')).toBeVisible();
    await expect(page.locator('[data-app="folio"] folio-app')).toHaveCount(1);
  });

  test('Folio (Artifacts) opens straight in with its own menu, keeps Esc, and the band goes to Title or Home', async ({ page }) => {
    await page.goto('/@me/folio');
    await expect(page.locator('[data-app="folio"] folio-app')).toHaveCount(1);
    await expect(page.locator('ui-centre-menu')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/@me\/folio$/);
    const band = page.locator('ui-shell');
    await band.getByRole('button', { name: 'All apps', exact: true }).click();
    await expect(page).toHaveURL(/\/@me$/);
    const title = page.locator('ui-centre-menu[variant="title"]');
    await expect(title).toBeVisible();
    // into an app from Title, then straight out to Home: the way out works after any way in
    await title.evaluate((menu: HTMLElement & { categories: { id?: string }[]; setCategory(i: number): void }) =>
      menu.setCategory(menu.categories.findIndex((c) => c.id === 'folio')),
    );
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-app="folio"] folio-app')).toHaveCount(1);
    await band.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/\/@me\/home$/);
    await expect(band.getByRole('button', { name: 'Home, you’re here' })).toBeVisible();
  });

  test('Title shows Folio (Artifacts), which has no areas, as itself, and choosing it opens it', async ({ page }) => {
    await page.goto('/');
    const title = page.locator('ui-centre-menu[variant="title"]');
    await expect(title).toBeVisible();
    await title.evaluate((menu: HTMLElement & { categories: { id?: string }[]; setCategory(i: number): void }) =>
      menu.setCategory(menu.categories.findIndex((c) => c.id === 'folio')),
    );
    await expect(title.locator('.catlabel')).toContainText('Artifacts');
    await expect(title.locator('.item')).toHaveCount(0);
    await expect(title.locator('.caption .title')).toHaveText('Artifacts');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/@me\/folio$/);
    await expect(page.locator('[data-app="folio"] folio-app')).toHaveCount(1);
  });

  test('an app opens a document, and Folio answers', async ({ page }) => {
    since('1.3');
    await page.goto('/reference');
    await press(page, 'open-document');
    await expect(page).toHaveURL(/\/@me\/folio(\/|$)/);
    await expect(page.locator('[data-app="folio"]')).toBeVisible();
  });

  test('an app asks for a document, and Folio’s picker opens over it', async ({ page }) => {
    since('1.3');
    await page.goto('/reference');
    await press(page, 'pick-document');
    const picker = page.locator('ui-dialog [data-app="folio"] folio-picker');
    await expect(picker).toBeVisible();
    await picker.locator('ui-button', { hasText: 'Cancel' }).click();
    await expect(check(page, 'picked')).toHaveText('cancelled');
  });
});

test.describe('with Folio off', () => {
  test.skip(folioOn, 'Folio is on in this run');

  test('Home carries on without Folio’s card', async ({ page }) => {
    since('1.2');
    await page.goto('/@me/home');
    await expect(page.locator('[data-app="home"] [data-card="reference"] [data-check="card"]')).toHaveText('Reference card on me');
    await expect(page.locator('[data-app="home"] [data-card="folio"]')).toHaveCount(0);
  });

  test('nothing is at Folio’s address', async ({ page }) => {
    await page.goto('/@me/folio');
    await expect(page.locator('[data-app="folio"]')).toHaveCount(0);
    await expect(page.getByText('Nothing here')).toBeVisible();
  });

  test('opening or picking a document says no app handles it, and the app carries on', async ({ page }) => {
    since('1.3');
    await page.goto('/reference');
    await press(page, 'open-document');
    await expect(check(page, 'opened')).toHaveText('no app');
    expect(await notifications(page)).toContain('No app you can open handles "document.open".');
    await press(page, 'pick-document');
    await expect(check(page, 'picked')).toHaveText('no app');
    await expect(check(page, 'token')).toHaveText('ok');
  });
});
