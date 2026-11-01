import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App, routeFor } from './app.js';
import type { AppInstalls, PlatformUpdates } from './model/types.js';
import { appRows, augurRow } from './units.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const updates = (over: Partial<PlatformUpdates> = {}): PlatformUpdates => ({
  running: { version: '0.13.1', channel: 'stable' },
  channel: 'stable',
  ring: 'production',
  feed: 'on',
  checkedAt: '2026-11-01T20:00:00Z',
  newer: [{ version: '0.13.2', channel: 'stable', breaking: [] }],
  available: { version: '0.13.2', channel: 'stable', breaking: [], parts: [] },
  needsYou: [],
  goBack: [{ version: '0.13.0', channel: 'stable' }],
  history: [{ id: 'h1', from: '0.13.0', version: '0.13.1', requestedBy: 'p1', requestedByName: 'Sam', requestedAt: '2026-10-30T10:00:00Z', state: 'done' }],
  ...over,
});

const installs: AppInstalls = {
  feed: 'on',
  sdkVersion: '1.10.0',
  installed: [{ app: 'folio', name: 'Artifacts', version: '1.0.0', installedAt: '', channel: 'stable', policy: 'automatic', update: { version: '1.1.0', channel: 'stable', needs: [] } }],
  available: [],
};

describe('routes', () => {
  it('opens the overview, a unit or the history', () => {
    expect(routeFor('/')).toEqual({ page: 'overview' });
    expect(routeFor('/augur')).toEqual({ page: 'unit', unit: 'augur' });
    expect(routeFor('/apps/folio')).toEqual({ page: 'unit', unit: 'folio' });
    expect(routeFor('/history')).toEqual({ page: 'history' });
    expect(routeFor('/nonsense')).toEqual({ page: 'overview' });
  });
});

describe('unit rows', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  it('shows AUGUR’s offer as available until it has a policy, and as running during a job', () => {
    expect(augurRow(updates(), undefined, now)).toMatchObject({ id: 'augur', running: '0.13.1', offered: '0.13.2', state: 'update-available' });
    const job = updates({ upgrade: { id: 'u', from: '0.13.1', version: '0.13.2', requestedBy: 'p', requestedAt: '', state: 'running', steps: [] } });
    expect(augurRow(job, undefined, now).state).toBe('running');
    expect(augurRow(updates({ needsYou: [{ kind: 'halted', message: 'Stopped' }] }), undefined, now).state).toBe('halted');
  });

  it('lets an Automatic app take a minor by itself, and waits for a person when it asks for more', () => {
    expect(appRows(installs, {}, now)[0]).toMatchObject({ id: 'folio', name: 'Artifacts', state: 'update-available', policy: 'automatic' });
    const asks = { ...installs, installed: [{ ...installs.installed[0]!, update: { version: '1.1.0', channel: 'stable' as const, needs: ['It asks to send notifications.'] } }] };
    expect(appRows(asks, {}, now)[0]!.state).toBe('waiting-you');
  });
});

describe('Upgrade Centre', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState(null, '', '/');
  });

  const mount = async (roles: string[], respond: (path: string, init?: RequestInit) => [number, unknown]) => {
    window.history.replaceState(null, '', '/@me/upgrades');
    const el = document.createElement('div');
    document.body.append(el);
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      const [status, body] = respond(path, init);
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    });
    const root = createRoot(el);
    await act(async () => {
      root.render(<App ctx={{ fetch, path: '', user: { id: 'p1', name: 'Alex', departments: [], roles } }} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    return { el, fetch, root };
  };

  const registry = (path: string): [number, unknown] =>
    path.endsWith('/platform/updates') ? [200, updates()] : path.endsWith('/app-runner/apps') ? [200, installs] : [404, { error: 'not_found', message: 'No such record' }];

  it('answers the three overview questions, and says when nothing needs you', async () => {
    const { el } = await mount(['admin'], registry);
    expect(el.textContent).toContain('Nothing needs you.');
    expect(el.textContent).toContain('Production');
    expect(el.querySelector('[data-unit="augur"]')?.textContent).toContain('0.13.1');
    expect(el.querySelector('[data-unit="folio"]')?.textContent).toContain('Artifacts');
    expect(el.textContent).toContain('Nothing scheduled.');
  });

  it('opens a unit inside the app, keeping its upgrade visible but explained', async () => {
    const { el } = await mount(['admin'], registry);
    const link = [...el.querySelectorAll('nav a')].find((a) => a.textContent === 'AUGUR') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/@me/upgrades/augur');
    await act(async () => link.click());
    expect(window.location.pathname).toBe('/@me/upgrades/augur');
    const button = el.querySelector('[data-release="0.13.2"] ui-button');
    expect(button?.textContent).toBe('Upgrade AUGUR to 0.13.2');
    expect(button?.getAttribute('reason')).toContain('deployment-admin');
    expect(el.querySelector('[data-go-back="0.13.0"]')?.textContent).toContain('Can go back straight away');
  });

  it('keeps what it last read when the registry stops answering, and says so', async () => {
    let fail = false;
    const { el } = await mount(['deployment-admin'], (path) => (fail ? [502, { message: 'The registry isn’t answering.' }] : registry(path)));
    fail = true;
    const check = el.querySelector('ui-button') as HTMLElement;
    await act(async () => check.click());
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('The registry isn’t answering.');
    expect(el.querySelector('[data-unit="augur"]')).not.toBeNull();
  });
});
