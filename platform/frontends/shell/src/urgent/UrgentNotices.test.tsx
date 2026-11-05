import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { ServerNotification } from '../host/index.js';
import { UrgentNotices, urgentQueue } from './UrgentNotices.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const note = (id: string, more: Partial<ServerNotification> = {}): ServerNotification => ({
  id,
  app: 'upgrades',
  level: 'needs',
  title: `News ${id}`,
  detail: `What happened to ${id}.`,
  createdAt: `2026-11-05T0${id}:00:00.000Z`,
  urgent: true,
  ...more,
});

describe('urgent notices', () => {
  it('letterboxes only urgent news whose app has the preview on, oldest first', () => {
    const on = (app: string) => app === 'upgrades';
    const queue = urgentQueue([note('3'), note('1'), note('2', { urgent: false }), note('4', { app: 'folio' })], on);
    expect(queue.map((n) => n.id)).toEqual(['1', '3']);
  });

  it('opens the first over the work, steps back to the edge, and opens it where it can be dealt with', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const onOpen = vi.fn();
    const root = createRoot(el);
    await act(async () => root.render(<UrgentNotices queue={[note('1'), note('2')]} appName={() => 'Upgrade Centre'} me="Lee Park" onOpen={onOpen} />));
    const box = document.querySelector('.augur-letterbox')!;
    expect(box.getAttribute('data-look')).toBe('see-through');
    expect(box.textContent).toContain('News 1');
    expect(box.textContent).toContain('1 of 2');
    // Acknowledging is not resolving: it says who saw it and stays.
    await act(async () => [...box.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('Acknowledge'))!.click());
    expect(document.querySelector('.augur-letterbox')!.textContent).toMatch(/Acknowledged .* by Lee Park · not resolved/);
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>('.augur-letterbox button')].find((b) => b.textContent === 'Step back')!.click());
    expect(document.querySelector('.augur-urgent-edge')!.textContent).toContain('News 1');
    await act(async () => document.querySelector<HTMLElement>('.augur-urgent-edge-button')!.click());
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>('.augur-letterbox button')].find((b) => b.textContent === 'Open in Upgrade Centre')!.click());
    expect(onOpen).toHaveBeenCalledWith('1');
    await act(async () => root.unmount());
  });
});
