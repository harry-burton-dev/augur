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
    // For a box that scrolls sideways, what in it runs past its inner edge: the outermost part, so a failure names the cause.
    const runsPast = (box: Element) => {
      const edge = box.getBoundingClientRect().left + box.clientLeft + box.clientWidth + 1;
      const found = [...box.querySelectorAll('*')].filter(shown).filter((el) => el.getBoundingClientRect().right > edge);
      const outermost = found.filter((el) => !found.some((other) => other !== el && other.contains(el))).slice(0, 3);
      // The first one's parents, each with its width, so the part that won't shrink shows.
      const chain: string[] = [];
      for (let up = outermost[0]?.parentElement; up && up !== box; up = up.parentElement) {
        const style = getComputedStyle(up);
        chain.push(`${up.tagName.toLowerCase()}.${String(up.getAttribute('class') ?? '').split(' ')[0]} ${Math.round(up.getBoundingClientRect().width)}/${up.scrollWidth}px min ${style.minWidth}`);
      }
      return [...outermost.map((el) => `${name(el)} by ${Math.round(el.getBoundingClientRect().right - edge)}px`), ...(chain.length ? [`in ${chain.join(' < ')}`] : [])];
    };
    return { past: past.map(name), sideways: sideways.map((el) => [name(el), ...runsPast(el)].join(' ← ')) };
  });

/** Everything in the shell that moves and then stops has stopped, and the web font is in (the title card fits its name again when it arrives). */
const atRest = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    const shell = document.querySelector('.aerie-shell');
    const finite = (shell?.getAnimations({ subtree: true }) ?? []).filter((a) => a.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
  });

/**
 * The title card brings its name in at twice its tracking and clips that entrance on purpose: the name is fitted to
 * the window at rest. This waits until the name has settled, while the card still shows (it fades after that).
 */
const cardSettled = (page: Page) =>
  page.locator('.aerie-card').evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).filter((a) => a.effect?.getComputedTiming().endTime !== Infinity && !(a instanceof CSSAnimation && a.animationName === 'aerie-card-life')).map((a) => a.finished.catch(() => undefined))),
  );

failOnPageErrors();

test.use({ viewport: NARROW });

test('at 320 px the desktop and its bar cut nothing off', async ({ page }) => {
  await page.goto('/');
  const bar = page.getByRole('navigation', { name: 'App bar', exact: true });
  await expect(bar.locator('.aerie-bar-tile').first()).toBeVisible();
  // The desktop names its floor on the title card too: checked once the name has settled, and again once it has gone.
  if (await page.locator('.aerie-card').count()) {
    await cardSettled(page);
    expect(await cutOff(page)).toEqual({ past: [], sideways: [] });
    await expect(page.locator('.aerie-card')).toHaveCount(0);
  }
  await atRest(page);
  expect(await cutOff(page)).toEqual({ past: [], sideways: [] });
});

test('at 320 px an open app, its rail, head and screen cut nothing off', async ({ page }) => {
  await page.goto(`/${reference.id}`);
  await expect(check(page, 'person')).toBeVisible();
  await expect(rail(page)).toBeVisible();
  // Opening the app names it on the title card, checked once its name has settled (on a slow runner this may see
  // less of it, since it fades after that)...
  const card = page.locator('.aerie-card');
  await expect(card).toBeAttached();
  await cardSettled(page);
  expect(await cutOff(page)).toEqual({ past: [], sideways: [] });
  // ...and the app's screen once the card has gone, since the shell holds the screen out of sight behind it.
  await expect(card).toHaveCount(0);
  await atRest(page);
  expect(await cutOff(page)).toEqual({ past: [], sideways: [] });
});
