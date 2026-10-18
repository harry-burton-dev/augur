import { createEventBus, type MountContext } from '@platform/mfe-sdk';
import { describe, expect, it, vi } from 'vitest';
import palette from './entry.js';

const ctx = (extra: Partial<MountContext> = {}): MountContext => ({
  user: { id: 'u1', name: 'Sam Okafor', departments: [], roles: [] },
  getToken: async () => 't',
  bus: createEventBus(),
  raise: vi.fn(),
  request: vi.fn(),
  notify: vi.fn(),
  path: '/',
  ...extra,
});

describe('palette', () => {
  it('answers a request with the colour picked', async () => {
    const respond = vi.fn();
    const el = document.createElement('div');
    await palette.mount(el, ctx({ intent: { type: 'colour.pick', payload: { purpose: 'the new label' } }, reply: { respond, cancel: vi.fn() } }));
    expect(el.textContent).toContain('Pick a colour for the new label.');
    el.querySelector<HTMLButtonElement>('[data-colour="Ochre"]')!.click();
    expect(respond).toHaveBeenCalledWith({ name: 'Ochre', hex: '#c99a3b' });
  });

  it('only shows the colours when opened as a page', async () => {
    const el = document.createElement('div');
    await palette.mount(el, ctx());
    expect(el.querySelector('ui-heading')?.getAttribute('heading')).toBe('Palette');
    expect(el.querySelector<HTMLButtonElement>('[data-colour="Moss"]')!.disabled).toBe(true);
    await palette.unmount!(el);
    expect(el.querySelector('button')).toBeNull();
  });
});
