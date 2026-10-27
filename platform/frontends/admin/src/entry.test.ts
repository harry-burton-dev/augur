import { createEventBus, type MountContext } from '@augur/mfe-sdk';
import type { UiDialog, UiTable, UiToggle } from '@augur/ui-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import admin, { screenFor } from './entry.js';
import { AdminApi, departmentPath, type AppInstalls, type AuditEntry, type CatalogueApp, type ComponentStatus, type Department, type Person, type PlatformUpdates } from './api.js';
import { appStatus, floorStatus, floorTree, rollbackNote, scopeWords, uploadChoices, type AdminApps } from './apps.js';
import { headline, stateOf, type AdminStatus } from './status.js';
import { headline as updatesHeadline, type AdminUpdates } from './updates.js';
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
    expect(screenFor('/updates')).toEqual({ screen: 'updates', adding: false });
    expect(screenFor('/')).toEqual({ screen: 'people', adding: false });
  });

  it('mounts with the caller’s token on every call, and clears up', async () => {
    const getToken = vi.fn(async () => 'token');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { status: 200 }));
    const el = document.createElement('div');
    document.body.append(el);
    const own = { id: 'w-me', kind: 'personal' as const, name: 'You', slug: 'me', path: [], role: 'lead' as const };
    const ctx: MountContext = { user: { id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] }, getToken, bus: createEventBus(), raise: vi.fn(), request: vi.fn(), notify: vi.fn(), workspace: own, getWorkspace: () => own, fetch: vi.fn(), path: '/apps' };
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
      const stale = { state: 'attention' as const, problem: 'No backup has been test-restored yet.' };
      expect(headline([part('gateway', 'up')], stale)).toEqual({ heading: 'Backups need a look', summary: 'No backup has been test-restored yet.' });
      expect(headline([part('registry', 'down')], stale).heading).toBe('1 part is down');
    });

    it('marks each state with a word that doesn’t rely on colour', () => {
      expect(['up', 'slow', 'down', 'checking'].map((state) => stateOf({ state: state as ComponentStatus['state'] }).label)).toEqual(['Running', 'Slow', 'Down', 'Checking']);
    });

    it('shows every part from the gateway, and what to check for one that’s down', async () => {
      const components = [part('gateway', 'up', { kind: 'gateway', version: '0.2.0' }), part('library', 'down', { kind: 'app', problem: 'It can’t be reached.' })];
      const backups = { state: 'ok', lastBackup: { at: '2026-10-22T02:00:00Z', ok: true, bytes: 52_000 }, lastRestoreTest: { at: '2026-10-19T02:01:00Z', ok: true, people: 3 } };
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ components, backups }), { status: 200 }));
      const el = document.createElement('admin-status') as AdminStatus;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.components).toHaveLength(2));
      await el.updateComplete;
      expect(fetchImpl).toHaveBeenCalledWith('/api/gateway/v1/status', expect.anything());
      expect(el.querySelector('ui-heading')!.getAttribute('heading')).toBe('1 part is down');
      expect(el.querySelector('ui-status[label="Backups restore cleanly"]')).not.toBeNull();
      el.open = 'library';
      await el.updateComplete;
      const dialog = el.querySelector('ui-dialog')!;
      expect(dialog.getAttribute('summary')).toBe('It can’t be reached.');
      expect(dialog.textContent).toContain('People can’t use library while its service is down');
      el.remove();
    });
  });

  describe('Updates', () => {
    const running = { version: '0.2.0', channel: 'beta' as const };
    const out: PlatformUpdates = {
      running,
      channel: 'beta',
      feed: 'on',
      checkedAt: '2026-10-30T09:00:00Z',
      available: { version: '0.4.0', channel: 'beta', breaking: [], notesUrl: 'https://github.com/o/r/releases/tag/augur@0.4.0', parts: [{ name: '@augur/registry', from: '0.2.0', to: '0.4.0' }] },
      newer: [
        { version: '0.4.0', channel: 'beta', breaking: [] },
        { version: '0.3.0', channel: 'beta', breaking: ['@augur/identity 0.3.0 → 1.0.0'] },
      ],
      next: '0.4.0',
      needsYou: [{ kind: 'setting', key: 'OBJECT_STORE_URL', required: true, message: 'Set OBJECT_STORE_URL in .env: 0.4.0 won’t start without it.' }],
    };

    it('heads the screen with what’s out, or that all is current', () => {
      expect(updatesHeadline(out)).toEqual({ heading: 'AUGUR 0.4.0 is out', summary: 'You’re on 0.2.0. 1 thing needs you before upgrading.' });
      expect(updatesHeadline({ running, channel: 'beta', feed: 'on', checkedAt: out.checkedAt, newer: [], needsYou: [] }).heading).toBe('You’re up to date');
      expect(updatesHeadline({ running, channel: 'beta', feed: 'on', checkedAt: out.checkedAt, problem: 'The release feed answered 502.', newer: [], needsYou: [] }).heading).toBe('Updates can’t be checked');
      expect(updatesHeadline({ running, channel: 'stable', feed: 'off', newer: [], needsYou: [] }).summary).toContain('RELEASE_FEED_URL is off');
    });

    it('shows what needs doing first, what changes, and checks again when asked', async () => {
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify(out), { status: 200 }));
      const el = document.createElement('admin-updates') as AdminUpdates;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.updates).toBeDefined());
      await el.updateComplete;
      expect(fetchImpl).toHaveBeenCalledWith('/api/registry/v1/platform/updates', expect.anything());
      expect(el.querySelector('[data-needs]')!.textContent).toContain('Set OBJECT_STORE_URL in .env');
      expect(el.querySelector('[data-parts]')!.textContent).toContain('0.2.0 → 0.4.0');
      expect(el.querySelector('[data-releases]')!.textContent).toContain('Breaking');
      expect(el.textContent).toContain('PLATFORM_VERSION=0.4.0');
      (el.querySelector('[data-check]') as HTMLElement).click();
      await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledWith('/api/registry/v1/platform/updates/check', expect.objectContaining({ method: 'POST' })));
      el.remove();
    });

    it('asks for the password again before an upgrade, then asks for it', async () => {
      const assign = vi.fn();
      vi.stubGlobal('location', { ...window.location, pathname: '/admin/updates', search: '', assign });
      const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'PUT' ? new Response(JSON.stringify({ error: 'sign_in_again', message: 'Enter your password again to upgrade.' }), { status: 401 }) : new Response(JSON.stringify(out), { status: 200 }),
      );
      const el = document.createElement('admin-updates') as AdminUpdates;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.updates).toBeDefined());
      await el.updateComplete;
      (el.querySelector('[data-upgrade]') as HTMLElement).click();
      await el.updateComplete;
      const dialog = el.querySelector('ui-dialog') as UiDialog;
      expect(dialog.getAttribute('heading')).toBe('Upgrade to AUGUR 0.4.0?');
      expect(dialog.textContent).toContain('Set OBJECT_STORE_URL in .env');
      await dialog.confirm();
      expect(fetchImpl).toHaveBeenCalledWith('/api/registry/v1/platform/upgrade', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ version: '0.4.0' }) }));
      expect(assign).toHaveBeenCalledWith(`/auth/again?return=${encodeURIComponent('/admin/updates?upgrade=0.4.0')}`);
      el.remove();
      vi.unstubAllGlobals();
    });

    it('follows an upgrade step by step, and says how it ended', async () => {
      const steps = [
        { step: 'preflight', state: 'done', at: '2026-10-30T09:00:00Z' },
        { step: 'roll-forward', state: 'failed', at: '2026-10-30T09:02:00Z', message: 'identity didn’t get ready' },
        { step: 'roll-back', state: 'done', at: '2026-10-30T09:03:00Z' },
      ];
      const upgrade = { id: 'up-1', from: '0.2.0', version: '0.4.0', requestedBy: 'u-1', requestedAt: '2026-10-30T08:59:00Z', state: 'rolled-back', steps, message: 'identity didn’t get ready in 120 s' };
      expect(updatesHeadline({ ...out, upgrade: { ...upgrade, state: 'running' } } as PlatformUpdates).heading).toBe('Upgrading to 0.4.0');
      expect(updatesHeadline({ ...out, upgrade } as PlatformUpdates)).toEqual({ heading: 'Back on 0.2.0', summary: 'identity didn’t get ready in 120 s' });
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ...out, upgrade }), { status: 200 }));
      const el = document.createElement('admin-updates') as AdminUpdates;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.updates).toBeDefined());
      await el.updateComplete;
      const progress = el.querySelector('[data-progress]')!.textContent!;
      expect(progress).toContain('Start each part on the new version: identity didn’t get ready');
      expect(progress).toContain('Go back to the old version');
      expect(el.querySelector('ui-status[status="warning"]')!.getAttribute('label')).toBe('Back on 0.2.0: identity didn’t get ready in 120 s');
      el.remove();
    });

    it('puts a mark on Status when a release is out', async () => {
      const fetchImpl = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('updates') ? out : { components: [] }), { status: 200 }));
      const el = document.createElement('admin-status') as AdminStatus;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.updates).toBeDefined());
      await el.updateComplete;
      expect(el.querySelector('[data-update] ui-status')!.getAttribute('label')).toContain('AUGUR 0.4.0 is out');
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
      expect(sentence(entry('app.setting-changed', { app: 'registry', target: 'library', detail: { setting: 'retentionDays', label: 'Keep deleted documents for', value: 90, unit: 'days' } }), names)).toBe(
        'Alex Rivera set Library’s “Keep deleted documents for” to 90 days',
      );
      expect(sentence(entry('app.setting-changed', { app: 'registry', target: 'library', detail: { setting: 'retentionDays', label: 'Keep deleted documents for', value: null } }), names)).toBe(
        'Alex Rivera put Library’s “Keep deleted documents for” back to its default',
      );
      expect(sentence(entry('app.scopes-granted', { app: 'registry', actor: { id: 'library', kind: 'service' }, target: 'library', detail: { scopes: [], shipsWithAugur: true } }), names)).toBe(
        'Library may now do what its release asks',
      );
      expect(sentence(entry('origin.allowed', { app: 'registry', target: 'https://apps.example.org' }), names)).toBe('Alex Rivera let apps load from https://apps.example.org');
      expect(sentence(entry('document.published', { app: 'library', target: 'doc-7' }), names)).toBe('Alex Rivera: document.published (doc-7)');
    });

    it('says which floor an app was turned on, off or blocked for', () => {
      expect(sentence(entry('app.disabled', { app: 'registry', target: 'library', detail: { workspace: 'd-1' } }), names)).toBe('Alex Rivera turned Library off for Finance');
      expect(sentence(entry('app.blocked', { app: 'registry', target: 'library', detail: { workspace: 'd-1' } }), names)).toBe('Alex Rivera blocked Library for Finance and every team below it');
      expect(sentence(entry('team-notices.on', { app: 'events', target: 'd-2' }), names)).toBe('Alex Rivera turned on team notices for Payroll');
    });

    it('filters by floor, offering the org and every team', async () => {
      const urls: string[] = [];
      const fetchImpl = vi.fn(async (url: string) => {
        urls.push(url);
        if (url.endsWith('/me/workspaces')) return Response.json({ workspaces: [{ id: 'o', kind: 'org', name: 'Acme' }] });
        if (url.endsWith('/admin/departments')) return Response.json([finance, payroll]);
        return Response.json([]);
      });
      const el = document.createElement('admin-activity') as AdminActivity;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.filterOptions.floors.map((o) => o.label)).toEqual(['Any floor', 'Acme', 'Acme / Finance', 'Acme / Finance / Payroll']));
      el.floor = 'd-1';
      await el.load();
      expect(new URL(urls.filter((u) => u.includes('/audit')).at(-1)!, 'http://x').searchParams.get('workspace')).toBe('d-1');
      el.remove();
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

  describe('Where apps load from', () => {
    const app: CatalogueApp = { id: 'maps', name: 'Maps', route: '/maps', entry: 'https://apps.example.org/maps/entry.js', version: '0.1.0', sdk: '^1.0.0', platform: false, enabled: true };

    it('marks an app blocked when its site is no longer allowed', () => {
      expect(appStatus({ ...app, blocked: 'Maps loads from https://apps.example.org, which isn’t a place apps are allowed to load from.' })).toMatchObject({ status: 'warning', label: 'Blocked' });
      expect(appStatus({ ...app, enabled: false, blocked: 'x' }).label).toBe('Off');
    });

    it('allows a site, lists it, and removes it again', async () => {
      const calls: [string, string, unknown][] = [];
      let origins: { origin: string; addedBy: string; addedAt: string }[] = [];
      const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
        const method = init.method ?? 'GET';
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push([method, url, body]);
        if (url.endsWith('/origins') && method === 'POST') {
          origins = [{ origin: body.origin, addedBy: 'u-1', addedAt: '2026-10-22T10:00:00.000Z' }];
          return new Response(JSON.stringify(origins[0]), { status: 201 });
        }
        if (url.includes('/origins/') && method === 'DELETE') {
          origins = [];
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify(url.endsWith('/origins') ? origins : [app]), { status: 200 });
      });
      const el = document.createElement('admin-apps') as AdminApps;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.apps).toHaveLength(1));
      el.originsOpen = true;
      await vi.waitFor(() => expect(el.origins).toEqual([]));
      await el.updateComplete;
      const dialog = el.querySelector('ui-dialog') as UiDialog;
      expect(await el.allowOrigin({ origin: ' https://apps.example.org ' }, dialog)).toBe(false);
      expect(calls).toContainEqual(['POST', '/api/registry/v1/origins', { origin: 'https://apps.example.org' }]);
      expect(el.origins?.map((o) => o.origin)).toEqual(['https://apps.example.org']);
      await el.removeOrigin('https://apps.example.org');
      expect(calls).toContainEqual(['DELETE', '/api/registry/v1/origins/https%3A%2F%2Fapps.example.org', undefined]);
      expect(el.origins).toEqual([]);
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

  describe('App sign-ins', () => {
    const app: CatalogueApp = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.2.0', sdk: '^1.0.0', platform: false, enabled: true, scopes: ['notifications:send'] };

    it('says what an app may do in words', () => {
      expect(scopeWords(['notifications:send', 'audit:write'])).toBe('Notify people, Write to the activity log');
      expect(scopeWords([])).toBe('Nothing beyond registering itself');
      expect(scopeWords(undefined)).toBe('Nothing beyond registering itself');
    });

    it('issues a new sign-in and shows its secret once', async () => {
      const calls: [string, string][] = [];
      const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
        calls.push([init.method ?? 'GET', url]);
        const body = url.endsWith('/credential') ? { app: 'library', clientId: 'app-library', secret: 's3cret-value' } : url.endsWith('/versions') ? [] : [app];
        return new Response(JSON.stringify(body), { status: url.endsWith('/credential') ? 201 : 200 });
      });
      const el = document.createElement('admin-apps') as AdminApps;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.apps).toHaveLength(1));
      el.open = 'library';
      await settle(el);
      expect((el.querySelector('ui-facts') as unknown as { items: { label: string; value: string }[] }).items).toContainEqual({ label: 'May', value: 'Notify people' });
      el.issuing = app;
      await el.issueSignIn({}, document.createElement('ui-dialog') as UiDialog);
      expect(calls).toContainEqual(['POST', '/api/identity/v1/admin/apps/library/credential']);
      await settle(el);
      expect(el.querySelector('[data-secret]')?.textContent).toBe('s3cret-value');
      el.issued = undefined;
      await settle(el);
      expect(el.querySelector('[data-secret]')).toBeNull();
      el.remove();
    });
  });

  describe('Installs from releases', () => {
    const notes: CatalogueApp = { id: 'notes', name: 'Notes', route: '/notes', entry: '/apps/notes/entry.js', version: '1.0.0', sdk: '^1.0.0', platform: false, enabled: true, registeredBy: 'notes' };
    const installs: AppInstalls = {
      feed: 'on',
      runnerSeenAt: '2026-10-27T12:00:00Z',
      sdkVersion: '1.3.0',
      installed: [{ app: 'notes', name: 'Notes', version: '1.0.0', installedAt: '2026-10-27T11:00:00Z', channel: 'stable', policy: 'automatic', update: { version: '2.0.0', channel: 'stable', needs: ['2.0.0 is a major version: it may change how Notes works.'] } }],
      available: [{ app: 'tasks', name: 'Tasks', description: 'Things to do', version: '1.2.0', channel: 'stable', signer: { repository: 'o/r', workflow: '.github/workflows/release.yml' }, asks: { scopes: ['notifications:send'], storage: { database: true }, maxUpload: 10 } }],
    };
    const setup = (answer: (method: string, url: string, body?: unknown) => Response | undefined = () => undefined) => {
      const sent: { method: string; url: string; body?: unknown }[] = [];
      const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
        const method = init.method ?? 'GET';
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        sent.push({ method, url, body });
        const said = answer(method, url, body);
        if (said) return said;
        const data = url.startsWith('/api/registry/v1/app-runner/') ? installs : url.endsWith('/floors') || url.endsWith('/versions') ? [] : [notes];
        return new Response(JSON.stringify(data), { status: 200 });
      });
      const el = document.createElement('admin-apps') as AdminApps;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      return { el, sent };
    };

    it('lists what the feed offers and what waits for an admin, and installs on confirming', async () => {
      const { el, sent } = setup();
      await vi.waitFor(() => expect(el.installs).toBeDefined());
      await settle(el);
      expect(el.querySelector('[data-available]')?.textContent).toContain('Tasks 1.2.0');
      expect(el.querySelector('[data-waiting]')?.textContent).toContain('Notes 2.0.0');
      el.askInstall('tasks', '1.2.0');
      await settle(el);
      expect(el.confirmInstall?.notes).toEqual(['May: Notify people', 'Keeps a database on the server', 'Uploads up to 10 MB']);
      await el.install({}, document.createElement('ui-dialog') as UiDialog);
      expect(sent).toContainEqual({ method: 'POST', url: '/api/registry/v1/app-runner/jobs', body: { action: 'install', app: 'tasks', version: '1.2.0' } });
      el.remove();
    });

    it('goes to enter the password again when the registry asks for it', async () => {
      const { el } = setup((method) => (method === 'POST' ? new Response(JSON.stringify({ error: 'sign_in_again', message: 'Enter your password again.' }), { status: 401 }) : undefined));
      const assign = vi.fn();
      const location = window.location;
      Object.defineProperty(window, 'location', { configurable: true, value: { ...location, pathname: '/admin/apps', search: '', assign } });
      await vi.waitFor(() => expect(el.installs).toBeDefined());
      el.askInstall('notes', '2.0.0');
      expect(el.confirmInstall?.notes).toEqual(['2.0.0 is a major version: it may change how Notes works.']);
      expect(await el.install({}, document.createElement('ui-dialog') as UiDialog)).toBe(false);
      expect(assign).toHaveBeenCalledWith(`/auth/again?return=${encodeURIComponent('/admin/apps?install=notes%402.0.0')}`);
      Object.defineProperty(window, 'location', { configurable: true, value: location });
      el.remove();
    });

    it('sets how an installed app takes new releases from its details', async () => {
      const { el, sent } = setup();
      await vi.waitFor(() => expect(el.installs).toBeDefined());
      el.open = 'notes';
      await settle(el);
      expect(el.querySelector('[data-runner]')).not.toBeNull();
      expect(el.querySelector('[data-update]')?.textContent).toContain('Install 2.0.0');
      await el.follow(el.installs!.installed[0], 'beta', 'ask');
      expect(sent).toContainEqual({ method: 'PUT', url: '/api/registry/v1/app-runner/apps/notes/follow', body: { channel: 'beta', policy: 'ask' } });
      el.remove();
    });

    it('chooses an installed app’s developers from everyone, and lists its previews', async () => {
      const ada = { id: 'u-2', username: 'ada', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.org', enabled: true, roles: [], departments: [] };
      const withPreview: AppInstalls = {
        ...installs,
        installed: [{ ...installs.installed[0], developers: ['u-2'], previews: [{ pr: 12, version: '1.1.0-pr.12.1', title: 'Tags on notes', url: 'https://github.com/o/r/pull/12', startedAt: '2026-10-27T12:00:00Z', endsAt: '2026-11-03T12:00:00Z' }] }],
      };
      const { el, sent } = setup((_method, url) =>
        url.endsWith('/admin/people') ? new Response(JSON.stringify([ada])) : url.startsWith('/api/registry/v1/app-runner/') ? new Response(JSON.stringify(withPreview)) : undefined,
      );
      await vi.waitFor(() => expect(el.installs).toBeDefined());
      el.open = 'notes';
      await vi.waitFor(() => expect(el.people).toHaveLength(1));
      await settle(el);
      const picker = el.querySelector('[data-developers]') as HTMLElement & { options: { label: string }[]; values: string[] };
      expect(picker.options.map((o) => o.label)).toEqual(['Ada Lovelace']);
      expect(picker.values).toEqual(['u-2']);
      expect(el.querySelector('[data-runner]')?.textContent).toContain('Tags on notes');
      await el.setDevelopers(el.installs!.installed[0], []);
      expect(sent).toContainEqual({ method: 'PUT', url: '/api/registry/v1/app-runner/apps/notes/developers', body: { people: [] } });
      el.remove();
    });
  });

  describe('Apps that ship with AUGUR', () => {
    it('can be turned off, but offer no version to go back to and no sign-in to issue', async () => {
      const folio: CatalogueApp = { id: 'folio', name: 'Folio', route: '/folio', entry: '/apps/folio/entry.js', version: '0.1.0', sdk: '^1.1.0', platform: false, pillar: true, enabled: true, registeredBy: 'folio' };
      const urls: string[] = [];
      const fetchImpl = vi.fn(async (url: string) => {
        urls.push(url);
        return new Response(JSON.stringify(url.endsWith('/floors') ? [] : [folio]), { status: 200 });
      });
      const el = document.createElement('admin-apps') as AdminApps;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.apps).toHaveLength(1));
      el.open = 'folio';
      await settle(el);
      expect(el.querySelector('ui-dialog')?.getAttribute('eyebrow')).toBe('Ships with AUGUR');
      expect(el.querySelector('[data-pillar]')?.textContent).toMatch(/can’t be removed/);
      expect(el.querySelector('ui-toggle')).not.toBeNull();
      expect(el.textContent).not.toContain('Issue a new sign-in');
      expect(urls.some((u) => u.endsWith('/versions'))).toBe(false);
      el.remove();
    });
  });

  describe('An app’s own settings', () => {
    it('shows each with its value, and saves what’s typed, or the default when emptied', async () => {
      const retention = { id: 'retentionDays', label: 'Keep deleted documents for', type: 'integer' as const, unit: 'days', min: 1, max: 3650, default: 30 };
      const folio: CatalogueApp = { id: 'folio', name: 'Folio', route: '/folio', entry: '/apps/folio/entry.js', version: '0.1.0', sdk: '^1.1.0', platform: false, enabled: true, settings: [retention] };
      const calls: [string, string, string?][] = [];
      let value = 30;
      const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
        calls.push([init.method ?? 'GET', url, init.body as string | undefined]);
        if (url.includes('/settings/')) value = JSON.parse(String(init.body)).value ?? 30;
        const body = url.includes('/settings') ? { settings: [{ ...retention, value }] } : url.endsWith('/floors') ? [] : url.endsWith('/versions') ? [] : [folio];
        return new Response(JSON.stringify(body), { status: 200 });
      });
      const el = document.createElement('admin-apps') as AdminApps;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.apps).toHaveLength(1));
      el.open = 'folio';
      await vi.waitFor(() => expect(el.settingValues).toHaveLength(1));
      await settle(el);
      const field = el.querySelector('[data-setting="retentionDays"]') as HTMLElement & { value: string; label: string };
      expect(field.label).toBe('Keep deleted documents for (days)');
      expect(field.value).toBe('30');
      await el.setSetting(folio, el.settingValues![0], '0');
      expect(el.settingsError).toBe('Keep deleted documents for is a whole number from 1 to 3650 days.');
      await el.setSetting(folio, el.settingValues![0], '90');
      expect(calls).toContainEqual(['PUT', '/api/registry/v1/apps/folio/settings/retentionDays', JSON.stringify({ value: 90 })]);
      expect(el.settingValues![0].value).toBe(90);
      await el.setSetting(folio, el.settingValues![0], '');
      expect(calls.at(-1)?.[2]).toBe(JSON.stringify({ value: null }));
      expect(el.settingValues![0].value).toBe(30);
      el.remove();
    });
  });

  describe('Largest upload', () => {
    it('offers what the app asks for, and only less', () => {
      expect(uploadChoices({ maxUpload: 200 }).map((o) => o.value)).toEqual(['asked', '100', '50', '25', '10', '5', '1']);
      expect(uploadChoices({}).map((o) => o.label)).toEqual(['10 MB, as it asks', '5 MB', '1 MB']);
      expect(uploadChoices({ maxUpload: 200, uploadLimit: 30, uploadLimitLowered: true }).map((o) => o.value)).toContain('30');
    });

    it('lowers an app’s limit and goes back to what it asks', async () => {
      const app: CatalogueApp = { id: 'folio', name: 'Folio', route: '/folio', entry: '/apps/folio/entry.js', version: '0.1.0', sdk: '^1.0.0', platform: false, enabled: true, maxUpload: 200, uploadLimit: 200 };
      const calls: [string, string, unknown][] = [];
      const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push([init.method ?? 'GET', url, body]);
        if (url.endsWith('/upload-limit')) return Response.json({ ...app, uploadLimit: body.mb ?? 200, uploadLimitLowered: body.mb !== null });
        return Response.json(url.endsWith('/apps') ? [app] : []);
      });
      const el = document.createElement('admin-apps') as AdminApps;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.apps).toHaveLength(1));
      await el.limitUploads(app, '50');
      expect(calls).toContainEqual(['PUT', '/api/registry/v1/apps/folio/upload-limit', { mb: 50 }]);
      expect(el.apps[0].uploadLimit).toBe(50);
      await el.limitUploads(app, 'asked');
      expect(calls).toContainEqual(['PUT', '/api/registry/v1/apps/folio/upload-limit', { mb: null }]);
      expect(el.apps[0].uploadLimitLowered).toBe(false);
      el.remove();
    });
  });

  describe('Where an app is on', () => {
    const app: CatalogueApp = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.2.0', sdk: '^1.0.0', platform: false, enabled: true };
    const legal: Department = { id: 'd-3', name: 'Legal', members: [] };
    const tree = floorTree({ id: 'o', name: 'Acme' }, [finance, payroll, legal]);
    const names = new Map(tree.map((f) => [f.id, f.name]));
    const rule = (workspace: string, state: 'on' | 'off' | 'blocked', carriesOn = true) => ({ app: 'library', workspace, state, carriesOn, setBy: 'u-1', setAt: '2026-10-23T00:00:00.000Z' });
    const status = (id: string, rules: ReturnType<typeof rule>[], a = app) => floorStatus(a, tree.find((f) => f.id === id)!, rules, names).words;

    it('lays the org and its teams out as a tree', () => {
      expect(tree.map((f) => [f.name, f.path])).toEqual([
        ['Acme', ['o']],
        ['Finance', ['o', 'd-1']],
        ['Payroll', ['o', 'd-1', 'd-2']],
        ['Legal', ['o', 'd-3']],
      ]);
    });

    it('says why an app is on or off on each floor, as the registry decides', () => {
      expect(status('d-3', [rule('d-3', 'off')])).toBe('Off');
      expect(status('d-1', [rule('d-3', 'off')])).toBe('On');
      expect(status('d-2', [rule('d-1', 'off')])).toBe('Off, as Finance');
      expect(status('d-2', [rule('d-1', 'on', false), rule('o', 'off')])).toBe('Off, as Acme');
      expect(status('d-2', [rule('d-2', 'on'), rule('o', 'blocked')])).toBe('Off: blocked by Acme');
      expect(status('o', [rule('o', 'blocked')])).toBe('Blocked here and below');
      expect(status('d-1', [], { ...app, enabled: false })).toBe('Off: the app is turned off');
      expect(status('o', [], { ...app, floors: ['team'] })).toBe('Off: it doesn’t work on the org');
    });

    it('turns an app off for one team', async () => {
      const calls: [string, string, unknown][] = [];
      let rules: unknown[] = [];
      const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push([init.method ?? 'GET', url, body]);
        if (url.endsWith('/floors')) return Response.json(rules);
        if (url.includes('/floors/')) return Response.json({ rules: (rules = [rule('d-3', body.state)]) });
        if (url.endsWith('/me/workspaces')) return Response.json({ workspaces: [{ id: 'm', kind: 'personal', name: 'You' }, { id: 'o', kind: 'org', name: 'Acme' }] });
        if (url.endsWith('/admin/departments')) return Response.json([finance, payroll, legal]);
        if (url.endsWith('/versions')) return Response.json([]);
        return Response.json([app]);
      });
      const el = document.createElement('admin-apps') as AdminApps;
      document.body.append(el);
      el.api = new AdminApi(async () => 't', fetchImpl as unknown as typeof fetch);
      await vi.waitFor(() => expect(el.apps).toHaveLength(1));
      el.open = 'library';
      await vi.waitFor(() => expect(el.floorRules).toEqual([]));
      await settle(el);
      expect([...el.querySelectorAll('[data-floor]')].map((n) => n.getAttribute('label'))).toEqual(['Acme', 'Finance', 'Payroll', 'Legal']);
      await el.setFloor(app, el.floorList!.find((f) => f.id === 'd-3')!, 'off');
      expect(calls).toContainEqual(['PUT', '/api/registry/v1/apps/library/floors/d-3', { state: 'off' }]);
      await settle(el);
      expect(el.querySelector('[data-floor="d-3"]')?.getAttribute('hint')).toBe('Off');
      expect(el.querySelector('[data-floor="d-1"]')?.getAttribute('hint')).toBe('On');
      el.remove();
    });
  });
});
