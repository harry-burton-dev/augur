// The way back (public/recover/): its sign-in round trip, what it shows, and asking twice before it goes back.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.__AUGUR_RECOVER_TEST__ = true;
const recover = await import('../public/recover/recover.js');
const { PENDING_KEY, signInUrl, newPending, whyNot, start, ASK_AGAIN_MS } = recover;

const updates = (more = {}) => ({
  running: { version: '0.25.0', channel: 'beta' },
  channel: 'beta',
  feed: 'on',
  newer: [],
  needsYou: [],
  updaterSeenAt: '2026-11-09T20:00:00Z',
  goBack: [
    { version: '0.24.1', channel: 'beta' },
    { version: '0.23.0', channel: 'beta', breakingAfter: '0.24.0' },
  ],
  ...more,
});

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A window at `href`, with storage, and the page's root. */
const page = (href) => {
  document.body.innerHTML = '<div id="recover"></div>';
  const url = new URL(href);
  const store = new Map();
  const win = {
    location: { origin: url.origin, pathname: url.pathname, search: url.search, assign: vi.fn() },
    history: { replaceState: vi.fn() },
    crypto: globalThis.crypto,
    fetch: vi.fn(),
  };
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  return { win, storage, store, root: () => document.getElementById('recover') };
};

const buttons = () => [...document.querySelectorAll('#recover button')];
const press = (label) => buttons().find((b) => b.textContent === label).click();

describe('the way back', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => vi.useRealTimers());

  it('asks Keycloak for a fresh sign-in with PKCE, as the shell’s client', async () => {
    const pending = await newPending();
    const url = new URL(signInUrl('https://augur.example', 'https://augur.example/recover/', pending));
    expect(url.pathname).toBe('/sso/realms/platform/protocol/openid-connect/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ client_id: 'shell', response_type: 'code', code_challenge_method: 'S256', max_age: '0', state: pending.state, redirect_uri: 'https://augur.example/recover/' });
    expect(pending.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pending.challenge).not.toBe(pending.verifier);
  });

  it('signs in, keeping only the verifier and state for the round trip', async () => {
    const p = page('https://augur.example/recover/');
    await start({ doc: document, win: p.win, fetchFn: p.win.fetch, storage: p.storage });
    press('Sign in');
    await vi.waitFor(() => expect(p.win.location.assign).toHaveBeenCalled());
    const kept = JSON.parse(p.store.get(PENDING_KEY));
    expect(new URL(p.win.location.assign.mock.calls[0][0]).searchParams.get('state')).toBe(kept.state);
  });

  it('back from signing in, trades the code, takes it off the address and shows what the server runs', async () => {
    const p = page('https://augur.example/recover/?code=abc&state=s1');
    p.store.set(PENDING_KEY, JSON.stringify({ state: 's1', verifier: 'v1' }));
    p.win.fetch.mockImplementation(async (url, init) => {
      if (String(url).endsWith('/token')) {
        expect(init.body.get('code_verifier')).toBe('v1');
        return json(200, { access_token: 't1' });
      }
      expect(init.headers.authorization).toBe('Bearer t1');
      return json(200, updates());
    });
    await start({ doc: document, win: p.win, fetchFn: p.win.fetch, storage: p.storage });
    expect(p.win.history.replaceState).toHaveBeenCalledWith(null, '', 'https://augur.example/recover/');
    expect(p.store.has(PENDING_KEY)).toBe(false);
    expect(p.root().textContent).toContain('0.25.0, on the beta channel');
    const breaking = buttons().find((b) => b.textContent === 'Go back to 0.23.0');
    expect(breaking.disabled).toBe(true);
    expect(document.getElementById(breaking.getAttribute('aria-describedby')).textContent).toMatch(/0\.24\.0 is breaking in between/);
  });

  it('refuses an answer it didn’t ask for', async () => {
    const p = page('https://augur.example/recover/?code=abc&state=other');
    p.store.set(PENDING_KEY, JSON.stringify({ state: 's1', verifier: 'v1' }));
    await start({ doc: document, win: p.win, fetchFn: p.win.fetch, storage: p.storage });
    expect(p.win.fetch).not.toHaveBeenCalled();
    expect(p.root().querySelector('[role=alert]').textContent).toMatch(/wasn’t one this page asked for/);
  });

  it('goes back only on a second press, then follows the change', async () => {
    const p = page('https://augur.example/recover/?code=abc&state=s1');
    p.store.set(PENDING_KEY, JSON.stringify({ state: 's1', verifier: 'v1' }));
    const sent = [];
    p.win.fetch.mockImplementation(async (url, init) => {
      if (String(url).endsWith('/token')) return json(200, { access_token: 't1' });
      if (init.method === 'PUT') {
        sent.push(JSON.parse(init.body));
        return json(202, updates({ upgrade: { id: 'u1', from: '0.25.0', version: '0.24.1', state: 'requested', steps: [] } }));
      }
      return json(200, updates());
    });
    await start({ doc: document, win: p.win, fetchFn: p.win.fetch, storage: p.storage });
    press('Go back to 0.24.1');
    expect(sent).toEqual([]);
    expect(buttons().some((b) => b.textContent === 'Press again: go back to 0.24.1 now')).toBe(true);
    press('Press again: go back to 0.24.1 now');
    await vi.waitFor(() => expect(sent).toEqual([{ version: '0.24.1' }]));
    await vi.waitFor(() => expect(p.root().textContent).toContain('0.25.0 to 0.24.1: waiting for the updater'));
    expect(buttons().find((b) => b.textContent === 'Go back to 0.24.1').disabled).toBe(true);
  });

  it('forgets a first press after a while', async () => {
    const p = page('https://augur.example/recover/?code=abc&state=s1');
    p.store.set(PENDING_KEY, JSON.stringify({ state: 's1', verifier: 'v1' }));
    p.win.fetch.mockImplementation(async (url) => (String(url).endsWith('/token') ? json(200, { access_token: 't1' }) : json(200, updates())));
    await start({ doc: document, win: p.win, fetchFn: p.win.fetch, storage: p.storage });
    press('Go back to 0.24.1');
    vi.advanceTimersByTime(ASK_AGAIN_MS);
    expect(buttons().some((b) => b.textContent === 'Go back to 0.24.1')).toBe(true);
  });

  it('shows a refusal in the server’s words and asks to sign in again on a 401', async () => {
    const p = page('https://augur.example/recover/?code=abc&state=s1');
    p.store.set(PENDING_KEY, JSON.stringify({ state: 's1', verifier: 'v1' }));
    p.win.fetch.mockImplementation(async (url) =>
      String(url).endsWith('/token') ? json(200, { access_token: 't1' }) : json(403, { error: 'forbidden', message: 'Only a deployment admin can do that.' }),
    );
    await start({ doc: document, win: p.win, fetchFn: p.win.fetch, storage: p.storage });
    expect(p.root().querySelector('[role=alert]').textContent).toBe('Only a deployment admin can do that.');
  });

  it('keeps the Upgrade Centre’s reasons for a release it can’t go back to', () => {
    expect(whyNot({ version: '1', channel: 'beta', halted: { reason: 'it lost data' } }, updates())).toBe('Halted: it lost data');
    expect(whyNot({ version: '1', channel: 'beta' }, updates({ upgrade: { state: 'running' } }))).toBe('Wait for the upgrade under way to finish.');
    expect(whyNot({ version: '1', channel: 'beta' }, updates())).toBeUndefined();
  });
});
