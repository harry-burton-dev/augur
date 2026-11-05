import { createEventBus, type EventBus, type MountContext } from '@augur/mfe-sdk';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import home, { HOME_CHANNEL, needsWords, type HomeState } from './entry.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mount = (el: HTMLElement, c: MountContext) => act(() => void home.mount(el, c));
const unmount = (el: HTMLElement) => act(() => void home.unmount!(el));
const heading = (el: HTMLElement) => el.querySelector('.augur-heading');
const title = (el: HTMLElement) => heading(el)?.querySelector('.augur-title')?.textContent;
const eyebrow = (el: HTMLElement) => heading(el)?.querySelector('.augur-eyebrow')?.textContent ?? '';
const summary = (el: HTMLElement) => heading(el)?.querySelector('.augur-summary')?.textContent;
const press = (b: Element | undefined) => act(() => (b as HTMLElement).click());

const own = { id: 'w-me', kind: 'personal' as const, name: 'You', slug: 'me', path: [], role: 'lead' as const };
const ctx = (bus: EventBus = createEventBus(), notify = vi.fn()): MountContext => ({
  user: { id: 'u1', name: 'Sam Okafor', departments: ['Finance'], roles: [] },
  getToken: async () => 't',
  bus,
  raise: vi.fn(),
  request: vi.fn(),
  notify,
  workspace: own,
  getWorkspace: () => own,
  previewOn: () => false,
  fetch: vi.fn(),
  path: '/',
});

const state: HomeState = {
  needs: [
    { id: 'n1', app: 'claims', appName: 'Claims', title: 'Approve Alex’s claim', time: Date.now() - 4 * 60_000, actions: ['Approve', 'Open'] },
    { id: 'n2', app: 'library', appName: 'Library', title: 'Review the policy', detail: 'By Friday', floorName: 'Finance', time: Date.now(), actions: [] },
  ],
  cards: [{ app: 'claims', name: 'Claims', icon: 'document' }],
};

/** Stands in for the shell: answers `ready` with a state, and records what Home asks. */
const shell = (answer: HomeState | null) => {
  const bus = createEventBus();
  const asked: string[] = [];
  bus.on(HOME_CHANNEL.ready, () => answer && bus.emit(HOME_CHANNEL.state, answer));
  bus.on<{ id: string }>(HOME_CHANNEL.open, ({ id }) => asked.push(`open ${id}`));
  bus.on<{ id: string; index: number }>(HOME_CHANNEL.act, ({ id, index }) => asked.push(`act ${id} ${index}`));
  bus.on<{ el: HTMLElement; app: string; done(shown: boolean): void }>(HOME_CHANNEL.mountCard, ({ el, app, done }) => {
    asked.push(`mount ${app}`);
    el.textContent = `${app} card`;
    done(app !== 'broken');
  });
  bus.on(HOME_CHANNEL.unmountCard, () => asked.push('unmount'));
  return { bus, asked };
};

const rows = (el: HTMLElement) => [...el.querySelectorAll('.quill-list-row')];

afterEach(() => vi.useRealTimers());

describe('home', () => {
  it('greets the person by first name and clears up on unmount', async () => {
    const el = document.createElement('div');
    mount(el, ctx(shell(state).bus));
    expect(title(el)).toMatch(/, Sam$/);
    expect(eyebrow(el)).toBe('');
    unmount(el);
    expect(heading(el)).toBeNull();
  });

  it('names the floor it was opened on', async () => {
    const el = document.createElement('div');
    const finance = { id: 'w-fin', kind: 'team' as const, name: 'Finance', slug: 'finance', path: [], role: 'member' as const };
    mount(el, { ...ctx(shell(state).bus), workspace: finance });
    expect(eyebrow(el)).toBe('Finance');
  });

  it('counts what needs you, and lists each with its actions', async () => {
    const el = document.body.appendChild(document.createElement('div'));
    mount(el, ctx(shell(state).bus));
    expect(summary(el)).toBe('2 things need you');
    expect(rows(el).map((r) => [r.querySelector('b')!.textContent, r.querySelector('.quill-list-text span')?.textContent, [...r.querySelectorAll('button')].map((b) => b.textContent)])).toEqual([
      ['Approve Alex’s claim', 'Claims', ['Approve', 'Open']],
      ['Review the policy', 'Library · On Finance · By Friday', []],
    ]);
    expect(needsWords(1)).toBe('1 thing needs you');
  });

  it('passes on what’s pressed: opening a row, or one of its actions', async () => {
    const { bus, asked } = shell(state);
    const el = document.body.appendChild(document.createElement('div'));
    mount(el, ctx(bus));
    press(rows(el)[0]!.querySelector('button')!);
    press(rows(el)[1]);
    expect(asked.filter((a) => !a.startsWith('mount'))).toEqual(['act n1 0', 'open n2']);
  });

  it('makes a tile for each card and has the shell mount it, saying so when it can’t', async () => {
    const { bus, asked } = shell({ needs: [], cards: [{ app: 'claims', name: 'Claims' }, { app: 'broken', name: 'Broken' }] });
    const el = document.body.appendChild(document.createElement('div'));
    mount(el, ctx(bus));
    expect(asked).toEqual(['mount claims', 'mount broken']);
    expect(el.querySelector('[data-card="claims"]')!.textContent).toBe('claims card');
    expect(el.querySelector('[data-card="broken"]')!.hasAttribute('hidden')).toBe(true);
    expect(el.querySelector('.quill-state[data-kind="error"]')!.textContent).toBe('Broken couldn’t show this right now.');
    // A new state keeps the tiles it already has.
    act(() => bus.emit(HOME_CHANNEL.state, { needs: [], cards: [{ app: 'claims', name: 'Claims' }] }));
    expect(asked).toEqual(['mount claims', 'mount broken', 'unmount']);
    unmount(el);
    expect(asked.at(-1)).toBe('unmount');
  });

  it('shows the card of an app that can’t be opened, with why, and doesn’t mount it', async () => {
    const why = 'Old was made for an older version of AUGUR and hasn’t been updated yet. Its team needs to release a version for this one.';
    const { bus, asked } = shell({ needs: [], cards: [{ app: 'old', name: 'Old', unavailable: why }] });
    const el = document.body.appendChild(document.createElement('div'));
    mount(el, ctx(bus));
    expect(asked).toEqual([]);
    const tile = el.querySelector('[data-unavailable="old"]')!;
    expect(tile.textContent).toContain('Old');
    expect(tile.textContent).toContain(why);
    unmount(el);
  });

  it('says nothing needs you when there’s nothing and no cards, or the shell doesn’t answer', async () => {
    const el = document.createElement('div');
    mount(el, ctx(shell({ needs: [], cards: [] }).bus));
    expect(el.querySelector('.quill-state')!.textContent).toBe('Nothing needs you right now.');
    vi.useFakeTimers();
    const quiet = document.createElement('div');
    mount(quiet, ctx(shell(null).bus));
    expect(quiet.querySelector('.quill-list [aria-busy="true"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(quiet.querySelector('.quill-state')).not.toBeNull();
    unmount(quiet);
  });

  it('sends a test notification through the shell', async () => {
    const notify = vi.fn();
    const el = document.createElement('div');
    mount(el, ctx(shell(state).bus, notify));
    press([...el.querySelectorAll('button')].find((b) => b.textContent === 'Send a test notification'));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ needsYou: true }));
  });
});

describe('home, design direction previews (PER-283)', () => {
  const withPreviews = (on: string[], bus: EventBus) => ({ ...ctx(bus), previewOn: (id: string) => on.includes(id) });

  it('stays as it was with every preview off', async () => {
    const el = document.body.appendChild(document.createElement('div'));
    mount(el, ctx(shell(state).bus));
    expect(el.querySelector('.quill-field')!.hasAttribute('data-pulling')).toBe(false);
    expect(el.querySelector('.augur-signal')).toBeNull();
    expect(el.querySelector('.quill-ring-more')).toBeNull();
    unmount(el);
  });

  it('focal planes: what needs you pulls focus, with its count in light and words, and the cards go quiet', async () => {
    const el = document.body.appendChild(document.createElement('div'));
    mount(el, withPreviews(['focal-planes'], shell(state).bus));
    expect(el.querySelector('.quill-field')!.hasAttribute('data-pulling')).toBe(true);
    expect(el.querySelector('.augur-signal')!.textContent).toContain('need you');
    const items = [...el.querySelectorAll('.quill-focus-item')].map((i) => i.getAttribute('data-focus'));
    expect(items).toEqual(['pulled', 'ambient']);
    unmount(el);
  });

  it('radial menu: each need opens its actions in a ring, Open first, and choosing one is passed on', async () => {
    const el = document.body.appendChild(document.createElement('div'));
    const { bus, asked } = shell(state);
    mount(el, withPreviews(['radial-menu'], bus));
    const more = el.querySelector<HTMLButtonElement>('.quill-ring-more')!;
    expect(more.getAttribute('aria-label')).toBe('More actions for Approve Alex’s claim');
    press(more);
    const names = [...document.querySelectorAll('.quill-ring-items .quill-ring-label')].map((n) => n.textContent);
    expect(names).toEqual(['Open', 'Approve', 'Open']);
    vi.useFakeTimers();
    press([...document.querySelectorAll<HTMLElement>('.quill-ring-items [role="menuitem"]')][1]);
    act(() => void vi.runAllTimers());
    expect(asked).toContain('act n1 0');
    unmount(el);
  });
});
