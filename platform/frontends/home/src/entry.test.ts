import { createEventBus, type EventBus, type MountContext } from '@platform/mfe-sdk';
import type { UiList } from '@platform/ui-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import home, { HOME_CHANNEL, needsWords, type HomeState } from './entry.js';

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

const list = async (el: HTMLElement) => {
  const l = el.querySelector('ui-list') as UiList;
  await l.updateComplete;
  return l;
};

afterEach(() => vi.useRealTimers());

describe('home', () => {
  it('greets the person by first name and clears up on unmount', async () => {
    const el = document.createElement('div');
    await home.mount(el, ctx(shell(state).bus));
    const heading = el.querySelector('ui-heading')!;
    expect(heading.getAttribute('heading')).toMatch(/, Sam$/);
    expect(heading.getAttribute('eyebrow')).toBe('');
    await home.unmount!(el);
    expect(el.querySelector('ui-heading')).toBeNull();
  });

  it('names the floor it was opened on', async () => {
    const el = document.createElement('div');
    const finance = { id: 'w-fin', kind: 'team' as const, name: 'Finance', slug: 'finance', path: [], role: 'member' as const };
    await home.mount(el, { ...ctx(shell(state).bus), workspace: finance });
    expect(el.querySelector('ui-heading')!.getAttribute('eyebrow')).toBe('Finance');
  });

  it('counts what needs you, and lists each with its actions', async () => {
    const el = document.body.appendChild(document.createElement('div'));
    await home.mount(el, ctx(shell(state).bus));
    expect(el.querySelector('ui-heading')!.getAttribute('summary')).toBe('2 things need you');
    const rows = (await list(el)).items;
    expect(rows.map((r) => [r.title, r.detail, r.actions?.map((a) => a.label)])).toEqual([
      ['Approve Alex’s claim', 'Claims', ['Approve', 'Open']],
      ['Review the policy', 'Library · On Finance · By Friday', []],
    ]);
    expect(needsWords(1)).toBe('1 thing needs you');
  });

  it('passes on what’s pressed: opening a row, or one of its actions', async () => {
    const { bus, asked } = shell(state);
    const el = document.body.appendChild(document.createElement('div'));
    await home.mount(el, ctx(bus));
    const l = await list(el);
    l.shadowRoot!.querySelectorAll<HTMLButtonElement>('.act')[0].click();
    l.shadowRoot!.querySelectorAll<HTMLButtonElement>('.row')[1].click();
    expect(asked.filter((a) => !a.startsWith('mount'))).toEqual(['act n1 0', 'open n2']);
  });

  it('makes a tile for each card and has the shell mount it, saying so when it can’t', async () => {
    const { bus, asked } = shell({ needs: [], cards: [{ app: 'claims', name: 'Claims' }, { app: 'broken', name: 'Broken' }] });
    const el = document.body.appendChild(document.createElement('div'));
    await home.mount(el, ctx(bus));
    expect(asked).toEqual(['mount claims', 'mount broken']);
    expect(el.querySelector('[data-card="claims"]')!.textContent).toBe('claims card');
    expect(el.querySelector('[data-card="broken"]')!.hasAttribute('hidden')).toBe(true);
    expect(el.querySelector('ui-state[kind="error"]')!.getAttribute('heading')).toBe('Broken couldn’t show this right now.');
    // A new state keeps the tiles it already has.
    bus.emit(HOME_CHANNEL.state, { needs: [], cards: [{ app: 'claims', name: 'Claims' }] });
    expect(asked).toEqual(['mount claims', 'mount broken', 'unmount']);
    await home.unmount!(el);
    expect(asked.at(-1)).toBe('unmount');
  });

  it('says nothing needs you when there’s nothing and no cards, or the shell doesn’t answer', async () => {
    const el = document.createElement('div');
    await home.mount(el, ctx(shell({ needs: [], cards: [] }).bus));
    expect(el.querySelector('ui-state')!.getAttribute('heading')).toBe('Nothing needs you right now.');
    vi.useFakeTimers();
    const quiet = document.createElement('div');
    await home.mount(quiet, ctx(shell(null).bus));
    expect(quiet.querySelector('ui-list')!.hasAttribute('loading')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(quiet.querySelector('ui-state')).not.toBeNull();
    await home.unmount!(quiet);
  });

  it('sends a test notification through the shell', async () => {
    const notify = vi.fn();
    const el = document.createElement('div');
    await home.mount(el, ctx(shell(state).bus, notify));
    (el.querySelector('ui-button') as HTMLElement).click();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ needsYou: true }));
  });
});
