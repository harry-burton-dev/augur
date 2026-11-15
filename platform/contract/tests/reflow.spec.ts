import { expect, test, type Page } from '@playwright/test';
import { check, failOnPageErrors, rail, reference } from './reference';

/**
 * Reflow (WCAG 2.2, 1.4.10): at 320 CSS px wide, the width of a 1280 px screen at 400%, the shell needs no
 * sideways scrolling and cuts nothing off. The desktop's bar folds what doesn't fit into More; with an app
 * open, the rail, the app's head and its screen stay inside the window.
 */
const NARROW = { width: 320, height: 640 };

/** Whether the page scrolls sideways, and anything shown that runs past the window's right edge. */
const pastTheEdge = (page: Page, within: string) =>
  page.evaluate((selector) => {
    const width = document.documentElement.clientWidth;
    const scrolls = document.scrollingElement!.scrollWidth > width;
    const clipped = (el: Element) => {
      for (let up = el.parentElement; up; up = up.parentElement) {
        const { overflowX } = getComputedStyle(up);
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
      }
      return false;
    };
    const past = [...document.querySelectorAll(`${selector} *`)]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return box.width > 0 && box.right > width + 1 && style.visibility !== 'hidden' && style.opacity !== '0' && !clipped(el);
      })
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').split(' ')[0]} (${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)})`);
    return { scrolls, past };
  }, within);

failOnPageErrors();

test.use({ viewport: NARROW });

test('at 320 px the desktop and its bar fit the window, the rest under More', async ({ page }) => {
  await page.goto('/');
  const bar = page.getByRole('navigation', { name: 'App bar', exact: true });
  await expect(bar).toBeVisible();
  await expect(bar.locator('.aerie-bar-tile').first()).toBeVisible();
  expect(await pastTheEdge(page, '.aerie-shell-bar')).toEqual({ scrolls: false, past: [] });
});

test('at 320 px an open app, its rail, head and screen fit the window', async ({ page }) => {
  await page.goto(`/${reference.id}`);
  await expect(check(page, 'person')).toBeVisible();
  await expect(rail(page)).toBeVisible();
  expect(await pastTheEdge(page, '.aerie-shell')).toEqual({ scrolls: false, past: [] });
});
