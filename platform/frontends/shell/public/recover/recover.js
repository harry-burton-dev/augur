/*
 * The way back (ADR 0083): a page that works when the shell, the kit or an app won't, so a deployment admin can
 * still see what the server runs and take it back to an earlier release. It loads nothing but itself: no kit, no
 * React, no shell. It signs in on its own with the shell's sign-in client (authorization code with PKCE), always
 * asking for the password, because going back needs a fresh sign-in; it keeps the token in memory only. Then it
 * reads the registry's Updates page through the gateway and asks for the same go-back the Upgrade Centre does
 * (PUT /api/registry/v1/platform/go-back). Everything the server refuses, it shows in the server's own words.
 */

/** Where the shell signs in: the same realm and client, so the token is the shell's kind (main.tsx). */
export const REALM = '/sso/realms/platform/protocol/openid-connect';
export const CLIENT_ID = 'shell';
export const REGISTRY = '/api/registry/v1';
/** What the round trip to sign in keeps, for this tab only, until it is back. */
export const PENDING_KEY = 'augur-recover:pending';
/** How often to look again while an upgrade or a go-back is waiting or under way, and how long a first press of Go back waits for the second. */
export const POLL_MS = 2000;
export const ASK_AGAIN_MS = 5000;

const STEP_WORDS = {
  preflight: 'Checking the server can take it',
  backup: 'Taking a backup and testing it',
  pull: 'Fetching the images',
  'roll-forward': 'Restarting each part',
  verify: 'Checking each part answers',
  watch: 'Watching it',
  'roll-back': 'Going back to where it was',
};
const STATE_WORDS = { running: 'under way', done: 'done', failed: 'failed' };

/** Bytes as base64url, without padding (RFC 7636). */
export const base64url = (bytes) => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** A fresh PKCE verifier and its S256 challenge, and a state to match the answer to the ask. */
export const newPending = async (cryptoApi = globalThis.crypto) => {
  const verifier = base64url(cryptoApi.getRandomValues(new Uint8Array(32)));
  const state = base64url(cryptoApi.getRandomValues(new Uint8Array(16)));
  const challenge = base64url(await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return { verifier, state, challenge };
};

/** This page's own address, which the sign-in comes back to. */
export const returnTo = (location) => `${location.origin}${location.pathname}`;

/** Where to send the browser to sign in. `max_age=0` makes Keycloak ask for the password, so the sign-in is fresh enough to go back. */
export const signInUrl = (origin, back, pending) => {
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'openid',
    redirect_uri: back,
    state: pending.state,
    code_challenge: pending.challenge,
    code_challenge_method: 'S256',
    max_age: '0',
  });
  return `${origin}${REALM}/auth?${q}`;
};

/** Trades the code the sign-in came back with for a token. */
export const exchange = async (fetchFn, back, code, verifier) => {
  const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: CLIENT_ID, code, redirect_uri: back, code_verifier: verifier });
  const res = await fetchFn(`${REALM}/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.access_token !== 'string') throw new Error(data.error_description || 'Signing in didn’t finish. Sign in again.');
  return data.access_token;
};

/** Whether an upgrade or a go-back is waiting or under way. */
export const busy = (updates) => updates?.upgrade?.state === 'requested' || updates?.upgrade?.state === 'running';

/** Why the server can't go back to `target` from here now, or nothing when it can: the Upgrade Centre's own rules. */
export const whyNot = (target, updates) =>
  target.halted
    ? `Halted: ${target.halted.reason}`
    : target.problem
      ? target.problem
      : target.breakingAfter
        ? `${target.breakingAfter} is breaking in between, so going back needs the backup (docs/upgrade.md, Going back).`
        : busy(updates)
          ? 'Wait for the upgrade under way to finish.'
          : undefined;

/** What a refused call says, in the server's words when it gave some. */
export const refusalOf = async (res) => {
  const data = await res.json().catch(() => ({}));
  return { status: res.status, code: data.error, message: data.message ?? `That didn’t work (${res.status}). Nothing was changed.` };
};

const el = (doc, tag, props = {}, ...children) => {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'onclick') node.addEventListener('click', v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c) node.append(c);
  return node;
};

/**
 * Draws what the page knows into `root`: signed out, a problem, or the server's Updates page. `on` holds what
 * its buttons do. Built from text nodes only: nothing the server says is ever read as markup.
 */
export const draw = (doc, root, view, on) => {
  root.replaceChildren();
  if (view.problem) root.append(el(doc, 'p', { role: 'alert', class: 'problem', text: view.problem }));
  if (!view.token) {
    root.append(
      el(doc, 'p', { text: 'Sign in as a deployment admin. You’ll be asked for your password, because going back needs it.' }),
      el(doc, 'button', { type: 'button', onclick: on.signIn, text: 'Sign in' }),
    );
    return;
  }
  const u = view.updates;
  if (!u) {
    root.append(el(doc, 'p', { text: view.loading ? 'Asking the server what it runs…' : 'The server didn’t say what it runs.' }));
    if (!view.loading) root.append(el(doc, 'button', { type: 'button', onclick: on.reload, text: 'Ask again' }));
    return;
  }
  const running = `${u.running.version}${u.running.build === 'source' ? ', built from source' : ''}, on the ${u.running.channel} channel`;
  root.append(el(doc, 'h2', { text: 'What it runs' }), el(doc, 'p', { class: 'running', text: running }));
  if (u.updaterSeenAt === undefined) root.append(el(doc, 'p', { class: 'note', text: 'The server’s updater hasn’t been heard from, so a go-back asked for here waits until it is. Without one, go back by hand (docs/upgrade.md, Going back).' }));

  const up = u.upgrade;
  if (up) {
    const heading = busy(u) ? `${up.from} to ${up.version}: ${up.state === 'requested' ? 'waiting for the updater' : 'under way'}` : `Last: ${up.from} to ${up.version}, ${up.state}`;
    const steps = el(doc, 'ol', { class: 'steps' });
    for (const s of up.steps ?? []) steps.append(el(doc, 'li', { 'data-state': s.state, text: `${STEP_WORDS[s.step] ?? s.step}: ${STATE_WORDS[s.state] ?? s.state}` }));
    root.append(el(doc, 'h2', { text: 'The latest change' }), el(doc, 'p', { text: heading }), up.message ? el(doc, 'p', { class: 'note', text: up.message }) : null, steps);
  }

  const targets = u.goBack ?? [];
  root.append(el(doc, 'h2', { text: 'Go back' }));
  if (targets.length === 0) {
    root.append(el(doc, 'p', { text: 'There is no earlier release this server can go back to from here. The manual way is in docs/upgrade.md, Going back.' }));
    return;
  }
  const list = el(doc, 'ul', { class: 'targets' });
  for (const t of targets.slice(0, 5)) {
    const why = whyNot(t, u);
    const asking = view.asking === t.version;
    const label = asking ? `Press again: go back to ${t.version} now` : `Go back to ${t.version}`;
    const reasonId = `why-${t.version.replace(/[^a-z0-9]/gi, '-')}`;
    list.append(
      el(
        doc,
        'li',
        {},
        el(doc, 'span', { class: 'version', text: `${t.version} (${t.channel}${t.released ? `, ${new Date(t.released).toLocaleDateString()}` : ''})` }),
        el(doc, 'button', { type: 'button', class: asking ? 'danger' : undefined, disabled: Boolean(why) || view.sending, 'aria-describedby': why ? reasonId : undefined, onclick: () => on.goBack(t.version), text: label }),
        why ? el(doc, 'span', { id: reasonId, class: 'why', text: why }) : null,
      ),
    );
  }
  root.append(list);
};

/** The page: signs in, reads the Updates page, follows a change under way, and asks for a go-back. */
export const start = async ({ doc = document, win = window, fetchFn = (...a) => win.fetch(...a), storage = win.sessionStorage } = {}) => {
  const root = doc.getElementById('recover');
  const view = { token: undefined, updates: undefined, problem: undefined, loading: false, asking: undefined, sending: false };
  let poll;
  let askTimer;
  const back = returnTo(win.location);
  const render = () => draw(doc, root, view, on);

  const signIn = async () => {
    const pending = await newPending(win.crypto);
    storage.setItem(PENDING_KEY, JSON.stringify({ state: pending.state, verifier: pending.verifier }));
    win.location.assign(signInUrl(win.location.origin, back, pending));
  };

  /** A call to the registry with the token; a refusal comes back as one, and a 401 ends the sign-in. */
  const call = async (method, path, body) => {
    let res;
    try {
      res = await fetchFn(`${REGISTRY}${path}`, {
        method,
        headers: { authorization: `Bearer ${view.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      return { refused: { status: 0, message: 'The server can’t be reached. Check your connection; nothing was changed.' } };
    }
    if (res.ok) return { data: await res.json().catch(() => undefined) };
    const refused = await refusalOf(res);
    if (res.status === 401) {
      view.token = undefined;
      refused.message = refused.code === 'sign_in_again' ? refused.message : 'Your sign-in ran out. Sign in again.';
    }
    return { refused };
  };

  const followIfBusy = () => {
    clearTimeout(poll);
    if (busy(view.updates)) poll = setTimeout(load, POLL_MS);
  };

  const load = async () => {
    view.loading = !view.updates;
    render();
    const { data, refused } = await call('GET', '/platform/updates');
    view.loading = false;
    if (data) {
      view.updates = data;
      view.problem = undefined;
    } else view.problem = refused.message;
    render();
    followIfBusy();
  };

  const goBack = async (version) => {
    if (view.asking !== version) {
      view.asking = version;
      clearTimeout(askTimer);
      askTimer = setTimeout(() => {
        view.asking = undefined;
        render();
      }, ASK_AGAIN_MS);
      render();
      return;
    }
    clearTimeout(askTimer);
    view.asking = undefined;
    view.sending = true;
    render();
    const { data, refused } = await call('PUT', '/platform/go-back', { version });
    view.sending = false;
    if (data) {
      view.updates = data;
      view.problem = undefined;
    } else view.problem = refused.message;
    render();
    followIfBusy();
  };

  const on = { signIn, reload: load, goBack };

  // Back from signing in: match the answer to the ask, trade the code, and take both off the address.
  const params = new URLSearchParams(win.location.search);
  const code = params.get('code');
  const error = params.get('error');
  if (code || error) {
    const kept = storage.getItem(PENDING_KEY);
    storage.removeItem(PENDING_KEY);
    win.history.replaceState(null, '', back);
    const pending = kept ? JSON.parse(kept) : undefined;
    if (error) view.problem = params.get('error_description') || 'Signing in didn’t finish. Sign in again.';
    else if (!pending || pending.state !== params.get('state')) view.problem = 'That sign-in wasn’t one this page asked for. Sign in again.';
    else {
      try {
        view.token = await exchange(fetchFn, back, code, pending.verifier);
      } catch (err) {
        view.problem = err.message;
      }
    }
  }
  if (view.token) await load();
  else render();
  return { view, load, goBack };
};

if (typeof document !== 'undefined' && document.getElementById('recover') && !globalThis.__AUGUR_RECOVER_TEST__) void start();
