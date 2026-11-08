import { expect, test, type Page } from '@playwright/test';
import { frozenBuild } from './builds';

/**
 * The Inbox (SDK 1.12, ADR 0026): what the shell promises an app that puts work in people's inboxes.
 * The kind's words come from the app's manifest (`inbox.kinds`), and Open raises the item's intent to
 * the app as a notification's button does. Items come from the stand-in inbox in the dev-app mode
 * (`augur:dev-inbox-item`), as an app's service would put them. They check the shell, not what the app was
 * built with, so they run against today's build once.
 */
test.skip(frozenBuild !== undefined, 'The Inbox’s checks run against today’s build, once');

const check = (page: Page, name: string) => page.locator('[data-app="reference"]').first().locator(`[data-check="${name}"]`);
const shell = (page: Page) => page.waitForFunction(() => Boolean((document.querySelector('[data-shell]') as unknown as { shell?: unknown } | null)?.shell));
const put = (page: Page, item: object) => page.evaluate((detail) => dispatchEvent(new CustomEvent('augur:dev-inbox-item', { detail })), item);
const openInbox = (page: Page) =>
  page.evaluate(() => ((document.querySelector('[data-shell]') as unknown as { shell: unknown }).shell as unknown as { openView(id: string): void }).openView('inbox'));
const inbox = (page: Page) => page.getByRole('dialog', { name: 'Inbox' });

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test('an item shows in the app’s words, and Open raises its intent to the app', async ({ page }) => {
  await page.goto('/reference/somewhere');
  await shell(page);
  await put(page, { title: 'Check claim 42', open: { type: 'reference.show', payload: { n: 7 } } });
  await openInbox(page);
  const row = inbox(page).locator('[data-inbox-item]', { hasText: 'Check claim 42' });
  await expect(row).toContainText('Reference · To check');
  await row.getByRole('button', { name: 'Open' }).click();
  await expect(inbox(page)).toBeHidden();
  await expect(check(page, 'intent')).toHaveText('reference.show {"n":7}');
});

test('what the app doesn’t allow stays in the menu, saying why; what it does moves the item to Done', async ({ page }) => {
  await page.goto('/reference/somewhere');
  await shell(page);
  await put(page, { title: 'Sign off claim 43', allow: { selfComplete: true, handOn: false } });
  await openInbox(page);
  const row = inbox(page).locator('[data-inbox-item]', { hasText: 'Sign off claim 43' });
  await row.getByRole('button', { name: /^More/ }).click();
  await expect(page.getByRole('menuitem', { name: /Hand on/ })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('menuitem', { name: 'Mark done' }).click();
  await expect(row).toHaveCount(0);
  await inbox(page).getByRole('tab', { name: /Done/ }).click();
  await expect(inbox(page).locator('[data-inbox-item]', { hasText: 'Sign off claim 43' })).toContainText('Done');
});

test('Home lists the item above what needs you, and opening it raises its intent', async ({ page }) => {
  await page.goto('/@me/home');
  await shell(page);
  await put(page, { title: 'Review claim 44', open: { type: 'reference.show', payload: { n: 8 } } });
  const row = page.locator('[data-app="home"] .quill-list-row', { hasText: 'Review claim 44' });
  await expect(row).toBeVisible();
  await row.click();
  await expect(check(page, 'intent')).toHaveText('reference.show {"n":8}');
});
