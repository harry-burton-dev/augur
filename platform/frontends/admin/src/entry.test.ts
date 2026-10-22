import { createEventBus, type MountContext } from '@platform/mfe-sdk';
import type { UiDialog, UiTable, UiToggle } from '@platform/ui-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import admin, { screenFor } from './entry.js';
import { AdminApi, departmentPath, type AuditEntry, type CatalogueApp, type ComponentStatus, type Department, type Person } from './api.js';
import { appStatus, rollbackNote, type AdminApps } from './apps.js';
import { headline, stateOf, type AdminStatus } from './status.js';
import { describe as sentence, namesFrom, rangeFor, type AdminActivity } from './activity.js';
import type { AdminPeople } from './people.js';

const finance: Department = { id: 'd-1', name: 'Finance', members: ['u-1'] };
const payroll: Department = { id: 'd-2', name: 'Payroll', parentId: 'd-1', members: [] };
const alex: Person = { id: 'u-1', username: 'alex', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.org', enabled: true, invited: false, roles: ['admin'], departments: ['d-1'] };
const sam: Person = { id: 'u-2', username: 'sam', firstName: 'Sam', lastName: 'Okafor', email: 'sam@example.org', enabled: false, invited: false, roles: [], departments: [] };

/** A gateway that answers like identity and the registry do, recording what was sent. */
const gateway = () => {
  const sent: { method: string; url: string; body?: unknown }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    sent.push({ method, url: String(url), body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    if (url === '/api/identity/v1/admin/people' && method === 'GET') return json([alex, sam]);
    if (url === '/api/identity/v1/admin/departments') return json([finance, payroll]);
    if (url === '/api/identity/v1/admin/roles') return json([{ name: 'admin' }, { name: 'editor' }]);
    if (url === '/api/identity/v1/admin/people' && method === 'POST') {
      return json({ person: { ...sam, id: 'u-3', ...body, username: 'jo', enabled: true, invited: true }, temporaryPassword: 'abcd-efgh-jkmn' }, 201);
    }
    if (String(url).startsWith('/api/identity/v1/admin/people/u-1') && method === 'PATCH') return json({ message: 'You can’t turn off your own sign-in.' }, 409);
    return json({ message: 'not here' }, 404);
  });
  return { sent, api: new AdminApi(async () => 'token', fetchImpl as unknown as typeof fetch) };
};

const settle = async (el: Element) => {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await Promise.all([el, ...el.querySelectorAll('*')].map((e) => (e as Partial<UiTable>).updateComplete));
  }
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('admin', () => {
  it('opens the screen its path names', () => {
    expect(screenFor('/people')).toEqual({ screen: 'people', adding: false });
    expect(screenFor('/people/new')).toEqual({ screen: 'people', adding: true });
    expect(screenFor('/departments/new')).toEqual({ screen: 'departments', adding: true });
    expect(screenFor('/apps')).toEqual({ screen: 'apps', adding: false });
    expect(screenFor('/status')).toEqual({ screen: 'status', adding: false });
    expect(screenFor('/activity')).toEqual({ screen: 'activity', adding: false });
    expect(screenFor('/')).toEqual({ screen: 'people', adding: false });
  });

  it('mounts with the caller’s token on every call, and clears up', async () => {
    const getToken = vi.fn(async () => 'token');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }));
    const el = document.createElement('div');
    document.body.append(el);
    const ctx: MountContext = { user: { id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] }, getToken, bus: createEventBus(), raise: vi.fn(), request: vi.fn(), notify: vi.fn(), path: '/apps' };
    await admin.mount(el, ctx);
    await settle(el);
    expect(el.querySelector('admin-apps')).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith('/api/registry/v1/apps', expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer token' }) }));
    await admin.unmount!(el);
    expect(el.querySelector('admin-apps')).toBeNull();
    fetchSpy.mockRestore();
  });

  it('lists people with their department’s full name and where their sign-in stands', async () => {
    const { api } = gateway();
    document.body.innerHTML = '<admin-people></admin-people>';
    const people = document.querySelector('admin-people') as AdminPeople;
    Object.assign(people, { api, me: 'u-1' });
    await settle(people);
    const table = people.querySelector('ui-table') as UiTable;
    expect(table.rows.map((r) => [r.name, r.department, r.signIn])).toEqual([
      ['Alex Rivera', 'Finance', 'Active'],
      ['Sam Okafor', '', 'Off'],
    ]);
  });

  it('adds a person and shows their one-time password once', async () => {
    const { api, sent } = gateway();
    document.body.innerHTML = '<admin-people adding></admin-people>';
    const people = document.querySelector('admin-people') as AdminPeople;
    Object.assign(people, { api, me: 'u-1' });
    await settle(people);
    const dialog = people.querySelector('ui-dialog') as UiDialog;
    const field = (name: string) => people.querySelector(`[name="${name}"]`) as HTMLElement & { value: string };
    field('firstName').value = 'Jo';
    field('lastName').value = 'Smith';
    field('email').value = 'jo@example.org';
    field('department').value = 'd-2';
    expect(await dialog.confirm()).toBe(true);
    await settle(people);
    expect(sent.find((c) => c.method === 'POST')!.body).toEqual({ firstName: 'Jo', lastName: 'Smith', email: 'jo@example.org', roles: [], departments: ['d-2'] });
    expect(people.querySelector('[data-password]')!.textContent!.trim()).toBe('abcd-efgh-jkmn');
  });

  it('won’t let an admin turn off their own sign-in', async () => {
    const { api } = gateway();
    document.body.innerHTML = '<admin-people></admin-people>';
    const people = document.querySelector('admin-people') as AdminPeople;
    Object.assign(people, { api, me: 'u-1' });
    await settle(people);
    people.editing = alex;
    await settle(people);
    const toggle = people.querySelector('ui-toggle') as UiToggle;
    expect(toggle.disabled).toBe(true);
    expect(toggle.hint).toMatch(/your own sign-in/);
  });

  it('says why an app won’t open', () => {
    const app = { id: 'x', name: 'X', route: '/x', entry: '/x.js', version: '1.0.0', sdk: '^2.0.0', platform: false, enabled: true } as CatalogueApp;
    expect(appStatus(app, '1.0.0')).toMatchObject({ status: 'warning', label: 'Won’t open' });
    expect(appStatus({ ...app, sdk: '^1.0.0' }, '1.0.0')).toMatchObject({ status: 'done', label: 'On' });
    expect(appStatus({ ...app, enabled: false }, '1.0.0')).toMatchObject({ status: 'paused', label: 'Off' });
  });

  it('names a department with the ones it sits inside', () => {
    expect(departmentPath('d-2', [finance, payroll])).toBe('Finance / Payroll');
  });

  describe('Status', () => {
    const part = (name: string, state: ComponentStatus['state'], extra: Partial<ComponentStatus> = {}): ComponentStatus => ({ name, kind: 'service', state, ...extra });

    it('heads the screen with what needs a look first', () => {
      expect(headline([part('gateway', 'up'), part('registry', 'up')]).heading).toBe('Everything is running');
      expect(headline([part('gateway', 'up'), part('events', 'slow')]).heading).toBe('1 part is slow');
      expect(headline([part('events', 'slow'), part('registry', 'down'), part('sign-in', 'down')]).heading).toBe('2 parts are down');
    });

    it('marks each state with a word that doesn’t rely on colour', () => {
      expect(['up', 'slow', 'down', 'checking'].map((state) => stateOf({ state: state as ComponentStatus['state'] }).label)).toEqual(['Running', 'Slow', 'Down', 'Checking']);
    });

    it('shows every part from the gateway, and what to check for one that’s down', async () => {
      const components = [part('gateway', 'up', { kind: 'gateway', version: '0.2.0' }), part('library', 'down', { kind: 'app', problem: 'It can’t be reached.' })];
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ components }), { status: 200 }));
      const el = document.createElement('admin-status') as AdminStatus;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.components).toHaveLength(2));
      await el.updateComplete;
      expect(fetchImpl).toHaveBeenCalledWith('/api/gateway/v1/status', expect.anything());
      expect(el.querySelector('ui-heading')!.getAttribute('heading')).toBe('1 part is down');
      el.open = 'library';
      await el.updateComplete;
      const dialog = el.querySelector('ui-dialog')!;
      expect(dialog.getAttribute('summary')).toBe('It can’t be reached.');
      expect(dialog.textContent).toContain('People can’t use library while its service is down');
      el.remove();
    });
  });

  describe('Activity', () => {
    const names = namesFrom([alex, sam], [finance, payroll], [{ id: 'library', name: 'Library' } as CatalogueApp]);
    const entry = (action: string, extra: Partial<AuditEntry> = {}): AuditEntry => ({ id: '1', at: '2026-10-22T10:00:00.000Z', actor: { id: 'u-1', kind: 'user' }, app: 'identity', action, ...extra });

    it('writes each change as a sentence with people’s, departments’ and apps’ names', () => {
      expect(sentence(entry('department.member-added', { target: 'd-1', detail: { person: 'u-2' } }), names)).toBe('Alex Rivera added Sam Okafor to Finance');
      expect(sentence(entry('person.updated', { target: 'u-2', detail: { roles: { from: [], to: ['admin'] }, firstName: {}, lastName: {} } }), names)).toBe('Alex Rivera changed Sam Okafor’s roles and name');
      expect(sentence(entry('person.disabled', { target: 'u-2' }), names)).toBe('Alex Rivera turned off Sam Okafor’s sign-in');
      expect(sentence(entry('app.registered', { app: 'registry', actor: { id: 'library', kind: 'service' }, target: 'library', detail: { version: '0.2.0' } }), names)).toBe('Library was registered, version 0.2.0');
      expect(sentence(entry('app.disabled', { app: 'registry', target: 'library' }), names)).toBe('Alex Rivera turned Library off');
      expect(sentence(entry('app.pinned', { app: 'registry', target: 'library', detail: { version: '0.1.0' } }), names)).toBe('Alex Rivera held Library at version 0.1.0');
      expect(sentence(entry('app.updated', { app: 'registry', target: 'library', detail: { version: '0.3.0', heldAt: '0.1.0' } }), names)).toBe(
        'Library registered version 0.3.0, kept but not used while it’s held at 0.1.0',
      );
      expect(sentence(entry('document.published', { app: 'library', target: 'doc-7' }), names)).toBe('Alex Rivera: document.published (doc-7)');
    });

    it('turns a period into a time range', () => {
      const now = new Date(2026, 9, 22, 15, 30);
      expect(rangeFor('today', now)).toEqual({ since: new Date(2026, 9, 22).toISOString() });
      expect(rangeFor('week', now)).toEqual({ since: new Date(2026, 9, 16).toISOString() });
      expect(rangeFor('all', now)).toEqual({});
      expect(rangeFor('custom', now, '2026-10-01', '2026-10-02')).toEqual({ since: new Date(2026, 9, 1).toISOString(), until: new Date(2026, 9, 3).toISOString() });
      expect(rangeFor('custom', now, 'nonsense', '')).toEqual({});
    });

    it('asks for the last week, then pages to older changes from the oldest shown', async () => {
      const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => entry('person.password-reset', { id: String(from - i), target: 'u-2' }));
      const urls: string[] = [];
      const fetchImpl = vi.fn(async (url: string) => {
        urls.push(url);
        const body = url.includes('/audit') ? (url.includes('before=') ? page(50, 3) : page(100, 50)) : [];
        return new Response(JSON.stringify(body), { status: 200 });
      });
      const el = document.createElement('admin-activity') as AdminActivity;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.entries).toHaveLength(50));
      const first = new URL(urls.find((u) => u.includes('/audit'))!, 'http://x');
      expect(first.pathname).toBe('/api/events/v1/audit');
      expect(first.searchParams.get('limit')).toBe('50');
      expect(first.searchParams.get('since')).toBeTruthy();
      expect(el.more).toBe(true);
      await el.loadOlder();
      expect(urls.at(-1)).toContain('before=51');
      expect(el.entries).toHaveLength(53);
      expect(el.more).toBe(false);
      el.remove();
    });
  });

  describe('App versions', () => {
    const app: CatalogueApp = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.2.0', sdk: '^1.0.0', platform: false, enabled: true };
    const kept = (version: string, entry = app.entry, serving = false) => ({ version, entry: { ...app, version, entry }, registeredBy: 'library', registeredAt: '2026-10-20T10:00:00.000Z', serving });

    it('warns when going back changes the manifest but not the code', () => {
      expect(rollbackNote(app, kept('0.1.0'))).toMatch(/loads from the same address as 0.2.0/);
      expect(rollbackNote(app, kept('0.1.0', '/apps/library/0.1.0/entry.js'))).toBe('');
      expect(rollbackNote(app, kept('0.2.0'))).toBe('');
    });

    it('lists an app’s kept versions and holds it at the one picked', async () => {
      const calls: [string, string][] = [];
      const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
        calls.push([init.method ?? 'GET', url]);
        const body = url.endsWith('/versions')
          ? [kept('0.2.0', app.entry, true), kept('0.1.0', '/apps/library/0.1.0/entry.js')]
          : url.endsWith('/pin')
            ? { ...app, version: '0.1.0', pinnedVersion: '0.1.0' }
            : [app];
        return new Response(JSON.stringify(body), { status: 200 });
      });
      const el = document.createElement('admin-apps') as AdminApps;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.apps).toHaveLength(1));
      el.open = 'library';
      await vi.waitFor(() => expect(el.versions).toHaveLength(2));
      el.choice = '0.1.0';
      await el.useChoice(app);
      expect(calls).toContainEqual(['PUT', '/api/registry/v1/apps/library/pin']);
      expect(el.apps[0]).toMatchObject({ version: '0.1.0', pinnedVersion: '0.1.0' });
      el.choice = '';
      await el.useChoice(el.apps[0]);
      expect(calls).toContainEqual(['DELETE', '/api/registry/v1/apps/library/pin']);
      el.remove();
    });
  });
});
