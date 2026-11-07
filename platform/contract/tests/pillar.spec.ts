import { expect, test, type Page } from '@playwright/test';
import { folioOn, frozenBuild } from './builds';

/**
 * Folio ships with AUGUR and is switched on in every deployment, but an admin can turn it off.
 * Either way the shell, Home, Find and other apps keep working: run.mjs runs every check with
 * Folio in the catalogue (its built frontend and its service) and without it, as when it's off.
 * These check the shell and Folio, not what an app was built with, so they run against today's
 * build of the reference app only; the frozen builds run beside Folio for tests/contract.spec.ts.
 */
test.skip(frozenBuild !== undefined, 'Folio’s checks run against today’s build of the reference app only');
/** Artifacts on screen, in its layout on Quill. */
const artifacts = (page: Page) => page.locator('[data-app="folio"]').locator('.quill-frame');
const reference = (page: Page) => page.locator('[data-app="reference"]').first();
const check = (page: Page, name: string) => reference(page).locator(`[data-check="${name}"]`);
const press = (page: Page, action: string) => reference(page).locator(`[data-action="${action}"]`).click();
const notifications = (page: Page) =>
  page.evaluate(() => ((document.querySelector('[data-shell]') as unknown as { shell: unknown }).shell as unknown as { notifications: { title: string }[] }).notifications.map((n) => n.title));

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
    await expect(card.getByRole('button', { name: 'Published to you' })).toBeVisible();
  });

  test('Folio opens at its address', async ({ page }) => {
    await page.goto('/@me/folio/libraries');
    await expect(page.locator('[data-app="folio"]')).toBeVisible();
    await expect(artifacts(page)).toHaveCount(1);
  });

  test('Folio (Artifacts) opens straight in, keeps Esc, and Home in the rail goes back to the desktop', async ({ page }) => {
    await page.goto('/@me/folio');
    await expect(artifacts(page)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/@me\/folio$/);
    await expect(artifacts(page)).toHaveCount(1);
    await page.getByRole('navigation', { name: /^App bar: / }).getByRole('button', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/\/@me$/);
    await expect(page.getByRole('navigation', { name: 'App bar', exact: true })).toBeVisible();
  });

  test('the desktop’s app bar puts Folio (Artifacts) under Pillars, and choosing it opens it', async ({ page }) => {
    await page.goto('/');
    const bar = page.getByRole('navigation', { name: 'App bar', exact: true });
    await bar.getByRole('button', { name: 'Pillars', exact: true }).click();
    await page.getByRole('menu').getByRole('menuitem', { name: /Artifacts/ }).click();
    await expect(page).toHaveURL(/\/@me\/folio$/);
    await expect(artifacts(page)).toHaveCount(1);
  });

  test('an app opens a document, and Folio answers', async ({ page }) => {
    await page.goto('/reference');
    await press(page, 'open-document');
    await expect(page).toHaveURL(/\/@me\/folio(\/|$)/);
    await expect(page.locator('[data-app="folio"]')).toBeVisible();
  });

  test('an app asks for a document, and Folio’s picker opens over it', async ({ page }) => {
    await page.goto('/reference');
    await press(page, 'pick-document');
    const picker = page.locator('.augur-dialog [data-app="folio"] [data-folio-picker]');
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: 'Cancel' }).click();
    await expect(check(page, 'picked')).toHaveText('cancelled');
  });
});

test.describe('with Folio off', () => {
  test.skip(folioOn, 'Folio is on in this run');

  test('Home carries on without Folio’s card', async ({ page }) => {
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
    await page.goto('/reference');
    await press(page, 'open-document');
    await expect(check(page, 'opened')).toHaveText('no app');
    expect(await notifications(page)).toContain('No app you can open handles "document.open".');
    await press(page, 'pick-document');
    await expect(check(page, 'picked')).toHaveText('no app');
    await expect(check(page, 'token')).toHaveText('ok');
  });
});
