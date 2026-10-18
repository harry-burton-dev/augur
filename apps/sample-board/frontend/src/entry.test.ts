import { createEventBus, IntentCancelled, IntentError, type MountContext } from '@platform/mfe-sdk';
import { describe, expect, it, vi } from 'vitest';
import board from './entry.js';

const ctx = (request: MountContext['request'], raise = vi.fn(async () => {})): MountContext => ({
  user: { id: 'u1', name: 'Sam Okafor', departments: [], roles: [] },
  getToken: async () => 't',
  bus: createEventBus(),
  raise,
  request,
  notify: vi.fn(),
  path: '/',
});

const add = async (el: HTMLElement) => {
  el.querySelector<HTMLElement>('[data-add]')!.click();
  await new Promise((r) => setTimeout(r));
};

describe('board', () => {
  it('asks for a colour through an intent and adds the label', async () => {
    const request = vi.fn(async () => ({ name: 'Moss', hex: '#4a8f6d' })) as unknown as MountContext['request'];
    const el = document.createElement('div');
    await board.mount(el, ctx(request));
    await add(el);
    expect(request).toHaveBeenCalledWith({ type: 'colour.pick', payload: { purpose: 'the new label' } });
    expect(el.querySelector('[data-labels]')!.textContent).toContain('Moss');
  });

  it('does nothing when the person closes the picker', async () => {
    const request = vi.fn(async () => Promise.reject(new IntentCancelled())) as unknown as MountContext['request'];
    const el = document.createElement('div');
    await board.mount(el, ctx(request));
    await add(el);
    expect(el.textContent).toContain('No labels yet.');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('says why when no app can answer', async () => {
    const request = vi.fn(async () => Promise.reject(new IntentError('No app you can open handles "colour.pick".'))) as unknown as MountContext['request'];
    const el = document.createElement('div');
    await board.mount(el, ctx(request));
    await add(el);
    expect(el.querySelector('[role="alert"]')!.textContent).toBe('No app you can open handles "colour.pick".');
  });

  it('opens the colours as a page with raise', async () => {
    const raise = vi.fn(async () => {});
    const el = document.createElement('div');
    await board.mount(el, ctx(vi.fn() as unknown as MountContext['request'], raise));
    el.querySelector<HTMLElement>('[data-browse]')!.click();
    expect(raise).toHaveBeenCalledWith({ type: 'colour.pick', payload: {} });
  });
});
