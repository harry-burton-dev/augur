import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { failOnPageErrors, shellReady } from './reference';

/**
 * Account (ADR 0036) is a dialog over the shell's menu: it opens only from the menu's Account, or on
 * coming back from one of Keycloak's screens, and closes back to the menu. Each section's parts sit side
 * by side while they fit and wait behind a switch when they don't, so at the sizes AUGUR is used at
 * nothing in it scrolls and nothing is cut off. The stand-in shell answers identity's account API.
 */
const sky = (page: Page) => page.locator('.aerie-sky');
const account = (page: Page) => page.getByRole('dialog', { name: /^Account/ });

async function openAccount(page: Page) {
  await page.goto('/');
  await shellReady(page);
  await page.keyboard.press('`');
  await expect(sky(page)).toHaveAttribute('aria-hidden', 'false');
  await sky(page).getByRole('button', { name: /^Account/ }).click();
  await expect(account(page)).toBeVisible();
}

/** What scrolls, or is cut off at the bottom of its parts, in the dialog as it is now. */
const overflow = (page: Page) =>
  page.evaluate(() => {
    const found: string[] = [];
    const dialog = document.querySelector('.augur-section-dialog');
    if (!dialog) return ['no dialog'];
    for (const el of dialog.querySelectorAll<HTMLElement>('*')) {
      const { overflowY } = getComputedStyle(el);
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) found.push(`scrolls: ${el.className}`);
    }
    const box = document.querySelector('.augur-section-panel .augur-fit-parts')?.getBoundingClientRect();
    for (const part of dialog.querySelectorAll<HTMLElement>('.augur-fit-part')) {
      const at = part.getBoundingClientRect();
      if (box && at.bottom > box.bottom + 1) found.push(`cut off: ${part.querySelector('h3')?.textContent} by ${Math.round(at.bottom - box.bottom)}px`);
      if (at.right > dialog.getBoundingClientRect().right + 1) found.push(`too wide: ${part.querySelector('h3')?.textContent}`);
    }
    if (document.documentElement.scrollHeight > window.innerHeight + 1) found.push('the page scrolls');
    return found;
  });

failOnPageErrors();

test('Account opens only from the menu, over it, and closes back to it', async ({ page }) => {
  // An address alone doesn't open it: Account isn't a place.
  await page.goto('/?account=security');
  await shellReady(page);
  await expect(account(page)).toHaveCount(0);

  await openAccount(page);
  await expect(account(page).getByRole('tab', { name: 'Overview', selected: true })).toBeVisible();
  await expect(page).not.toHaveURL(/account=/);
  // The menu's keys don't reach the menu behind it.
  await page.keyboard.press('Control+k');
  await expect(sky(page)).toHaveAttribute('aria-hidden', 'false');
  await expect(account(page)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(account(page)).toHaveCount(0);
  await expect(sky(page)).toHaveAttribute('aria-hidden', 'false');

  await sky(page).getByRole('button', { name: /^Account/ }).click();
  await account(page).getByRole('button', { name: /Back to the menu/ }).click();
  await expect(account(page)).toHaveCount(0);
  await expect(sky(page)).toHaveAttribute('aria-hidden', 'false');
});

test('coming back from one of Keycloak’s screens opens the menu and the section it left from, once', async ({ page }) => {
  await page.goto('/?account=security&kc_action_status=success');
  await expect(account(page).getByRole('tab', { name: 'Sign-in and security', selected: true })).toBeVisible();
  await expect(account(page)).toContainText('Done. The change is saved.');
  await expect(sky(page)).toHaveAttribute('aria-hidden', 'false');
  await expect(page).not.toHaveURL(/account=|kc_action_status/);
  await page.reload();
  await shellReady(page);
  await expect(account(page)).toHaveCount(0);
});

for (const [width, height] of [
  [1280, 720],
  [1024, 768],
  [800, 600],
] as const) {
  test(`at ${width}×${height} nothing in Account scrolls or is cut off, in any section or part`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openAccount(page);
    const tabs = account(page).getByRole('tab');
    const names = await tabs.allTextContents();
    expect(names).toHaveLength(9);
    const found: string[] = [];
    for (const [i, name] of names.entries()) {
      await tabs.nth(i).click();
      await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true');
      await expect(account(page).locator('.augur-fit-part').first()).toBeVisible();
      // Loaded, so each part is as tall as it gets.
      await expect(account(page).getByText(/^Loading your/)).toHaveCount(0);
      const parts = account(page).locator('.augur-fit-switch-item');
      const shown = Math.max(1, await parts.count());
      for (let j = 0; j < shown; j++) {
        if (await parts.count()) {
          await parts.nth(j).click();
          await expect(parts.nth(j)).toHaveAttribute('aria-pressed', 'true');
        }
        found.push(...(await overflow(page)).map((f) => `${name}: ${f}`));
      }
    }
    // The pages inside Overview: securing the account, and every sign-in.
    await tabs.first().click();
    for (const open of ['Secure your account', 'See']) {
      // In a narrow window the account check waits behind the switch.
      const check = account(page).locator('.augur-fit-switch-item', { hasText: 'Account check' });
      if (await check.count()) await check.click();
      await account(page).getByRole('button', { name: open, exact: true }).last().click();
      await expect(account(page).getByRole('button', { name: 'Back to Overview' })).toBeVisible();
      found.push(...(await overflow(page)).map((f) => `${open}: ${f}`));
      await account(page).getByRole('button', { name: 'Back to Overview' }).click();
    }
    expect(found).toEqual([]);
  });
}

test('Account has nothing serious for axe', async ({ page }) => {
  await openAccount(page);
  const { violations } = await new AxeBuilder({ page }).include('.augur-section-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});
