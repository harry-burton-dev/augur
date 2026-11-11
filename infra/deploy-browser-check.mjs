// Opens a running AUGUR in a real browser, as its first admin would, and checks what unit and
// contract tests can't see on a release's own images: sign-in works, the shell and the apps that
// ship with it render, and the UI kit comes from KIT_URL, held to its hashes (ADR 0048).
// infra/deploy-test.sh runs it in Playwright's container after a fresh install. See The deploy test in the AUGUR handbook, 03 Architecture/Engineering.
//
//   node deploy-browser-check.mjs <front door> <admin user> <admin password> <app id>...
//
// With APP_RELEASE (an app's release file), ISSUER (the sign-in realm) and APP_SECRET (the app's sign-in secret,
// as the app runner works it out), the same admin then installs that app through the app runner, as broken mode
// does with Starter: it signs in from the command line as well (the device grant, approved in this browser),
// installs the release, opens the app, has infra/deploy-test.sh stop its parts (it writes $OUT/<id>.stop and
// waits for $OUT/<id>.stopped), sees the pane say it failed, removes it, and checks its sign-in is gone.
//
// Writes a screenshot of each page to $OUT (default ./browser-check) and exits 1 on any failure.
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

// The app the app runner installs, when there is one.
const release = process.env.APP_RELEASE ? JSON.parse(readFileSync(process.env.APP_RELEASE, 'utf8')) : undefined;
if (release && (!process.env.ISSUER || !process.env.APP_SECRET)) {
  console.error('APP_RELEASE needs ISSUER (the sign-in realm) and APP_SECRET (the app’s sign-in secret) too.');
  process.exit(2);
}
// Calls that are meant to fail: an app's own API once its parts are stopped on purpose.
const meantToFail = [];

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
  if (meantToFail.some((prefix) => url.pathname.startsWith(prefix))) return;
  if (res.status() >= 500 || (res.status() >= 400 && isCode(url.pathname))) badResponses.push(`${url.pathname} (HTTP ${res.status()})`);
});
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
// What the first admin ends up signing in with, for the sign-in pages the device grant may show again.
const account = { password, totp: undefined, signedInAt: 0 };
// Keycloak takes each one-time code once: the 30-second step last used, so the next code waits for a new one.
let lastTotpStep = -1;
async function freshTotp(secret) {
  while (Math.floor(Date.now() / 30_000) <= lastTotpStep) await sleep(1_000);
  lastTotpStep = Math.floor(Date.now() / 30_000);
  return totp(secret);
}
// Every call to AUGUR from here gives up after this long, so one that hangs fails the check rather than the job.
const CALL_MS = 30_000;
// How long after a sign-in a job is still asked for on it: well inside the registry's 10 minutes.
const SIGN_IN_FRESH_MS = 3 * 60_000;

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
      account.password = fresh;
      await page.locator('#password-new').fill(fresh);
      await page.locator('#password-confirm').fill(fresh);
      await page.locator('[type=submit]').first().click();
    } else if (page.url().includes('CONFIGURE_TOTP')) {
      await page.locator('#mode-manual').click();
      const secret = (await page.locator('#kc-totp-secret-key').innerText()).replace(/\s+/g, '');
      account.totp = secret;
      await page.locator('#totp').fill(await freshTotp(secret));
      await page.locator('#userLabel').fill('deploy test');
      await page.locator('[type=submit]').first().click();
    }
    await page.waitForURL((url) => signedIn(url) || url.href !== before, { timeout: 30_000 }).catch(() => {});
  }
  await page.waitForURL(signedIn, { timeout: 30_000 });
  account.signedInAt = Date.now();
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

  if (release) await throughTheRunner(release);
} catch (err) {
  fail(`stopped: ${err.message.split('\n')[0]}`);
  // What was on screen, so a failure in CI can be read from its log alone.
  const seen = await page.locator('body').innerText().catch(() => '');
  console.error(`  at ${page.url()} ("${await page.title().catch(() => '')}"): ${seen.replace(/\s+/g, ' ').trim().slice(0, 400)}`);
  await shot('stopped').catch(() => {});
} finally {
  await browser.close();
}

/** The realm's OpenID Connect endpoints, under ISSUER. */
function endpoint(path) {
  return `${process.env.ISSUER.replace(/\/$/, '')}/protocol/openid-connect/${path}`;
}
async function form(path, fields) {
  const res = await fetch(endpoint(path), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields), signal: AbortSignal.timeout(CALL_MS) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Signs the admin in from the command line, as `pnpm seed` does (the device grant on the realm's command-line
 * client), approving the code in this browser: on its session, or with the password and a one-time code once
 * freshSignIn has cleared it. Gives a fresh access token on each call, refreshed, which keeps the sign-in's auth_time.
 */
async function commandLineSignIn() {
  const clientId = process.env.CLI_CLIENT ?? 'platform-cli';
  const start = await form('auth/device', { client_id: clientId, scope: 'openid' });
  if (start.status !== 200) throw new Error(`the realm won't start a device sign-in for ${clientId} (HTTP ${start.status}: ${start.body.error ?? ''})`);
  const code = start.body;
  let tokens;
  const poll = (async () => {
    const until = Date.now() + (code.expires_in ?? 300) * 1000;
    let interval = (code.interval ?? 5) * 1000;
    while (Date.now() < until) {
      await sleep(interval);
      const res = await form('token', { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: code.device_code, client_id: clientId }).catch(
        // A look that timed out: the next one may answer.
        () => ({ status: 0, body: { error: 'authorization_pending' } }),
      );
      if (res.status === 200) return (tokens = res.body);
      if (res.body.error === 'slow_down') interval += 5000;
      else if (res.body.error !== 'authorization_pending') throw new Error(`the device sign-in failed (${res.body.error ?? res.status})`);
    }
    throw new Error('the device sign-in code ran out before it was approved');
  })();
  // Awaited below; until then a rejection is held here, not left unhandled.
  poll.catch(() => {});
  // Keycloak's pages for the code, read by their fields: the code to confirm, a grant to accept, or a sign-in again.
  await page.goto(code.verification_uri_complete ?? code.verification_uri);
  for (let step = 0; step < 8 && !tokens; step++) {
    await page.waitForLoadState('domcontentloaded');
    const before = page.url();
    const has = async (selector) => (await page.locator(selector).count()) > 0 && (await page.locator(selector).first().isVisible());
    if (await has('#username')) {
      await page.locator('#username').fill(user);
      await page.locator('#password').fill(account.password);
      await page.locator('#kc-login').click();
    } else if (await has('#otp')) {
      if (!account.totp) throw new Error('the device sign-in asks for a one-time code the check doesn’t have');
      await page.locator('#otp').fill(await freshTotp(account.totp));
      await page.locator('[type=submit]').first().click();
    } else if (await has('input[name="device_user_code"], #device-user-code')) {
      await page.locator('input[name="device_user_code"], #device-user-code').first().fill(code.user_code);
      await page.locator('[type=submit]').first().click();
    } else if (await has('input[name="accept"], button[name="accept"]')) {
      await page.locator('input[name="accept"], button[name="accept"]').first().click();
    } else {
      // Nothing left to answer: the code is approved, and the poll hears it.
      await Promise.race([poll, sleep(10_000)]);
      continue;
    }
    await page.waitForURL((url) => url.href !== before, { timeout: 15_000 }).catch(() => {});
  }
  let current = await poll;
  let expires = Date.now() + (current.expires_in ?? 60) * 1000;
  return async () => {
    if (current.refresh_token && Date.now() > expires - 30_000) {
      const res = await form('token', { grant_type: 'refresh_token', refresh_token: current.refresh_token, client_id: clientId });
      if (res.status !== 200) throw new Error(`the command-line sign-in couldn't be renewed (${res.body.error ?? res.status})`);
      current = res.body;
      expires = Date.now() + (current.expires_in ?? 60) * 1000;
    }
    return current.access_token;
  };
}

/**
 * A command-line sign-in on a fresh browser session: its cookies cleared, so the device code is approved with the
 * password and a one-time code again, and the token's auth_time is now. Installing or removing an app needs a
 * sign-in from the last 10 minutes, and a refreshed token, or a device grant on the old session, keeps the old one.
 */
async function freshSignIn() {
  await page.context().clearCookies();
  const token = await commandLineSignIn();
  account.signedInAt = Date.now();
  return token;
}
/** Asks the app runner for a job (POST /app-runner/jobs) and waits until it has finished; returns the job. */
async function runnerJob(token, body, minutes) {
  const api = new URL('/api/registry/v1/app-runner/jobs', base).href;
  const headers = async () => ({ authorization: `Bearer ${await token()}`, 'content-type': 'application/json' });
  const asked = await fetch(api, { method: 'POST', headers: await headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(CALL_MS) });
  const job = await asked.json().catch(() => ({}));
  if (asked.status !== 202) throw new Error(`the registry refused to ${body.action} ${body.app ?? body.release?.id} (HTTP ${asked.status}): ${job.message ?? JSON.stringify(job)}`);
  const until = Date.now() + minutes * 60_000;
  let seen = job;
  while (Date.now() < until) {
    await sleep(5_000);
    try {
      const res = await fetch(`${api}?app=${encodeURIComponent(job.app)}`, { headers: await headers(), signal: AbortSignal.timeout(CALL_MS) });
      if (res.ok) seen = (await res.json()).jobs.find((j) => j.id === job.id) ?? seen;
    } catch (err) {
      // One look that timed out or failed: the next one may answer.
      console.error(`  (the job's state couldn't be read: ${err.message})`);
    }
    if (['done', 'failed', 'cancelled'].includes(seen.state)) break;
  }
  const steps = (seen.steps ?? []).map((s) => `${s.step} ${s.state}${s.message ? `: ${s.message}` : ''}`).join('; ');
  if (seen.state !== 'done') throw new Error(`the app runner's ${body.action} of ${job.app} ended ${seen.state} after ${minutes} minutes at most${seen.message ? `: ${seen.message}` : ''} (${steps || 'no steps reported'})`);
  pass(`the app runner did the ${body.action} of ${job.app} (${steps})`);
  return seen;
}

/** Whether the app's own sign-in (its client in the realm, client-credentials grant) gives a token: the HTTP status and error. */
async function appSignIn(id) {
  const res = await form('token', { grant_type: 'client_credentials', client_id: `app-${id}`, client_secret: process.env.APP_SECRET });
  return { ok: res.status === 200 && Boolean(res.body.access_token), said: `HTTP ${res.status}${res.body.error ? ` ${res.body.error}` : ''}` };
}

/** Opens the app's pane and gives it time to ask its service: the pane, and what it says. */
async function openApp(id) {
  await page.goto(new URL(`/@me/${id}`, base).href);
  const pane = page.locator(`[data-app="${id}"]`).first();
  await pane.waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  return pane;
}

/**
 * The app runner, end to end, with the release in APP_RELEASE: installed, opened, its parts stopped and the pane
 * saying so, removed, and its sign-in gone. Its name and id come from its manifest, nothing from here.
 */
async function throughTheRunner(r) {
  const id = r.id;
  const name = r.manifest?.name ?? id;
  const token = Date.now() - account.signedInAt > SIGN_IN_FRESH_MS ? await freshSignIn() : await commandLineSignIn();
  pass('the first admin signs in from the command line too (device grant)');

  await runnerJob(token, { action: 'install', release: r }, 8);
  let pane;
  try {
    pane = await openApp(id);
    const text = (await pane.innerText()).trim();
    if (text.length === 0) fail(`${name} opens but shows nothing`);
    else if (await pane.getByRole('alert').count()) fail(`${name} opens saying something failed: ${(await pane.getByRole('alert').first().innerText()).replace(/\s+/g, ' ')}`);
    else pass(`${name} opens once installed (${text.split('\n')[0].slice(0, 60)})`);
    if (!loaded.some((path) => path.startsWith(`/apps/${id}/`))) fail(`${name}'s frontend wasn't loaded from /apps/${id}/`);
  } catch {
    fail(`${name} didn't open at /@me/${id} once installed`);
  }
  await shot(`${id}-installed`);
  const before = await appSignIn(id);
  if (before.ok) pass(`${name}'s own sign-in (app-${id}) gives a token while it's installed`);
  else fail(`${name}'s own sign-in (app-${id}) gives no token while it's installed (${before.said})`);

  // Its parts stopped, as a crash would leave them: the gateway can't reach it, and its pane must say so.
  meantToFail.push(`/api/${id}/`);
  writeFileSync(join(out, `${id}.stop`), 'stop\n');
  const stopped = join(out, `${id}.stopped`);
  const until = Date.now() + 120_000;
  while (!existsSync(stopped) && Date.now() < until) await sleep(1_000);
  const said = existsSync(stopped) ? readFileSync(stopped, 'utf8').trim() : 'nothing within two minutes';
  if (said !== 'ok') fail(`${name}'s parts weren't stopped: infra/deploy-test.sh said ${said}`);
  else {
    try {
      pane = await openApp(id);
      const alert = pane.getByRole('alert').first();
      await alert.waitFor({ state: 'visible', timeout: 30_000 });
      pass(`with its parts stopped, ${name}'s pane says it failed (${(await alert.innerText()).replace(/\s+/g, ' ').slice(0, 80)})`);
    } catch {
      fail(`with its parts stopped, ${name}'s pane doesn't say anything failed: ${(await pane?.innerText().catch(() => '') ?? '').replace(/\s+/g, ' ').slice(0, 200)}`);
    }
    await shot(`${id}-stopped`);
  }

  // Signed in afresh for the removal: the install and the stop may have taken most of the 10 minutes.
  await runnerJob(await freshSignIn(), { action: 'remove', app: id }, 3);
  pass('the first admin signs in again, with a password and a one-time code, to remove it');
  const after = await appSignIn(id);
  if (!after.ok && after.said.includes('invalid_client')) pass(`once removed, ${name}'s own sign-in is refused (${after.said})`);
  else fail(`once removed, ${name}'s own sign-in still answers ${after.said}, not invalid_client`);
}

if (badResponses.length > 0) fail(`requests that failed: ${[...new Set(badResponses)].join('; ')}`);
if (errors.length > 0) fail(`errors in the page: ${[...new Set(errors)].join('; ')}`);
if (consoleErrors.length > 0) console.error(`Console errors (not failed): ${[...new Set(consoleErrors)].join('; ')}`);
if (failures.length > 0) {
  console.error(`Browser check: ${failures.length} failed.`);
  process.exit(1);
}
console.error('Browser check passed.');
