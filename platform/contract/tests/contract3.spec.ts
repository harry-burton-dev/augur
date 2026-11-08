import { expect, test, type Page } from '@playwright/test';

/**
 * What the shell promises an app on the app contract (contract 3, spec section 6): its frontend runs
 * in a worker with no network and no token, draws only Quill's remote vocabulary, reaches the gateway
 * only through the host, and when it fails, hangs or floods, only its own pane says so. The reference
 * app on the contract (reference-app-3) opens in the real shell's dev-app mode; the gateway is the
 * test's stand-in (page.route), so no deployment is needed. run.mjs runs this as its own target.
 */
test.skip(process.env.CONTRACT_TARGET !== 'contract-3', 'Runs against the reference app on the contract (run.mjs’s contract-3 target).');

const pane = (page: Page) => page.locator('[data-app="reference3"]').first();
const check = (page: Page, name: string) => pane(page).locator('.augur-notice').filter({ hasText: `check ${name}` });
const press = (page: Page, label: string) => pane(page).getByRole('button', { name: label, exact: true }).click();
const rail = (page: Page) => page.getByRole('navigation', { name: 'App bar: Reference' });

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw err;
  });
});

test('draws the screen from a worker that has no network, no page and no token', async ({ page }) => {
  await page.goto('/reference3');
  await expect(check(page, 'person')).toContainText('Dev Person (dev-person)');
  await expect(check(page, 'floor')).toContainText('dev-me personal');
  await expect(check(page, 'worker')).toContainText('network: none; document: function; page: none; token: none');
  await expect(check(page, 'previews')).toContainText('turned-on:on not-declared:off');
  // The kit drew it: Quill's own parts, in the shell's page.
  await expect(pane(page).getByRole('button', { name: 'Fetch', exact: true })).toHaveClass(/augur-button/);
  await expect(pane(page).getByRole('heading', { name: 'Reference on the contract' })).toBeVisible();
});

test('the worker’s own policy refuses a script from anywhere but the shell’s origin', async ({ page }) => {
  await page.goto('/reference3');
  await press(page, 'Load from elsewhere');
  await expect(check(page, 'policy')).toContainText('held: script-src');
});

test('drops an element outside Quill’s remote vocabulary, with a reason on the console', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
  await page.goto('/reference3');
  await expect(check(page, 'person')).toBeVisible();
  await expect(pane(page).locator('evil-frame, iframe')).toHaveCount(0);
  await expect.poll(() => warnings.join('\n')).toContain('<evil-frame> isn’t in Quill’s remote vocabulary');
});

test('ctx.fetch reaches the gateway with the person’s token, the floor and the app’s own id, never what the app sends', async ({ page }) => {
  let seen: Record<string, string> = {};
  await page.route('**/api/reference3/v1/echo', (route) => {
    seen = route.request().headers();
    return route.fulfill({ body: 'echoed', contentType: 'text/plain' });
  });
  await page.goto('/@org/reference3');
  await press(page, 'Fetch');
  await expect(check(page, 'fetched')).toContainText('200 echoed');
  expect(seen['x-augur-app']).toBe('reference3');
  expect(seen['x-workspace-id']).toBe('dev-org');
  expect(seen.authorization).toBe('Bearer dev-token');
  await press(page, 'Fetch an address');
  await expect(check(page, 'fetched')).toContainText('refused: TypeError');
});

test('the host owns the address: the app asks to move and hears where it is, without starting again', async ({ page }) => {
  await page.goto('/reference3');
  await expect(check(page, 'path')).toContainText('/');
  await press(page, 'Go to claims');
  await expect(page).toHaveURL(/\/reference3\/claims\/7$/);
  await expect(check(page, 'path')).toContainText('/claims/7');
  // The same worker heard it: a command it counted before the move still counts.
  await pane(page).getByRole('button', { name: 'Check again' }).click();
  await expect(check(page, 'commands')).toContainText('1');
  await rail(page).getByRole('button', { name: 'Claims' }).click();
  await expect(check(page, 'path')).toContainText('/claims');
  await expect(check(page, 'commands')).toContainText('1');
});

test('a floor change starts the app’s worker again on the new floor', async ({ page }) => {
  await page.goto('/reference3');
  await pane(page).getByRole('button', { name: 'Check again' }).click();
  await expect(check(page, 'commands')).toContainText('1');
  await page.evaluate(() => {
    window.history.pushState(null, '', '/@org/reference3');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(check(page, 'floor')).toContainText('dev-org org');
  await expect(check(page, 'commands')).toContainText('0');
});

test('a worker that throws fails only its own pane, and the rail still works', async ({ page }) => {
  page.removeAllListeners('pageerror');
  await page.goto('/reference3');
  await press(page, 'Throw');
  await expect(pane(page)).toContainText('Reference stopped answering');
  await expect(pane(page).getByRole('button', { name: 'Try again' })).toBeVisible();
  await rail(page).getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/(@me\/?)?$/);
});

test('an app that draws 2,001 nodes in one flush is stopped as unresponsive, and Try again starts it afresh', async ({ page }) => {
  await page.goto('/reference3');
  await press(page, 'Flood');
  await expect(pane(page)).toContainText('tried to draw 2,001 things at once');
  await pane(page).getByRole('button', { name: 'Try again' }).click();
  await expect(check(page, 'person')).toBeVisible();
});
