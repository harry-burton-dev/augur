import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/facts.js';
import type { Fact } from '../components/facts.js';

const items: Fact[] = [
  { value: 12, label: 'Reports' },
  { value: 3, label: 'Updated today' },
  { value: 2, label: 'To review' },
];

const meta: Meta = {
  title: 'Primitives/Facts',
  component: 'ui-facts',
  args: { items, loading: false },
  render: (a) => html`<ui-facts .items=${a.items} ?loading=${a.loading}></ui-facts>`,
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
export const Two: Story = { args: { items: [{ value: '2 hours', label: 'Since last run' }, { value: '92%', label: 'On time' }] } };
export const ExtrasDropped: Story = { args: { items: [...items, { value: 9, label: 'Never shown' }] } };
export const Loading: Story = { args: { loading: true } };
