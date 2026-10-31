import { afterEach, describe, expect, it, vi } from 'vitest';
import './button.js';
import './icon-button.js';
import './list.js';
import './menu.js';
import './notice.js';
import './note.js';
import './can.js';
import type { UiButton } from './button.js';
import type { UiIconButton } from './icon-button.js';
import type { UiList } from './list.js';
import type { UiMenu } from './menu.js';
import type { UiNotice } from './notice.js';
import type { UiNote } from './note.js';
import type { UiCan } from './can.js';

const mount = async <T extends HTMLElement>(markup: string, tag: string) => {
  document.body.innerHTML = markup;
  const el = document.body.querySelector(tag) as T & { updateComplete: Promise<unknown> };
  await el.updateComplete;
  return el;
};

afterEach(() => {
  vi.restoreAllMocks();
  delete document.documentElement.dataset.kitDev;
});

describe('a disabled control says why', () => {
  it('keeps a button with a reason focusable, says why, and still swallows presses', async () => {
    const el = await mount<UiButton>('<ui-button disabled reason="Only its leads can pass it down.">Pass down</ui-button>', 'ui-button');
    const inner = el.shadowRoot!.querySelector('button')!;
    expect(inner.disabled).toBe(false);
    expect(inner.getAttribute('aria-disabled')).toBe('true');
    const why = el.shadowRoot!.getElementById(inner.getAttribute('aria-describedby')!)!;
    expect(why.textContent).toBe('Only its leads can pass it down.');
    const onClick = vi.fn();
    el.addEventListener('click', onClick);
    inner.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows no reason while the button can be used', async () => {
    const el = await mount<UiButton>('<ui-button reason="Only its leads can pass it down.">Pass down</ui-button>', 'ui-button');
    expect(el.shadowRoot!.querySelector('.reason')).toBeNull();
    expect(el.shadowRoot!.querySelector('button')!.hasAttribute('aria-disabled')).toBe(false);
  });

  it('warns in development when a control is disabled without a reason, once', async () => {
    document.documentElement.dataset.kitDev = 'true';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const el = await mount<UiButton>('<ui-button disabled>Publish</ui-button>', 'ui-button');
    el.busy = true;
    await el.updateComplete;
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('"Publish" is disabled without a reason');
  });

  it('stays quiet outside development', async () => {
    document.documentElement.dataset.kitDev = 'false';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mount<UiButton>('<ui-button disabled>Publish</ui-button>', 'ui-button');
    expect(warn).not.toHaveBeenCalled();
  });

  it('puts an icon button’s reason under its name', async () => {
    const el = await mount<UiIconButton>('<ui-icon-button icon="find" label="Find" disabled reason="Find opens when the library has loaded."></ui-icon-button>', 'ui-icon-button');
    const inner = el.shadowRoot!.querySelector('button')!;
    expect(inner.disabled).toBe(false);
    expect(el.shadowRoot!.querySelector('.why')!.textContent).toBe('Find opens when the library has loaded.');
  });

  it('says why a row can’t be opened in place of its detail, and why an action can’t be used', async () => {
    const list = await mount<UiList>('<ui-list label="Documents"></ui-list>', 'ui-list');
    list.items = [
      { id: 'a', title: 'Q4 budget', detail: 'Finance', disabled: true, reason: 'Kept on Finance. Ask its leads.' },
      { id: 'b', title: 'Travel policy', actions: [{ id: 'share', label: 'Share', disabled: true, reason: 'Withdrawn by its owner.' }] },
    ];
    await list.updateComplete;
    const root = list.shadowRoot!;
    expect(root.querySelector('.why')!.textContent).toBe('Kept on Finance. Ask its leads.');
    const act = root.querySelector<HTMLButtonElement>('.act')!;
    expect(act.getAttribute('aria-disabled')).toBe('true');
    expect(act.getAttribute('aria-description')).toBe('Withdrawn by its owner.');
    const onAction = vi.fn();
    list.addEventListener('ui-action', onAction);
    act.click();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('says why a menu entry can’t be used, under its name', async () => {
    const menu = await mount<UiMenu>('<ui-menu label="More"></ui-menu>', 'ui-menu');
    menu.items = [{ id: 'share', label: 'Share', disabled: true, reason: 'Withdrawn by its owner.' }];
    await menu.updateComplete;
    expect(menu.shadowRoot!.querySelector('.why')!.textContent).toBe('Withdrawn by its owner.');
  });
});

describe('ui-notice', () => {
  it('leads with its heading, offers one action, and counts the rest', async () => {
    const el = await mount<UiNotice>('<ui-notice tone="needs" heading="Waiting for your back-brief." action="Write it" more="2">Due Sat 31 Oct.</ui-notice>', 'ui-notice');
    const root = el.shadowRoot!;
    expect(root.querySelector('b')!.textContent).toBe('Waiting for your back-brief.');
    expect(root.querySelector('.more')!.textContent).toContain('2 more need you');
    const onAction = vi.fn();
    el.addEventListener('ui-action', onAction);
    root.querySelector('ui-button')!.click();
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('marks a neutral notice with the info icon', async () => {
    const el = await mount<UiNotice>('<ui-notice>Shown as it stood on 1 Jun.</ui-notice>', 'ui-notice');
    expect(el.tone).toBe('info');
    expect(el.shadowRoot!.querySelector('ui-icon')!.getAttribute('name')).toBe('info');
  });
});

describe('ui-note', () => {
  it('keeps the reason behind the line until it’s pressed', async () => {
    const el = await mount<UiNote>('<ui-note why="A team’s working view sits beside the org’s record.">Facts as each floor holds them.</ui-note>', 'ui-note');
    const root = el.shadowRoot!;
    const line = root.querySelector('button')!;
    expect(root.querySelector<HTMLElement>('.why')!.hidden).toBe(true);
    expect(line.getAttribute('aria-expanded')).toBe('false');
    line.click();
    await el.updateComplete;
    expect(root.querySelector<HTMLElement>('.why')!.hidden).toBe(false);
    expect(line.getAttribute('aria-expanded')).toBe('true');
  });

  it('is a plain line without a reason, and a status when live', async () => {
    const el = await mount<UiNote>('<ui-note live>Saved.</ui-note>', 'ui-note');
    expect(el.shadowRoot!.querySelector('button')).toBeNull();
    expect(el.shadowRoot!.querySelector('p')!.getAttribute('role')).toBe('status');
  });
});

describe('ui-can', () => {
  it('offers at most two actions and says who can do the rest', async () => {
    const el = await mount<UiCan>('<ui-can></ui-can>', 'ui-can');
    el.actions = [{ id: 'ask', label: 'Ask for access' }, { id: 'who', label: 'See who decides' }, { id: 'x', label: 'Dropped' }];
    el.blocked = [{ what: 'change it here', who: 'an admin' }];
    await el.updateComplete;
    const root = el.shadowRoot!;
    const buttons = [...root.querySelectorAll('ui-button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Ask for access', 'See who decides']);
    expect(buttons.map((b) => b.getAttribute('kind'))).toEqual(['secondary', 'tertiary']);
    expect(root.querySelector('p')!.textContent).toContain('To change it here, ask an admin.');
    const onAction = vi.fn();
    el.addEventListener('ui-action', onAction);
    buttons[0].click();
    expect(onAction.mock.calls[0][0].detail.action.id).toBe('ask');
  });
});
