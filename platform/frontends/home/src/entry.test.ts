import { createEventBus, type MountContext } from '@platform/mfe-sdk';
import { describe, expect, it, vi } from 'vitest';
import home from './entry.js';

const ctx = (notify = vi.fn()): MountContext => ({
  user: { id: 'u1', name: 'Sam Okafor', departments: ['Finance'], roles: [] },
  getToken: async () => 't',
  bus: createEventBus(),
  raise: vi.fn(),
  notify,
  path: '/',
});

describe('home', () => {
  it('greets the person by first name and clears up on unmount', async () => {
    const el = document.createElement('div');
    await home.mount(el, ctx());
    const heading = el.querySelector('ui-heading')!;
    expect(heading.getAttribute('heading')).toMatch(/, Sam$/);
    await home.unmount!(el);
    expect(el.querySelector('ui-heading')).toBeNull();
  });

  it('sends a notification through the shell', async () => {
    const notify = vi.fn();
    const el = document.createElement('div');
    await home.mount(el, ctx(notify));
    (el.querySelector('ui-button') as HTMLElement).click();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ needsYou: true }));
  });
});
