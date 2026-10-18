import { describe, expect, it } from 'vitest';
import './heading.js';
import './status.js';
import './surface.js';
import type { UiHeading } from './heading.js';
import type { UiStatus } from './status.js';
import type { UiSurface } from './surface.js';
import './facts.js';
import './rows.js';
import './keycap.js';
import './icon-button.js';
import type { UiFacts } from './facts.js';
import type { UiRows } from './rows.js';
import type { UiKeycap, UiBack } from './keycap.js';
import type { UiIconButton } from './icon-button.js';

const mount = async <T extends HTMLElement & { updateComplete: Promise<boolean> }>(markup: string, tag: string) => {
  document.body.innerHTML = markup;
  const el = document.body.querySelector(tag) as T;
  await el.updateComplete;
  return el;
};

describe('ui-heading', () => {
  it('renders eyebrow, title as a heading and summary', async () => {
    const el = await mount<UiHeading>('<ui-heading eyebrow="Finance" heading="Policies" summary="Three due for review."></ui-heading>', 'ui-heading');
    const title = el.shadowRoot!.querySelector('[role="heading"]')!;
    expect(title.textContent).toBe('Policies');
    expect(title.getAttribute('aria-level')).toBe('2');
    expect(el.shadowRoot!.textContent).toContain('Finance');
    expect(el.shadowRoot!.textContent).toContain('Three due for review.');
  });

  it('omits the eyebrow and summary when not given', async () => {
    const el = await mount<UiHeading>('<ui-heading heading="Policies"></ui-heading>', 'ui-heading');
    expect(el.shadowRoot!.querySelector('.label')).toBeNull();
    expect(el.shadowRoot!.querySelector('.summary')).toBeNull();
  });
});

describe('ui-status', () => {
  it('says the status in words', async () => {
    const el = await mount<UiStatus>('<ui-status status="needs"></ui-status>', 'ui-status');
    expect(el.shadowRoot!.querySelector('.word')!.textContent).toBe('Needs you');
  });

  it('names the mark for screen readers when shown alone', async () => {
    const el = await mount<UiStatus>('<ui-status status="failed" mark-only></ui-status>', 'ui-status');
    expect(el.shadowRoot!.querySelector('.word')).toBeNull();
    expect(el.shadowRoot!.querySelector('.mark')!.getAttribute('aria-label')).toBe('Failed');
  });
});

describe('ui-surface', () => {
  it('defaults to a pane', async () => {
    const el = await mount<UiSurface>('<ui-surface>x</ui-surface>', 'ui-surface');
    expect(el.getAttribute('kind')).toBe('pane');
  });
});

describe('ui-facts', () => {
  it('shows at most three facts, value over label', async () => {
    document.body.innerHTML = '<ui-facts></ui-facts>';
    const el = document.body.querySelector('ui-facts') as UiFacts;
    el.items = [{ value: 12, label: 'Reports' }, { value: 3, label: 'Today' }, { value: 2, label: 'To review' }, { value: 9, label: 'Extra' }];
    await el.updateComplete;
    const facts = el.shadowRoot!.querySelectorAll('.fact');
    expect(facts.length).toBe(3);
    expect(facts[0].querySelector('dd')!.textContent).toBe('12');
    expect(facts[0].querySelector('dt')!.textContent).toBe('Reports');
  });

  it('shows skeletons while loading', async () => {
    const el = await mount<UiFacts>('<ui-facts loading count="2"></ui-facts>', 'ui-facts');
    expect(el.shadowRoot!.querySelector('dl')!.getAttribute('aria-busy')).toBe('true');
    expect(el.shadowRoot!.querySelectorAll('.fact').length).toBe(2);
  });
});

describe('ui-rows', () => {
  it('shows at most five rows', async () => {
    document.body.innerHTML = '<ui-rows></ui-rows>';
    const el = document.body.querySelector('ui-rows') as UiRows;
    el.items = Array.from({ length: 7 }, (_, i) => ({ label: `Row ${i}`, value: `${i}` }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('li').length).toBe(5);
  });

  it('says so when empty, and when it failed', async () => {
    const el = await mount<UiRows>('<ui-rows empty="No sources yet."></ui-rows>', 'ui-rows');
    expect(el.shadowRoot!.textContent).toContain('No sources yet.');
    el.error = 'Couldn’t load these.';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[role="alert"]')!.textContent).toBe('Couldn’t load these.');
  });
});

describe('ui-keycap and ui-back', () => {
  it('draws the key', async () => {
    const el = await mount<UiKeycap>('<ui-keycap label="Esc"></ui-keycap>', 'ui-keycap');
    expect(el.shadowRoot!.querySelector('kbd')!.textContent).toBe('Esc');
  });

  it('back reads as Esc Back and says it is Esc', async () => {
    const el = await mount<UiBack>('<ui-back></ui-back>', 'ui-back');
    const button = el.shadowRoot!.querySelector('button')!;
    expect(button.textContent!.replace(/\s+/g, '')).toBe('EscBack');
    expect(button.getAttribute('aria-keyshortcuts')).toBe('Escape');
  });
});

describe('ui-icon-button', () => {
  it('is named by its label', async () => {
    const el = await mount<UiIconButton>('<ui-icon-button icon="find" label="Find"></ui-icon-button>', 'ui-icon-button');
    expect(el.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).toBe('Find');
  });

  it('swallows clicks while disabled', async () => {
    const el = await mount<UiIconButton>('<ui-icon-button icon="find" label="Find" disabled></ui-icon-button>', 'ui-icon-button');
    let clicks = 0;
    el.addEventListener('click', () => clicks++);
    el.click();
    expect(clicks).toBe(0);
  });
});
