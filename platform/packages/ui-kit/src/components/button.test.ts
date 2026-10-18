import { afterEach, describe, expect, it, vi } from 'vitest';
import './button.js';
import type { UiButton } from './button.js';

const mount = async (markup: string) => {
  document.body.innerHTML = markup;
  const el = document.body.querySelector('ui-button') as UiButton;
  await el.updateComplete;
  return el;
};
const inner = (el: UiButton) => el.shadowRoot!.querySelector('button')!;

afterEach(() => vi.useRealTimers());

describe('ui-button', () => {
  it('defaults to a secondary button of type button', async () => {
    const el = await mount('<ui-button>Save</ui-button>');
    expect(el.kind).toBe('secondary');
    expect(inner(el).type).toBe('button');
  });

  it('reflects kind so styles and tests can target it', async () => {
    const el = await mount('<ui-button kind="primary">Publish</ui-button>');
    expect(el.getAttribute('kind')).toBe('primary');
    expect(inner(el).className).toContain('primary');
  });

  it('swallows clicks while disabled or busy', async () => {
    const el = await mount('<ui-button disabled>Publish</ui-button>');
    const onClick = vi.fn();
    el.addEventListener('click', onClick);
    el.click();
    el.disabled = false;
    el.busy = true;
    el.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows the busy label while working', async () => {
    const el = await mount('<ui-button kind="primary" busy busy-label="Publishing…">Publish</ui-button>');
    expect(inner(el).textContent).toContain('Publishing…');
    expect(inner(el).getAttribute('aria-busy')).toBe('true');
  });

  it('only marks primary and secondary as AI', async () => {
    const el = await mount('<ui-button kind="tertiary" ai>Later</ui-button>');
    expect(inner(el).className).not.toContain('ai');
    el.kind = 'primary';
    await el.updateComplete;
    expect(inner(el).className).toContain('ai');
  });

  describe('danger', () => {
    it('arms on the first press and acts on the second', async () => {
      const el = await mount('<ui-button kind="danger">Delete library</ui-button>');
      const onClick = vi.fn();
      el.addEventListener('click', onClick);
      el.click();
      expect(onClick).not.toHaveBeenCalled();
      expect(el.armed).toBe(true);
      el.click();
      expect(onClick).toHaveBeenCalledOnce();
      expect(el.armed).toBe(false);
    });

    it('disarms after the timeout', async () => {
      vi.useFakeTimers();
      const el = await mount('<ui-button kind="danger" arm-for="3000">Delete</ui-button>');
      el.click();
      vi.advanceTimersByTime(3001);
      expect(el.armed).toBe(false);
    });

    it('disarms on Escape', async () => {
      const el = await mount('<ui-button kind="danger">Delete</ui-button>');
      el.click();
      const esc = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      el.dispatchEvent(esc);
      expect(el.armed).toBe(false);
      expect(esc.defaultPrevented).toBe(true);
      const again = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      el.dispatchEvent(again);
      expect(again.defaultPrevented).toBe(false);
    });

    it('acts at once with `once`, for use inside a Confirm', async () => {
      const el = await mount('<ui-button kind="danger" once>Delete</ui-button>');
      const onClick = vi.fn();
      el.addEventListener('click', onClick);
      el.click();
      expect(onClick).toHaveBeenCalledOnce();
    });
  });
});
