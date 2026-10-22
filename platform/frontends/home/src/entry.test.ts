import { createEventBus, type MountContext } from '@platform/mfe-sdk';
import { describe, expect, it, vi } from 'vitest';
import home from './entry.js';

const own = { id: 'w-me', kind: 'personal' as const, name: 'You', slug: 'me', path: [], role: 'lead' as const };
const ctx = (notify = vi.fn()): MountContext => ({
  user: { id: 'u1', name: 'Sam Okafor', departments: ['Finance'], roles: [] },
  getToken: async () => 't',
  bus: createEventBus(),
  raise: vi.fn(),
  request: vi.fn(),
  notify,
  workspace: own,
  getWorkspace: () => own,
  fetch: vi.fn(),
  path: '/',
});

describe('home', () => {
  it('greets the person by first name and clears up on unmount', async () => {
    const el = document.createElement('div');
    await home.mount(el, ctx());
    const heading = el.querySelector('ui-heading')!;
    expect(heading.getAttribute('heading')).toMatch(/, Sam$/);
    expect(heading.getAttribute('eyebrow')).toBe('');
    await home.unmount!(el);
    expect(el.querySelector('ui-heading')).toBeNull();
  });

  it('names the floor it was opened on', async () => {
    const el = document.createElement('div');
    const finance = { id: 'w-fin', kind: 'team' as const, name: 'Finance', slug: 'finance', path: [], role: 'member' as const };
    await home.mount(el, { ...ctx(), workspace: finance });
    expect(el.querySelector('ui-heading')!.getAttribute('eyebrow')).toBe('Finance');
  });

  it('sends a notification through the shell', async () => {
    const notify = vi.fn();
    const el = document.createElement('div');
    await home.mount(el, ctx(notify));
    (el.querySelector('ui-button') as HTMLElement).click();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ needsYou: true }));
  });
});
