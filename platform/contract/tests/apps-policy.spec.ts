import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { check, failOnPageErrors, pane, reference } from './reference';

/**
 * The policy the front door sends with every file under /apps/ (PER-453), read from where it is set
 * (infra/deploy/not-a-page.conf) so this can't drift from it, and enforced, as the front door sends it. A
 * browser takes a policy only from a document's or a worker's own script, and an app's worker is /sandbox/'s
 * bootstrap, so on the app's modules it changes nothing (the first test keeps it that way); on a page or an SVG
 * opened from /apps/ it stops every script (the rest).
 */
const conf = readFileSync(new URL('../../../infra/deploy/not-a-page.conf', import.meta.url), 'utf8');
const policy = /^add_header Content-Security-Policy "([^"]+)" always;$/m.exec(conf)?.[1];
if (!policy) throw new Error('infra/deploy/not-a-page.conf has no Content-Security-Policy line.');
const enforced = { 'content-security-policy': policy, 'x-content-type-options': 'nosniff' };

failOnPageErrors();

test('the reference app’s worker loads and draws with the /apps/ policy enforced on its code', async ({ page }) => {
  let held = 0;
  // The app's code: in the dev server its modules under reference-app/frontend/, in a deployment /apps/<id>/<folder>/.
  await page.context().route(/\/contract\/reference-app\/frontend\//, async (route) => {
    const response = await route.fetch();
    held++;
    await route.fulfill({ response, headers: { ...response.headers(), ...enforced } });
  });
  await page.goto(`/${reference.id}`);
  await expect(check(page, 'person')).toContainText('Dev Person (dev-person)');
  await expect(check(page, 'worker')).toContainText('network: none; document: function; page: none; token: none');
  await expect(pane(page).getByRole('heading', { name: 'Reference on the contract' })).toBeVisible();
  // It was the app's code that carried the policy, not nothing.
  expect(held).toBeGreaterThan(0);
});

/** A page and an SVG an app might ship, each of which, if its script runs, moves to …/ran. */
const probes = [
  { file: 'probe.html', type: 'text/html', body: '<!doctype html><title>probe</title><script>location.replace("ran?" + sessionStorage.length)</script>' },
  { file: 'probe.svg', type: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"><script>location.replace("ran?" + sessionStorage.length)</script></svg>' },
];
const at = (file: string) => `/apps/${reference.id}/1.0.0_probe/${file}`;
const serve = (page: Page, file: string, type: string, body: string, headers: Record<string, string>) =>
  page.route(`**${at(file)}`, (route) => route.fulfill({ status: 200, contentType: type, headers, body }));
const consoleOf = (page: Page) => {
  const lines: string[] = [];
  page.on('console', (m) => lines.push(m.text()));
  return lines;
};

for (const { file, type, body } of probes) {
  test(`${file} opened from /apps/ under the policy enforced runs no script as the shell`, async ({ page }) => {
    const lines = consoleOf(page);
    await serve(page, file, type, body, enforced);
    await page.goto(at(file));
    await expect.poll(() => lines.join('\n')).toMatch(/Blocked script execution|Refused to execute inline script/);
    expect(page.url()).toMatch(new RegExp(`${file.replace('.', '\\.')}$`));
  });

  test(`${file} without the policy does run, so the check above isn’t empty`, async ({ page }) => {
    await serve(page, file, type, body, {});
    await page.route(`**/apps/${reference.id}/1.0.0_probe/ran*`, (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'ran' }));
    await page.goto(at(file));
    await page.waitForURL(/\/ran\?\d+$/);
  });
}
