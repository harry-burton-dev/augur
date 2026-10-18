import { describe, expect, it } from 'vitest';
import './button.js';

const mount = async (markup: string) => {
  document.body.innerHTML = markup;
  const el = document.body.querySelector('ui-button')!;
  await el.updateComplete;
  return el;
};

describe('ui-button', () => {
  it('defaults to a secondary button', async () => {
    const el = await mount('<ui-button>Save</ui-button>');
    expect(el.variant).toBe('secondary');
    expect(el.shadowRoot!.querySelector('button')!.type).toBe('button');
  });

  it('reflects the variant so styles can target it', async () => {
    const el = await mount('<ui-button variant="primary">Publish</ui-button>');
    expect(el.getAttribute('variant')).toBe('primary');
  });

  it('disables the inner button', async () => {
    const el = await mount('<ui-button disabled>Publish</ui-button>');
    expect(el.shadowRoot!.querySelector('button')!.disabled).toBe(true);
  });
});
