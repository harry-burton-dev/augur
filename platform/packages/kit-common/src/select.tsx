import { useRef, useState } from 'react';
import { Button, ListBox, ListBoxItem, Popover, Select as AriaSelect, SelectValue, type Key } from 'react-aria-components';
import { cx } from './cx.js';
import { FieldHead, FieldHint, NEEDS_YOU, shownState, useMessage, useValue, type FieldProps, type FieldState } from './field.js';
import { Icon } from './icon.js';
import { useReason, warnNoReason } from './reason.js';

export interface SelectOption {
  value: string;
  label: string;
  /** A quiet fact on the right ("12 people"), or why it can't be picked. */
  detail?: string;
  /** Stays in the list, dimmed, so people know it exists. Say why in `detail`. */
  disabled?: boolean;
}

export interface SelectProps extends FieldProps {
  options: (SelectOption | string)[];
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  /** What it says before anything is picked. */
  placeholder?: string;
  /** What it says when there is nothing to pick, and so why. */
  empty?: string;
  name?: string;
  readOnly?: boolean;
  busy?: boolean;
}

const normalise = (options: (SelectOption | string)[]): SelectOption[] => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

/**
 * Choose one from a short list (up to about 12). It looks like a TextField with
 * a chevron; opened, a raised glass list appears under the line, and the chosen
 * option carries an ink tick. Keys, typing to jump and the list's placement
 * come from React Aria; the list opens above everything, so a dialog never clips it.
 */
export function Select({ label, hint, required, optional, disabled, reason, state, message, className, options, value, defaultValue = null, onChange, placeholder = 'Choose…', empty, name, readOnly, busy }: SelectProps) {
  const items = normalise(options);
  const [picked, setPicked] = useValue<string | null>(value, defaultValue);
  const [own, setOwn] = useState<{ state: FieldState; message?: string }>({ state: 'idle' });
  const [open, setOpen] = useState(false);
  const none = items.length === 0;
  const shown = shownState(state, message || (none ? empty : undefined), own);
  const { reasoned, describe, caption } = useReason(disabled, reason);
  const { describedBy, line } = useMessage(shown.message);
  const key = useRef({});
  warnNoReason(key.current, `Select "${label}"`, disabled, reason);

  return (
    <AriaSelect
      className={cx('augur-field augur-control relative', className)}
      data-state={shown.state}
      data-busy={busy || undefined}
      data-readonly={readOnly || undefined}
      data-unavailable={disabled || undefined}
      selectedKey={picked}
      onSelectionChange={(k: Key | null) => {
        if (k == null) return;
        setPicked(String(k));
        setOwn({ state: 'idle' });
        onChange?.(String(k));
      }}
      isOpen={open}
      onOpenChange={(next) => {
        // Unavailable, read-only, busy or empty: it stays focusable and says why, but doesn't open.
        if (next && (reasoned || readOnly || busy || none)) return;
        setOpen(next);
        if (!next && required && picked == null) setOwn({ state: 'attention', message: NEEDS_YOU });
      }}
      disabledKeys={items.filter((o) => o.disabled).map((o) => o.value)}
      isRequired={required}
      isDisabled={disabled && !reasoned}
      isInvalid={shown.state === 'error' || shown.state === 'attention'}
      validationBehavior="aria"
      name={name}
      placeholder={placeholder}
    >
      <FieldHead label={label} required={required} optional={optional} />
      <FieldHint hint={hint} />
      <Button
        className="augur-field-box augur-select-box"
        {...describe}
        aria-describedby={[describe['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined}
      >
        <SelectValue className="augur-select-value" />
        <span className="augur-chevron" aria-hidden="true">
          <Icon name="chevron-down" size={16} />
        </span>
      </Button>
      {line()}
      {caption}
      <Popover className="augur-popover augur-list" offset={6}>
        <ListBox items={items} className="outline-none">
          {(o) => (
            <ListBoxItem id={o.value} textValue={o.label} className="augur-option">
              {({ isSelected }) => (
                <>
                  <span className="augur-option-mark" aria-hidden="true">
                    {isSelected ? <Icon name="check" size={14} /> : null}
                  </span>
                  <span className="augur-option-label">{o.label}</span>
                  {o.detail ? <em className="augur-option-detail">{o.detail}</em> : null}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
