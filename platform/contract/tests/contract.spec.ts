import { expect, test, type Page } from '@playwright/test';
import { since } from './builds';

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

test('mounts with no working context, which SDK 1.10 reserves (ADR 0029)', async ({ page }) => {
  since('1.10');
  await page.goto('/reference/claims/42');
  await expect(check(page, 'focus')).toHaveText('none');
});

// SDK 1.7: feature previews. The manifest declares `turned-on` and `left-off`, and run.mjs turns the first on
// for the stand-in person; an id the manifest doesn't list is off.
test('previewOn says which of the app’s feature previews are on for the person', async ({ page }) => {
  since('1.7');
  await page.goto('/reference');
  await expect(check(page, 'previews')).toHaveText('turned-on:on left-off:off not-declared:off');
});

// SDK 1.9: a team floor names its level. The stand-in's floors are the person's own and the org's,
// which have none, so this checks it stays absent there and the path still reads from the top.
test('a floor that isn’t a team has no level, and its path holds itself', async ({ page }) => {
  since('1.9');
  await page.goto('/@me/reference');
  await expect(check(page, 'level')).toHaveText('none me');
  await page.goto('/@org/reference');
  await expect(check(page, 'level')).toHaveText('none org');
});

// SDK 1.10: the shell serves React 19 and the React kits, so an app's bundle carries neither (ADR 0015).
test('the app draws with the shell’s React and Quill', async ({ page }) => {
  since('1.10');
  await page.goto('/reference');
  await expect(check(page, 'react')).toHaveText(/^19\./);
  await expect(app(page).locator('[data-action="notify"]')).toHaveClass(/augur-button/);
  await expect(app(page).getByRole('heading', { name: 'Reference', exact: true })).toBeVisible();
});

test('notify puts a notification on the shell’s stream', async ({ page }) => {
  await page.goto('/reference');
  await press(page, 'notify');
  const titles = await page.evaluate(() =>
    ((document.querySelector('[data-shell]') as unknown as { shell: unknown }).shell as unknown as { notifications: { title: string; level: string }[] }).notifications.map((n) => `${n.title}:${n.level}`),
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
  const answering = page.locator('.augur-dialog [data-app="reference"]');
  await expect(answering.locator('[data-check="intent"]')).toHaveText('reference.answer {"question":"six times seven"}');
  await answering.locator('[data-action="respond"]').click();
  await expect(check(page, 'answer')).toHaveText('42');
});

test('a request the handler declines rejects as cancelled', async ({ page }) => {
  await page.goto('/reference');
  await press(page, 'request');
  await page.locator('.augur-dialog [data-app="reference"] [data-action="cancel"]').click();
  await expect(check(page, 'answer')).toHaveText('cancelled');
});

test('the event bus carries events within the page', async ({ page }) => {
  await page.goto('/reference');
  await press(page, 'emit');
  await expect(check(page, 'bus')).toHaveText('pong');
});

test('a domain event the person may see reaches the app on the bus, and it reloads', async ({ page }) => {
  since('1.10');
  let loads = 0;
  await page.route('**/api/reference/v1/thing', (route) => route.fulfill({ body: `thing ${++loads}` }));
  await page.goto('/@me/reference');
  await press(page, 'follow');
  await expect(check(page, 'thing')).toHaveText('thing 1');
  // Published as the stand-in events service would stream it: on this floor, on a topic of an app the person has here.
  const publish = (detail: object) => page.evaluate((d) => dispatchEvent(new CustomEvent('augur:dev-domain-event', { detail: d })), detail);
  await expect
    .poll(async () => {
      await publish({ topic: 'reference.thing.changed', payload: { thing: 't1' } });
      return loads;
    })
    .toBeGreaterThan(1);
  await expect(check(page, 'thing')).toHaveText(`thing ${loads}`);
  // Another floor's: no reload.
  const before = loads;
  await publish({ topic: 'reference.thing.changed', workspace: 'dev-org' });
  await page.waitForTimeout(300);
  expect(loads).toBe(before);
});

test('leaving the app unmounts it', async ({ page }) => {
  await page.goto('/reference');
  await expect(check(page, 'token')).toHaveText('ok');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.referenceUnmounts ?? 0)).toBe(1);
  await expect(app(page)).toHaveCount(0);
});


// SDK 1.1: the floor the app is on, and requests that name it.
test('mounts on the person’s own floor unless the address names another', async ({ page }) => {
  since('1.1');
  await page.goto('/reference');
  await expect(page).toHaveURL(/\/@me\/reference$/);
  await expect(check(page, 'floor')).toHaveText('You (me, personal, lead) dev-me');
  await page.goto('/@org/reference');
  await expect(check(page, 'floor')).toHaveText('Organisation (org, org, member) dev-org');
});

test('an app sits on the still ground, and moving floors inside it never shows the water', async ({ page }) => {
  since('1.1'); // the app says which floor it's on from SDK 1.1
  await page.goto('/@me/reference');
  await expect(check(page, 'floor')).toHaveText('You (me, personal, lead) dev-me');
  const shell = page.locator('.aerie-shell');
  await expect(shell).toHaveAttribute('data-background', 'none');
  await shell.evaluate((el) => {
    const seen: string[] = [];
    (window as unknown as { grounds: string[] }).grounds = seen;
    new MutationObserver(() => seen.push(el.getAttribute('data-background') ?? '')).observe(el, { attributes: true, attributeFilter: ['data-background'] });
    (el as unknown as { shell: EventTarget }).shell.dispatchEvent(new CustomEvent('ui-floor', { detail: { id: 'dev-org', direction: 'up' } }));
  });
  await expect(page).toHaveURL(/\/@org\/reference$/);
  await expect(check(page, 'floor')).toHaveText('Organisation (org, org, member) dev-org');
  expect(await page.evaluate(() => (window as unknown as { grounds: string[] }).grounds.filter((g) => g !== 'none'))).toEqual([]);
  await expect(shell).toHaveAttribute('data-background', 'none');
});

test('fetch sends the token and the floor the app is on', async ({ page }) => {
  since('1.1');
  await page.route('**/api/reference/v1/floor', (route) => {
    const h = route.request().headers();
    return route.fulfill({ body: `${h['x-workspace-id']} ${h.authorization}` });
  });
  await page.goto('/@org/reference');
  await press(page, 'fetch');
  await expect(check(page, 'fetched')).toHaveText('dev-org Bearer dev-token');
});

// SDK 1.2: buttons on a notification, each raising an intent through the shell.
test('a notification’s action raises its intent through the shell', async ({ page }) => {
  since('1.2');
  await page.goto('/reference/somewhere');
  await press(page, 'notify-action');
  await page.evaluate(() => ((document.querySelector('[data-shell]') as unknown as { shell: unknown }).shell as unknown as { openView(id: string): void }).openView('stream'));
  await page.locator('.aerie-shell .aerie-act', { hasText: 'Show' }).click();
  await expect(check(page, 'intent')).toHaveText('reference.show {"n":2}');
  const left = await page.evaluate(() => ((document.querySelector('[data-shell]') as unknown as { shell: unknown }).shell as unknown as { notifications: { title: string }[] }).notifications.map((n) => n.title));
  expect(left).not.toContain('Reference action');
});

// SDK 1.2: Home lists what needs you with its actions, and places apps' glance cards.
const goTo = (page: Page, path: string) =>
  page.evaluate((to) => {
    window.history.pushState(null, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);

test('Home lists what needs you, and its actions raise their intents', async ({ page }) => {
  since('1.2');
  await page.goto('/reference/somewhere');
  await press(page, 'notify-action');
  await goTo(page, '/@me/home');
  const row = page.locator('[data-app="home"] .quill-list-row', { hasText: 'Reference action' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /^Show/ }).click();
  await expect(check(page, 'intent')).toHaveText('reference.show {"n":2}');
});

test('Home places the app’s glance card for the floor, with a working context', async ({ page }) => {
  since('1.2');
  await page.goto('/@me/home');
  const card = page.locator('[data-app="home"] [data-card="reference"]');
  await expect(card.locator('[data-check="card"]')).toHaveText('Reference card on me');
  await card.locator('[data-action="card-raise"]').click();
  await expect(check(page, 'intent')).toHaveText('reference.show {"n":3}');
});

// Find over apps' content: the shell asks each app that declares `search`, on the person's floor.
const find = async (page: Page, q: string) => {
  // The shell's model is set on its element once it has drawn; wait for it rather than racing the first render.
  await page.waitForFunction(() => Boolean((document.querySelector('[data-shell]') as unknown as { shell?: unknown } | null)?.shell));
  await page.evaluate(() => ((document.querySelector('[data-shell]') as unknown as { shell: unknown }).shell as unknown as { openView(id: string): void }).openView('find'));
  await page.locator('.aerie-shell .aerie-search input').fill(q);
};

test('Find asks the app’s service, on the floor, and opens a result where it says', async ({ page }) => {
  await page.route('**/api/reference/v1/search?*', (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      json: { results: [{ id: 'c42', title: `Claim matching ${url.searchParams.get('q')}`, detail: route.request().headers()['x-workspace-id'], path: '/claims/42' }] },
    });
  });
  await page.goto('/@org/reference/somewhere');
  await find(page, 'travel');
  const result = page.locator('.aerie-shell .aerie-view ul[aria-label="Reference"] .aerie-row');
  await expect(result).toContainText('Claim matching travel');
  await expect(result).toContainText('dev-org');
  await result.click();
  await expect(check(page, 'path')).toHaveText('/claims/42');
  await expect(page).toHaveURL(/\/@org\/reference\/claims\/42$/);
});

test('Find doesn’t wait for a slow app: it says so, and lets go after the budget', async ({ page }) => {
  await page.route('**/api/reference/v1/search?*', async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.fulfill({ json: { results: [] } }).catch(() => undefined);
  });
  await page.goto('/reference');
  await find(page, 'reference');
  await expect(page.locator('.aerie-shell .aerie-view .aerie-row', { hasText: 'Reference' }).first()).toBeVisible();
  // The reference app's own note: other apps in the catalogue (Folio, when it's on) have theirs.
  const note = page.locator('.aerie-shell .aerie-view .aerie-group.aerie-label:has-text("Reference") + p.aerie-note.aerie-small');
  await expect(note).toHaveText('Still looking…');
  await expect(note).toHaveText('Didn’t answer in time.', { timeout: 3000 });
});
