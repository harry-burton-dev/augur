import { useRef, useState } from 'react';
import { Input, TextArea, TextField as AriaTextField } from 'react-aria-components';
import { cx } from './cx.js';
import { FieldHead, FieldHint, NEEDS_YOU, StateMark, shownState, useMessage, useValue, type FieldCheck, type FieldProps, type FieldState } from './field.js';
import { useReason, warnNoReason } from './reason.js';

export interface TextFieldProps extends FieldProps {
  value?: string;
  defaultValue?: string;
  /** Every keystroke. */
  onChange?: (value: string) => void;
  /** On leaving the field or Enter, after its check. */
  onCommit?: (value: string) => void;
  name?: string;
  type?: 'text' | 'email' | 'url' | 'tel' | 'password' | 'search';
  placeholder?: string;
  /** Several lines, growing as you write. */
  multiline?: boolean;
  rows?: number;
  /** A count shows under the field. */
  maxLength?: number;
  readOnly?: boolean;
  /** Saving or checking: a line runs along the field. */
  busy?: boolean;
  /** Show the tick when the value passes its check. */
  showValid?: boolean;
  /** Return a check for the value, or null when it's fine. Runs when you leave the field. */
  validate?: (value: string) => FieldCheck | null;
  autoFocus?: boolean;
}

/**
 * A line to write on: a label, an optional hint and a hairline that turns the
 * focus blue while you type. A required field left empty asks in green; only
 * content that is wrong turns red, and typing clears either straight away.
 */
export function TextField({
  label, hint, required, optional, disabled, reason, state, message, className,
  value, defaultValue = '', onChange, onCommit, name, type = 'text', placeholder, multiline, rows = 3, maxLength, readOnly, busy, showValid, validate, autoFocus,
}: TextFieldProps) {
  const [text, setText] = useValue(value, defaultValue, onChange);
  const [own, setOwn] = useState<{ state: FieldState; message?: string }>({ state: 'idle' });
  const shown = shownState(state, message, own);
  const { reasoned, describe, caption } = useReason(disabled, reason);
  const { describedBy, line } = useMessage(shown.message);
  const area = useRef<HTMLTextAreaElement>(null);
  const key = useRef({});
  warnNoReason(key.current, `TextField "${label}"`, disabled, reason);

  const check = (v: string) => {
    if (required && !v.trim()) return setOwn({ state: 'attention', message: NEEDS_YOU });
    const result = v ? validate?.(v) : null;
    setOwn(result ? { state: result.state, message: result.message } : { state: showValid && v ? 'valid' : 'idle' });
  };

  const grow = () => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <AriaTextField
      className={cx('augur-field augur-control relative', className)}
      data-state={shown.state}
      data-busy={busy || undefined}
      data-unavailable={disabled || undefined}
      value={text}
      onChange={(v) => {
        setText(v);
        if (own.state === 'attention' || own.state === 'error') setOwn({ state: 'idle' });
        if (multiline) grow();
      }}
      onBlur={() => {
        if (reasoned || readOnly) return;
        check(text);
        onCommit?.(text);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !multiline) {
          check(text);
          onCommit?.(text);
        } else e.continuePropagation();
      }}
      name={name}
      type={type}
      maxLength={maxLength}
      isRequired={required}
      isDisabled={disabled && !reasoned}
      isReadOnly={readOnly || reasoned}
      isInvalid={shown.state === 'error' || shown.state === 'attention'}
      validationBehavior="aria"
      autoFocus={autoFocus}
      aria-describedby={[describe['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined}
    >
      <FieldHead label={label} required={required} optional={optional} />
      <FieldHint hint={hint} />
      <div className="augur-field-box">
        {multiline ? (
          <TextArea ref={area} rows={rows} placeholder={placeholder} className="augur-input" aria-disabled={describe['aria-disabled']} />
        ) : (
          <Input placeholder={placeholder} className="augur-input" aria-disabled={describe['aria-disabled']} />
        )}
        <StateMark state={shown.state} />
      </div>
      {line(maxLength ? <span className="augur-count-text">{`${text.length} / ${maxLength}`}</span> : null)}
      {caption}
    </AriaTextField>
  );
}
