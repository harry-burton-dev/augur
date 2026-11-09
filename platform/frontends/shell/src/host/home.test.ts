import { createEventBus, type AppManifestEntry, type MountContext, type Workspace } from '@augur/mfe-sdk';
import { CURRENT_SDK } from '../current-sdk.js';
import type { ShellNotification } from '@augur/shell-kit';
import { describe, expect, it, vi } from 'vitest';
import { cardOf, cardsFor, needsFor, settingsOf, SurfaceMounter } from './home.js';
import { fromCatalogue3 } from './apps3.js';

const app = (id: string, extra: Partial<AppManifestEntry> = {}): AppManifestEntry => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  route: `/${id}`,
  entry: `/apps/${id}/entry.js`,
  version: '0.1.0',
  sdk: CURRENT_SDK,
  ...extra,
});
const card = (floor: 'personal' | 'team' | 'org', role?: 'member' | 'lead', module = './Card') => ({ floor, slot: 'card' as const, module, ...(role ? { role } : {}) });
const me: Workspace = { id: 'w-me', kind: 'personal', name: 'You', slug: 'me', path: [], role: 'lead' };
const finance: Workspace = { id: 'w-fin', kind: 'team', name: 'Finance', slug: 'finance', path: [], role: 'member' };
const ctx = (): MountContext => ({
  user: { id: 'u', name: 'U', departments: [], roles: [] },
  getToken: async () => 't',
  bus: createEventBus(),
  raise: vi.fn(),
  request: vi.fn(),
  notify: vi.fn(),
  workspace: me,
  getWorkspace: () => me,
  previewOn: () => false,
  fetch: vi.fn(),
  path: '/',
});

describe('what needs you, for Home', () => {
  const at = (m: number) => Date.UTC(2026, 9, 23, 9, m);
  const notes: ShellNotification[] = [
    { id: 'a', app: 'claims', level: 'needs', title: 'Approve a claim', time: at(1), actions: [{ label: 'Approve' }] },
    { id: 'b', app: 'claims', level: 'info', title: 'Claim paid', time: at(2) },
    { id: 'c', app: 'library', level: 'needs', title: 'Review the policy', time: at(3), floor: 'w-fin' },
    { id: 'd', app: 'noisy', level: 'needs', title: 'Muted', time: at(4) },
    { id: 'e', app: 'library', level: 'needs', title: 'Here', time: new Date(at(0)), floor: 'w-me' },
  ];

  it('is every unread notification that needs you, newest first, leaving out muted apps', () => {
    const needs = needsFor(notes, { muted: ['noisy'], apps: [app('claims'), app('library')], floors: [me, finance], here: 'w-me' });
    expect(needs.map((n) => n.id)).toEqual(['c', 'a', 'e']);
    expect(needs[0]).toMatchObject({ appName: 'Library', floorName: 'Finance', actions: [] });
    expect(needs[1]).toMatchObject({ appName: 'Claims', actions: ['Approve'] });
    expect(needs[2].floorName).toBeUndefined();
    expect(typeof needs[2].time).toBe('number');
  });
});

describe('glance cards', () => {
  it('picks the card for the kind of floor, a role’s own over everyone’s', () => {
    const a = app('claims', { surfaces: [card('team', undefined, './Everyone'), card('team', 'member', './Members'), card('org', 'lead', './Leads'), { floor: 'team', slot: 'page', module: './Page' }] });
    expect(cardOf(a, finance)?.module).toBe('./Members');
    expect(cardOf(a, { kind: 'team', role: 'lead' })?.module).toBe('./Everyone');
    expect(cardOf(a, { kind: 'org', role: 'member' })).toBeUndefined();
    expect(cardOf(a, me)).toBeUndefined();
  });

  it('finds an app’s own settings for this kind of floor, or else its personal ones', () => {
    const settings = (floor: 'personal' | 'team' | 'org', module: string) => ({ floor, slot: 'settings' as const, module });
    const a = app('claims', { surfaces: [settings('personal', './Mine'), settings('team', './Team'), card('team')] });
    expect(settingsOf(a, finance)?.module).toBe('./Team');
    expect(settingsOf(a, { kind: 'org', role: 'member' })?.module).toBe('./Mine');
    expect(settingsOf(app('plain', { surfaces: [card('personal')] }), me)).toBeUndefined();
  });

  it('orders cards by the apps opened most recently, then the catalogue, at most six', () => {
    const many = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].map((id) => app(id, { surfaces: [card('personal')] }));
    const manifest = [app('home'), ...many, app('old', { sdk: '^0.1.0', surfaces: [card('personal')] })];
    expect(cardsFor(manifest, me, ['a5', 'home', 'a2']).map((c) => c.app)).toEqual(['a5', 'a2', 'a1', 'a3', 'a4', 'a6']);
  });

  it('puts apps for the work before platform apps, among those not opened lately', () => {
    const explorer = app('auspex', { category: 'platform', surfaces: [card('personal')] });
    const artifacts = app('folio', { category: 'pillar', surfaces: [card('personal')] });
    const plain = app('claims', { surfaces: [card('personal')] });
    expect(cardsFor([explorer, artifacts, plain], me, []).map((c) => c.app)).toEqual(['folio', 'claims', 'auspex']);
    // Opened lately comes first, whatever its kind.
    expect(cardsFor([explorer, artifacts, plain], me, ['auspex']).map((c) => c.app)).toEqual(['auspex', 'folio', 'claims']);
  });

  it('keeps the card of an app it can’t open, saying why and who can change it', () => {
    const manifest = [app('claims', { surfaces: [card('personal')] }), app('old', { sdk: '^0.1.0', surfaces: [card('personal')] })];
    const [claims, old] = cardsFor(manifest, me, []);
    expect(claims.unavailable).toBeUndefined();
    expect(old).toMatchObject({ app: 'old', name: 'Old' });
    expect(old.unavailable).toMatch(/made for an older version of AUGUR.*Its team needs to release/);
  });

  it('mounts a card from its app’s entry, once per entry, and puts it away', async () => {
    const mount = vi.fn((el: HTMLElement) => void (el.textContent = 'card'));
    const unmount = vi.fn();
    const load = vi.fn(async () => ({ default: { mount: vi.fn(), surfaces: { './Card': { mount, unmount } } } }));
    const cards = new SurfaceMounter(load);
    const a = app('claims', { surfaces: [card('personal')] });
    const one = document.body.appendChild(document.createElement('div'));
    const two = document.body.appendChild(document.createElement('div'));
    expect(await cards.mount(one, a, me, ctx())).toBe(true);
    expect(await cards.mount(two, a, me, ctx())).toBe(true);
    expect(load).toHaveBeenCalledOnce();
    expect(one.textContent).toBe('card');
    await cards.unmount(one);
    expect(unmount).toHaveBeenCalledWith(one);
    expect(one.textContent).toBe('');
  });

  it('says no, without throwing, for a card that is missing, fails or won’t load', async () => {
    const el = document.body.appendChild(document.createElement('div'));
    const a = app('claims', { surfaces: [card('personal')] });
    expect(await new SurfaceMounter(async () => ({ default: { mount: vi.fn() } })).mount(el, a, me, ctx())).toBe(false);
    expect(await new SurfaceMounter(async () => ({ default: { mount: vi.fn(), surfaces: { './Card': { mount: () => Promise.reject(new Error('boom')) } } } })).mount(el, a, me, ctx())).toBe(false);
    const flaky = vi.fn().mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce({ default: { mount: vi.fn(), surfaces: { './Card': { mount: vi.fn() } } } });
    const cards = new SurfaceMounter(flaky);
    expect(await cards.mount(el, a, me, ctx())).toBe(false);
    expect(await cards.mount(el, a, me, ctx())).toBe(true);
    expect(await cards.mount(el, app('plain'), me, ctx())).toBe(false);
  });
});

describe('cards of apps on the app contract', () => {
  const worker = fromCatalogue3({ contract: 3, id: 'notes', name: 'Notes', version: '1.0.0', frontend: { entry: 'sandbox.js' }, contributes: { card: true } });
  /** A stand-in for the worker's card: it says it was shown when the test says so, and counts its ends. */
  const fakeCard = () => {
    let settle!: (shown: boolean) => void;
    const made = { ends: 0, mounted: 0, settle: (v: boolean) => settle(v) };
    const factory = vi.fn(() => ({
      shown: new Promise<boolean>((r) => (settle = r)),
      mount: () => void made.mounted++,
      unmount: () => {
        made.ends++;
        settle(false);
      },
    }));
    return { made, factory };
  };

  it('ends the card’s worker when the tile goes while it is still opening', async () => {
    const { made, factory } = fakeCard();
    const cards = new SurfaceMounter(undefined, factory as never);
    const el = document.createElement('div');
    document.body.append(el);
    const shown = cards.mount(el, worker, me, ctx());
    await cards.unmount(el);
    expect(await shown).toBe(false);
    expect(made.ends).toBe(1);
    el.remove();
  });

  it('ends the first card when the same tile is filled again', async () => {
    const first = fakeCard();
    const second = fakeCard();
    const factories = [first.factory, second.factory];
    const cards = new SurfaceMounter(undefined, (() => factories.shift()!()) as never);
    const el = document.createElement('div');
    document.body.append(el);
    const one = cards.mount(el, worker, me, ctx());
    await Promise.resolve();
    const two = cards.mount(el, worker, me, ctx());
    await Promise.resolve();
    second.made.settle(true);
    expect(await one).toBe(false);
    expect(await two).toBe(true);
    expect(first.made.ends).toBe(1);
    expect(second.made.ends).toBe(0);
    el.remove();
  });

  it('starts no card for a tile no longer on the page', async () => {
    const { made, factory } = fakeCard();
    const cards = new SurfaceMounter(undefined, factory as never);
    expect(await cards.mount(document.createElement('div'), worker, me, ctx())).toBe(false);
    expect(made.mounted).toBe(0);
  });
});

