import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/rows.js';
import type { Row } from '../components/rows.js';

const items: Row[] = [
  { label: 'Q3 readiness', value: 'Today 09:12' },
  { label: 'Training return', value: 'Today 08:40' },
  { label: 'Fleet availability', value: 'Today 07:55' },
  { label: 'Budget variance', value: 'Thu' },
  { label: 'Risk register', value: 'Wed' },
];

const meta: Meta = {
  title: 'Primitives/Rows',
  component: 'ui-rows',
  args: { items, loading: false, empty: 'No sources yet.', error: '' },
  render: (a) => html`<div style="max-width: var(--measure-read)">
    <ui-rows .items=${a.items} ?loading=${a.loading} empty=${a.empty} error=${a.error}></ui-rows>
  </div>`,
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = { args: { items: [] } };
export const CouldNotLoad: Story = { args: { error: 'Couldn’t load these.' } };
