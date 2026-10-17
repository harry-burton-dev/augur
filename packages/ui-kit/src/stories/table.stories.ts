import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/table.js';
import '../components/surface.js';
import type { TableColumn, TableRow } from '../components/table.js';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const columns: TableColumn[] = [
  { key: 'title', label: 'Title', sortable: true },
  { key: 'collection', label: 'Collection', sortable: true },
  { key: 'status', label: 'Status', kind: 'status', sortable: true },
  { key: 'pages', label: 'Pages', kind: 'number', sortable: true, sortFirst: 'desc' },
  { key: 'updated', label: 'Updated', kind: 'date', sortable: true, sortFirst: 'desc' },
];
const rows: TableRow[] = [
  { id: '1', title: 'Travel and subsistence policy', collection: 'Policies', status: 'needs', pages: 12, updated: hoursAgo(3) },
  { id: '2', title: 'Annual report 2025–26', collection: 'Reports', status: 'running', pages: 48, updated: hoursAgo(26) },
  { id: '3', title: 'Board minutes, 12 October', collection: 'Minutes', status: 'done', pages: 6, updated: hoursAgo(80) },
  { id: '4', title: 'Records retention schedule', collection: 'Policies', status: 'warning', pages: 9, updated: hoursAgo(400) },
  { id: '5', title: 'Quarterly return Q3', collection: 'Returns', status: 'failed', pages: 3, updated: hoursAgo(1) },
];

const meta: Meta = {
  title: 'Collections/Table',
  component: 'ui-table',
  render: (a) => html`<ui-surface style="max-width: var(--measure-wide)">
    <ui-table noun="documents" .columns=${columns} .rows=${a.rows ?? rows} ?selectable=${a.selectable} ?filterable=${a.filterable}
      ?loading=${a.loading} .error=${a.error ?? ''} density=${a.density ?? 'default'}></ui-table>
  </ui-surface>`,
};
export default meta;
type Story = StoryObj;

export const Default: Story = { args: { filterable: true } };
export const Selectable: Story = { args: { selectable: true } };
export const Compact: Story = { args: { density: 'compact' } };
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = { args: { rows: [] } };
export const Error: Story = { args: { error: "Couldn't load documents. Nothing was changed." } };
