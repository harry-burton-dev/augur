import { beforeEach, describe, expect, it, vi } from 'vitest';
import './glance.js';
import type { UiGlance, GlanceData } from './glance.js';

let el: UiGlance;

const data = (extra: Partial<GlanceData> = {}): GlanceData => ({
  eyebrow: 'Finance',
  icon: 'library',
  title: 'Policies',
  summary: 'Three updated this week.',
  facts: [
    { value: 12, label: 'Documents' },
    { value: 3, label: 'Updated' },
    { value: 1, label: 'Needs review' },
    { value: 9, label: 'Dropped' },
  ],
  rows: Array.from({ length: 7 }, (_, i) => ({ label: `Row ${i}`, value: `${i}` })),
  primary: { label: 'Open library' },
  secondary: { label: 'Share' },
  ...extra,
});

const root = () => el.shadowRoot!;

beforeEach(async () => {
  document.body.innerHTML = '<div style="position:relative;height:600px"><ui-glance variant="sheet"></ui-glance></div>';
  el = document.querySelector('ui-glance')!;
  await el.updateComplete;
});

describe('ui-glance', () => {
  it('opens with the data and keeps at most three facts and five rows', async () => {
    el.open(data());
    await el.updateComplete;
    expect(el.isOpen).toBe(true);
    expect(el.hasAttribute('open')).toBe(true);
    expect(root().querySelector('.title')!.textContent).toBe('Policies');
    expect(root().querySelectorAll('.fact')).toHaveLength(3);
    expect(root().querySelectorAll('.rows li')).toHaveLength(5);
  });

  it('runs the primary and reports which action ran', async () => {
    const onSelect = vi.fn();
    const seen = vi.fn();
    el.addEventListener('ui-action', (e) => seen((e as CustomEvent).detail.which));
    el.open(data({ primary: { label: 'Open library', onSelect } }));
    await el.updateComplete;
    (root().querySelector('.primary') as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledOnce();
    expect(seen).toHaveBeenCalledWith('primary');
  });

  it('closes on Esc and says so', async () => {
    const closed = vi.fn();
    el.addEventListener('ui-close', closed);
    el.open(data());
    await el.updateComplete;
    root().querySelector('.frame')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(el.isOpen).toBe(false);
    expect(closed).toHaveBeenCalledOnce();
  });

  it('shows the error with Try again, which retries', async () => {
    const onRetry = vi.fn();
    el.open(data({ error: "Can't reach the library.", onRetry }));
    await el.updateComplete;
    expect(root().querySelector('[role="alert"]')!.textContent).toContain("Can't reach");
    expect(root().querySelector('.fact')).toBeNull();
    const primary = root().querySelector('.primary') as HTMLElement;
    expect(primary.textContent).toContain('Try again');
    primary.click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows a skeleton and no actions while loading', async () => {
    el.open({ title: 'Policies', loading: true });
    await el.updateComplete;
    expect(root().querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(root().querySelector('.primary')).toBeNull();
  });

  it('draws the title variant with a word for its action', async () => {
    el.variant = 'title';
    el.open(data());
    await el.updateComplete;
    expect(root().querySelector('.bar.top')).not.toBeNull();
    expect(root().querySelector('button.primary.word')).not.toBeNull();
    expect(root().querySelector('.summary')).toBeNull();
  });
});
