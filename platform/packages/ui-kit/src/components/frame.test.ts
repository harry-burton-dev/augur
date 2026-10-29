import { describe, expect, it, vi } from 'vitest';
import './app-frame.js';
import './page-head.js';
import './section.js';
import type { UiAppFrame } from './app-frame.js';
import type { UiPageHead } from './page-head.js';
import type { UiSection } from './section.js';

const settle = async (el: { updateComplete: Promise<unknown> }) => {
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
};

describe('ui-app-frame', () => {
  it('shows a rail and an aside only when the app gives them', async () => {
    document.body.innerHTML = '<ui-app-frame><p>Main</p></ui-app-frame>';
    const el = document.querySelector('ui-app-frame') as UiAppFrame;
    await settle(el);
    expect(el.hasAttribute('has-rail')).toBe(false);
    expect(el.hasAttribute('has-aside')).toBe(false);
    document.body.innerHTML = '<ui-app-frame rail-label="Libraries"><nav slot="rail">Libraries</nav><p>Main</p><div slot="aside">Line of sight</div></ui-app-frame>';
    const framed = document.querySelector('ui-app-frame') as UiAppFrame;
    await settle(framed);
    expect(framed.hasAttribute('has-rail')).toBe(true);
    expect(framed.hasAttribute('has-aside')).toBe(true);
    expect(framed.shadowRoot!.querySelector('nav')!.getAttribute('aria-label')).toBe('Libraries');
  });

  it('marks the main column busy', async () => {
    document.body.innerHTML = '<ui-app-frame busy></ui-app-frame>';
    const el = document.querySelector('ui-app-frame') as UiAppFrame;
    await settle(el);
    expect(el.shadowRoot!.querySelector('main')!.getAttribute('aria-busy')).toBe('true');
  });
});

describe('ui-page-head', () => {
  const mount = async () => {
    document.body.innerHTML = '<ui-page-head eyebrow="Intent" heading="Keep Port Halden open" summary="By Fri 13 Nov"></ui-page-head>';
    const el = document.querySelector('ui-page-head') as UiPageHead;
    await el.updateComplete;
    return el;
  };

  it('is the page’s one heading, with one line of summary', async () => {
    const el = await mount();
    const title = el.shadowRoot!.querySelector('[role=heading]')!;
    expect(title.textContent).toBe('Keep Port Halden open');
    expect(title.getAttribute('aria-level')).toBe('1');
    expect(el.shadowRoot!.querySelector('.summary')!.getAttribute('title')).toBe('By Fri 13 Nov');
  });

  it('shows two actions with at most one primary, and puts the rest in ⋯', async () => {
    const el = await mount();
    el.actions = [
      { id: 'pass', label: 'Pass down', kind: 'primary' },
      { id: 'judge', label: 'Judge', kind: 'primary' },
      { id: 'edit', label: 'Edit' },
      { id: 'withdraw', label: 'Withdraw', danger: true },
    ];
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll('ui-button')];
    expect(buttons.map((b) => [b.textContent?.trim(), b.getAttribute('kind')])).toEqual([['Pass down', 'primary'], ['Judge', 'secondary']]);
    expect(el.shadowRoot!.querySelector('ui-icon-button')!.getAttribute('label')).toBe('More');
    const onAction = vi.fn();
    el.addEventListener('ui-action', onAction);
    buttons[1].click();
    expect(onAction.mock.calls[0][0].detail.action.id).toBe('judge');
  });

  it('folds a long trail to its first and last steps until asked', async () => {
    const el = await mount();
    el.trail = ['Org', 'Logistics', 'Northern', 'Ports'].map((label) => ({ id: label, label }));
    await el.updateComplete;
    const steps = () => [...el.shadowRoot!.querySelectorAll('ol button')].map((b) => b.textContent);
    expect(steps()).toEqual(['Org', '…', 'Ports']);
    const onTrail = vi.fn();
    el.addEventListener('ui-trail', onTrail);
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>('ol button')[1].click();
    await el.updateComplete;
    expect(steps()).toEqual(['Org', 'Logistics', 'Northern', 'Ports']);
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>('ol button')[3].click();
    expect(onTrail.mock.calls[0][0].detail.step.id).toBe('Ports');
  });
});

describe('ui-section', () => {
  it('counts its children, shows five and folds the rest behind "N more"', async () => {
    document.body.innerHTML = `<ui-section label="Parts">${'<p>x</p>'.repeat(8)}</ui-section>`;
    const el = document.querySelector('ui-section') as UiSection;
    await settle(el);
    const root = el.shadowRoot!;
    expect(root.querySelector('.head b')!.textContent).toBe('8');
    const more = root.querySelector<HTMLButtonElement>('.more')!;
    expect(more.textContent).toBe('3 more');
    expect([...root.querySelectorAll('style')].some((s) => s.textContent!.includes('nth-child(n+6)'))).toBe(true);
    more.click();
    await settle(el);
    expect(root.querySelector('.more')!.textContent).toBe('Show fewer');
    expect([...root.querySelectorAll('style')].some((s) => s.textContent!.includes('nth-child'))).toBe(false);
  });

  it('keeps its reason behind "Why?" and offers one action', async () => {
    document.body.innerHTML = '<ui-section label="Bound to" count="3" action="Bind" why="What it is about: ships, places and resources."><ui-list></ui-list></ui-section>';
    const el = document.querySelector('ui-section') as UiSection;
    await settle(el);
    const root = el.shadowRoot!;
    expect(root.querySelector('.head b')!.textContent).toBe('3');
    expect(root.querySelector('.why')).toBeNull();
    const [why, bind] = [...root.querySelectorAll('ui-button')];
    why.click();
    await el.updateComplete;
    expect(root.querySelector('.why')!.textContent).toContain('ships, places');
    const onAction = vi.fn();
    el.addEventListener('ui-action', onAction);
    bind.click();
    expect(onAction).toHaveBeenCalledOnce();
  });
});
