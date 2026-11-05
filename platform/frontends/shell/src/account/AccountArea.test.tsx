import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Preferences } from '../host/preferences.js';
import { AccountApi, sessionOf } from './api.js';
import { AccountArea, type AccountAreaProps, type AccountSection } from './AccountArea.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A token whose sid claim is `sid`. */
const tokenFor = (sid: string) => `x.${btoa(JSON.stringify({ sid })).replace(/=+$/, '')}.y`;

const answers: Record<string, unknown> = {
  'GET /me/profile': { username: 'alex', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.org', emailVerified: true, managed: [] },
  'GET /me/security': {
    password: { set: true },
    codeApps: [{ id: 'c-1', type: 'otp', label: 'Phone', removeAction: 'delete_credential:c-1', removable: false, reason: 'Keep one.' }],
    passkeys: [],
    recoveryCodes: null,
    twoStep: { required: true, set: true },
    linked: [],
    canLink: [],
    actions: [
      { id: 'password', action: 'UPDATE_PASSWORD', available: true },
      { id: 'code-app', action: 'CONFIGURE_TOTP', available: true },
      { id: 'passkey', action: 'webauthn-register-passwordless', available: true },
      { id: 'recovery-codes', action: 'CONFIGURE_RECOVERY_AUTHN_CODES', available: true },
      { id: 'email', action: 'UPDATE_EMAIL', available: true },
    ],
  },
  'GET /me/sessions': {
    sessions: [
      { id: 's-here', startedAt: '2026-11-05T08:00:00Z', lastSeenAt: '2026-11-05T09:00:00Z', clients: ['shell'] },
      { id: 's-other', startedAt: '2026-11-04T08:00:00Z', lastSeenAt: '2026-11-04T09:00:00Z', ipAddress: '10.0.0.9', clients: ['shell'] },
    ],
  },
  'GET /me/sign-ins': { signIns: [{ time: '2026-11-05T07:59:00Z', kind: 'failed', event: 'LOGIN_ERROR', error: 'invalid_user_credentials' }] },
  'DELETE /me/sessions': { ended: 1 },
  'GET /me/leave': {},
  'POST /me/leave': { requestedAt: '2026-11-05T09:00:00Z', note: 'Friday' },
  'GET /me/data': { you: { id: 'u-1' } },
};

const fakeApi = () => {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace('/api/identity/v1', '');
    const method = init?.method ?? 'GET';
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (method === 'PATCH') return Response.json({ ...(answers['GET /me/profile'] as object), ...(JSON.parse(String(init!.body)) as object) });
    const key = `${method} ${path.split('?')[0]}`;
    return key in answers ? Response.json(answers[key]) : new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  return { api: new AccountApi({ getToken: async () => tokenFor('s-here'), fetchImpl }), calls };
};

let root: Root | undefined;
let host: HTMLDivElement | undefined;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
});

const open = async (section: AccountSection, over: Partial<AccountAreaProps> = {}) => {
  const { api, calls } = fakeApi();
  const props: AccountAreaProps = {
    section,
    onSection: vi.fn(),
    onClose: vi.fn(),
    api,
    prefs: {} as Preferences,
    onPreference: vi.fn(),
    onAction: vi.fn(),
    onSignOut: vi.fn(),
    apps: [{ id: 'board', name: 'Board' }],
    floors: [
      { id: 'w-me', name: 'Alex' },
      { id: 'w-fin', name: 'Finance' },
    ],
    ownFloor: 'w-me',
    appSettings: [],
    mountSettings: vi.fn(async () => true),
    unmountSettings: vi.fn(),
    shellClient: 'shell',
    product: 'AUGUR',
    ...over,
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<AccountArea {...props} />));
  await act(async () => new Promise((r) => setTimeout(r, 0)));
  return { props, calls, text: () => host!.textContent ?? '', button: (name: string) => [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim() === name) };
};

describe('the Account area', () => {
  it('reads a token’s sign-in session', () => {
    expect(sessionOf(tokenFor('abc'))).toBe('abc');
    expect(sessionOf('not-a-token')).toBeUndefined();
  });

  it('shows the profile and changes the email on Keycloak’s screen', async () => {
    const { text, button, props } = await open('profile');
    expect(text()).toContain('alex@example.org');
    await act(async () => button('Change email')!.click());
    expect(props.onAction).toHaveBeenCalledWith('UPDATE_EMAIL', 'profile');
  });

  it('says how they sign in, keeps the last code app a role needs, and marks this browser', async () => {
    const { text, button, props } = await open('security');
    expect(text()).toContain('This browser');
    expect(text()).toContain('From 10.0.0.9');
    expect(text()).toContain('Sign-in failed: wrong password');
    expect(button('Remove')?.getAttribute('aria-disabled') ?? button('Remove')?.disabled.toString()).toBeTruthy();
    await act(async () => button('Change password')!.click());
    expect(props.onAction).toHaveBeenCalledWith('UPDATE_PASSWORD', 'security');
    // the browser being used is never offered to sign out of
    expect([...document.querySelectorAll('button')].filter((b) => b.textContent === 'Sign out there')).toHaveLength(1);
  });

  it('signs out of one other place', async () => {
    const { button, calls } = await open('security');
    await act(async () => button('Sign out there')!.click());
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/me/sessions/s-other')).toBe(true);
  });

  it('chooses how each app’s notifications arrive', async () => {
    const { props, text } = await open('notifications', { prefs: { muted: [] } });
    expect(text()).toContain('Board');
    const toggle = document.querySelector<HTMLInputElement>('[role="switch"], input[type="checkbox"]');
    expect(toggle).toBeTruthy();
    expect(props.onPreference).not.toHaveBeenCalled();
  });

  it('pins apps, clears recent ones and mounts each app’s own settings', async () => {
    const mountSettings = vi.fn(async (el: HTMLElement) => {
      el.textContent = 'Board’s own choices';
      return true;
    });
    const { props, text, button } = await open('apps', { prefs: { pinned: ['gone'], recent: ['board'] }, appSettings: [{ id: 'board', name: 'Board' }], mountSettings });
    expect(text()).toContain('One pinned app isn’t on this floor');
    expect(text()).toContain('Board’s own choices');
    expect(mountSettings).toHaveBeenCalledWith(expect.any(HTMLElement), 'board');
    await act(async () => document.querySelector<HTMLElement>('[role="switch"], input[type="checkbox"]')!.click());
    expect(props.onPreference).toHaveBeenCalledWith('pinned', ['gone', 'board']);
    await act(async () => button('Clear recent apps')!.click());
    expect(props.onPreference).toHaveBeenCalledWith('recent', []);
  });

  it('says when the floor they start on isn’t theirs any more', async () => {
    const { text } = await open('apps', { prefs: { startFloor: 'w-old' } });
    expect(text()).toContain('The floor you chose isn’t one of yours any more.');
    expect(text()).toContain('No app on this floor has settings of its own.');
  });

  it('chooses each kind of notification an app names, unless the whole app is quiet', async () => {
    const kinds = [{ id: 'comment', label: 'Comments on your documents' }, { id: 'approval', label: 'Approvals' }];
    const { props, text } = await open('notifications', { prefs: { quietKinds: ['board:approval'] }, apps: [{ id: 'board', name: 'Board', kinds }] });
    expect(text()).toContain('Comments on your documents');
    const switches = [...document.querySelectorAll<HTMLInputElement>('.account-app [role="switch"], .account-app input[type="checkbox"]')];
    expect(switches).toHaveLength(3);
    await act(async () => switches[1]!.click());
    expect(props.onPreference).toHaveBeenCalledWith('quietKinds', ['board:approval', 'board:comment']);
    act(() => root?.unmount());
    const muted = await open('notifications', { prefs: { muted: ['board'] }, apps: [{ id: 'board', name: 'Board', kinds }] });
    expect(muted.text()).toContain('Every kind from Board is quiet while the whole app is.');
  });

  it('downloads their data, says who sees what, and asks to leave twice before it does', async () => {
    const made = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL: made, revokeObjectURL: vi.fn() });
    const { text, button, calls } = await open('privacy');
    expect(text()).toContain('What others see about you');
    await act(async () => button('Download my data')!.click());
    expect(made).toHaveBeenCalled();
    expect(text()).toContain('Saved my-data.json.');
    await act(async () => button('Ask to leave')!.click());
    expect(calls.some((c) => c.method === 'POST' && c.path === '/me/leave')).toBe(false);
    await act(async () => [...host!.querySelectorAll('button')].find((b) => b.textContent?.includes('Press again'))!.click());
    expect(calls.some((c) => c.method === 'POST' && c.path === '/me/leave')).toBe(true);
    expect(text()).toContain('You said: “Friday”');
    await act(async () => button('Take it back')!.click());
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/me/leave')).toBe(true);
    expect(button('Ask to leave')).toBeTruthy();
  });

  it('says when only one language is offered, and offers ways of writing dates and a clock', async () => {
    const { text } = await open('region', { prefs: { dateFormat: 'en-US', clock: '24' } });
    expect(text()).toContain('Your organisation offers only English. A deployment admin can offer more.');
    expect(text()).toContain('Write dates as in');
    expect(text()).toContain('12-hour');
    expect(text()).toContain('Time zone');
  });

  it('says once how the last of Keycloak’s screens went', async () => {
    const { text } = await open('security', { actionStatus: 'cancelled' });
    expect(text()).toContain('Nothing changed.');
  });

  it('closes on Escape', async () => {
    const { props } = await open('about', { version: 'AUGUR 0.15.0' });
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(props.onClose).toHaveBeenCalled();
  });
});
