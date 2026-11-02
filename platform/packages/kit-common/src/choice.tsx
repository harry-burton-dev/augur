import { useRef, useState } from 'react';
import { Radio, RadioGroup, ToggleButton, ToggleButtonGroup, type Key } from 'react-aria-components';
import { cx } from './cx.js';
import { FieldHead, FieldHint, NEEDS_YOU, useFieldCheck, useMessage, useValue, type FieldProps } from './field.js';
import { Icon, type IconName } from './icon.js';
import { useReason, warnNoReason } from './reason.js';

export interface ChoiceOption {
  value: string;
  label: string;
  /** One line on what picking it means. */
  detail?: string;
  /** Can't be picked now: it stays, dimmed, and `reason` takes the place of its line. */
  disabled?: boolean;
  /** Why it can't be picked, and who can change that, in one sentence. */
  reason?: string;
}

export interface ChoiceProps extends Omit<FieldProps, 'state'> {
  /** Two to four options. More than that is a Select. */
  options: ChoiceOption[];
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  name?: string;
}

/**
 * Pick one of two to four options, each with a line explaining it. The chosen
 * one fills with green. An option that can't be picked stays in the list and
 * says why in place of its line. Arrows move and pick (React Aria).
 */
export function Choice({
  label,
  hint,
  required,
  optional,
  disabled,
  reason,
  message,
  className,
  options,
  value,
  defaultValue = null,
  onChange,
  name,
}: ChoiceProps) {
  const [picked, setPicked] = useValue<string | null>(value, defaultValue);
  const { reasoned, describe, caption } = useReason(disabled, reason);
  const [asked, setAsked] = useState(false);
  const asking = asked && picked == null;
  const { describedBy, line } = useMessage(message || (asking ? NEEDS_YOU : undefined));
  const first = useRef<HTMLDivElement>(null);
  const key = useRef({});
  warnNoReason(key.current, `Choice "${label}"`, disabled, reason);
  for (const o of options) warnNoReason(o, `Choice option "${o.label}"`, o.disabled, o.reason);
  useFieldCheck({
    check: () => {
      const ok = !required || picked != null || reasoned;
      setAsked(!ok);
      return ok;
    },
    focus: () => first.current?.querySelector('input')?.focus(),
    name,
    value: () => picked ?? '',
  });

  return (
    <RadioGroup
      ref={first}
      className={cx('augur-field augur-control relative', className)}
      data-state={asking ? 'attention' : 'idle'}
      data-unavailable={disabled || undefined}
      value={picked}
      onChange={(v) => {
        setPicked(v);
        onChange?.(v);
      }}
      isRequired={required}
      isDisabled={disabled && !reasoned}
      isReadOnly={reasoned}
      name={name}
      aria-describedby={[describe['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined}
    >
      <FieldHead label={label} required={required} optional={optional} />
      <FieldHint hint={hint} />
      <div className="augur-choices">
        {options.map((o) => (
          <Radio key={o.value} value={o.value} isDisabled={o.disabled} className="augur-choice">
            <span className="augur-choice-dot" aria-hidden="true" />
            <span className="augur-choice-label">{o.label}</span>
            {o.disabled && o.reason ? (
              <span className="augur-choice-detail">{o.reason}</span>
            ) : o.detail ? (
              <span className="augur-choice-detail">{o.detail}</span>
            ) : null}
          </Radio>
        ))}
      </div>
      {line()}
      {caption}
    </RadioGroup>
  );
}

export interface SegmentOption {
  value: string;
  label: string;
  icon?: IconName;
  /** Show only the icon; the label is still read aloud. */
  iconOnly?: boolean;
}

export interface SegmentedProps {
  /** What it switches, read aloud ("View"). */
  label: string;
  options: SegmentOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}

/** Two to four ways of seeing the same thing (list or grid). One is always on. */
export function Segmented({ label, options, value, defaultValue, onChange, className }: SegmentedProps) {
  const [on, setOn] = useValue<string>(value, defaultValue ?? options[0]?.value ?? '', onChange);
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[on]}
      onSelectionChange={(keys: Set<Key>) => {
        const next = [...keys][0];
        if (next != null) setOn(String(next));
      }}
      className={cx('augur-segmented', className)}
    >
      {options.map((o) => (
        <ToggleButton key={o.value} id={o.value} aria-label={o.iconOnly ? o.label : undefined} className="augur-segment">
          {o.icon ? <Icon name={o.icon} size={16} /> : null}
          {o.iconOnly ? null : o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
