import type { AppManifestEntry, InboxItem, Workspace } from '@augur/mfe-sdk';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { InboxClient } from '../host/index.js';
import { InboxView } from './InboxView.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const manifest: AppManifestEntry[] = [{ id: 'mandate', name: 'Intent', route: '/intent', entry: '/e.js', version: '1.0.0', sdk: '^1.0.0', inbox: { kinds: [{ id: 'assignment', label: 'Assigned to you' }] } }];
const floors = [{ id: 'fin', kind: 'team', name: 'Finance', slug: 'finance', path: [], role: 'member' } as Workspace];
const item = (id: string, more: Partial<InboxItem> = {}): InboxItem => ({
  id,
  app: 'mandate',
  key: id,
  kind: 'assignment',
  owner: { kind: 'person', id: 'u-nora' },
  state: 'open',
  title: `Plan ${id}`,
  allow: { decline: true, handOn: true, selfComplete: false },
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  workspace: { id: 'fin', path: ['org', 'fin'] },
  ...more,
});

const show = async (answer: (url: string) => Response | Promise<Response>) => {
  const el = document.createElement('div');
  document.body.append(el);
  const client = new InboxClient({ getToken: async () => 't', floor: () => 'fin', fetchImpl: (async (url: string) => answer(String(url))) as typeof fetch });
  const root = createRoot(el);
  await act(async () => {
    root.render(<InboxView client={client} manifest={manifest} floors={floors} here="fin" me="u-nora" version={0} fetch={fetch} onOpen={() => {}} onChanged={() => {}} />);
  });
  await act(async () => new Promise((r) => setTimeout(r, 20)));
  return { el, unmount: () => act(() => root.unmount()) };
};

describe('the Inbox view', () => {
  it('lists the person’s items with the app’s words, and Open disabled when the app is off here', async () => {
    const { el, unmount } = await show(() => Response.json([item('a'), item('b', { app: 'gone' })]));
    const rows = [...el.querySelectorAll('[data-inbox-item]')];
    expect(rows.map((r) => r.querySelector('strong')?.textContent)).toEqual(['Plan a', 'Plan b']);
    expect(rows[0].textContent).toContain('Intent · Assigned to you');
    const opens = rows.map((r) => [...r.querySelectorAll('button')].find((b) => b.textContent?.includes('Open')));
    expect(opens[0]?.getAttribute('aria-disabled')).not.toBe('true');
    expect(rows[1].textContent).toContain('gone');
    // Each row's menu opens from a button.
    expect(rows.every((r) => [...r.querySelectorAll('button')].some((b) => b.textContent === 'More'))).toBe(true);
    await unmount();
  });

  it('says when nothing waits, and when the inbox can’t be reached, with Try again', async () => {
    const empty = await show(() => Response.json([]));
    expect(empty.el.textContent).toContain('Nothing is waiting on you or your teams.');
    await empty.unmount();
    const down = await show(() => new Response('{}', { status: 503 }));
    expect(down.el.textContent).toContain('Your inbox can’t be reached right now.');
    expect([...down.el.querySelectorAll('button')].some((b) => b.textContent?.includes('Try again'))).toBe(true);
    await down.unmount();
  });
});
