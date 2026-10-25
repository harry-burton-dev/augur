import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/filter-bar.js';
import '../components/button.js';
import '../components/surface.js';
import type { FilterDef } from '../components/filter-bar.js';

const filters: FilterDef[] = [
  {
    id: 'tag',
    label: 'Tags',
    search: true,
    options: [
      { value: 'fin', label: 'Finance', detail: 'Org', icon: 'org' },
      { value: 'pol', label: 'Policy', detail: 'Org', icon: 'org' },
      { value: 'trv', label: 'Travel' },
      { value: 'drf', label: 'Draft' },
    ],
  },
  { id: 'type', label: 'Type', options: [{ value: 'pdf', label: 'PDF' }, { value: 'word', label: 'Word' }, { value: 'markdown', label: 'Markdown' }] },
  { id: 'author', label: 'Added by', options: [{ value: 'u-1', label: 'Alex Rivera' }, { value: 'u-2', label: 'Sam Okafor' }] },
  { id: 'since', label: 'Changed', single: true, options: [{ value: 'week', label: 'Past week' }, { value: 'month', label: 'Past month' }, { value: 'year', label: 'Past year' }] },
];
const sorts = [
  { value: 'title', label: 'Title' },
  { value: 'newest', label: 'Newest' },
  { value: 'updated', label: 'Recently changed' },
];

const meta: Meta = {
  title: 'Inputs/Filter bar',
  component: 'ui-filter-bar',
  render: () => html`<ui-surface style="max-width:var(--measure-wide)">
    <ui-filter-bar label="Filter documents" .filters=${filters} .sorts=${sorts} sort="title" .count=${24} .noun=${['document', 'documents']}>
      <ui-button slot="actions" kind="ghost" size="sm">Save view</ui-button>
    </ui-filter-bar>
  </ui-surface>`,
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
/** Some filters on: each shows as a tag with its ×. */
export const Filtered: Story = {
  render: () => html`<ui-surface style="max-width:var(--measure-wide)">
    <ui-filter-bar label="Filter documents" .filters=${filters} .value=${{ tag: ['pol', 'drf'], since: ['month'] }} .sorts=${sorts} sort="updated" .count=${3} .noun=${['document', 'documents']}>
      <ui-button slot="actions" kind="ghost" size="sm">Save view</ui-button>
    </ui-filter-bar>
  </ui-surface>`,
};
