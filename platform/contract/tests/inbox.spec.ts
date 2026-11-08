import { expect, test, type Page } from '@playwright/test';
import { check, failOnPageErrors, openView, reference, shellReady } from './reference';

/**
 * The Inbox (ADR 0026): what the shell promises an app that puts work in people's inboxes. The kind's
 * words come from the app's manifest (`contributes.inbox.kinds`), and Open raises the item's intent to
 * the app as a notification's button does. Items come from the stand-in inbox in the dev-app mode
 * (`augur:dev-inbox-item`), as an app's service would put them, each naming its kind.
 */
const { id, name } = reference;
const kind = reference.contributes.inbox.kinds[0]!;

const put = (page: Page, item: object) => page.evaluate((detail) => dispatchEvent(new CustomEvent('augur:dev-inbox-item', { detail })), { app: id, kind: kind.id, ...item });
const inbox = (page: Page) => page.getByRole('dialog', { name: 'Inbox' });

failOnPageErrors();

test('an item shows in the app’s words, and Open raises its intent to the app', async ({ page }) => {
  await page.goto(`/${id}/somewhere`);
  await shellReady(page);
  await put(page, { title: 'Check claim 42', open: { type: 'reference.show', payload: { n: 7 } } });
  await openView(page, 'inbox');
  const row = inbox(page).locator('[data-inbox-item]', { hasText: 'Check claim 42' });
  await expect(row).toContainText(`${name} · ${kind.label}`);
  await row.getByRole('button', { name: 'Open' }).click();
  await expect(inbox(page)).toBeHidden();
  await expect(check(page, 'intent')).toContainText('reference.show {"n":7}');
});

test('what the app doesn’t allow stays in the menu, saying why; what it does moves the item to Done', async ({ page }) => {
  await page.goto(`/${id}/somewhere`);
  await shellReady(page);
  await put(page, { title: 'Sign off claim 43', allow: { selfComplete: true, handOn: false } });
  await openView(page, 'inbox');
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
  await shellReady(page);
  await put(page, { title: 'Review claim 44', open: { type: 'reference.show', payload: { n: 8 } } });
  const row = page.locator('[data-app="home"] .quill-list-row', { hasText: 'Review claim 44' });
  await expect(row).toBeVisible();
  await row.click();
  await expect(check(page, 'intent')).toContainText('reference.show {"n":8}');
});
