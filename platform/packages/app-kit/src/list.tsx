import { useState, type ReactNode } from 'react';
import {
  Cell,
  Column,
  GridList,
  GridListItem,
  Row as AriaRow,
  Table as AriaTable,
  TableBody,
  TableHeader,
  Checkbox as AriaCheckbox,
  type Selection,
  type SortDescriptor,
} from 'react-aria-components';
import { Button, Icon, cx, type IconName } from '@augur/kit-common';
import { State, Status, statusUrgency, type StatusName } from './states.js';

/** A thing to do about one row, shown as a word at its end ("Approve", "Open"). */
export interface ListAction {
  id: string;
  label: string;
  disabled?: boolean;
  /** Why it can't be used, in one sentence. */
  reason?: string;
}

export interface ListItem {
  id: string;
  title: string;
  /** One line under the title. */
  detail?: string;
  /** A time or a count at the end. */
  meta?: string;
  /** The lead mark: `needs` is green, and the first that needs you pings. */
  status?: StatusName;
  /** A kit icon for the lead mark instead of a status. */
  icon?: IconName;
  /** Rows with the same group sit under one header, in the order they first appear. */
  group?: string;
  /** At most two, at the row's end. */
  actions?: ListAction[];
  /** Shown dimmed, can't be opened. */
  disabled?: boolean;
  /** Why it can't be opened; it takes the detail line's place. */
  reason?: string;
}

export interface ListProps {
  label: string;
  /** What a row is, one and many. */
  noun?: [string, string];
  items: ListItem[];
  density?: 'comfortable' | 'compact';
  loading?: boolean;
  /** Couldn't load: said in red with Try again, in place of the rows. */
  error?: string;
  /** Said when there are no rows. */
  empty?: string;
  /** Whether to show the bar that counts the rows. */
  bar?: boolean;
  onOpen?: (item: ListItem) => void;
  onAction?: (item: ListItem, action: ListAction) => void;
  onRetry?: () => void;
  className?: string;
}

/**
 * Things you can act on, one per row: a lead mark, a title, a line of detail,
 * a time or count at the end, then the row's own actions as words. The first
 * row that needs you pings; the rest are a still green. Arrows, Home, End and
 * Enter come from React Aria's grid list.
 */
export function List({ label, noun = ['item', 'items'], items, density = 'comfortable', loading, error, empty = 'Nothing here.', bar = true, onOpen, onAction, onRetry, className }: ListProps) {
  const [one, many] = noun;
  const count = items.length;
  const head = bar ? <div className="quill-list-bar quill-label">{loading ? `${many}…` : `${count} ${count === 1 ? one : many}`}</div> : null;
  const wrap = (body: ReactNode) => (
    <div className={cx('quill-list', className)} data-density={density}>
      {head}
      {body}
    </div>
  );
  if (loading)
    return wrap(
      <div aria-busy="true" aria-label={label}>
        <span className="quill-list-skel" />
        <span className="quill-list-skel" />
        <span className="quill-list-skel" />
      </div>,
    );
  if (error) return wrap(<State kind="error" heading={error} body="Nothing was changed." action="Try again" onAction={onRetry} />);
  if (!count) return wrap(<State heading={empty} />);
  const groups: [string | undefined, ListItem[]][] = [];
  for (const item of items) {
    const g = groups.find(([name]) => name === item.group);
    if (g) g[1].push(item);
    else groups.push([item.group, [item]]);
  }
  const pinging = items.find((i) => i.status === 'needs' && !i.disabled)?.id;
  return wrap(
    groups.map(([name, rows]) => (
      <div key={name ?? ''}>
        {name !== undefined ? (
          <div className="quill-list-group quill-label" data-needs={rows.every((r) => r.status === 'needs') ? '' : undefined}>
            {name}
          </div>
        ) : null}
        <GridList
          aria-label={name ?? label}
          className="quill-list-rows"
          disabledKeys={rows.filter((r) => r.disabled).map((r) => r.id)}
          onAction={(key) => {
            const item = rows.find((r) => r.id === key);
            if (item && !item.disabled) onOpen?.(item);
          }}
        >
          {rows.map((item) => (
            <GridListItem key={item.id} id={item.id} textValue={item.title} className="quill-list-row" data-disabled-row={item.disabled ? '' : undefined}>
              {item.icon && !item.status ? (
                <Icon name={item.icon} size={16} className="quill-list-icon" />
              ) : (
                <span className="quill-list-lead" data-status={item.status} data-first={item.id === pinging ? '' : undefined} aria-hidden="true" />
              )}
              <span className="quill-list-text">
                <b>{item.title}</b>
                {item.disabled && item.reason ? <span className="quill-list-why">{item.reason}</span> : item.detail ? <span>{item.detail}</span> : null}
              </span>
              {item.meta ? <span className="quill-list-meta">{item.meta}</span> : null}
              {(item.actions ?? []).slice(0, 2).map((action, i) => {
                const off = Boolean(item.disabled || action.disabled);
                return (
                  <Button
                    key={action.id}
                    kind={i === 0 && item.status === 'needs' && !off ? 'secondary' : 'ghost'}
                    size="sm"
                    disabled={off}
                    reason={action.disabled ? action.reason : item.reason}
                    aria-label={`${action.label}: ${item.title}`}
                    onPress={() => onAction?.(item, action)}
                  >
                    {action.label}
                  </Button>
                );
              })}
            </GridListItem>
          ))}
        </GridList>
      </div>
    )),
  );
}

export interface TableColumn<R extends TableRow = TableRow> {
  key: string;
  label: string;
  kind?: 'text' | 'number' | 'date' | 'status';
  align?: 'start' | 'end';
  wrap?: boolean;
  sortable?: boolean;
  /** First sort direction for this column. */
  sortFirst?: 'asc' | 'desc';
  /** Custom cell content. */
  format?: (value: unknown, row: R) => ReactNode;
  /** Plain text used for filtering and sorting when `format` returns markup. */
  text?: (value: unknown, row: R) => string;
}

export interface TableRow {
  id: string;
  [key: string]: unknown;
}

export interface TableSort {
  key: string;
  dir: 'asc' | 'desc';
}

/** "4 min ago", "3 h ago", "2 d ago", then the date. */
export const relativeTime = (value: unknown, now = Date.now()): string => {
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
export const compareBy = <R extends TableRow>(column: TableColumn<R>, a: R, b: R): number => {
  const av = a[column.key];
  const bv = b[column.key];
  if (column.kind === 'status') return statusUrgency.indexOf(av as StatusName) - statusUrgency.indexOf(bv as StatusName);
  if (column.kind === 'number') return Number(av) - Number(bv);
  if (column.kind === 'date') return Date.parse(String(av)) - Date.parse(String(bv));
  const at = column.text ? column.text(av, a) : String(av ?? '');
  const bt = column.text ? column.text(bv, b) : String(bv ?? '');
  return at.localeCompare(bt, undefined, { numeric: true, sensitivity: 'base' });
};

export interface TableProps<R extends TableRow = TableRow> {
  label?: string;
  /** Plural noun for the count bar ("documents"). */
  noun?: string;
  columns: TableColumn<R>[];
  rows: R[];
  /** The starting sort; the table keeps its own after that. */
  sort?: TableSort | null;
  onSort?: (sort: TableSort | null) => void;
  selectable?: boolean;
  selected?: string[];
  onSelect?: (ids: string[]) => void;
  density?: 'default' | 'compact';
  filterable?: boolean;
  loading?: boolean;
  error?: string;
  empty?: string;
  onOpen?: (row: R) => void;
  onRetry?: () => void;
  /** Buttons in the bar, before the filter. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Many things compared by the same fields. The first column takes the spare
 * width and truncates. Sortable headers cycle ascending, descending, cleared;
 * status sorts by urgency. Keyboard, selection and sorting come from React
 * Aria's table.
 */
export function Table<R extends TableRow = TableRow>({
  label,
  noun = 'rows',
  columns,
  rows,
  sort: initialSort = null,
  onSort,
  selectable,
  selected: selectedIds,
  onSelect,
  density = 'default',
  filterable,
  loading,
  error,
  empty = 'Nothing here yet.',
  onOpen,
  onRetry,
  actions,
  className,
}: TableProps<R>) {
  const [sort, setSort] = useState<TableSort | null>(initialSort);
  const [own, setOwn] = useState<Set<string>>(new Set());
  const [filtering, setFiltering] = useState(false);
  const [filter, setFilter] = useState('');
  const selected = selectedIds ? new Set(selectedIds) : own;
  const q = filter.trim().toLowerCase();
  let visible = q
    ? rows.filter((row) =>
        columns.some((c) => {
          const v = row[c.key];
          return (c.text ? c.text(v, row) : String(v ?? '')).toLowerCase().includes(q);
        }),
      )
    : [...rows];
  const column = sort && columns.find((c) => c.key === sort.key);
  if (column) {
    const dir = sort.dir === 'asc' ? 1 : -1;
    visible = visible.sort((a, b) => dir * compareBy(column, a, b));
  }
  const sortBy = (key: string) => {
    const c = columns.find((x) => x.key === key);
    if (!c) return;
    const first = c.sortFirst ?? 'asc';
    const second = first === 'asc' ? 'desc' : 'asc';
    const next: TableSort | null = !sort || sort.key !== key ? { key, dir: first } : sort.dir === first ? { key, dir: second } : null;
    setSort(next);
    onSort?.(next);
  };
  const select = (keys: Selection) => {
    const ids = keys === 'all' ? visible.map((r) => r.id) : [...keys].map(String);
    if (!selectedIds) setOwn(new Set(ids));
    onSelect?.(ids);
  };
  const countText = selected.size ? `${selected.size} selected` : q ? `${visible.length} of ${rows.length} ${noun}` : `${rows.length} ${noun}`;
  const span = columns.length + (selectable ? 1 : 0);
  const end = (c: TableColumn<R>) => c.align === 'end' || c.kind === 'number';
  const cell = (c: TableColumn<R>, row: R): ReactNode => {
    const value = row[c.key];
    if (c.format) return c.format(value, row);
    if (c.kind === 'status') return <Status status={String(value) as StatusName} />;
    if (c.kind === 'date') {
      const exact = new Date(String(value));
      return (
        <time dateTime={String(value)} title={Number.isNaN(exact.getTime()) ? undefined : exact.toLocaleString()}>
          {relativeTime(value)}
        </time>
      );
    }
    return String(value ?? '');
  };
  const descriptor: SortDescriptor | undefined = sort ? { column: sort.key, direction: sort.dir === 'asc' ? 'ascending' : 'descending' } : undefined;
  const stateRow = (body: ReactNode, tone?: 'error') => (
    <AriaRow id="__state" className="quill-table-state-row">
      <Cell colSpan={span} className="quill-table-state" data-error={tone ? '' : undefined}>
        {body}
      </Cell>
    </AriaRow>
  );
  let body: ReactNode;
  if (loading)
    body = [0, 1, 2].map((i) => (
      <AriaRow key={`skel-${i}`} id={`__skel-${i}`} className="quill-table-skel">
        {Array.from({ length: span }, (_, j) => (
          <Cell key={j}>
            <span className="quill-skel" />
          </Cell>
        ))}
      </AriaRow>
    ));
  else if (error)
    body = stateRow(
      <>
        <p>{error}</p>
        <Button kind="secondary" size="sm" onPress={onRetry}>
          Try again
        </Button>
      </>,
      'error',
    );
  else if (!rows.length) body = stateRow(<p>{empty}</p>);
  else if (!visible.length)
    body = stateRow(
      <>
        <p>Nothing matches “{filter}”.</p>
        <Button kind="tertiary" onPress={() => setFilter('')}>
          Clear the filter
        </Button>
      </>,
    );
  else
    body = visible.map((row) => (
      <AriaRow key={row.id} id={row.id} className="quill-table-row">
        {selectable ? (
          <Cell className="quill-table-sel">
            <AriaCheckbox slot="selection" aria-label="Select" className="quill-check">
              <span className="quill-check-box" aria-hidden="true">
                <Icon name="check" size={12} />
              </span>
            </AriaCheckbox>
          </Cell>
        ) : null}
        {columns.map((c, i) => (
          <Cell key={c.key} className="quill-table-cell" data-primary={i === 0 ? '' : undefined} data-end={end(c) ? '' : undefined} data-num={c.kind === 'number' ? '' : undefined} data-wrap={c.wrap ? '' : undefined}>
            {cell(c, row)}
          </Cell>
        ))}
      </AriaRow>
    ));
  return (
    <div className={cx('quill-table', className)} data-density={density}>
      <div className="quill-table-bar">
        <span className="quill-label" aria-live="polite">
          {countText}
        </span>
        {actions}
        {filterable ? (
          filtering ? (
            <label className="quill-table-filter">
              <Icon name="find" size={16} />
              <input
                type="search"
                aria-label={`Filter ${noun}`}
                value={filter}
                autoFocus
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return;
                  e.preventDefault();
                  if (filter) setFilter('');
                  else setFiltering(false);
                }}
              />
            </label>
          ) : (
            <button type="button" className="quill-table-find" aria-label={`Filter ${noun}`} onClick={() => setFiltering(true)}>
              <Icon name="find" size={16} />
            </button>
          )
        ) : null}
      </div>
      <div className="quill-table-wrap">
        <AriaTable
          aria-label={label || noun}
          aria-busy={loading || undefined}
          selectionMode={selectable ? 'multiple' : 'none'}
          selectionBehavior="toggle"
          selectedKeys={selected}
          onSelectionChange={select}
          sortDescriptor={descriptor}
          onSortChange={(d) => sortBy(String(d.column))}
          onRowAction={(key) => {
            const row = visible.find((r) => r.id === key);
            if (row) onOpen?.(row);
          }}
        >
          <TableHeader>
            {selectable ? (
              <Column className="quill-table-sel">
                <AriaCheckbox slot="selection" aria-label="Select all" className="quill-check">
                  <span className="quill-check-box" aria-hidden="true">
                    <Icon name="check" size={12} />
                  </span>
                </AriaCheckbox>
              </Column>
            ) : null}
            {columns.map((c, i) => (
              <Column key={c.key} id={c.key} isRowHeader={i === 0} allowsSorting={c.sortable} className="quill-table-head quill-label" data-primary={i === 0 ? '' : undefined} data-end={end(c) ? '' : undefined}>
                {({ allowsSorting, sortDirection }) => (
                  <span className="quill-table-sort" data-on={sortDirection ? '' : undefined} data-dir={sortDirection}>
                    {c.label}
                    {allowsSorting ? <Icon name="chevron-down" size={14} /> : null}
                  </span>
                )}
              </Column>
            ))}
          </TableHeader>
          <TableBody>{body}</TableBody>
        </AriaTable>
      </div>
    </div>
  );
}
