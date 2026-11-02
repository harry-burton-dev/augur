import { useRef, useState } from 'react';
import { ComboBox, Input, ListBox, ListBoxItem, Popover, type Key } from 'react-aria-components';
import { FieldHead, FieldHint, Icon, cx, useFieldCheck, useReason, useValue, type FieldProps, type IconName, type SelectOption } from '@augur/kit-common';
import { Tag } from './states.js';

/** A tag to pick from. `detail` is a quiet word beside it, such as an email. */
export type TagOption = SelectOption & { icon?: IconName };

export interface TagPickerProps extends Omit<FieldProps, 'state' | 'message'> {
  options: TagOption[];
  /** The chosen values. Left out, the picker keeps its own, starting from `defaultValue`. */
  value?: string[];
  defaultValue?: string[];
  onChange?: (values: string[]) => void;
  /** With it, a word that isn't a tag yet can be added: the app adds the option (and the value) once it exists. */
  onCreate?: (name: string) => void;
  /** The most it takes; 0 for no limit. */
  max?: number;
  placeholder?: string;
  /** A dialog collects the chosen values joined with commas. */
  name?: string;
}

/** What the list offers for a word: the unchosen options that match, those that start with it first, then "Add …" when it may. */
export const tagChoices = (options: TagOption[], chosen: string[], typed: string, creatable: boolean) => {
  const word = typed.trim().toLocaleLowerCase();
  const found = options.filter((o) => !chosen.includes(o.value) && (!word || o.label.toLocaleLowerCase().includes(word)));
  found.sort((a, b) => Number(!a.label.toLocaleLowerCase().startsWith(word)) - Number(!b.label.toLocaleLowerCase().startsWith(word)) || a.label.localeCompare(b.label));
  const rows: { id: string; option?: TagOption; add?: string }[] = found.map((option) => ({ id: option.value, option }));
  if (creatable && word && !options.some((o) => o.label.toLocaleLowerCase() === word)) rows.push({ id: `add:${typed.trim()}`, add: typed.trim() });
  return rows;
};

/**
 * Pick any number of tags from a vocabulary by typing: what's chosen shows as
 * tags in the field, the rest narrow as you type. Keys come from React Aria's
 * combo box: type to narrow, ↓ ↑ move, Enter picks (or adds), Esc closes the
 * list; Backspace in an empty field takes the last tag off. Once `max` is
 * reached, the field says so instead of offering more.
 */
export function TagPicker({ label, hint, required, optional, disabled, reason, className, options, value, defaultValue = [], onChange, onCreate, max = 0, placeholder = 'Type to find a tag', name }: TagPickerProps) {
  const [chosen, setChosen] = useValue<string[]>(value, defaultValue, onChange);
  const [typed, setTyped] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const { reasoned, describe, caption } = useReason(disabled, reason);
  const full = max > 0 && chosen.length >= max;
  useFieldCheck({ check: () => true, focus: () => input.current?.focus(), name, value: () => chosen.join(',') });
  const choices = full ? [] : tagChoices(options, chosen, typed, Boolean(onCreate));
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const pick = (key: Key | null) => {
    if (key == null || full) return;
    const row = choices.find((c) => c.id === String(key));
    if (!row) return;
    if (row.add) onCreate?.(row.add);
    else if (row.option) setChosen([...chosen, row.option.value]);
    setTyped('');
  };
  return (
    <ComboBox
      className={cx('augur-field augur-control relative quill-tag-picker', className)}
      data-unavailable={disabled || undefined}
      items={choices}
      inputValue={typed}
      onInputChange={setTyped}
      selectedKey={null}
      onSelectionChange={pick}
      menuTrigger="focus"
      allowsEmptyCollection={false}
      isDisabled={disabled && !reasoned}
      isReadOnly={reasoned}
      isRequired={required}
      aria-label={label}
    >
      <FieldHead label={label} required={required} optional={optional} />
      <FieldHint hint={hint} />
      <div className="augur-field-box quill-tag-picker-box" onClick={() => input.current?.focus()}>
        {chosen.map((v) => (
          <Tag key={v} label={labelOf(v)} onRemove={disabled ? undefined : () => setChosen(chosen.filter((c) => c !== v))} />
        ))}
        <Input
          ref={input}
          className="augur-input quill-tag-picker-input"
          placeholder={full ? `That’s the most it takes: ${max}.` : chosen.length ? '' : placeholder}
          {...describe}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !typed && chosen.length && !disabled) setChosen(chosen.slice(0, -1));
          }}
        />
      </div>
      {caption}
      <Popover className="augur-popover augur-list" offset={6}>
        <ListBox className="outline-none">
          {(row: (typeof choices)[number]) => (
            <ListBoxItem id={row.id} textValue={row.option?.label ?? row.add} className="augur-option">
              <span className="augur-option-mark" aria-hidden="true">
                {row.add ? <Icon name="plus" size={14} /> : row.option?.icon ? <Icon name={row.option.icon} size={14} /> : null}
              </span>
              <span className="augur-option-label">{row.add ? `Add “${row.add}”` : row.option?.label}</span>
              {row.option?.detail ? <em className="augur-option-detail">{row.option.detail}</em> : null}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
