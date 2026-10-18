import { describe, expect, it } from 'vitest';
import './heading.js';
import './status.js';
import './surface.js';
import type { UiHeading } from './heading.js';
import type { UiStatus } from './status.js';
import type { UiSurface } from './surface.js';

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
