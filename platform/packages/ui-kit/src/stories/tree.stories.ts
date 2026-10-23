import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/tree.js';
import '../components/surface.js';
import type { TreeItem } from '../components/tree.js';

const items: TreeItem[] = [
  {
    id: 'policies',
    label: 'Policies',
    icon: 'folder',
    meta: '14',
    children: [
      { id: 'hr', label: 'People and HR', icon: 'folder', meta: '6', children: [{ id: 'leave', label: 'Leave', icon: 'folder', meta: '2' }] },
      { id: 'it', label: 'IT and security', icon: 'folder', meta: '5' },
    ],
  },
  { id: 'reports', label: 'Weekly reports', icon: 'folder', meta: '48' },
  { id: 'minutes', label: 'Board minutes', icon: 'folder' },
];

const meta: Meta = {
  title: 'Lists/Tree',
  component: 'ui-tree',
  args: { items, selected: 'hr', heading: 'Folders' },
  render: (a) => html`<ui-surface style="max-width:280px">
    <ui-tree label="Folders" heading=${a.heading} .items=${a.items} selected=${a.selected}></ui-tree>
  </ui-surface>`,
};
export default meta;
type Story = StoryObj;

/** A library's folders: the selected one's parents open by themselves. */
export const Default: Story = {};
export const NothingSelected: Story = { args: { selected: '' } };
export const Flat: Story = { args: { items: items.map(({ children: _, ...item }) => item), selected: 'reports' } };
