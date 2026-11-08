import { readFileSync } from 'node:fs';
import { test, type Page } from '@playwright/test';

interface Manifest {
  id: string;
  name: string;
  contributes: { places: { id: string; label: string; path?: string }[]; inbox: { kinds: { id: string; label: string }[] } };
}

/**
 * The reference app as the specs reach it: its id, name and words come from its manifest, never
 * from the specs. Its checks are notices headed `check <name>`; its buttons are labelled for what
 * they do (reference-app/frontend/src/entry.ts).
 */
export const reference = JSON.parse(readFileSync(new URL('../reference-app/manifest.json', import.meta.url), 'utf8')) as Manifest;
const manifest = reference;

/** The reference app's pane on the stage: the first, as one answering a request opens in a dialog after it. */
export const pane = (page: Page) => page.locator(`[data-app="${manifest.id}"]`).first();
export const check = (page: Page, name: string, within = pane(page)) => within.locator('.augur-notice').filter({ hasText: `check ${name}` });
export const press = (page: Page, label: string, within = pane(page)) => within.getByRole('button', { name: label, exact: true }).click();
/** The app bar docked beside an open app: the rail. */
export const rail = (page: Page) => page.getByRole('navigation', { name: `App bar: ${manifest.name}` });

/** Waits until the shell has drawn and set its model on its element. */
export const shellReady = (page: Page) => page.waitForFunction(() => Boolean((document.querySelector('[data-shell]') as unknown as { shell?: unknown } | null)?.shell));
/** Opens one of the shell's own views (the stream, Find, the Inbox), as its buttons do. */
export const openView = async (page: Page, id: string) => {
  await shellReady(page);
  await page.evaluate((view) => ((document.querySelector('[data-shell]') as unknown as { shell: { openView(id: string): void } }).shell.openView(view)), id);
};
/** Moves the address as a link in the shell would, without loading the page again. */
export const goTo = (page: Page, path: string) =>
  page.evaluate((to) => {
    window.history.pushState(null, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);

/** Any error on the page fails the test, unless the test expects one. */
export const failOnPageErrors = () =>
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      throw err;
    });
  });
