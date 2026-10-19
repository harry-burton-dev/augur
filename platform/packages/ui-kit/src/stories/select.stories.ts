import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/select.js';
import type { SelectOption } from '../components/select.js';

const meta: Meta = { title: 'Inputs/Select', component: 'ui-select' };
export default meta;
type Story = StoryObj;

const people: SelectOption[] = [
  { value: 'cos', label: 'Chief of Staff', detail: 'Person' },
  { value: 'ops', label: 'Operations team', detail: '12 people' },
  { value: 'hq', label: 'Fleet HQ', detail: 'Inbox' },
  { value: 'all', label: 'Everyone', detail: 'Not allowed here', disabled: true },
];

const grid = (inner: unknown) => html`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--space-6);max-width:var(--measure-wide)">${inner}</div>`;

export const Default: Story = {
  render: () => html`<div style="max-width: var(--measure-decision)"><ui-select label="Send to" placeholder="Choose who reads it" .options=${people}></ui-select></div>`,
};
export const States: Story = {
  render: () =>
    grid(html`
      <ui-select label="Send to" .options=${people} value="cos"></ui-select>
      <ui-select label="Send to" .options=${people} required state="attention" message="Needs you."></ui-select>
      <ui-select label="Send to" .options=${people} value="hq" state="error" message="Fleet HQ can’t receive drafts. Choose a person."></ui-select>
      <ui-select label="Send to" .options=${people} value="ops" state="warning" message="Twelve people will see this."></ui-select>
      <ui-select label="Classification" .options=${['Official', 'Official-Sensitive']} value="Official" readonly></ui-select>
      <ui-select label="Send to" .options=${people} value="cos" disabled></ui-select>
      <ui-select label="Send to" busy></ui-select>
      <ui-select label="Send to" .options=${[]}></ui-select>
    `),
};
