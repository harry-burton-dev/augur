import { beforeEach, describe, expect, it, vi } from 'vitest';
import './table.js';
import type { TableColumn, TableRow, UiTable } from './table.js';

const columns: TableColumn[] = [
  { key: 'title', label: 'Title', sortable: true },
  { key: 'status', label: 'Status', kind: 'status', sortable: true },
  { key: 'pages', label: 'Pages', kind: 'number', sortable: true, sortFirst: 'desc' },
];
const rows: TableRow[] = [
  { id: 'a', title: 'Travel policy', status: 'done', pages: 4 },
  { id: 'b', title: 'Annual report', status: 'needs', pages: 32 },
  { id: 'c', title: 'Minutes 12 Oct', status: 'failed', pages: 2 },
];

let el: UiTable;
const titles = () => el.visibleRows.map((r) => r.title);

beforeEach(async () => {
  document.body.innerHTML = '<ui-table noun="documents"></ui-table>';
  el = document.body.querySelector('ui-table') as UiTable;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
});

describe('ui-table', () => {
  it('renders one row per item and a count', () => {
    expect(el.shadowRoot!.querySelectorAll('tr.row')).toHaveLength(3);
    expect(el.shadowRoot!.querySelector('.bar .label')!.textContent).toBe('3 DOCUMENTS');
  });

  it('cycles a header through ascending, descending and cleared', () => {
    el.sortBy('title');
    expect(titles()).toEqual(['Annual report', 'Minutes 12 Oct', 'Travel policy']);
    el.sortBy('title');
    expect(titles()).toEqual(['Travel policy', 'Minutes 12 Oct', 'Annual report']);
    el.sortBy('title');
    expect(el.sort).toBeNull();
  });

  it('honours sortFirst', () => {
    el.sortBy('pages');
    expect(el.sort).toEqual({ key: 'pages', dir: 'desc' });
    expect(titles()[0]).toBe('Annual report');
  });

  it('sorts status by urgency, not alphabet', () => {
    el.sortBy('status');
    expect(el.visibleRows.map((r) => r.status)).toEqual(['needs', 'failed', 'done']);
  });

  it('filters across columns and counts what matches', async () => {
    el.filterText = 'policy';
    await el.updateComplete;
    expect(titles()).toEqual(['Travel policy']);
    expect(el.shadowRoot!.querySelector('.bar .label')!.textContent).toBe('1 OF 3 DOCUMENTS');
  });

  it('says so when nothing matches the filter', async () => {
    el.filterText = 'zzz';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.state')!.textContent).toContain('Nothing matches');
  });

  it('opens a row on Enter', async () => {
    const onOpen = vi.fn();
    el.addEventListener('ui-open', onOpen);
    el.shadowRoot!.querySelector('tr.row')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onOpen.mock.calls[0][0].detail.row.id).toBe('a');
  });

  it('selects with Space when selectable', async () => {
    el.selectable = true;
    await el.updateComplete;
    const onSelect = vi.fn();
    el.addEventListener('ui-select', onSelect);
    el.shadowRoot!.querySelector('tr.row')!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(onSelect.mock.calls[0][0].detail.ids).toEqual(['a']);
  });

  it('shows the error state with a retry', async () => {
    el.error = "Couldn't load documents. Nothing was changed.";
    await el.updateComplete;
    const onRetry = vi.fn();
    el.addEventListener('ui-retry', onRetry);
    el.shadowRoot!.querySelector('.state ui-button')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(onRetry).toHaveBeenCalled();
  });
});
