import { useRef, type ReactNode } from 'react';
import { Checkbox as AriaCheckbox, CheckboxGroup as AriaCheckboxGroup } from 'react-aria-components';
import { cx } from './cx.js';
import { FieldHead, FieldHint, useMessage, useValue, type FieldProps } from './field.js';
import { Icon } from './icon.js';
import { useReason, warnNoReason } from './reason.js';

export interface CheckboxProps {
  /** What ticking it means. */
  children: ReactNode;
  /** A quiet fact on the right ("12 people"). */
  detail?: string;
  /** In a group: the value it adds. */
  value?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Why it can't be ticked, in one sentence. */
  reason?: string;
  name?: string;
  className?: string;
}

/**
 * A choice that waits for the form's primary. Ticked, the box fills with ink.
 * A choice that acts at once is a Toggle.
 */
export function Checkbox({ children, detail, value, checked, defaultChecked, onChange, disabled, reason, name, className }: CheckboxProps) {
  const { reasoned, describe, caption } = useReason(disabled, reason);
  const key = useRef({});
  warnNoReason(key.current, `Checkbox "${typeof children === 'string' ? children : value ?? ''}"`, disabled, reason);
  return (
    <div className={cx('augur-check-wrap augur-control relative', className)} data-unavailable={disabled || undefined}>
      <AriaCheckbox
        {...describe}
        value={value}
        isSelected={checked}
        defaultSelected={defaultChecked}
        onChange={onChange}
        isDisabled={disabled && !reasoned}
        isReadOnly={reasoned}
        name={name}
        className="augur-check"
      >
        <span className="augur-check-box" aria-hidden="true">
          <Icon name="check" size={14} className="augur-tick" />
        </span>
        <span className="augur-check-text">
          {children}
          {detail ? <em>{detail}</em> : null}
        </span>
      </AriaCheckbox>
      {caption}
    </div>
  );
}

export interface CheckboxGroupProps extends Omit<FieldProps, 'state'> {
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  /** The most that can be ticked. Once reached, the rest say why they can't be. */
  max?: number;
  /** Shown on the rest once `max` is reached. Defaults to a sentence with the number. */
  maxReason?: (max: number) => string;
  name?: string;
  /** Checkbox elements, each with a `value`. */
  children: ReactNode;
}

/** Several choices under one label. */
export function CheckboxGroup({ label, hint, required, optional, disabled, reason, message, className, value, defaultValue = [], onChange, max = 0, maxReason, name, children }: CheckboxGroupProps) {
  const [values, setValues] = useValue(value, defaultValue, onChange);
  const atMost = max > 0 && values.length >= max;
  const said = message || (atMost ? (maxReason ?? ((n) => `That’s ${n}, the most you can choose.`))(max) : '');
  const { describedBy, line } = useMessage(said);
  const { reasoned, describe, caption } = useReason(disabled, reason);
  return (
    <AriaCheckboxGroup
      className={cx('augur-field augur-control relative', className)}
      data-unavailable={disabled || undefined}
      data-at-most={atMost || undefined}
      value={values}
      onChange={(next) => setValues(max > 0 && next.length > max ? values : next)}
      isRequired={required}
      isDisabled={disabled && !reasoned}
      isReadOnly={reasoned}
      name={name}
      aria-describedby={[describe['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined}
    >
      <FieldHead label={label} required={required} optional={optional} />
      <FieldHint hint={hint} />
      <div className="augur-checks">{children}</div>
      {line()}
      {caption}
    </AriaCheckboxGroup>
  );
}
