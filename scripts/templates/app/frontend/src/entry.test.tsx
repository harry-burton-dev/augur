import { createEventBus, type MountContext, type Workspace } from '@augur/mfe-sdk';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import app from './entry.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const floor: Workspace = { id: 'w-me', kind: 'personal', name: 'You', slug: 'me', path: [], role: 'lead' };

const ctx = (fetch: MountContext['fetch'], notify = vi.fn()): MountContext => ({
  user: { id: 'u1', name: 'Sam Okafor', departments: ['Finance'], roles: [] },
  getToken: async () => 't',
  bus: createEventBus(),
  raise: vi.fn(),
  request: vi.fn(),
  notify,
  path: '/',
  workspace: floor,
  getWorkspace: () => floor,
  previewOn: () => false,
  fetch,
});

const mounted = async (c: MountContext) => {
  const el = document.createElement('div');
  document.body.append(el);
  await act(async () => {
    await app.mount(el, c);
  });
  return el;
};

describe('__ID__', () => {
  it("shows what the app's service says, and clears up on unmount", async () => {
    const fetch = vi.fn(async () => Response.json({ message: 'Hello from the service' }));
    const el = await mounted(ctx(fetch));
    expect(fetch).toHaveBeenCalledWith('/api/__ID__/v1/greeting');
    expect(el.textContent).toContain('Hello, Sam');
    expect(el.textContent).toContain('Hello from the service');
    await act(async () => {
      await app.unmount!(el);
    });
    expect(el.textContent).toBe('');
  });

  it("says so when the service isn't answering", async () => {
    const el = await mounted(ctx(vi.fn(async () => new Response(null, { status: 502 }))));
    expect(el.textContent).toMatch(/isn't answering/);
  });

  it('sends a notification through the shell', async () => {
    const notify = vi.fn();
    const el = await mounted(ctx(vi.fn(async () => Response.json({ message: 'hi' })), notify));
    await act(async () => el.querySelector('button')!.click());
    expect(notify).toHaveBeenCalledWith({ title: 'Hello from __NAME__' });
  });
});
