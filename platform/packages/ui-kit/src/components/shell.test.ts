import { beforeEach, describe, expect, it, vi } from 'vitest';
import './shell.js';
import { ago, streamWords, type ShellNotification, type UiShell } from './shell.js';

let el: UiShell;
const now = Date.now();
const note = (id: string, level: ShellNotification['level'], minutesAgo = 5): ShellNotification => ({
  id,
  app: 'library',
  level,
  title: `Note ${id}`,
  time: now - minutesAgo * 60_000,
});

const root = () => el.shadowRoot!;
const key = (target: EventTarget, k: string, extra: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true, ...extra }));

beforeEach(async () => {
  document.body.innerHTML = '<ui-shell product="AUGUR" workspace="Finance"><main>App</main></ui-shell>';
  el = document.querySelector('ui-shell')!;
  el.apps = [
    { id: 'home', name: 'Home', icon: 'home' },
    { id: 'library', name: 'Library', icon: 'library', line: 'Your documents' },
    { id: 'admin', name: 'Admin', icon: 'admin' },
  ];
  el.current = 'home';
  el.recent = ['admin'];
  await el.updateComplete;
});

describe('stream words', () => {
  it('says status in words, never a point alone', () => {
    expect(streamWords([])).toBe('All quiet');
    expect(streamWords([note('a', 'info'), note('b', 'done')])).toBe('2 notifications');
    expect(streamWords([note('a', 'needs'), note('b', 'info')])).toBe('1 needs you');
    expect(streamWords([note('a', 'needs'), note('b', 'needs')])).toBe('2 need you');
  });

  it('says how long ago in the fewest words', () => {
    expect(ago(now - 10_000, now)).toBe('now');
    expect(ago(now - 4 * 60_000, now)).toBe('4 min');
    expect(ago(now - 2 * 3_600_000, now)).toBe('2 h');
    expect(ago(new Date(now - 3 * 86_400_000), now)).toBe('3 d');
  });
});

describe('ui-shell', () => {
  it('opens on ` and Ctrl K, and never while typing', async () => {
    key(window, '`');
    expect(el.isOpen).toBe(true);
    key(window, 'k', { ctrlKey: true });
    expect(el.isOpen).toBe(false);
    const input = document.createElement('input');
    document.body.append(input);
    key(input, '`');
    expect(el.isOpen).toBe(false);
  });

  it('makes the stage inert while open', async () => {
    el.open();
    await el.updateComplete;
    expect((root().querySelector('.stage') as HTMLElement).inert).toBe(true);
    el.close();
    await el.updateComplete;
    expect((root().querySelector('.stage') as HTMLElement).inert).toBe(false);
  });

  it('puts the stream at the top of the arc with focus on it', async () => {
    el.open();
    await el.updateComplete;
    const buttons = [...root().querySelectorAll('.dome > button')];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Apps', 'Find', 'Notifications: All quiet', 'Agents', 'Account', 'Settings']);
    expect(buttons[2].getAttribute('tabindex')).toBe('0');
  });

  it('Esc goes back to the dome, then closes', async () => {
    el.openView('settings');
    await el.updateComplete;
    const sky = root().querySelector('.sky')!;
    key(sky, 'Escape');
    expect(el.view).toBe('');
    expect(el.isOpen).toBe(true);
    key(sky, 'Escape');
    expect(el.isOpen).toBe(false);
  });

  it('notifies without opening itself, and the band says it in words', async () => {
    el.notify(note('a', 'needs'));
    await el.updateComplete;
    expect(el.isOpen).toBe(false);
    expect(root().querySelector('.status')!.textContent).toContain('1 needs you');
    expect(root().querySelector('.status')!.classList.contains('needs')).toBe(true);
  });

  it('groups the stream by app: what needs you first, then the newest, muted apps last', async () => {
    el.notifications = [
      { ...note('a', 'info', 1), app: 'admin' },
      { ...note('b', 'needs', 30), app: 'library' },
      { ...note('c', 'done', 60 * 48), app: 'library' },
      { ...note('d', 'needs', 2), app: 'home' },
    ];
    el.muted = ['home'];
    el.openView('stream');
    await el.updateComplete;
    const groups = [...root().querySelectorAll('.group .name')].map((g) => g.textContent!.replace(/\s+/g, ' ').trim());
    expect(groups).toEqual(['Library 2', 'Admin 1', 'Home 1Muted']);
    // Newest first inside a group, and only the first that needs you (not a muted one) pings.
    expect([...root().querySelectorAll('ul')][0].textContent).toMatch(/Note b[\s\S]*Note c/);
    expect([...root().querySelectorAll('.row.first')].map((r) => r.textContent!.trim().split(/\s+/).slice(0, 2).join(' '))).toEqual(['Note b']);
  });

  it('shows up to two actions on a row, and pressing one tells the host and closes', async () => {
    const acted = vi.fn();
    el.addEventListener('ui-notification-action', (e) => acted((e as CustomEvent).detail.notification.id, (e as CustomEvent).detail.index));
    el.notifications = [{ ...note('a', 'needs'), actions: [{ label: 'Approve' }, { label: 'Open' }, { label: 'Dropped' }] }];
    el.openView('stream');
    await el.updateComplete;
    const acts = [...root().querySelectorAll<HTMLButtonElement>('.act')];
    expect(acts.map((b) => b.textContent!.trim())).toEqual(['Approve', 'Open']);
    acts[1].click();
    expect(acted).toHaveBeenCalledWith('a', 1);
    expect(el.isOpen).toBe(false);
  });

  it('a muted app lands in the stream silently: no pulse, not in the band', async () => {
    el.muted = ['library'];
    el.notify(note('a', 'needs'));
    await el.updateComplete;
    expect(el.notifications).toHaveLength(1);
    expect(el.hasAttribute('arriving')).toBe(false);
    expect(root().querySelector('.status')!.textContent).toContain('All quiet');
  });

  it('says when its notifications or mutes change, however they changed', async () => {
    const seen: number[] = [];
    el.addEventListener('ui-notifications', (e) => seen.push((e as CustomEvent).detail.notifications.length));
    el.notify(note('a', 'info'));
    await el.updateComplete;
    el.dismiss('a');
    await el.updateComplete;
    el.setMuted('library', true);
    await el.updateComplete;
    expect(seen).toEqual([1, 0, 0]);
  });

  it('mutes and unmutes an app from its group menu', async () => {
    const seen: string[] = [];
    el.addEventListener('ui-mute', (e) => seen.push(`${(e as CustomEvent).detail.app} ${(e as CustomEvent).detail.muted}`));
    el.notifications = [note('a', 'info')];
    el.openView('stream');
    await el.updateComplete;
    (root().querySelector('.group .more') as HTMLElement).click();
    const menu = root().querySelector('ui-menu')!;
    await menu.updateComplete;
    const item = menu.shadowRoot!.querySelector<HTMLButtonElement>('[role=menuitem]')!;
    expect(item.textContent).toContain('Mute Library');
    item.click();
    expect(el.muted).toEqual(['library']);
    (root().querySelector('.group .more') as HTMLElement).click();
    await menu.updateComplete;
    menu.shadowRoot!.querySelector<HTMLButtonElement>('[role=menuitem]')!.click();
    expect(el.muted).toEqual([]);
    expect(seen).toEqual(['library true', 'library false']);
  });

  it('dismisses with undo, and clears the quiet ones', async () => {
    el.notifications = [note('a', 'needs'), note('b', 'info'), note('c', 'done')];
    el.dismiss('b');
    expect(el.notifications.map((n) => n.id)).toEqual(['a', 'c']);
    el.restore();
    expect(el.notifications.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
    el.clear();
    expect(el.notifications.map((n) => n.id)).toEqual(['a']);
    expect(el.undo?.items).toHaveLength(2);
  });

  it('tells the host what was dismissed and what Undo brought back', async () => {
    const seen: string[] = [];
    el.addEventListener('ui-dismiss', (e) => seen.push(`dismiss ${(e as CustomEvent).detail.ids.join(',')}`));
    el.addEventListener('ui-restore', (e) => seen.push(`restore ${(e as CustomEvent).detail.ids.join(',')}`));
    el.notifications = [note('a', 'needs'), note('b', 'info'), note('c', 'done')];
    el.dismiss('b');
    el.restore();
    el.clear();
    expect(seen).toEqual(['dismiss b', 'restore b', 'dismiss b,c']);
  });

  it('dismisses the focused notification on x', async () => {
    el.notifications = [note('a', 'info')];
    el.openView('stream');
    await el.updateComplete;
    key(root().querySelector('.row')!, 'x');
    expect(el.notifications).toHaveLength(0);
  });

  it('opening a notification closes the Shell and tells the host', async () => {
    const opened = vi.fn();
    el.addEventListener('ui-open-notification', (e) => opened((e as CustomEvent).detail.notification.id));
    el.notifications = [note('a', 'needs')];
    el.openView('stream');
    await el.updateComplete;
    (root().querySelector('.row') as HTMLElement).click();
    expect(opened).toHaveBeenCalledWith('a');
    expect(el.isOpen).toBe(false);
  });

  it('lists the current app first, then recent, then the rest', async () => {
    el.openView('apps');
    await el.updateComplete;
    const names = [...root().querySelectorAll('.app b')].map((b) => b.textContent);
    expect(names).toEqual(['Home', 'Admin', 'Library']);
    expect(root().querySelector('.app em')!.textContent).toBe('Open now');
  });

  it('opening an app makes it current and recent', async () => {
    const opened = vi.fn();
    el.addEventListener('ui-open-app', (e) => opened((e as CustomEvent).detail.id));
    el.openView('apps');
    await el.updateComplete;
    (root().querySelectorAll('.app')[2] as HTMLElement).click();
    expect(opened).toHaveBeenCalledWith('library');
    expect(el.current).toBe('library');
    expect(el.recent[0]).toBe('library');
  });

  it('finds across apps and notifications', async () => {
    el.notifications = [{ ...note('a', 'info'), title: 'Travel policy published' }];
    el.openView('find');
    await el.updateComplete;
    const input = root().querySelector('input')!;
    input.value = 'li';
    input.dispatchEvent(new InputEvent('input'));
    await el.updateComplete;
    expect([...root().querySelectorAll('.view .row b')].map((b) => b.textContent)).toContain('Library');
    input.value = 'travel';
    input.dispatchEvent(new InputEvent('input'));
    await el.updateComplete;
    expect([...root().querySelectorAll('.view .row b')].map((b) => b.textContent)).toEqual(['Travel policy published']);
  });

  it('lists apps’ results under their names, saying which are still looking or didn’t answer', async () => {
    el.openView('find');
    await el.updateComplete;
    const input = root().querySelector('input')!;
    input.value = 'budget';
    input.dispatchEvent(new InputEvent('input'));
    el.findResults = [
      { id: 'p', title: 'Budgets', detail: 'Admin · AUGUR', kind: 'page' },
      { id: 'l1', title: 'Budget paper', detail: 'Draft', kind: 'content', group: 'Library' },
    ];
    el.findGroups = [
      { name: 'Library', state: 'done' },
      { name: 'Claims', state: 'looking' },
      { name: 'Slow', state: 'late' },
      { name: 'Quiet', state: 'done' },
    ];
    await el.updateComplete;
    const view = root().querySelector('.view')!;
    expect([...view.querySelectorAll('.group')].map((g) => g.textContent!.replace(/\s+/g, ' ').trim())).toEqual(['Library 1', 'Claims', 'Slow']);
    expect([...view.querySelectorAll('.note.small')].map((n) => n.textContent)).toEqual(['Still looking…', 'Didn’t answer in time.']);
    expect([...view.querySelectorAll('.row b')].map((b) => b.textContent)).toEqual(['Budgets', 'Budget paper']);
    const picked = vi.fn();
    el.addEventListener('ui-pick', (e) => picked((e as CustomEvent).detail.result.id));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(picked).toHaveBeenCalledWith('p');
  });

  it('sorts agents by urgency and says when none run', async () => {
    el.openView('agents');
    await el.updateComplete;
    expect(root().querySelector('.view .note')!.textContent).toBe('No agents are running.');
    el.agents = [
      { id: '1', name: 'Indexer', status: 'running' },
      { id: '2', name: 'Reviewer', status: 'needs' },
    ];
    await el.updateComplete;
    expect([...root().querySelectorAll('.view .row b')].map((b) => b.textContent)).toEqual(['Reviewer', 'Indexer']);
  });

  it('shows stream loading and error states', async () => {
    el.openView('stream');
    el.setStream({ loading: true });
    await el.updateComplete;
    expect(root().querySelector('.view')!.textContent).toContain('Catching up');
    const retry = vi.fn();
    el.addEventListener('ui-retry', retry);
    el.setStream({ error: "Can't reach notifications. Nothing was lost." });
    await el.updateComplete;
    (root().querySelector('.retry') as HTMLElement).click();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('turns amber and says the stream is from before when offline', async () => {
    el.online = false;
    el.notifications = [note('a', 'info')];
    el.openView('stream');
    await el.updateComplete;
    expect(root().querySelector('.status')!.classList.contains('offline')).toBe(true);
    expect(root().querySelector('.caption')!.textContent).toContain('from before');
  });

  it('hands a function with no view to the host', async () => {
    const fn = vi.fn();
    el.functions = [...el.functions, { id: 'help', label: 'Help', icon: 'find' }];
    el.addEventListener('ui-function', (e) => fn((e as CustomEvent).detail.id));
    el.openView('help');
    expect(fn).toHaveBeenCalledWith('help');
  });

  it('offers Switch workspace only when the host has more than one', async () => {
    el.openView('account');
    await el.updateComplete;
    const links = () => [...root().querySelectorAll('.view .link')].map((b) => b.textContent!.trim());
    expect(links()).toEqual(['Switch workspace', 'Sign out']);
    el.canSwitchWorkspace = false;
    await el.updateComplete;
    expect(links()).toEqual(['Sign out']);
  });

  it('shows the version in Settings once the host gives one', async () => {
    el.openView('settings');
    await el.updateComplete;
    expect(root().querySelector('.version')).toBeNull();
    el.version = '0.3.0 · SDK 1.0.0';
    await el.updateComplete;
    expect(root().querySelector('.version')!.textContent).toContain('0.3.0 · SDK 1.0.0');
  });
});

describe('floors', () => {
  const org = { id: 'org', kind: 'org' as const, name: 'Acme', path: [{ id: 'org', kind: 'org' as const, name: 'Acme' }] };
  const finance = { id: 'fin', kind: 'team' as const, name: 'Finance', path: [org.path[0], { id: 'fin', kind: 'team' as const, name: 'Finance' }] };
  const me = { id: 'me', kind: 'personal' as const, name: 'You', path: [{ id: 'me', kind: 'personal' as const, name: 'You' }] };

  beforeEach(async () => {
    el.floors = [me, org, finance];
    el.floor = 'fin';
    await el.updateComplete;
  });

  it('shows the floor you’re on top left, its icon and name with no path', async () => {
    el.current = '';
    await el.updateComplete;
    const where = root().querySelector('.where')!;
    expect(where.textContent!.trim()).toBe('Finance');
    expect(where.querySelector('ui-icon')!.getAttribute('name')).toBe('people');
    expect(where.querySelectorAll('li, button')).toHaveLength(0);
    expect(root().querySelector('.mark')).toBeNull();
    expect(root().querySelector('.place')).toBeNull();
    expect(el.getAttribute('floor-kind')).toBe('team');
  });

  it('names the open app under the handle, and the part of it you’re in', async () => {
    expect(root().querySelector('.where')!.textContent!.trim()).toBe('Finance');
    expect(root().querySelector('.place')!.textContent!.trim()).toBe('Home');
    el.area = 'Organisation';
    await el.updateComplete;
    expect(root().querySelector('.place span')!.textContent).toBe('Organisation');
  });

  it('shows Back only when there is a level to go up to, and says where', async () => {
    expect(root().querySelector('.back')).toBeNull();
    el.backTo = 'all apps';
    await el.updateComplete;
    const back = root().querySelector<HTMLButtonElement>('.back')!;
    expect(back.getAttribute('aria-label')).toBe('Back to all apps');
    const up = vi.fn();
    el.addEventListener('ui-back', up);
    back.click();
    expect(up).toHaveBeenCalledOnce();
  });

  it('draws the gauge from the org down to your own floor, lit where you are', () => {
    const notches = [...root().querySelectorAll('.gauge button')];
    expect(notches.map((b) => b.getAttribute('aria-label'))).toEqual(['Acme', 'Finance, you’re here', 'Your own floor']);
    expect(notches[1].getAttribute('aria-current')).toBe('location');
  });

  it('says on the gauge who sees each floor, and which floor the open app is showing', async () => {
    const labels = [...root().querySelectorAll('.gauge .label')].map((l) => l.textContent!.replace(/\s+/g, ' ').trim());
    expect(labels).toEqual([
      'Acme Everyone in Acme sees what’s here.',
      'Finance You’re here Finance and the teams under it see what’s here. Home is showing this floor',
      'Your own floor Just you. No one else sees what’s here unless you share it.',
    ]);
    expect(root().querySelectorAll('.gauge .pinned')).toHaveLength(1);
    el.current = '';
    await el.updateComplete;
    expect(root().querySelector('.gauge .bound')).toBeNull();
    expect(root().querySelector('.gauge .pinned')).toBeNull();
  });

  it('goes up or down a floor with Page Up and Page Down', () => {
    const go = vi.fn();
    el.addEventListener('ui-floor', (e) => go((e as CustomEvent).detail));
    key(window, 'PageUp');
    key(window, 'PageDown', { altKey: true });
    expect(go.mock.calls.map(([d]) => d)).toEqual([
      { id: 'org', direction: 'up' },
      { id: 'me', direction: 'down' },
    ]);
  });

  it('says where you arrived, then stops saying it', async () => {
    vi.useFakeTimers();
    el.floor = 'org';
    await el.updateComplete;
    expect(root().querySelector('.lift')!.textContent).toContain('Acme');
    expect(root().querySelector('.live')!.textContent).toBe('Up to Acme');
    expect(el.hasAttribute('moving')).toBe(true);
    vi.advanceTimersByTime(1500);
    await el.updateComplete;
    expect(root().querySelector('.lift')).toBeNull();
    expect(el.hasAttribute('moving')).toBe(false);
    vi.useRealTimers();
  });

  it('marks the gauge where something waits, and tags notifications from other floors', async () => {
    el.notify({ id: 'n1', app: 'home', level: 'needs', title: 'Approve the budget', time: Date.now(), floor: 'org' });
    el.notify({ id: 'n2', app: 'home', level: 'info', title: 'Filed', time: Date.now(), floor: 'fin' });
    el.notify({ id: 'n3', app: 'home', level: 'info', title: 'Plain', time: Date.now() });
    await el.updateComplete;
    const notches = [...root().querySelectorAll('.gauge button')];
    expect(notches.map((b) => b.getAttribute('aria-label'))).toEqual(['Acme, 1 waiting', 'Finance, you’re here, 1 waiting', 'Your own floor']);
    expect(notches.map((b) => !!b.querySelector('.dot'))).toEqual([true, true, false]);
    el.openView('stream');
    await el.updateComplete;
    const lines = [...root().querySelectorAll('.item .text span')].map((x) => x.textContent);
    expect(lines.some((l) => l?.includes('On Acme'))).toBe(true);
    // The app's name heads the group, so a row's line starts with its floor tag.
    expect(lines.filter((l) => l?.startsWith('On ')).length).toBe(1);
    el.openView('account');
    await el.updateComplete;
    expect(root().querySelector('.floors li:nth-child(2) .meta')!.textContent).toBe('1 waiting');
  });

  it('lists every floor in Account in place of Switch workspace', async () => {
    el.openView('account');
    await el.updateComplete;
    const rows = [...root().querySelectorAll('.floors .row')];
    expect(rows.map((r) => r.querySelector('b')!.textContent)).toEqual(['Your own floor', 'Acme', 'Finance in Acme']);
    expect(rows[1].querySelector('.text > span')!.textContent).toBe('Everyone in Acme sees what’s here.');
    expect(rows[2].getAttribute('aria-current')).toBe('location');
    expect([...root().querySelectorAll('.view .link')].map((b) => b.textContent!.trim())).toEqual(['Sign out']);
  });
});
