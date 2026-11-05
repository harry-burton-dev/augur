// Opens a running AUGUR in a real browser, as its first admin would, and checks what unit and
// contract tests can't see on a release's own images: sign-in works, the shell and the apps that
// ship with it render, and the UI kit comes from KIT_URL, held to its hashes (ADR 0048).
// infra/deploy-test.sh runs it in Playwright's container after a fresh install. See The deploy test in the AUGUR handbook, 03 Architecture/Engineering.
//
//   node deploy-browser-check.mjs <front door> <admin user> <admin password> <app id>...
//
// Writes a screenshot of each page to $OUT (default ./browser-check) and exits 1 on any failure.
import { createHmac } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [base, user, password, ...apps] = process.argv.slice(2);
if (!base || !user || !password || apps.length === 0) {
  console.error('usage: node deploy-browser-check.mjs <front door> <admin user> <admin password> <app id>...');
  process.exit(2);
}
/** The current one-time code for a base32 secret (RFC 6238: SHA-1, 6 digits, 30 s), as an authenticator app shows it. */
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.toUpperCase().replace(/=+$/, '')].map((c) => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const mac = createHmac('sha1', key).update(counter).digest();
  const offset = mac[mac.length - 1] & 0xf;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

const out = process.env.OUT ?? 'browser-check';
mkdirSync(out, { recursive: true });

const failures = [];
const fail = (what) => {
  failures.push(what);
  console.error(`✗ ${what}`);
};
const pass = (what) => console.error(`✓ ${what}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// Uncaught errors and broken code or styles fail the check. Console errors and other refused calls
// are printed, not failed: a fresh server has no model, no data and no second person yet.
const errors = [];
const consoleErrors = [];
const badResponses = [];
const loaded = [];
const isCode = (path) => /^\/(kit|apps|shared)\//.test(path) || /\.(js|css)$/.test(path);
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()));
page.on('requestfailed', (req) => {
  const url = new URL(req.url());
  if (isCode(url.pathname)) badResponses.push(`${url.pathname} (${req.failure()?.errorText})`);
});
page.on('response', (res) => {
  const url = new URL(res.url());
  if (url.origin !== new URL(base).origin) return;
  loaded.push(url.pathname);
  if (res.status() >= 500 || (res.status() >= 400 && isCode(url.pathname))) badResponses.push(`${url.pathname} (HTTP ${res.status()})`);
});
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });

try {
  // Sign in with the first admin's starting password. Keycloak then asks for whatever the account still
  // needs, in its own order: a new password, and a one-time-code app for a deployment admin (ADR 0035).
  await page.goto(base);
  await page.locator('#username').fill(user);
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();
  const signedIn = (url) => url.origin === new URL(base).origin && !url.pathname.startsWith('/sso/');
  for (let step = 0; step < 4 && !signedIn(new URL(page.url())); step++) {
    await page.waitForLoadState('domcontentloaded');
    const before = page.url();
    if (await page.locator('#password-new').count()) {
      const fresh = `Ab1-${crypto.randomUUID()}`;
      await page.locator('#password-new').fill(fresh);
      await page.locator('#password-confirm').fill(fresh);
      await page.locator('[type=submit]').first().click();
    } else if (page.url().includes('CONFIGURE_TOTP')) {
      await page.locator('#mode-manual').click();
      const secret = (await page.locator('#kc-totp-secret-key').innerText()).replace(/\s+/g, '');
      await page.locator('#totp').fill(totp(secret));
      await page.locator('#userLabel').fill('deploy test');
      await page.locator('[type=submit]').first().click();
    }
    await page.waitForURL((url) => signedIn(url) || url.href !== before, { timeout: 30_000 }).catch(() => {});
  }
  await page.waitForURL(signedIn, { timeout: 30_000 });
  pass('the first admin signs in, sets a password and a one-time-code app');

  // The kit: where the page says it comes from, and that every kit file came from there.
  await page.waitForSelector('meta[name="augur-kit"]', { state: 'attached', timeout: 30_000 });
  const kit = JSON.parse(await page.locator('meta[name="augur-kit"]').getAttribute('content'));
  const map = JSON.parse(await page.locator('script[type="importmap"]').textContent());
  // The kit's address, KIT_URL with the pinned version: /kit/0.1.0/ by default.
  const kitBase = kit.url;
  if (!kitBase.endsWith(`/${kit.version}/`)) fail(`the kit's address (${kitBase}) doesn't name its version, ${kit.version}`);
  const kitImports = Object.entries(map.imports).filter(([, url]) => url.startsWith(kitBase));
  if (kitImports.length === 0) fail(`the import map names nothing under ${kitBase}`);
  const unhashed = kitImports.filter(([, url]) => !map.integrity?.[url]);
  if (unhashed.length > 0) fail(`kit files without a hash in the import map: ${unhashed.map(([name]) => name).join(', ')}`);
  for (const name of ['react', 'react-dom']) if (!map.imports[name]?.startsWith(kitBase)) fail(`${name} doesn't come from the kit (${map.imports[name] ?? 'not in the import map'})`);
  if (kitImports.length > 0 && unhashed.length === 0) pass(`the import map takes ${kitImports.length} kit entries from ${kitBase}, each with its hash`);

  for (const app of apps) {
    await page.goto(new URL(`/@me/${app}`, base).href);
    const frame = page.locator(`[data-app="${app}"]`).first();
    try {
      await frame.waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      const text = (await frame.innerText()).trim();
      if (text.length === 0) fail(`${app} opens but shows nothing`);
      else pass(`${app} renders (${text.split('\n')[0].slice(0, 60)})`);
    } catch {
      fail(`${app} didn't render at /@me/${app}`);
    }
    await shot(app);
  }

  if (await page.locator('#augur-kit-failed').count()) fail(`the page says the kit couldn't load: ${await page.locator('#augur-kit-failed').innerText()}`);
  const kitFiles = loaded.filter((path) => path.startsWith(kitBase));
  if (kitFiles.length === 0) fail(`no kit file was loaded from ${kitBase}`);
  else pass(`${kitFiles.length} kit files loaded from ${kitBase}`);
  for (const app of apps.filter((id) => !['home', 'admin', 'upgrades'].includes(id))) {
    if (!loaded.some((path) => path.startsWith(`/apps/${app}/`))) fail(`${app}'s frontend wasn't loaded from /apps/${app}/`);
  }
} catch (err) {
  fail(`stopped: ${err.message.split('\n')[0]}`);
  // What was on screen, so a failure in CI can be read from its log alone.
  const seen = await page.locator('body').innerText().catch(() => '');
  console.error(`  at ${page.url()} ("${await page.title().catch(() => '')}"): ${seen.replace(/\s+/g, ' ').trim().slice(0, 400)}`);
  await shot('stopped').catch(() => {});
} finally {
  await browser.close();
}

if (badResponses.length > 0) fail(`requests that failed: ${[...new Set(badResponses)].join('; ')}`);
if (errors.length > 0) fail(`errors in the page: ${[...new Set(errors)].join('; ')}`);
if (consoleErrors.length > 0) console.error(`Console errors (not failed): ${[...new Set(consoleErrors)].join('; ')}`);
if (failures.length > 0) {
  console.error(`Browser check: ${failures.length} failed.`);
  process.exit(1);
}
console.error('Browser check passed.');
