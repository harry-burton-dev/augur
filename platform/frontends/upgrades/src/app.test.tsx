import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App, routeFor } from './app.js';
import { needsYou } from './model/needs-you.js';
import type { AppInstalls, Overview, OverviewUnit, PlatformUpdates } from './model/types.js';
import { stateOf } from './units.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const manifest = [{ id: 'upgrades', name: 'Upgrade Centre', route: '/upgrades', entry: '', version: '0.0.0', sdk: '^1.10.0', icon: 'download' }];
/** The button with these words, and what it says when it can't be pressed. */
const buttonIn = (el: ParentNode, words: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === words) as HTMLButtonElement;
const reasonOf = (b: Element) => document.getElementById(b.getAttribute('aria-describedby') ?? '')?.textContent ?? '';

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
    expect(routeFor('/history#u1')).toEqual({ page: 'history' });
    expect(routeFor('/nonsense')).toEqual({ page: 'overview' });
  });
});

const unit = (over: Partial<OverviewUnit> = {}): OverviewUnit => ({
  unit: 'augur',
  name: 'AUGUR',
  running: '0.13.1',
  available: '0.13.2',
  desired: { unit: 'augur', channel: 'stable', policy: 'ask', automaticUpTo: 'patch', windows: [{ day: 0, start: '02:00', hours: 2 }], timeZone: 'Europe/London', setBy: 'default', setAt: '2026-11-01T00:00:00Z', isDefault: true },
  policy: 'AUGUR waits for you before taking any release from Production.',
  window: { open: false, nextAt: '2026-11-08T02:00:00Z' },
  ...over,
});

const overview = (over: Partial<Overview> = {}): Overview => ({
  ring: 'production',
  timeZone: 'Europe/London',
  feed: 'on',
  feedTrust: { state: 'verified', signer: 'release.yml' },
  checkedAt: '2026-11-01T20:00:00Z',
  units: [unit(), unit({ unit: 'folio', name: 'Artifacts', running: '1.0.0', available: '1.1.0', policy: 'Artifacts takes patch and minor releases by itself.', desired: { ...unit().desired, unit: 'folio', policy: 'automatic', automaticUpTo: 'minor', windows: [] }, window: { open: true }, automatic: { takes: 'It takes 1.1.0 by itself now.' } })],
  needsYou: [],
  ...over,
});

describe('unit state', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  it('follows the registry: running, halted, held, then the offer', () => {
    expect(stateOf(unit({ open: { id: 'u', state: 'running' } }), now)).toBe('running');
    expect(stateOf(unit({ halted: { reason: 'Sign-in loops', at: '' } }), now)).toBe('halted');
    expect(stateOf(unit({ desired: { ...unit().desired, policy: 'hold' } }), now)).toBe('held');
    expect(stateOf(unit({ available: undefined }), now)).toBe('up-to-date');
    expect(stateOf(unit(), now)).toBe('waiting-you');
  });

  it('waits for the window when Automatic takes it, and for a person when it says why not', () => {
    const auto = { ...unit().desired, policy: 'automatic' as const };
    expect(stateOf(unit({ desired: auto, automatic: { takes: 'Takes 0.13.2 on Sunday.' } }), now)).toBe('waiting-window');
    expect(stateOf(unit({ desired: auto, automatic: { takes: 'Takes it now.' }, window: { open: true } }), now)).toBe('update-available');
    expect(stateOf(unit({ desired: auto, automatic: { waits: 'It needs a setting only a person can give.' } }), now)).toBe('waiting-you');
    expect(stateOf(unit(), now, '2026-11-04T12:05:00Z')).toBe('watching');
  });
});

describe('needs you', () => {
  it('lists what the registry lists, worst first, then app releases that ask for more', () => {
    const items = needsYou(
      overview({
        needsYou: [
          { kind: 'went-back', unit: 'augur', message: 'Verify failed on registry.', result: { kind: 'upgrade', id: 'u1' } },
          { kind: 'halted', unit: 'folio', message: 'Uploads fail on 1.0.0.' },
        ],
      }),
      [{ ...installs.installed[0]!, update: { version: '1.1.0', channel: 'stable', needs: ['It asks to send notifications.'] } }],
    );
    expect(items.map((i) => i.kind)).toEqual(['halted', 'went-back', 'approval']);
    expect(items[0]!.title).toBe('Artifacts runs a halted release');
    expect(items[1]!.result).toEqual({ kind: 'upgrade', id: 'u1' });
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
    path.endsWith('/platform/overview')
      ? [200, overview()]
      : path.endsWith('/platform/updates')
        ? [200, updates()]
        : path.endsWith('/app-runner/apps')
          ? [200, installs]
          : path.endsWith('/manifest')
            ? [200, manifest]
          : [404, { error: 'not_found', message: 'Nothing there' }];

  it('answers the three overview questions, and says when nothing needs you', async () => {
    const { el } = await mount(['admin'], registry);
    expect(el.textContent).toContain('Nothing needs you.');
    expect(el.textContent).toContain('Production');
    expect(el.querySelector('[data-unit="augur"]')?.textContent).toContain('0.13.1');
    expect(el.querySelector('[data-unit="folio"]')?.textContent).toContain('Artifacts');
    expect(el.textContent).toContain('Next maintenance window Sun 8 Nov, 02:00 GMT');
    expect(el.querySelector('[data-unit="folio"]')?.textContent).toContain('Automatic');
  });

  it('opens a unit inside the app, keeping its upgrade visible but explained', async () => {
    const { el } = await mount(['admin'], registry);
    expect(el.querySelector('[data-unit="augur"] a')?.getAttribute('href')).toBe('/@me/upgrades/augur');
    const rail = [...el.querySelectorAll('nav button')].find((b) => b.textContent === 'AUGUR') as HTMLButtonElement;
    await act(async () => rail.click());
    expect(window.location.pathname).toBe('/@me/upgrades/augur');
    const button = el.querySelector('[data-release="0.13.2"] button')!;
    expect(button.textContent).toBe('Upgrade AUGUR to 0.13.2');
    expect(reasonOf(button)).toContain('deployment-admin');
    expect(el.querySelector('[data-go-back="0.13.0"]')?.textContent).toContain('Can go back straight away');
    expect(el.textContent).toContain('AUGUR waits for you before taking any release from Production.');
    expect(el.textContent).toContain('These are the defaults');
  });

  it('keeps what it last read when the registry stops answering, and says so', async () => {
    let fail = false;
    const { el } = await mount(['deployment-admin'], (path) => (fail ? [502, { message: 'The registry isn’t answering.' }] : registry(path)));
    fail = true;
    const check = buttonIn(el, 'Check now');
    await act(async () => check.click());
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('The registry isn’t answering.');
    expect(el.querySelector('[data-unit="augur"]')).not.toBeNull();
  });
});

describe('marking a result looked at', () => {
  it('sends it to the registry for every admin and shows the overview it answers with', async () => {
    window.history.replaceState(null, '', '/@me/upgrades');
    const el = document.createElement('div');
    document.body.append(el);
    let current = overview({ needsYou: [{ kind: 'failed', unit: 'augur', message: 'Pull failed.', result: { kind: 'upgrade', id: 'u9' } }] });
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.endsWith('/results/upgrade/u9/seen') && init?.method === 'POST') current = overview();
      const body = path.includes('/platform/overview') || path.includes('/seen') ? current : path.endsWith('/platform/updates') ? updates() : path.endsWith('/manifest') ? manifest : installs;
      return new Response(JSON.stringify(body), { status: 200 });
    });
    await act(async () => {
      createRoot(el).render(<App ctx={{ fetch, path: '', user: { id: 'p1', name: 'Alex', departments: [], roles: ['deployment-admin'] } }} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(el.querySelector('[data-need="failed"]')).not.toBeNull();
    const looked = el.querySelector('[data-need="failed"] button') as HTMLElement;
    await act(async () => looked.click());
    expect(fetch).toHaveBeenCalledWith('/api/registry/v1/platform/results/upgrade/u9/seen', expect.objectContaining({ method: 'POST' }));
    expect(el.querySelector('[data-need="failed"]')).toBeNull();
    expect(el.textContent).toContain('Nothing needs you.');
  });
});

describe('changing a unit’s settings', () => {
  const open = async (roles: string[], path = '/augur') => {
    window.history.replaceState(null, '', `/@me/upgrades${path}`);
    const el = document.createElement('div');
    document.body.append(el);
    let current = overview();
    const sent: { path: string; body: unknown }[] = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        sent.push({ path: url, body });
        if (body.channel !== 'stable') return new Response(JSON.stringify({ error: 'conflict', message: 'AUGUR follows stable releases, set by RELEASE_CHANNEL.' }), { status: 409 });
        current = overview({ units: [unit({ desired: { ...unit().desired, ...body, setBy: 'p1', isDefault: false }, policy: 'On hold: nothing new is offered.' }), ...overview().units.slice(1)] });
      }
      const body = url.includes('/platform/overview') || url.includes('/desired-state') ? current : url.endsWith('/platform/updates') ? updates() : url.endsWith('/manifest') ? manifest : installs;
      return new Response(JSON.stringify(body), { status: 200 });
    });
    await act(async () => {
      createRoot(el).render(<App ctx={{ fetch, path, user: { id: 'p1', name: 'Alex', departments: [], roles } }} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    return { el, sent };
  };
  const button = buttonIn;

  it('keeps Change settings visible without the role, saying which role it needs', async () => {
    const { el } = await open([]);
    expect(reasonOf(button(el, 'Change settings'))).toContain('deployment-admin');
  });

  it('shows the sentence before and after, the next windows, and saves what the person chose', async () => {
    const { el, sent } = await open(['deployment-admin']);
    await act(async () => button(el, 'Change settings').click());
    const form = el.querySelector('form')!;
    expect(reasonOf(button(el, 'Save settings'))).toBe('Nothing has changed yet.');
    const automatic = [...form.querySelectorAll('input[name="policy"]')][0] as HTMLInputElement;
    await act(async () => automatic.click());
    expect(form.querySelector('[data-after]')?.textContent).toContain('Automatic: patch releases install by themselves in Sunday 02:00 for 2 hours (Europe/London)');
    expect(form.textContent).toContain('The next windows');
    expect([...form.querySelectorAll('input[name="channel"]')].filter((c) => (c as HTMLInputElement).disabled)).toHaveLength(2);
    const hold = [...form.querySelectorAll('input[name="policy"]')][2] as HTMLInputElement;
    await act(async () => hold.click());
    await act(async () => button(el, 'Save settings').click());
    expect(sent).toEqual([
      { path: '/api/registry/v1/platform/units/augur/desired-state', body: { channel: 'stable', policy: 'hold', automaticUpTo: 'patch', windows: [{ day: 0, start: '02:00', hours: 2 }], timeZone: 'Europe/London' } },
    ]);
    expect(el.querySelector('form')).toBeNull();
    expect(el.textContent).toContain('On hold: nothing new is offered.');
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Saved.');
  });

  it('won’t save a range that isn’t one, and says why in place', async () => {
    const { el, sent } = await open(['deployment-admin']);
    await act(async () => button(el, 'Change settings').click());
    const range = el.querySelector('input[placeholder="^1.2.0"]') as HTMLInputElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(range, 'banana');
      range.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(reasonOf(button(el, 'Save settings'))).toContain('isn’t a version range');
    expect(sent).toEqual([]);
  });
});
