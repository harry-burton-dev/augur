import { expect, test, type Page } from '@playwright/test';
import { check, failOnPageErrors, goTo, openView, pane, press, rail, reference, shellReady } from './reference';

/**
 * What the shell promises an app on the app contract (contract 3, spec section 6): its frontend runs
 * in a worker with no network and no token, draws only Quill's remote vocabulary, reaches the gateway
 * only through the host, hears where it is from the host, and when it fails, hangs or floods, only its
 * own pane says so. The reference app opens in the real shell's dev-app mode; the gateway is the
 * test's stand-in (page.route), so no deployment is needed.
 */
const id = reference.id;
const name = reference.name;

failOnPageErrors();

test('draws the screen from a worker that has no network, no page and no token', async ({ page }) => {
  await page.goto(`/${id}`);
  await expect(check(page, 'person')).toContainText('Dev Person (dev-person)');
  await expect(check(page, 'worker')).toContainText('network: none; document: function; page: none; token: none');
  // The kit drew it: Quill's own parts, in the shell's page, under the heading the app set.
  await expect(pane(page).getByRole('button', { name: 'Fetch', exact: true })).toHaveClass(/augur-button/);
  await expect(pane(page).getByRole('heading', { name: 'Reference on the contract' })).toBeVisible();
});

test('opens with the path below its address, and no intent', async ({ page }) => {
  await page.goto(`/${id}/claims/42`);
  await expect(check(page, 'path')).toContainText('/claims/42');
  await expect(check(page, 'intent')).toContainText('none');
});

test('previewOn says which of the app’s feature previews are on for the person', async ({ page }) => {
  // The manifest declares `turned-on` and `left-off`, and the contract tests turn the first on for the
  // stand-in person (DEV_PREVIEWS); an id the manifest doesn't list is off.
  await page.goto(`/${id}`);
  await expect(check(page, 'previews')).toContainText('turned-on:on left-off:off not-declared:off');
});

test('opens on the person’s own floor unless the address names another', async ({ page }) => {
  await page.goto(`/${id}`);
  await expect(page).toHaveURL(new RegExp(`/@me/${id}$`));
  await expect(check(page, 'floor')).toContainText('You (dev-me, personal)');
  await page.goto(`/@org/${id}`);
  await expect(check(page, 'floor')).toContainText('Organisation (dev-org, org)');
});

test('the worker’s own policy refuses a script from anywhere but the shell’s origin', async ({ page }) => {
  await page.goto(`/${id}`);
  await press(page, 'Load from elsewhere');
  await expect(check(page, 'policy')).toContainText('held: script-src');
});

test('drops an element outside Quill’s remote vocabulary, with a reason on the console', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
  await page.goto(`/${id}`);
  await expect(check(page, 'person')).toBeVisible();
  await expect(pane(page).locator('evil-frame, iframe')).toHaveCount(0);
  await expect.poll(() => warnings.join('\n')).toContain('<evil-frame> isn’t in Quill’s remote vocabulary');
});

test('ctx.fetch reaches the gateway with the person’s token, the floor and the app’s own id, never what the app sends', async ({ page }) => {
  let seen: Record<string, string> = {};
  await page.route(`**/api/${id}/v1/echo`, (route) => {
    seen = route.request().headers();
    return route.fulfill({ body: 'echoed', contentType: 'text/plain' });
  });
  await page.goto(`/@org/${id}`);
  // The shell settles on the floor before the app is pressed.
  await expect(check(page, 'floor')).toContainText('(dev-org, org)');
  await press(page, 'Fetch');
  await expect(check(page, 'fetched')).toContainText('200 echoed');
  expect(seen['x-augur-app']).toBe(id);
  expect(seen['x-workspace-id']).toBe('dev-org');
  expect(seen.authorization).toBe('Bearer dev-token');
  await press(page, 'Fetch an address');
  await expect(check(page, 'fetched')).toContainText('refused: TypeError');
});

test('ctx.files.upload hands the bytes to the host, which sends them to the gateway with the token, intact', async ({ page }) => {
  let seen: { headers: Record<string, string>; body: number[] } | undefined;
  await page.route(`**/api/${id}/v1/files`, (route) => {
    seen = { headers: route.request().headers(), body: [...(route.request().postDataBuffer() ?? [])] };
    return route.fulfill({ body: 'kept', contentType: 'text/plain' });
  });
  await page.goto(`/${id}`);
  await press(page, 'Upload');
  await expect(check(page, 'uploaded')).toContainText('200 kept');
  expect(seen?.body).toEqual([0, 1, 2, 253, 254, 255]);
  expect(seen?.headers.authorization).toBe('Bearer dev-token');
  expect(seen?.headers['x-augur-app']).toBe(id);
});

test('an upload past the app’s maxUpload gets the gateway’s 413 words, and is never sent', async ({ page }) => {
  let sent = false;
  await page.route(`**/api/${id}/v1/files`, (route) => {
    sent = true;
    return route.fulfill({ body: 'kept' });
  });
  await page.goto(`/${id}`);
  await press(page, 'Upload too much');
  await expect(check(page, 'uploaded')).toContainText(`413 This is more than ${name} takes at once (1 MB).`);
  expect(sent).toBe(false);
});

test('the canvas is a frame with an opaque origin and no network, and talks to its app only over the port', async ({ page }) => {
  await page.goto(`/${id}`);
  await press(page, 'Open canvas');
  const frame = pane(page).locator('iframe.app-canvas');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(check(page, 'canvas')).toContainText('heard hello canvas; origin null; fetch refused');
  // While it is open the canvas takes the screen's place; the app's heading stays the shell's.
  await expect(pane(page).getByRole('heading', { name: 'Reference on the contract' })).toBeVisible();
});

test('notify puts a notification on the shell’s stream', async ({ page }) => {
  await page.goto(`/${id}`);
  await press(page, 'Notify');
  await expect
    .poll(() =>
      page.evaluate(() =>
        (document.querySelector('[data-shell]') as unknown as { shell: { notifications: { title: string; level: string }[] } }).shell.notifications.map((n) => `${n.title}:${n.level}`),
      ),
    )
    .toContain('Reference notification:needs');
});

test('raise opens the app that handles the intent, with the intent', async ({ page }) => {
  await page.goto(`/${id}/somewhere`);
  await press(page, 'Raise');
  await expect(check(page, 'intent')).toContainText('reference.show {"n":1}');
  await expect(page).toHaveURL(new RegExp(`/${id}$`));
});

test('request opens the handling app over this one and resolves with its answer', async ({ page }) => {
  await page.goto(`/${id}`);
  await press(page, 'Request');
  const answering = page.locator(`.augur-dialog [data-app="${id}"]`);
  await expect(check(page, 'intent', answering)).toContainText('reference.answer {"question":"six times seven"}');
  await press(page, 'Answer 42', answering);
  await expect(check(page, 'answer')).toContainText('42');
});

test('a request the handler declines rejects as cancelled', async ({ page }) => {
  await page.goto(`/${id}`);
  await press(page, 'Request');
  const answering = page.locator(`.augur-dialog [data-app="${id}"]`);
  await press(page, 'Decline', answering);
  await expect(check(page, 'answer')).toContainText('cancelled');
});

test('the host owns the address: the app asks to move and hears where it is, without starting again', async ({ page }) => {
  await page.goto(`/${id}`);
  await expect(check(page, 'path')).toContainText('/');
  await press(page, 'Go to claims');
  await expect(page).toHaveURL(new RegExp(`/${id}/claims/7$`));
  await expect(check(page, 'path')).toContainText('/claims/7');
  // The same worker heard it: a command it counted before the move still counts.
  await pane(page).getByRole('button', { name: 'Check again' }).click();
  await expect(check(page, 'commands')).toContainText('1');
  await rail(page).getByRole('button', { name: 'Claims' }).click();
  await expect(check(page, 'path')).toContainText('/claims');
  await expect(check(page, 'commands')).toContainText('1');
});

test('a move that would climb out of the app’s own address is ignored', async ({ page }) => {
  await page.goto(`/${id}/claims/1`);
  await expect(check(page, 'path')).toContainText('/claims/1');
  await press(page, 'Climb out');
  // Something the host does move to after it shows the refused move didn't happen first.
  await press(page, 'Go to claims');
  await expect(check(page, 'path')).toContainText('/claims/7');
  await expect(page).toHaveURL(new RegExp(`/@me/${id}/claims/7$`));
});

test('Back and Forward inside the app keep its worker, and it hears the new path', async ({ page }) => {
  await page.goto(`/@me/${id}/claims/1`);
  await expect(check(page, 'path')).toContainText('/claims/1');
  await pane(page).getByRole('button', { name: 'Check again' }).click();
  await expect(check(page, 'commands')).toContainText('1');
  await press(page, 'Go to claims');
  await expect(check(page, 'path')).toContainText('/claims/7');
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/@me/${id}/claims/1$`));
  await expect(check(page, 'path')).toContainText('/claims/1');
  await page.goForward();
  await expect(check(page, 'path')).toContainText('/claims/7');
  // Started once: the count from before the moves is still there.
  await expect(check(page, 'commands')).toContainText('1');
});

test('a floor change starts the app’s worker again on the new floor', async ({ page }) => {
  await page.goto(`/${id}`);
  await pane(page).getByRole('button', { name: 'Check again' }).click();
  await expect(check(page, 'commands')).toContainText('1');
  await goTo(page, `/@org/${id}`);
  await expect(check(page, 'floor')).toContainText('Organisation (dev-org, org)');
  await expect(check(page, 'commands')).toContainText('0');
});

test('an app sits on flat ground with the rail beside it, and moving floors inside it never shows the desktop', async ({ page }) => {
  await page.goto(`/@me/${id}`);
  await expect(check(page, 'floor')).toContainText('(dev-me, personal)');
  const shell = page.locator('.aerie-shell');
  await expect(shell).toHaveAttribute('data-bar', 'app');
  await shell.evaluate((el) => {
    const seen: string[] = [];
    (window as unknown as { grounds: string[] }).grounds = seen;
    new MutationObserver(() => seen.push(el.getAttribute('data-bar') ?? '')).observe(el, { attributes: true, attributeFilter: ['data-bar'] });
    (el as unknown as { shell: EventTarget }).shell.dispatchEvent(new CustomEvent('ui-floor', { detail: { id: 'dev-org', direction: 'up' } }));
  });
  await expect(page).toHaveURL(new RegExp(`/@org/${id}$`));
  await expect(check(page, 'floor')).toContainText('(dev-org, org)');
  expect(await page.evaluate(() => (window as unknown as { grounds: string[] }).grounds.filter((g) => g !== 'app'))).toEqual([]);
  await expect(shell).toHaveAttribute('data-bar', 'app');
});

for (const [width, height] of [[1440, 900], [1100, 800], [800, 700]] as const) {
  test(`at ${width}px the pane keeps its inset: the title and the screen line up, clear of the rail and the stage's fade`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(`/${id}`);
    await expect(check(page, 'person')).toBeVisible();
    const box = (sel: string) => page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    const [paneBox, head, screen, stage] = await Promise.all([box(`.aerie-app-pane[data-app="${id}"]`), box('.aerie-app-head [role="heading"]'), box('.aerie-app-screen .aerie-frame-pane > *'), box('.aerie-stage')]);
    const tight = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--edge-tight')));
    const fade = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-4')));
    // Every region pads itself: the pane's own inset, never its neighbour's.
    expect(head.left - paneBox.left).toBeGreaterThanOrEqual(tight);
    expect(Math.abs(screen.left - head.left)).toBeLessThanOrEqual(1);
    expect(paneBox.right - Math.max(head.right, screen.right)).toBeGreaterThanOrEqual(tight - 1);
    // The title starts below the stage's fade, so it is drawn at full strength.
    expect(head.top - stage.top).toBeGreaterThanOrEqual(fade);
  });

  test(`at ${width}px the app's pane is flush with the window's right edge, and the stage, band and floor picker end where it starts`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(`/${id}`);
    await expect(check(page, 'person')).toBeVisible();
    const box = (sel: string) => page.locator(sel).first().evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    const pane = page.locator('.aerie-pane-slot .aerie-pane');
    await expect(pane).toBeVisible();
    // The clock and the notification indicator are in the pane while it is drawn, not in the band.
    await expect(pane.locator('.aerie-clock')).toBeVisible();
    await expect(page.locator('.aerie-band .aerie-clock')).toHaveCount(0);
    const [slot, stage, band] = await Promise.all([box('.aerie-pane-slot'), box('.aerie-stage'), box('.aerie-band')]);
    expect(Math.abs(slot.right - width)).toBeLessThanOrEqual(1);
    expect(stage.right).toBeLessThanOrEqual(slot.left + 1);
    expect(band.right).toBeLessThanOrEqual(slot.left + 1);
    const gauge = page.locator('.aerie-gauge, .aerie-floor-picker');
    if (await gauge.count()) expect((await gauge.first().evaluate((el) => el.getBoundingClientRect().right))).toBeLessThanOrEqual(slot.left);
  });
}

test('leaving the app through Home in the rail takes its pane off the stage', async ({ page }) => {
  await page.goto(`/${id}`);
  await expect(check(page, 'person')).toBeVisible();
  // Home in the rail is the way out (PDR-020 D6).
  await rail(page).getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/@me\/?$/);
  await expect(page.locator(`[data-app="${id}"]`)).toHaveCount(0);
});

test('a worker that throws fails only its own pane, and the rail still works', async ({ page }) => {
  page.removeAllListeners('pageerror');
  await page.goto(`/${id}`);
  await press(page, 'Throw');
  await expect(pane(page)).toContainText(`${name} stopped answering`);
  await expect(pane(page).getByRole('button', { name: 'Try again' })).toBeVisible();
  await rail(page).getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(/\/(@me\/?)?$/);
});

test('an app that draws 2,001 nodes in one flush is stopped as unresponsive, and Try again starts it afresh', async ({ page }) => {
  await page.goto(`/${id}`);
  await press(page, 'Flood');
  await expect(pane(page)).toContainText('tried to draw 2,001 things at once');
  await pane(page).getByRole('button', { name: 'Try again' }).click();
  await expect(check(page, 'person')).toBeVisible();
});

// Home: what needs you, and the cards apps contribute (`contributes.card`), drawn by each app's worker.
test('Home lists what the app said needs you, and opening it opens the app', async ({ page }) => {
  await page.goto(`/${id}/somewhere`);
  await press(page, 'Notify');
  // The notice crosses from the worker first: leaving the app at once would stop it before it is sent.
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('[data-shell]') as unknown as { shell: { notifications: { title: string }[] } }).shell.notifications.length))
    .toBeGreaterThan(0);
  await goTo(page, '/@me/home');
  const row = page.locator('[data-app="home"] .quill-list-row', { hasText: 'Reference notification' });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/@me/${id}(/.*)?$`));
  await expect(check(page, 'person')).toBeVisible();
});

test('Home places the card the app draws from its worker, on the floor, and the card can raise an intent', async ({ page }) => {
  await page.goto('/@me/home');
  const card = page.locator(`[data-app="home"] [data-card="${id}"]`);
  await expect(check(page, 'card', card)).toContainText('Reference card on dev-me');
  await press(page, 'Show', card);
  await expect(check(page, 'intent')).toContainText('reference.show {"n":3}');
});

// Find over apps' content: the shell asks each app that declares `contributes.search`, on the person's floor.
const find = async (page: Page, q: string) => {
  await shellReady(page);
  await openView(page, 'find');
  await page.locator('.aerie-shell .aerie-search input').fill(q);
};

test('Find asks the app’s service, on the floor, and opens a result where it says', async ({ page }) => {
  await page.route(`**/api/${id}/v1/search?*`, (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: { results: [{ id: 'c42', title: `Claim matching ${url.searchParams.get('q')}`, detail: route.request().headers()['x-workspace-id'], path: '/claims/42' }] },
    });
  });
  await page.goto(`/@org/${id}/somewhere`);
  await find(page, 'travel');
  const result = page.locator(`.aerie-shell .aerie-view ul[aria-label="${name}"] .aerie-row`);
  await expect(result).toContainText('Claim matching travel');
  await expect(result).toContainText('dev-org');
  await result.click();
  await expect(check(page, 'path')).toContainText('/claims/42');
  await expect(page).toHaveURL(new RegExp(`/@org/${id}/claims/42$`));
});

test('Find asks the app’s service as the app, with the person’s token and the app’s own id', async ({ page }) => {
  let seen: Record<string, string> | undefined;
  await page.route(`**/api/${id}/v1/search?*`, (route) => {
    seen = route.request().headers();
    return route.fulfill({ json: { results: [] } });
  });
  await page.goto(`/@org/${id}`);
  await find(page, 'travel');
  await expect.poll(() => seen?.['x-augur-app']).toBe(id);
  expect(seen?.authorization).toBe('Bearer dev-token');
  expect(seen?.['x-workspace-id']).toBe('dev-org');
});

test('Find doesn’t wait for a slow app: it says so, and lets go after the budget', async ({ page }) => {
  // The app never answers while the test runs, so the only way the note can change is the shell's own
  // budget running out, however slow the runner (PER-322).
  await page.route(`**/api/${id}/v1/search?*`, () => new Promise<void>(() => undefined));
  await page.goto(`/${id}`);
  await find(page, 'reference');
  await expect(page.locator('.aerie-shell .aerie-view .aerie-row', { hasText: name }).first()).toBeVisible();
  // The reference app's own note: other apps in the catalogue have theirs.
  const note = page.locator(`.aerie-shell .aerie-view .aerie-group.aerie-label:has-text("${name}") + p.aerie-note.aerie-small`);
  await expect(note).toHaveText('Still looking…');
  await expect(note).toHaveText('Didn’t answer in time.');
});
