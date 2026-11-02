import { useState, type ReactNode } from 'react';
import { Button as AriaButton, Input, Menu, MenuItem, MenuTrigger, Popover, SearchField, type Key, type Selection } from 'react-aria-components';
import { Icon, cx, type IconName, type SelectOption } from '@augur/kit-common';
import { Tag } from './states.js';

/** One way to narrow a list: its button in the bar, and the choices it opens. */
export interface FilterDef {
  id: string;
  /** The button's word, also said on each chip it puts up: "Tags". */
  label: string;
  options: (SelectOption & { icon?: IconName })[];
  /** One choice at a time, such as a time range: picking one replaces the last, and the list closes. */
  single?: boolean;
  /** A box at the top to narrow a long list of choices, such as tags. */
  search?: boolean;
}

/** What's chosen, by filter id. */
export type FilterValue = Record<string, string[]>;

/** Chosen values with any empty or unknown filter left out, so a value compares and saves cleanly. */
export const filterValue = (filters: readonly FilterDef[], value: FilterValue): FilterValue =>
  Object.fromEntries(filters.map((f) => [f.id, (value[f.id] ?? []).filter((v) => f.options.some((o) => o.value === v))]).filter(([, v]) => v.length));

export interface FilterBarProps {
  /** What the bar narrows, for screen readers: "Filter documents". */
  label: string;
  filters: FilterDef[];
  value: FilterValue;
  sorts?: SelectOption[];
  sort?: string;
  /** How many match; left out, no count shows. */
  count?: number;
  /** For the count: ['document', 'documents']. */
  noun?: [string, string];
  /** A new count is on its way: the old one dims. */
  busy?: boolean;
  onChange: (value: FilterValue, sort: string) => void;
  /** After the count: the page's own buttons, such as Save view. */
  actions?: ReactNode;
  className?: string;
}

/** One filter's (or the sort's) button and the choices it opens under it. */
function Choices({ id, label, options, chosen, single, search, button, onPick }: { id: string; label: string; options: FilterDef['options']; chosen: string[]; single?: boolean; search?: boolean; button: ReactNode; onPick: (values: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState('');
  const shown = word.trim() ? options.filter((o) => o.label.toLocaleLowerCase().includes(word.trim().toLocaleLowerCase())) : options;
  return (
    <MenuTrigger
      isOpen={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setWord('');
      }}
    >
      <AriaButton className="quill-filter-open" data-on={chosen.length && id !== 'sort' ? '' : undefined} aria-label={id === 'sort' ? undefined : chosen.length ? `${label}, ${chosen.length} chosen` : label}>
        {button}
      </AriaButton>
      <Popover className="augur-popover augur-menu quill-filter-panel" placement="bottom start" offset={6}>
        {search ? (
          <SearchField aria-label={`Find a ${label.toLocaleLowerCase()}`} value={word} onChange={setWord} className="quill-filter-find" autoFocus>
            <Input className="augur-input" placeholder="Find…" />
          </SearchField>
        ) : null}
        <Menu
          aria-label={label}
          className="outline-none"
          items={shown}
          selectionMode={single ? 'single' : 'multiple'}
          selectedKeys={chosen}
          disabledKeys={options.filter((o) => o.disabled).map((o) => o.value)}
          renderEmptyState={() => <p className="quill-filter-none">Nothing by that name.</p>}
          onSelectionChange={(keys: Selection) => {
            const next = keys === 'all' ? options.map((o) => o.value) : [...keys].map((k: Key) => String(k));
            onPick(single ? next.slice(-1) : next);
            if (single) setOpen(false);
          }}
        >
          {(o: FilterDef['options'][number]) => (
            <MenuItem id={o.value} textValue={o.label} className="augur-menu-item quill-filter-item">
              {({ isSelected }) => (
                <>
                  <span className="augur-option-mark" aria-hidden="true">
                    {isSelected ? <Icon name="check" size={14} /> : o.icon ? <Icon name={o.icon} size={14} /> : null}
                  </span>
                  <span className="augur-menu-name">
                    <span className="augur-menu-label">{o.label}</span>
                  </span>
                  {o.detail ? <em className="augur-option-detail">{o.detail}</em> : null}
                </>
              )}
            </MenuItem>
          )}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/**
 * The bar above a long list: a button for each way to narrow it, a sort, how
 * many there are, and room for the page's own actions (Save view). What's on
 * shows below as tags, each with its ×, and one press clears them all. The
 * bar holds no list itself; it says what changed and the page asks again.
 * Keys come from React Aria's menu: arrows move, Enter or Space picks, Esc
 * closes and goes back to the button.
 */
export function FilterBar({ label, filters, value, sorts = [], sort = '', count, noun = ['item', 'items'], busy, onChange, actions, className }: FilterBarProps) {
  const on = filters.flatMap((f) => (value[f.id] ?? []).map((v) => ({ filter: f, option: f.options.find((o) => o.value === v) })).filter((c) => c.option));
  const sortLabel = sorts.find((s) => s.value === sort)?.label ?? sorts[0]?.label;
  const set = (id: string, values: string[]) => onChange(filterValue(filters, { ...value, [id]: values }), sort);
  return (
    <div className={cx('quill-filter-bar', className)} data-busy={busy || undefined}>
      <div className="quill-filter-row" role="group" aria-label={label}>
        <div className="quill-filter-filters">
          {filters.map((f) => {
            const n = (value[f.id] ?? []).length;
            return (
              <Choices
                key={f.id}
                id={f.id}
                label={f.label}
                options={f.options}
                chosen={value[f.id] ?? []}
                single={f.single}
                search={f.search}
                onPick={(v) => set(f.id, v)}
                button={
                  <>
                    {f.label}
                    {n ? (
                      <span className="quill-filter-n" aria-hidden="true">
                        {n}
                      </span>
                    ) : null}
                    <Icon name="chevron-down" size={16} />
                  </>
                }
              />
            );
          })}
        </div>
        <div className="quill-filter-end">
          {count === undefined ? null : (
            <span className="quill-filter-count" aria-live="polite">
              {count} {count === 1 ? noun[0] : noun[1]}
            </span>
          )}
          {sorts.length ? (
            <Choices
              id="sort"
              label="Sort"
              options={sorts}
              chosen={[sort || sorts[0]!.value]}
              single
              onPick={(v) => v[0] && onChange(value, v[0])}
              button={
                <>
                  <Icon name="sort" size={16} />
                  Sort: <strong>{sortLabel}</strong>
                </>
              }
            />
          ) : null}
          {actions}
        </div>
      </div>
      {on.length ? (
        <div className="quill-filter-chips">
          {on.map(({ filter, option }) => (
            <Tag key={`${filter.id}:${option!.value}`} label={option!.label} icon={option!.icon} removeLabel={`${filter.label}: ${option!.label}`} onRemove={() => set(filter.id, (value[filter.id] ?? []).filter((v) => v !== option!.value))} />
          ))}
          <button type="button" className="quill-filter-clear" onClick={() => onChange({}, sort)}>
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}
