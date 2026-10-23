import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/list.js';
import '../components/surface.js';
import type { ListItem } from '../components/list.js';

const items: ListItem[] = [
  { id: '1', title: 'Approve the travel policy', detail: 'Library · On Acme · Sam asked for your review', meta: '4 min', status: 'needs', actions: [{ id: '0', label: 'Approve' }, { id: '1', label: 'Open' }] },
  { id: '2', title: 'Procurement is due for review', detail: 'Library · On Payroll · Review by Friday', meta: '50 min', status: 'needs', actions: [{ id: '0', label: 'Open' }] },
  { id: '3', title: 'Sign Alex’s expense claim', detail: 'Expenses', meta: '2 h', status: 'needs' },
];

const meta: Meta = {
  title: 'Lists/List',
  component: 'ui-list',
  args: { items, loading: false, error: '', density: 'comfortable' },
  render: (a) => html`<ui-surface style="max-width:var(--measure-read)">
    <ui-list label="What needs you" .noun=${['thing', 'things']} .items=${a.items} ?loading=${a.loading} error=${a.error} density=${a.density}
      empty="Nothing needs you right now."></ui-list>
  </ui-surface>`,
};
export default meta;
type Story = StoryObj;

/** Things you can act on: the first that needs you pings, actions sit at the row's end. */
export const Default: Story = {};
export const Compact: Story = { args: { density: 'compact' } };
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = { args: { items: [] } };
export const CouldNotLoad: Story = { args: { error: 'Couldn’t load what needs you.' } };
