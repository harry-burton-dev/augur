import { expect, test, type Page } from '@playwright/test';

/**
 * What the shell promises every app through the SDK's mount context. Each test
 * opens the reference app in the real shell and checks one part of it.
 */
const app = (page: Page) => page.locator('[data-app="reference"]').first();
const check = (page: Page, name: string) => app(page).locator(`[data-check="${name}"]`);
const press = (page: Page, action: string) => app(page).locator(`[data-action="${action}"]`).click();

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test('mounts with the signed-in person, the path below its route and a token', async ({ page }) => {
  await page.goto('/reference/claims/42');
  await expect(check(page, 'user')).toHaveText('Dev Person (dev-person) Development');
  await expect(check(page, 'path')).toHaveText('/claims/42');
  await expect(check(page, 'token')).toHaveText('ok');
  await expect(check(page, 'intent')).toHaveText('none');
});

test('notify puts a notification on the shell’s stream', async ({ page }) => {
  await page.goto('/reference');
  await press(page, 'notify');
  const titles = await page.evaluate(() =>
    (document.querySelector('ui-shell') as unknown as { notifications: { title: string; level: string }[] }).notifications.map((n) => `${n.title}:${n.level}`),
  );
  expect(titles).toContain('Reference notification:needs');
});

test('raise opens the app that handles the intent, with the intent', async ({ page }) => {
  await page.goto('/reference/somewhere');
  await press(page, 'raise');
  await expect(check(page, 'intent')).toHaveText('reference.show {"n":1}');
  await expect(page).toHaveURL(/\/reference$/);
});

test('request opens the handling app over this one and resolves with its answer', async ({ page }) => {
  await page.goto('/reference');
  await press(page, 'request');
  const answering = page.locator('ui-dialog [data-app="reference"]');
  await expect(answering.locator('[data-check="intent"]')).toHaveText('reference.answer {"question":"six times seven"}');
  await answering.locator('[data-action="respond"]').click();
  await expect(check(page, 'answer')).toHaveText('42');
});

test('a request the handler declines rejects as cancelled', async ({ page }) => {
  await page.goto('/reference');
  await press(page, 'request');
  await page.locator('ui-dialog [data-app="reference"] [data-action="cancel"]').click();
  await expect(check(page, 'answer')).toHaveText('cancelled');
});

test('the event bus carries events within the page', async ({ page }) => {
  await page.goto('/reference');
  await press(page, 'emit');
  await expect(check(page, 'bus')).toHaveText('pong');
});

test('leaving the app unmounts it', async ({ page }) => {
  await page.goto('/reference');
  await expect(check(page, 'token')).toHaveText('ok');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.referenceUnmounts ?? 0)).toBe(1);
  await expect(app(page)).toHaveCount(0);
});
