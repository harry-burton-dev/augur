import { expect, test, type Page } from '@playwright/test';
import { check, failOnPageErrors, rail, reference } from './reference';

/**
 * Reflow (WCAG 2.2, 1.4.10): at 320 CSS px wide, the width of a 1280 px screen at 400%, the shell cuts
 * nothing off and nothing in it scrolls sideways. With the one app the dev shell has, the desktop's bar is
 * the logo and that app's tile; the kit's own tests hold how More folds a fuller bar (shell-kit desktopFit).
 */
const NARROW = { width: 320, height: 640 };

/**
 * What the shell draws that a person at this width can't reach: anything shown past either edge of the window
 * that no part inside the shell clips on purpose, and anything whose content runs sideways out of its own box,
 * scrolled or cut (words cut short with an ellipsis are allowed). The shell's own clip is the window's edge, so it
 * counts for neither: a light that spills past the edge is drawn, not content. Text kept for screen readers only
 * (a 1 px box) is skipped.
 */
const cutOff = (page: Page) =>
  page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const shell = document.querySelector('.aerie-shell');
    if (!shell) return { past: ['no .aerie-shell'], sideways: [] };
    const shown = (el: Element) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const name = (el: Element) => `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').split(' ')[0]} (${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)})`;
    const clippedBy = (el: Element) => {
      for (let up = el.parentElement; up && up !== shell; up = up.parentElement) if (getComputedStyle(up).overflowX !== 'visible') return true;
      return false;
    };
    const screenReaderOnly = (el: Element) => {
      const box = el.getBoundingClientRect();
      return box.width <= 1 || box.height <= 1;
    };
    const all = [...shell.querySelectorAll('*')].filter(shown);
    const past = all.filter((el) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && (box.right > width + 1 || box.left < -1) && !clippedBy(el);
    });
    const sideways = all.filter((el) => {
      const style = getComputedStyle(el);
      return !screenReaderOnly(el) && style.overflowX !== 'visible' && style.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
    });
    return { past: past.map(name), sideways: sideways.map(name) };
  });

failOnPageErrors();

test.use({ viewport: NARROW });

test('at 320 px the desktop and its bar cut nothing off', async ({ page }) => {
  await page.goto('/');
  const bar = page.getByRole('navigation', { name: 'App bar', exact: true });
  await expect(bar.locator('.aerie-bar-tile').first()).toBeVisible();
  expect(await cutOff(page)).toEqual({ past: [], sideways: [] });
});

test('at 320 px an open app, its rail, head and screen cut nothing off', async ({ page }) => {
  await page.goto(`/${reference.id}`);
  await expect(check(page, 'person')).toBeVisible();
  await expect(rail(page)).toBeVisible();
  expect(await cutOff(page)).toEqual({ past: [], sideways: [] });
});
