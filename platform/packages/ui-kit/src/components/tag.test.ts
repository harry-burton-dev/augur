import { beforeEach, describe, expect, it } from 'vitest';
import './tag.js';
import type { UiTag } from './tag.js';

let tag: UiTag;

beforeEach(async () => {
  document.body.innerHTML = '<ui-tag label="Finance"></ui-tag>';
  tag = document.querySelector('ui-tag')!;
  await tag.updateComplete;
});

describe('ui-tag', () => {
  it('shows its word, with no × unless it can be removed', () => {
    expect(tag.shadowRoot!.querySelector('.word')!.textContent).toBe('Finance');
    expect(tag.shadowRoot!.querySelector('button')).toBeNull();
  });

  it('says what its × takes away, and fires ui-remove', async () => {
    tag.removable = true;
    tag.removeLabel = 'Tag: Finance';
    await tag.updateComplete;
    let removed = 0;
    tag.addEventListener('ui-remove', () => removed++);
    const x = tag.shadowRoot!.querySelector('button')!;
    expect(x.getAttribute('aria-label')).toBe('Remove Tag: Finance');
    x.click();
    expect(removed).toBe(1);
  });
});
