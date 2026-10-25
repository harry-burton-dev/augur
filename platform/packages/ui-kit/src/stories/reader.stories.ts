import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/reader.js';
import '../components/contents.js';
import type { OutlineItem } from '../components/reader.js';

const SAMPLE = `# Travel policy

How we book, pay for and claim back travel for work. It applies to everyone, on every floor.

## Booking

Book through the **travel desk** at least two weeks ahead. Trains over flights for anything under four hours.

> A booking made elsewhere can't be claimed back unless the travel desk couldn't help.

## Claims and receipts

1. Keep every receipt.
2. Claim within 30 days of getting back.
3. Attach the receipts to the claim, not to an email.

| Item | Limit a night | Notes |
|---|---|---|
| Hotel, London | £180 | Breakfast included |
| Hotel, elsewhere | £120 | |
| Meals | £40 | No alcohol |

### Currency

Claims in another currency use the rate on the day of the receipt.

---

Questions go to [the finance team](https://example.org).
`;

const meta: Meta = {
  title: 'Content/Reader',
  component: 'ui-reader',
  args: { size: 'medium', width: 'narrow' },
  argTypes: { size: { control: 'inline-radio', options: ['small', 'medium', 'large'] }, width: { control: 'inline-radio', options: ['narrow', 'wide'] } },
  render: (a) => html`<ui-reader size=${a.size} width=${a.width} .markdown=${SAMPLE}></ui-reader>`,
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
/** Larger type, a wider measure: a person's own reading settings. */
export const LargeAndWide: Story = { args: { size: 'large', width: 'wide' } };
/** With its contents beside it, marking the heading being read. */
export const WithContents: Story = {
  render: () => {
    let items: OutlineItem[] = [];
    return html`<div style="display:grid;grid-template-columns:200px 1fr;gap:var(--space-6);align-items:start">
      <ui-contents id="contents" style="position:sticky;top:0"></ui-contents>
      <ui-reader
        .markdown=${SAMPLE}
        @ui-outline=${(e: CustomEvent<{ headings: OutlineItem[] }>) => {
          items = e.detail.headings;
          const contents = document.querySelector('#contents') as HTMLElement & { items: OutlineItem[] };
          if (contents) contents.items = items;
        }}
      ></ui-reader>
    </div>`;
  },
};
