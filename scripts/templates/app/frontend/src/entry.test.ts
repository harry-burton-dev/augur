import { createEventBus, type MountContext, type Workspace } from '@augur/mfe-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from './entry.js';

const floor: Workspace = { id: 'w-me', kind: 'personal', name: 'You', slug: 'me', path: [], role: 'lead' };

const ctx = (notify = vi.fn()): MountContext => ({
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
  fetch: vi.fn(),
});

afterEach(() => vi.unstubAllGlobals());

describe('__ID__', () => {
  it("shows what the app's service says, and clears up on unmount", async () => {
    const fetch = vi.fn(async () => Response.json({ message: 'Hello from the service' }));
    vi.stubGlobal('fetch', fetch);
    const el = document.createElement('div');
    await app.mount(el, ctx());
    expect(fetch).toHaveBeenCalledWith('/api/__ID__/v1/greeting', { headers: { authorization: 'Bearer t' } });
    expect(el.querySelector('ui-heading')!.getAttribute('summary')).toBe('Hello from the service');
    await app.unmount!(el);
    expect(el.querySelector('ui-heading')).toBeNull();
  });

  it("says so when the service isn't answering", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 502 })));
    const el = document.createElement('div');
    await app.mount(el, ctx());
    expect(el.querySelector('ui-heading')!.getAttribute('summary')).toMatch(/isn't answering/);
  });

  it('sends a notification through the shell', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'hi' })));
    const notify = vi.fn();
    const el = document.createElement('div');
    await app.mount(el, ctx(notify));
    (el.querySelector('ui-button') as HTMLElement).click();
    expect(notify).toHaveBeenCalledWith({ title: 'Hello from __NAME__' });
  });
});
