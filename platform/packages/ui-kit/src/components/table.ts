import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { base, label } from '../shared.js';
import { statusUrgency, type StatusName } from './status.js';
import './status.js';
import './button.js';

export interface TableColumn<Row = Record<string, unknown>> {
  key: string;
  label: string;
  kind?: 'text' | 'number' | 'date' | 'status';
  align?: 'start' | 'end';
  wrap?: boolean;
  sortable?: boolean;
  /** First sort direction for this column. */
  sortFirst?: 'asc' | 'desc';
  /** Custom cell content. */
  format?: (value: unknown, row: Row) => string | TemplateResult;
  /** Plain text used for filtering and sorting when `format` returns markup. */
  text?: (value: unknown, row: Row) => string;
}

export interface TableRow {
  id: string;
  [key: string]: unknown;
}

export interface TableSort {
  key: string;
  dir: 'asc' | 'desc';
}

const relative = (value: unknown, now = Date.now()): string => {
  const t = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (Number.isNaN(t)) return String(value ?? '');
  const mins = Math.round((now - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(t).toLocaleDateString();
};

/** Sort comparison for one column: status by urgency, numbers and dates by value, text by locale. */
export const compareBy = (column: TableColumn, a: TableRow, b: TableRow): number => {
  const av = a[column.key];
  const bv = b[column.key];
  if (column.kind === 'status') {
    return statusUrgency.indexOf(av as StatusName) - statusUrgency.indexOf(bv as StatusName);
  }
  if (column.kind === 'number') return Number(av) - Number(bv);
  if (column.kind === 'date') return Date.parse(String(av)) - Date.parse(String(bv));
  const at = column.text ? column.text(av, a) : String(av ?? '');
  const bt = column.text ? column.text(bv, b) : String(bv ?? '');
  return at.localeCompare(bt, undefined, { numeric: true, sensitivity: 'base' });
};

/**
 * Many things compared by the same fields, on a pane at the wide measure.
 * The first column takes the spare width and truncates (never below 160px).
 * Sortable headers cycle ascending, descending, cleared; status sorts by urgency.
 *
 * @fires ui-open - Enter or click on a row, detail `{ row }`
 * @fires ui-select - selection changed, detail `{ ids }`
 * @fires ui-sort - detail `{ sort }` (null when cleared)
 * @fires ui-retry - the error state's Try again
 */
export class UiTable extends LitElement {
  static override properties = {
    label: { type: String },
    noun: { type: String },
    columns: { attribute: false },
    rows: { attribute: false },
    sort: { attribute: false },
    selectable: { type: Boolean },
    density: { type: String, reflect: true },
    filterable: { type: Boolean },
    filterText: { type: String, attribute: 'filter-text' },
    loading: { type: Boolean, reflect: true },
    error: { type: String },
    empty: { type: String },
    selected: { attribute: false },
    filtering: { state: true },
  };

  declare label: string;
  /** Plural noun for the count bar ("documents"). */
  declare noun: string;
  declare columns: TableColumn[];
  declare rows: TableRow[];
  declare sort: TableSort | null;
  declare selectable: boolean;
  declare density: 'default' | 'compact';
  declare filterable: boolean;
  declare filterText: string;
  declare loading: boolean;
  declare error: string;
  declare empty: string;
  declare selected: Set<string>;
  declare filtering: boolean;

  constructor() {
    super();
    this.label = '';
    this.noun = 'rows';
    this.columns = [];
    this.rows = [];
    this.sort = null;
    this.selectable = false;
    this.density = 'default';
    this.filterable = false;
    this.filterText = '';
    this.loading = false;
    this.error = '';
    this.empty = 'Nothing here yet.';
    this.selected = new Set();
    this.filtering = false;
  }

  /** Rows after filtering and sorting, in display order. */
  get visibleRows(): TableRow[] {
    const q = this.filterText.trim().toLowerCase();
    let rows = q
      ? this.rows.filter((row) =>
          this.columns.some((c) => {
            const v = row[c.key];
            const t = c.text ? c.text(v, row) : String(v ?? '');
            return t.toLowerCase().includes(q);
          }),
        )
      : [...this.rows];
    const column = this.sort && this.columns.find((c) => c.key === this.sort!.key);
    if (column) {
      const dir = this.sort!.dir === 'asc' ? 1 : -1;
      rows = rows.sort((a, b) => dir * compareBy(column, a, b));
    }
    return rows;
  }

  /** Cycle a column's sort: first direction, the reverse, then cleared. */
  sortBy(key: string) {
    const column = this.columns.find((c) => c.key === key);
    if (!column) return;
    const first = column.sortFirst ?? 'asc';
    const second = first === 'asc' ? 'desc' : 'asc';
    if (!this.sort || this.sort.key !== key) this.sort = { key, dir: first };
    else if (this.sort.dir === first) this.sort = { key, dir: second };
    else this.sort = null;
    this.dispatchEvent(new CustomEvent('ui-sort', { detail: { sort: this.sort }, bubbles: true, composed: true }));
  }

  select(ids: Iterable<string>) {
    this.selected = new Set(ids);
    this.dispatchEvent(new CustomEvent('ui-select', { detail: { ids: [...this.selected] }, bubbles: true, composed: true }));
  }

  clearSelection() {
    this.select([]);
  }

  private toggle(id: string) {
    const next = new Set(this.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.select(next);
  }

  private open(row: TableRow) {
    this.dispatchEvent(new CustomEvent('ui-open', { detail: { row }, bubbles: true, composed: true }));
  }

  private onRowKey(e: KeyboardEvent, row: TableRow) {
    const tr = e.currentTarget as HTMLElement;
    if (e.key === 'Enter') this.open(row);
    else if (e.key === ' ' && this.selectable) {
      e.preventDefault();
      this.toggle(row.id);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      (tr.nextElementSibling as HTMLElement | null)?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      (tr.previousElementSibling as HTMLElement | null)?.focus();
    } else if (e.key === '/' && this.filterable) {
      e.preventDefault();
      this.openFilter();
    }
  }

  private async openFilter() {
    this.filtering = true;
    await this.updateComplete;
    this.renderRoot.querySelector<HTMLInputElement>('.filter input')?.focus();
  }

  private onFilterKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (this.filterText) this.filterText = '';
    else this.filtering = false;
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: block; }
      .bar { display: flex; align-items: center; gap: var(--space-4); min-height: 48px; padding: 0 var(--space-3); }
      .bar .label { flex: 1; }
      .filter { display: inline-flex; align-items: center; gap: var(--space-2); flex: 0 1 280px; border-bottom: 1px solid var(--focus); }
      .filter input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: 0;
        background: none;
        color: var(--ink);
        font: inherit;
        font-size: var(--type-meta);
        line-height: var(--leading-meta);
        padding: var(--space-2) 0;
      }
      .icon-btn { border: 0; background: none; color: var(--ink-muted); cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; }
      .icon-btn:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
      .icon-btn:focus-visible { outline: 1.5px solid var(--focus); }
      svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
      .wrap { overflow: auto; }
      table { width: 100%; border-collapse: collapse; font-size: var(--type-body); line-height: var(--leading-body); }
      th {
        position: sticky;
        top: 0;
        z-index: 1;
        height: 44px;
        padding: 0 var(--space-3);
        text-align: left;
        font-weight: 500;
        white-space: nowrap;
        background: color-mix(in srgb, var(--slate) 85%, transparent);
        border-bottom: 1px solid var(--hairline);
      }
      th.end, td.end { text-align: right; }
      .sort {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) 0;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        letter-spacing: inherit;
        text-transform: inherit;
        cursor: pointer;
      }
      th.end .sort { flex-direction: row-reverse; }
      .sort svg { width: 14px; height: 14px; opacity: 0; transition: opacity var(--motion-quick), transform var(--motion-base); }
      .sort:hover { color: var(--ink); }
      .sort:hover svg { opacity: 0.5; }
      .sort.on { color: var(--ink); }
      .sort.on svg { opacity: 1; }
      .sort.asc svg { transform: rotate(180deg); }
      .sort:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; border-radius: var(--radius-key); }
      td {
        height: 56px;
        padding: 0 var(--space-3);
        border-bottom: 1px solid var(--hairline);
        color: var(--ink-muted);
        white-space: nowrap;
      }
      tbody tr:last-child td { border-bottom: 0; }
      :host([density='compact']) td { height: 40px; }
      td.primary, th.primary { max-width: 0; width: 40%; overflow: hidden; text-overflow: ellipsis; }
      th.primary { min-width: 160px; }
      td.primary { color: var(--ink); font-weight: 500; }
      td.wrap { white-space: normal; min-width: 140px; padding-block: var(--space-2); }
      td.num { font-variant-numeric: tabular-nums; color: var(--ink); }
      tr.row { cursor: pointer; outline: none; transition: background var(--motion-quick) var(--ease-standard); }
      tr.row:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
      tr.row:focus-visible td { box-shadow: inset 0 1.5px 0 var(--focus), inset 0 -1.5px 0 var(--focus); }
      tr.row.selected { background: color-mix(in srgb, var(--ink) 8%, transparent); }
      tr.row.selected td:first-child { box-shadow: inset 2px 0 0 var(--ink); }
      .sel { width: 20px; padding-left: var(--space-4); padding-right: 0; }
      input[type='checkbox'] { accent-color: var(--ink); width: 16px; height: 16px; margin: 0; cursor: pointer; }
      .state { padding: var(--space-6) var(--space-4); text-align: center; color: var(--ink-muted); }
      .state.error { color: var(--danger); }
      .state p { margin: 0 0 var(--space-4); }
      .skel td span {
        display: block;
        height: 12px;
        border-radius: var(--radius-key);
        background: linear-gradient(90deg, var(--hairline), var(--hairline-strong), var(--hairline));
        background-size: 200% 100%;
        animation: shimmer var(--motion-shimmer) linear infinite;
      }
      @keyframes shimmer { to { background-position: -200% 0; } }
    `,
  ];

  private cell(column: TableColumn, row: TableRow) {
    const value = row[column.key];
    if (column.format) return column.format(value, row);
    if (column.kind === 'status') return html`<ui-status status=${String(value)}></ui-status>`;
    if (column.kind === 'date') {
      const exact = new Date(String(value));
      return html`<time datetime=${String(value)} title=${Number.isNaN(exact.getTime()) ? '' : exact.toLocaleString()}>${relative(value)}</time>`;
    }
    return String(value ?? '');
  }

  private header(column: TableColumn, index: number) {
    const end = column.align === 'end' || column.kind === 'number';
    const on = this.sort?.key === column.key;
    const ariaSort = on ? (this.sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    const cls = [index === 0 ? 'primary' : '', end ? 'end' : '', 'label'].join(' ');
    if (!column.sortable) return html`<th class=${cls} scope="col">${column.label}</th>`;
    return html`<th class=${cls} scope="col" aria-sort=${ariaSort}>
      <button class="sort ${on ? 'on' : ''} ${on && this.sort!.dir === 'asc' ? 'asc' : ''}" @click=${() => this.sortBy(column.key)}>
        ${column.label}<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
      </button>
    </th>`;
  }

  private body(rows: TableRow[]) {
    const span = this.columns.length + (this.selectable ? 1 : 0);
    if (this.loading) {
      return [0, 1, 2].map(
        () => html`<tr class="skel">${Array.from({ length: span }, () => html`<td><span></span></td>`)}</tr>`,
      );
    }
    if (this.error) {
      return html`<tr><td colspan=${span} class="state error">
        <p>${this.error}</p>
        <ui-button kind="secondary" size="sm" @click=${() => this.dispatchEvent(new CustomEvent('ui-retry', { bubbles: true, composed: true }))}>Try again</ui-button>
      </td></tr>`;
    }
    if (!this.rows.length) return html`<tr><td colspan=${span} class="state"><p>${this.empty}</p></td></tr>`;
    if (!rows.length) {
      return html`<tr><td colspan=${span} class="state">
        <p>Nothing matches “${this.filterText}”.</p>
        <ui-button kind="tertiary" @click=${() => (this.filterText = '')}>Clear the filter</ui-button>
      </td></tr>`;
    }
    return rows.map(
      (row) => html`<tr
        class="row ${this.selected.has(row.id) ? 'selected' : ''}"
        tabindex="0"
        aria-selected=${this.selectable ? String(this.selected.has(row.id)) : nothing}
        @click=${() => this.open(row)}
        @keydown=${(e: KeyboardEvent) => this.onRowKey(e, row)}
      >
        ${this.selectable
          ? html`<td class="sel" @click=${(e: Event) => e.stopPropagation()}>
              <input type="checkbox" aria-label="Select" .checked=${this.selected.has(row.id)} @change=${() => this.toggle(row.id)} />
            </td>`
          : nothing}
        ${this.columns.map((c, i) => {
          const cls = [
            i === 0 ? 'primary' : '',
            c.align === 'end' || c.kind === 'number' ? 'end' : '',
            c.kind === 'number' ? 'num' : '',
            c.wrap ? 'wrap' : '',
          ].join(' ');
          return html`<td class=${cls}>${this.cell(c, row)}</td>`;
        })}
      </tr>`,
    );
  }

  private countText(visible: number) {
    const noun = this.noun.toUpperCase();
    if (this.selected.size) return `${this.selected.size} SELECTED`;
    return this.filterText ? `${visible} OF ${this.rows.length} ${noun}` : `${this.rows.length} ${noun}`;
  }

  override render() {
    const rows = this.visibleRows;
    const allSelected = this.selectable && rows.length > 0 && rows.every((r) => this.selected.has(r.id));
    return html`
      <div class="bar">
        <span class="label" aria-live="polite">${this.countText(rows.length)}</span>
        <slot name="actions"></slot>
        ${this.filterable
          ? this.filtering
            ? html`<label class="filter">
                <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
                <input
                  type="search"
                  aria-label="Filter ${this.noun}"
                  .value=${this.filterText}
                  @input=${(e: Event) => (this.filterText = (e.target as HTMLInputElement).value)}
                  @keydown=${this.onFilterKey}
                />
              </label>`
            : html`<button class="icon-btn" aria-label="Filter ${this.noun}" @click=${this.openFilter}>
                <svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
              </button>`
          : nothing}
      </div>
      <div class="wrap">
        <table aria-label=${this.label || this.noun} aria-busy=${this.loading ? 'true' : 'false'}>
          <thead>
            <tr>
              ${this.selectable
                ? html`<th class="sel"><input type="checkbox" aria-label="Select all" .checked=${allSelected}
                    @change=${() => this.select(allSelected ? [] : rows.map((r) => r.id))} /></th>`
                : nothing}
              ${this.columns.map((c, i) => this.header(c, i))}
            </tr>
          </thead>
          <tbody>${this.body(rows)}</tbody>
        </table>
      </div>
    `;
  }
}

if (!customElements.get('ui-table')) customElements.define('ui-table', UiTable);

declare global {
  interface HTMLElementTagNameMap {
    'ui-table': UiTable;
  }
}
