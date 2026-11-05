// @vitest-environment happy-dom
import { createEventBus, type MountContext } from '@augur/mfe-sdk';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import admin, { screenFor } from './entry.js';
import { departmentPath, type AppInstalls, type AuditEntry, type CatalogueApp, type ComponentStatus, type Department, type Person } from './api.js';
import { appEyebrow, appStatus, floorStatus, floorTree, inboxWords, kindOf, kindWords, refusedKindNote, rollbackNote, scopeWords, uploadChoices } from './apps-model.js';
import { headline, stateOf } from './status.js';
import { describe as sentence, namesFrom, rangeFor } from './activity.js';
import { placeOf, portalLink } from './line.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const finance: Department = { id: 'd-1', name: 'Finance', members: ['u-1'] };
const payroll: Department = { id: 'd-2', name: 'Payroll', parentId: 'd-1', members: [] };
const alex: Person = { id: 'u-1', username: 'alex', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.org', enabled: true, invited: false, roles: ['admin'], departments: ['d-1'] };
const sam: Person = { id: 'u-2', username: 'sam', firstName: 'Sam', lastName: 'Okafor', email: 'sam@example.org', enabled: false, invited: false, roles: [], departments: [] };
const catalogue: CatalogueApp[] = [
  { id: 'admin', name: 'Admin', route: '/admin', entry: '/apps/admin/entry.js', version: '0.11.0', sdk: '^1.0.0', platform: true, enabled: true, icon: 'admin' },
  { id: 'upgrades', name: 'Upgrade Centre', route: '/upgrades', entry: '/apps/upgrades/entry.js', version: '0.1.0', sdk: '^1.9.0', platform: true, enabled: true, icon: 'download' },
];

type Answer = (method: string, url: string, body?: unknown) => Response | undefined;

/** A gateway that answers like identity, the registry, events and the gateway do, recording what was sent. */
const gateway = (more: Answer = () => undefined) => {
  const sent: { method: string; url: string; body?: unknown }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const u = String(url);
    sent.push({ method, url: u, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    const said = more(method, u, body);
    if (said) return said;
    if (u === '/api/identity/v1/admin/people' && method === 'GET') return json([alex, sam]);
    if (u === '/api/identity/v1/admin/departments') return json([finance, payroll]);
    if (u === '/api/identity/v1/admin/roles') return json([{ name: 'admin' }, { name: 'editor' }]);
    if (u === '/api/identity/v1/admin/levels') return json(method === 'PUT' ? { levels: (body as { levels: string[] }).levels, max: 5 } : { levels: ['Department', 'Team'], max: 5 });
    if (u === '/api/identity/v1/admin/people' && method === 'POST') return json({ person: { ...sam, id: 'u-3', ...(body as object), username: 'jo', enabled: true, invited: true }, temporaryPassword: 'abcd-efgh-jkmn' }, 201);
    if (u === '/api/registry/v1/apps') return json(catalogue);
    return json({ message: 'not here' }, 404);
  });
  vi.spyOn(globalThis, 'fetch').mockImplementation(fetchImpl as typeof fetch);
  return { sent, fetchImpl };
};

const own = { id: 'w-me', kind: 'personal' as const, name: 'You', slug: 'me', path: [], role: 'lead' as const };
const ctx = (path: string): MountContext => ({
  user: { id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] },
  getToken: async () => 'token',
  bus: createEventBus(),
  raise: vi.fn(),
  request: vi.fn(),
  notify: vi.fn(),
  workspace: own,
  getWorkspace: () => own,
  fetch: vi.fn(),
  path,
  previewOn: () => false,
});

/** Lets the services' answers land and React draw them. */
const settle = async (rounds = 8) => {
  for (let i = 0; i < rounds; i++) await act(async () => new Promise((r) => setTimeout(r, 5)));
};
let mounts: HTMLElement[] = [];
const open = async (path: string) => {
  window.history.replaceState(null, '', `/admin${path}`);
  const el = document.body.appendChild(document.createElement('div'));
  await act(async () => void (await admin.mount(el, ctx(path))));
  await settle();
  mounts.push(el);
  return el;
};
afterEach(async () => {
  for (const el of mounts) await act(async () => void (await admin.unmount?.(el)));
  mounts = [];
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const press = async (b: Element | null | undefined) => {
  expect(b, 'nothing to press').toBeTruthy();
  await act(async () => (b as HTMLElement).click());
  await settle();
};
/** A button by its words, anywhere on the page: dialogs draw outside the app. */
const button = (words: string, inside: ParentNode = document) => [...inside.querySelectorAll('button')].find((b) => b.textContent?.trim().replace(/^Esc/, '') === words);
const reasonOf = (b: Element | undefined) => document.getElementById(b?.getAttribute('aria-describedby') ?? '')?.textContent ?? '';
const shut = (b: Element | undefined) => b?.getAttribute('aria-disabled') === 'true' || (b as HTMLButtonElement | undefined)?.disabled === true;
/** A table's rows, each as its cells' words. */
const rowsOf = (el: ParentNode) => [...el.querySelectorAll('.quill-table-row')].map((r) => [...r.querySelectorAll('.quill-table-cell')].map((c) => c.textContent?.trim()));
const openRow = async (el: ParentNode, words: string) => press([...el.querySelectorAll('.quill-table-row')].find((r) => r.textContent?.includes(words))?.querySelector('.quill-table-cell'));
const fieldNamed = (label: string) => {
  const l = [...document.querySelectorAll('label')].find((x) => x.textContent?.replace(/Required|Optional/g, '').trim() === label);
  return (l?.htmlFor ? document.getElementById(l.htmlFor) : l?.closest('.augur-field')?.querySelector('input')) as HTMLInputElement;
};
const type = async (input: HTMLInputElement, text: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const title = (el: Element) => el.querySelector('.quill-page-head-title')?.textContent;

describe('admin', () => {
  it('opens the screen its path names', () => {
    expect(screenFor('/people')).toEqual({ screen: 'people', adding: false });
    expect(screenFor('/people/new')).toEqual({ screen: 'people', adding: true });
    expect(screenFor('/departments/new')).toEqual({ screen: 'departments', adding: true });
    expect(screenFor('/updates')).toEqual({ screen: 'updates', adding: false });
    expect(screenFor('/')).toEqual({ screen: 'people', adding: false });
  });

  it('calls with the caller’s token, names itself from the catalogue, moves between sections, and clears up', async () => {
    const { fetchImpl } = gateway();
    const el = await open('/people');
    expect(fetchImpl).toHaveBeenCalledWith('/api/identity/v1/admin/people', expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer token' }) }));
    expect(el.textContent).toContain('Upgrade Centre');
    await press(button('Departments', el));
    expect(title(el)).toBe('Departments');
    expect(window.location.pathname).toBe('/admin/departments');
    await act(async () => void (await admin.unmount!(el)));
    mounts = [];
    expect(el.querySelector('.quill-page-head-title')).toBeNull();
  });

  it('sends you to the Upgrade Centre through the shell', async () => {
    gateway();
    const el = await open('/people');
    const heard = vi.fn();
    window.addEventListener('popstate', heard);
    await press(button('Upgrade Centre', el));
    window.removeEventListener('popstate', heard);
    expect(window.location.pathname).toBe('/upgrades');
    expect(heard).toHaveBeenCalled();
  });
});

describe('People', () => {
  it('lists people with their department’s full name and where their sign-in stands', async () => {
    gateway();
    const el = await open('/people');
    expect(rowsOf(el).map((r) => [r[0], r[2], r[4]])).toEqual([
      ['Alex Rivera', 'Finance', 'Active'],
      ['Sam Okafor', '', 'Off'],
    ]);
  });

  it('adds a person and shows their one-time password once', async () => {
    const { sent } = gateway();
    await open('/people/new');
    await type(fieldNamed('First name'), 'Jo');
    await type(fieldNamed('Last name'), 'Smith');
    await type(fieldNamed('Email'), 'jo@example.org');
    await press(button('Add'));
    // Email isn't set up here, so a one-time password it is.
    expect(sent.find((c) => c.method === 'POST')!.body).toEqual({ start: 'temporary-password', firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org', roles: [], departments: [] });
    expect(document.querySelector('[data-password]')!.textContent!.trim()).toBe('abcd-efgh-jkmn');
    await press(button('Done'));
    expect(document.querySelector('[data-password]')).toBeNull();
  });

  it('won’t let an admin turn off their own sign-in, and says why', async () => {
    gateway();
    const el = await open('/people');
    await openRow(el, 'Alex Rivera');
    expect(shut(button('Turn off their sign-in'))).toBe(true);
    expect(document.querySelector('.augur-dialog')!.textContent).toContain('You can’t turn off your own sign-in.');
  });

  it('keeps what acts at once apart from Save, and asks twice before turning a sign-in off or giving a new password', async () => {
    const samOn = { ...sam, enabled: true };
    const { sent } = gateway((method, url, body) => {
      if (url === '/api/identity/v1/admin/people' && method === 'GET') return Response.json([alex, samOn]);
      if (url === '/api/identity/v1/admin/people/u-2' && method === 'PATCH') return Response.json({ ...samOn, ...(body as object) });
      if (url === '/api/identity/v1/admin/people/u-2/password') return Response.json({ temporaryPassword: 'pppp-qqqq-pppp' });
      return undefined;
    });
    const el = await open('/people');
    await openRow(el, 'Sam Okafor');
    const live = document.querySelector('[data-live]')!;
    expect(live.textContent).toContain('Takes effect at once');
    expect(document.querySelector('.augur-dialog-fields')!.textContent).toContain('Nothing here changes until you press Save.');
    expect(live.closest('.augur-dialog-fields')).toBeNull();

    // Turning off asks twice in place, and nothing is sent until the second press.
    await press(button('Turn off their sign-in'));
    expect(sent.some((c) => c.method === 'PATCH')).toBe(false);
    expect(live.textContent).toContain('Press again: they can’t sign in from now');
    await press(live.querySelector('[data-armed]'));
    expect(sent.find((c) => c.method === 'PATCH')!.body).toEqual({ enabled: false });
    expect(document.querySelector('[data-live-result]')!.textContent).toMatch(/Sign-in turned off/);

    // A new password asks twice too, then shows it once and says what happened.
    await press(button('Give them a new one-time password'));
    expect(sent.some((c) => c.url.endsWith('/u-2/password'))).toBe(false);
    await press(live.querySelector('[data-armed]'));
    expect(sent.some((c) => c.url.endsWith('/u-2/password'))).toBe(true);
    expect(document.querySelector('[data-password]')!.textContent!.trim()).toBe('pppp-qqqq-pppp');
    await press(button('Done'));
    expect(document.querySelector('[data-live-result]')!.textContent).toMatch(/New one-time password given/);
  });

  it('shows who asked to leave, and runs the leaver flow after asking twice', async () => {
    const samOn = { ...sam, enabled: true };
    const { sent } = gateway((method, url) => {
      if (url === '/api/identity/v1/admin/people' && method === 'GET') return Response.json([alex, samOn]);
      if (url === '/api/identity/v1/admin/leave-requests') return Response.json([{ person: 'u-2', requestedAt: '2026-11-01T09:00:00Z', note: 'Moving on' }]);
      if (url === '/api/identity/v1/admin/people/u-2/leave' && method === 'POST') return Response.json({ ...samOn, enabled: false });
      return undefined;
    });
    const el = await open('/people');
    expect(rowsOf(el).find((r) => r[0] === 'Sam Okafor')!.join(' ')).toContain('Asked to leave');
    await openRow(el, 'Sam Okafor');
    const live = document.querySelector('[data-live]')!;
    expect(live.querySelector('[data-leaver]')!.textContent).toContain('“Moving on”');
    await press(button('They’re leaving'));
    expect(sent.some((c) => c.url.endsWith('/u-2/leave'))).toBe(false);
    await press(live.querySelector('[data-armed]'));
    expect(sent.find((c) => c.url.endsWith('/u-2/leave'))!.body).toEqual({});
    expect(document.querySelector('[data-live-result]')!.textContent).toMatch(/They’ve left: signed out everywhere\. Apps keep what they own/);
  });

  it('invites by email when email works, says until when, and sends a new invite from their details', async () => {
    const invitee = { ...sam, id: 'u-3', firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org', enabled: true, invited: true, state: 'invited', invite: { method: 'email', expired: false, count: 1 } };
    const { sent } = gateway((method, url) => {
      if (url === '/api/identity/v1/admin/lifecycle') return Response.json({ email: true });
      if (url === '/api/identity/v1/admin/people' && method === 'POST')
        return Response.json({ person: invitee, invite: { method: 'email', sentTo: 'jo@example.org', expiresAt: '2026-11-08T09:00:00Z' } }, { status: 201 });
      if (url === '/api/identity/v1/admin/people/u-3/invite') return Response.json({ invite: { method: 'email', sentTo: 'jo@example.org', expiresAt: '2026-11-08T10:00:00Z' } });
      return undefined;
    });
    const el = await open('/people/new');
    await type(fieldNamed('First name'), 'Jo');
    await type(fieldNamed('Last name'), 'Smith');
    await type(fieldNamed('Email'), 'jo@example.org');
    await press(button('Add'));
    expect((sent.find((c) => c.method === 'POST')!.body as { start: string }).start).toBe('email');
    expect(document.querySelector('[data-password]')).toBeNull();
    expect(el.querySelector('[data-notice]')!.textContent).toContain('Invite sent to jo@example.org');
    await openRow(el, 'Jo Smith');
    await press(button('Send a new invite'));
    expect(sent.some((c) => c.url === '/api/identity/v1/admin/people/u-3/invite' && c.method === 'POST')).toBe(true);
    expect(document.querySelector('[data-live-result]')!.textContent).toContain('New invite sent to jo@example.org');
  });

  it('shows each account’s state and last sign-in, and keeps a leaver from coming back', async () => {
    const leaver = { ...sam, state: 'left', left: { at: '2026-11-03T09:00:00Z', by: 'u-1', handOverTo: 'u-1' } };
    gateway((method, url) => (url === '/api/identity/v1/admin/people' && method === 'GET' ? Response.json([{ ...alex, state: 'active', lastSignInAt: '2026-11-04T09:00:00Z' }, leaver]) : undefined));
    const el = await open('/people');
    const rows = rowsOf(el);
    expect(rows.find((r) => r[0] === 'Alex Rivera')![5]).toBe(new Date('2026-11-04T09:00:00Z').toLocaleDateString());
    expect(rows.find((r) => r[0] === 'Sam Okafor')![4]).toBe('Left');
    await openRow(el, 'Sam Okafor');
    expect(document.querySelector('[data-leaver]')!.textContent).toContain('handing their work to Alex Rivera');
    expect(shut(button('Turn their sign-in on'))).toBe(true);
    expect(shut(button('They’re leaving'))).toBe(true);
  });

  it('won’t let an admin run the leaver flow on themselves', async () => {
    gateway();
    const el = await open('/people');
    await openRow(el, 'Alex Rivera');
    expect(shut(button('They’re leaving'))).toBe(true);
  });
});

describe('Departments', () => {
  it('names a department with the ones it sits inside', () => {
    expect(departmentPath('d-2', [finance, payroll])).toBe('Finance / Payroll');
  });

  it('says each department’s level, and renames the levels, never leaving a gap between names', async () => {
    const { sent } = gateway();
    const el = await open('/departments');
    expect(rowsOf(el).map((r) => [r[0], r[1]])).toEqual([
      ['Finance', 'Department'],
      ['Finance / Payroll', 'Team'],
    ]);
    await press(button('Level names', el));
    await type(fieldNamed('At the top'), 'Division');
    await type(fieldNamed('Level 2'), '');
    await type(fieldNamed('Level 3'), 'Crew');
    await press(button('Save'));
    expect(document.querySelector('.augur-dialog-error')?.textContent).toMatch(/can’t be left without a name/);
    await type(fieldNamed('Level 2'), 'Squadron');
    await press(button('Save'));
    expect(sent.find((c) => c.method === 'PUT')!.body).toEqual({ levels: ['Division', 'Squadron', 'Crew'] });
    expect(rowsOf(el).map((r) => r[1])).toEqual(['Division', 'Squadron']);
  });
});

describe('Status', () => {
  const part = (name: string, state: ComponentStatus['state'], extra: Partial<ComponentStatus> = {}): ComponentStatus => ({ name, kind: 'service', state, ...extra });

  it('heads the screen with what needs a look first, in words that don’t rely on colour', () => {
    expect(headline([part('gateway', 'up'), part('registry', 'up')]).heading).toBe('Everything is running');
    expect(headline([part('gateway', 'up'), part('events', 'slow')]).heading).toBe('1 part is slow');
    expect(headline([part('events', 'slow'), part('registry', 'down'), part('sign-in', 'down')]).heading).toBe('2 parts are down');
    const stale = { state: 'attention' as const, problem: 'No backup has been test-restored yet.' };
    expect(headline([part('gateway', 'up')], stale)).toEqual({ heading: 'Backups need a look', summary: 'No backup has been test-restored yet.' });
    expect(['up', 'slow', 'down', 'checking'].map((state) => stateOf({ state: state as ComponentStatus['state'] }).label)).toEqual(['Running', 'Slow', 'Down', 'Checking']);
  });

  it('shows every part, what to check for one that’s down, that AUGUR is open to the internet, and that a release is out', async () => {
    const components = [part('gateway', 'up', { kind: 'gateway', version: '0.2.0' }), part('library', 'down', { kind: 'app', problem: 'It can’t be reached.' })];
    const backups = {
      state: 'ok',
      lastBackup: { at: '2026-10-22T02:00:00Z', ok: true, bytes: 52_000 },
      offsite: { at: '2026-10-22T02:01:00Z', ok: true, keepDays: 30 },
      pointInTime: { at: '2026-10-22T11:00:00Z', ok: true, earliest: '2026-10-16T02:01:00Z', lastTest: { at: '2026-10-19T02:03:00Z', ok: true } },
      lastRestoreTest: { at: '2026-10-19T02:01:00Z', ok: true, from: 'offsite', people: 3 },
    };
    gateway((_m, url) =>
      url === '/api/gateway/v1/status'
        ? Response.json({ components, backups, publicAccess: { open: true, until: '2026-10-28T18:00:00Z' }, email: { state: 'attention', relay: 'relay.example.org:587', from: 'augur@example.org', problem: 'AUGUR can’t reach the relay. Check SMTP_HOST.' } })
        : url === '/api/registry/v1/platform/updates'
          ? Response.json({ running: { version: '0.13.1', channel: 'stable' }, channel: 'stable', feed: 'on', newer: [], needsYou: [], available: { version: '0.13.2', channel: 'stable', breaking: [], parts: [] } })
          : undefined,
    );
    const el = await open('/status');
    expect(title(el)).toBe('1 part is down');
    expect(el.textContent).toContain('Backups restore cleanly');
    expect(el.textContent).toContain('30 days kept');
    expect(el.textContent).toContain('Restored from the copy off the server, 3 people');
    expect(el.textContent).toContain('Any moment since');
    expect(el.querySelector('[data-public]')!.textContent).toContain('infra/deploy/public.sh off');
    expect(el.textContent).toContain('AUGUR 0.13.2 is out.');
    expect(el.querySelector('[data-email]')!.textContent).toContain('Email needs a look');
    expect(el.textContent).toContain('relay.example.org:587');
    expect(el.textContent).toContain('Check SMTP_HOST.');
    await openRow(el, 'library');
    const dialog = document.querySelector('.augur-dialog')!;
    expect(dialog.textContent).toContain('It can’t be reached.');
    expect(dialog.textContent).toContain('People can’t use library while its service is down');
  });
});

describe('Activity', () => {
  const names = namesFrom([alex, sam], [finance, payroll], [{ id: 'library', name: 'Library' } as CatalogueApp]);
  const entry = (action: string, extra: Partial<AuditEntry> = {}): AuditEntry => ({ id: '1', at: '2026-10-22T10:00:00.000Z', actor: { id: 'u-1', kind: 'user' }, app: 'identity', action, ...extra });

  it('writes each change as a sentence with people’s, departments’ and apps’ names', () => {
    expect(sentence(entry('department.member-added', { target: 'd-1', detail: { person: 'u-2' } }), names)).toBe('Alex Rivera added Sam Okafor to Finance');
    expect(sentence(entry('person.updated', { target: 'u-2', detail: { roles: { from: [], to: ['admin'] }, firstName: {}, lastName: {} } }), names)).toBe('Alex Rivera changed Sam Okafor’s roles and name');
    expect(sentence(entry('app.updated', { app: 'registry', target: 'library', detail: { version: '0.3.0', heldAt: '0.1.0' } }), names)).toBe('Library registered version 0.3.0, kept but not used while it’s held at 0.1.0');
    expect(sentence(entry('app.blocked', { app: 'registry', target: 'library', detail: { workspace: 'd-1' } }), names)).toBe('Alex Rivera blocked Library for Finance and every team below it');
    expect(sentence(entry('document.published', { app: 'library', target: 'doc-7' }), names)).toBe('Alex Rivera: document.published (doc-7)');
  });

  it('turns a period into a time range', () => {
    const now = new Date(2026, 9, 22, 15, 30);
    expect(rangeFor('today', now)).toEqual({ since: new Date(2026, 9, 22).toISOString() });
    expect(rangeFor('week', now)).toEqual({ since: new Date(2026, 9, 16).toISOString() });
    expect(rangeFor('all', now)).toEqual({});
    expect(rangeFor('custom', now, '2026-10-01', '2026-10-02')).toEqual({ since: new Date(2026, 9, 1).toISOString(), until: new Date(2026, 9, 3).toISOString() });
  });

  it('asks for the last week, writes each change as a sentence, then pages to older ones', async () => {
    const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => entry('person.password-reset', { id: String(from - i), target: 'u-2' }));
    const { sent } = gateway((_m, url) => (url.startsWith('/api/events/v1/audit') ? Response.json(url.includes('before=') ? page(50, 3) : page(100, 50)) : undefined));
    const el = await open('/activity');
    const first = new URL(sent.find((c) => c.url.includes('/audit'))!.url, 'http://x');
    expect(first.searchParams.get('limit')).toBe('50');
    expect(first.searchParams.get('since')).toBeTruthy();
    expect(rowsOf(el)[0]?.[1]).toBe('Alex Rivera gave Sam Okafor a new password');
    await press(button('Show older', el));
    expect(sent.at(-1)!.url).toContain('before=51');
    expect(rowsOf(el)).toHaveLength(53);
    expect(button('Show older', el)).toBeUndefined();
  });
});

describe('Apps', () => {
  const library: CatalogueApp = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.2.0', sdk: '^1.0.0', platform: false, enabled: true, scopes: ['notifications:send'] };

  it('says why an app won’t open, what it may do, and what going back really does', () => {
    expect(appStatus({ ...library, sdk: '^2.0.0' }, '1.0.0')).toMatchObject({ status: 'warning', label: 'Won’t open' });
    expect(appStatus(library, '1.0.0')).toMatchObject({ status: 'done', label: 'On' });
    expect(appStatus({ ...library, enabled: false, blocked: 'x' }).label).toBe('Off');
    expect(appStatus({ ...library, blocked: 'Not allowed.' })).toMatchObject({ status: 'warning', label: 'Blocked' });
    expect(scopeWords(['notifications:send', 'audit:write'])).toBe('Notify people, Write to the activity log');
    expect(scopeWords(undefined)).toBe('Nothing beyond registering itself');
    const kinds = { kinds: [{ id: 'assignment', label: 'Assigned to you' }, { id: 'review', label: 'To review' }] };
    expect(inboxWords({ scopes: ['inbox:write'], grantedScopes: ['inbox:write'], inbox: kinds })).toBe('Assigned to you, To review');
    expect(inboxWords({ scopes: ['inbox:write'], grantedScopes: [], inbox: kinds })).toMatch(/until it’s allowed to put work in people’s inboxes/);
    expect(inboxWords({ scopes: [] })).toBeUndefined();
    const kept = (version: string, entry = library.entry) => ({ version, entry: { ...library, version, entry }, registeredBy: 'library', registeredAt: '', serving: false });
    expect(rollbackNote(library, kept('0.1.0'))).toMatch(/loads from the same address as 0.2.0/);
    expect(rollbackNote(library, kept('0.1.0', '/apps/library/0.1.0/entry.js'))).toBe('');
  });

  it('says what kind of app each is, from the kind in force, and why a claimed kind isn’t used', () => {
    expect(appStatus({ ...library, sdk: '^2.0.0' }, '1.0.0').why).toBe('It works with AUGUR SDK ^2.0.0; this deployment has 1.0.0.');
    const explorer = { ...library, id: 'auspex', name: 'Explorer', category: 'platform' as const, ships: true, pillar: true };
    const artifacts = { ...library, id: 'folio', name: 'Artifacts', category: 'pillar' as const, ships: true, pillar: true };
    const mandate = { ...library, id: 'mandate', name: 'Mandate', category: 'pillar' as const, registeredBy: 'mandate' };
    const rogue = { ...library, registeredBy: 'library', categoryRefused: { asked: 'pillar', why: 'x' } };
    expect([catalogue[0]!, explorer, artifacts, mandate, rogue].map((a) => kindWords(a).label)).toEqual(['Platform app', 'Platform app', 'Pillar app', 'Pillar app', 'App']);
    expect(appEyebrow(catalogue[0]!)).toBe('Platform app · built into AUGUR');
    expect(appEyebrow(explorer)).toBe('Platform app · ships with AUGUR');
    expect(appEyebrow(artifacts)).toBe('Pillar app · ships with AUGUR');
    expect(appEyebrow(mandate)).toBe('Pillar app · registered by mandate');
    expect(appEyebrow(rogue)).toBe('Registered by library');
    // A shipped app that says no kind, and a registry from before `ships`.
    expect(appEyebrow({ ...library, pillar: true })).toBe('Ships with AUGUR');
    // A kind this Admin doesn't know reads as an app.
    expect(kindOf({ ...library, category: 'tool' as never })).toBeUndefined();
    expect(refusedKindNote(rogue)).toBe('Its manifest says it’s a pillar app. Only apps that ship with AUGUR or come from its app feed can be one, so it’s listed as an app.');
    expect(refusedKindNote(mandate)).toBe('');
  });

  it('lists each app’s kind and explains a refused one in its dialog', async () => {
    const rogue = { ...library, registeredBy: 'library', categoryRefused: { asked: 'platform', why: 'x' } };
    gateway((_m, url) => (url === '/api/registry/v1/apps' ? Response.json([...catalogue, rogue]) : url.endsWith('/versions') || url.endsWith('/floors') ? Response.json([]) : undefined));
    const el = await open('/apps');
    expect(el.textContent).toContain('Kind');
    expect(el.textContent).toContain('Platform app');
    await openRow(el, 'Library');
    const dialog = document.querySelector('.augur-dialog')!;
    expect(dialog.textContent).toContain('Registered by library');
    expect(dialog.querySelector('[data-kind-refused]')?.textContent).toContain('Its manifest says it’s a platform app.');
  });

  it('offers only lower upload limits, and lays floors out as a tree, deciding each as the registry does', () => {
    expect(uploadChoices({ maxUpload: 25 }).map((c) => c.value)).toEqual(['asked', '10', '5', '1']);
    const org = { id: 'o', name: 'Acme' };
    const tree = floorTree(org, [payroll, finance]);
    expect(tree.map((f) => [f.name, f.path.length])).toEqual([
      ['Acme', 1],
      ['Finance', 2],
      ['Payroll', 3],
    ]);
    const names = new Map(tree.map((f) => [f.id, f.name]));
    expect(floorStatus(library, tree[2]!, [{ workspace: 'd-1', state: 'blocked', carriesOn: true } as never], names)).toEqual({ on: false, words: 'Off: blocked by Finance' });
    expect(floorStatus(library, tree[2]!, [{ workspace: 'o', state: 'off', carriesOn: true } as never], names)).toEqual({ on: false, words: 'Off, as Acme' });
    expect(floorStatus(library, tree[0]!, [], names)).toEqual({ on: true, words: 'On' });
  });

  it('issues a new sign-in and shows its secret once', async () => {
    const { sent } = gateway((_m, url) =>
      url === '/api/registry/v1/apps'
        ? Response.json([library])
        : url.endsWith('/credential')
          ? Response.json({ app: 'library', clientId: 'app-library', secret: 's3cret-value' }, { status: 201 })
          : url.endsWith('/versions') || url.endsWith('/floors')
            ? Response.json([])
            : undefined,
    );
    const el = await open('/apps');
    await openRow(el, 'Library');
    expect(document.querySelector('.augur-dialog')!.textContent).toContain('Notify people');
    await press(button('Issue a new sign-in'));
    await press(button('Issue a new sign-in', document.querySelectorAll('.augur-dialog')[1] ?? document));
    expect(sent).toContainEqual({ method: 'POST', url: '/api/identity/v1/admin/apps/library/credential', body: undefined });
    expect(document.querySelector('[data-secret]')?.textContent).toBe('s3cret-value');
  });

  describe('installs from releases', () => {
    const installs: AppInstalls = {
      feed: 'on',
      runnerSeenAt: '2026-10-27T12:00:00Z',
      sdkVersion: '1.3.0',
      installed: [{ app: 'notes', name: 'Notes', version: '1.0.0', installedAt: '', channel: 'stable', policy: 'automatic', update: { version: '2.0.0', channel: 'stable', needs: ['2.0.0 is a major version: it may change how Notes works.'] } }],
      available: [{ app: 'tasks', name: 'Tasks', description: 'Things to do', version: '1.2.0', channel: 'stable', signer: { repository: 'o/r', workflow: 'w' }, asks: { scopes: ['notifications:send'], storage: { database: true }, maxUpload: 10 } }],
    };
    const runner: Answer = (method, url) => (url.startsWith('/api/registry/v1/app-runner/') && method === 'GET' ? Response.json(installs) : undefined);

    it('lists what the feed offers and what waits for an admin, and installs on confirming', async () => {
      const { sent } = gateway(runner);
      const el = await open('/apps');
      expect(el.querySelector('[data-available]')?.textContent).toContain('Tasks 1.2.0');
      expect(el.querySelector('[data-waiting]')?.textContent).toContain('Notes 2.0.0');
      await press(button('Install', el.querySelector('[data-available]')!));
      expect(document.querySelector('.augur-dialog')!.textContent).toContain('Keeps a database on the server');
      await press(button('Install', document.querySelector('.augur-dialog')!));
      expect(sent).toContainEqual({ method: 'POST', url: '/api/registry/v1/app-runner/jobs', body: { action: 'install', app: 'tasks', version: '1.2.0' } });
    });

    it('goes to enter the password again when the registry asks for it', async () => {
      gateway((method, url, body) => (method === 'POST' ? Response.json({ error: 'sign_in_again', message: 'Enter your password again.' }, { status: 401 }) : runner(method, url, body)));
      const assign = vi.fn();
      const location = window.location;
      const el = await open('/apps');
      Object.defineProperty(window, 'location', { configurable: true, value: { ...location, pathname: '/admin/apps', search: '', assign } });
      try {
        await press(button('Install', el.querySelector('[data-waiting]')!));
        await press(button('Install', document.querySelector('.augur-dialog')!));
        expect(assign).toHaveBeenCalledWith(`/auth/again?return=${encodeURIComponent('/admin/apps?install=notes%402.0.0')}`);
        expect(document.querySelector('.augur-dialog')).not.toBeNull();
      } finally {
        Object.defineProperty(window, 'location', { configurable: true, value: location });
      }
    });
  });
});

describe('the line', () => {
  const unit = { id: 'augur', name: 'AUGUR', versions: { dev: '0.14.0-dev.3', preview: '0.13.2', production: '0.13.1' }, waiting: ['a'], previews: [] };

  it('puts this server on the branch it runs, links each part to the portal, and sends upgrades to the Upgrade Centre', async () => {
    expect(placeOf({ ...unit, running: '0.13.2' })).toBe('preview');
    expect(placeOf({ ...unit, running: '0.14.0-dev.7' })).toBe('dev');
    expect(placeOf({ ...unit, running: '0.9.0' })).toBeUndefined();
    expect(portalLink('https://portal.example', 'augur')).toBe('https://portal.example/catalog/default/system/augur-platform');
    expect(portalLink(undefined, 'augur')).toBeUndefined();
    gateway((_m, url) =>
      url === '/api/registry/v1/platform/updates'
        ? Response.json({ running: { version: '0.13.2', channel: 'beta' }, channel: 'beta', feed: 'on', newer: [], needsYou: [], line: { feed: 'on', repository: 'o/r', units: [{ ...unit, running: '0.13.2' }], steps: [{ from: 'dev', to: 'preview', merged: 2, pulls: [] }] } })
        : undefined,
    );
    const el = await open('/updates');
    expect(el.querySelector('[data-unit="augur"] [data-here]')?.textContent).toContain('0.13.2');
    expect(el.querySelector('[data-step="dev-preview"]')?.textContent).toContain('2 pull requests on Dev that Preview hasn’t got');
    expect(button('Open the Upgrade Centre', el)).toBeDefined();
    expect(shut(button('Open the Upgrade Centre', el))).toBe(false);
    expect(reasonOf(button('Open the Upgrade Centre', el))).toBe('');
  });
});
