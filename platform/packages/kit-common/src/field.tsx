import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Label, Text } from 'react-aria-components';
import { Icon } from './icon.js';

/**
 * Where a field stands. Missing is not wrong: a required field left empty asks
 * in green (`attention`, "Needs you"); only content that is wrong is `error`.
 */
export type FieldState = 'idle' | 'attention' | 'error' | 'warning' | 'valid';

export interface FieldCheck {
  state: Exclude<FieldState, 'idle' | 'attention'>;
  message?: string;
}

/** What every field takes, whatever it writes or picks. */
export interface FieldProps {
  /** Its name, shown above it. Every field has one. */
  label: string;
  /** One quiet line under the label: what goes here, or an example. */
  hint?: string;
  /** Marks it Required, and asks for it in green when it's left empty. */
  required?: boolean;
  /** Marks it Optional. Use one or the other across a form, the one that's rarer. */
  optional?: boolean;
  disabled?: boolean;
  /** Why it can't be changed, in one sentence. With one, the field stays focusable and says so. */
  reason?: string;
  /** Set from outside: wins over the field's own check while it's not idle. */
  state?: FieldState;
  /** The line under the field for that state. */
  message?: string;
  className?: string;
}

/** The text the kit says when a required field is left empty. */
export const NEEDS_YOU = 'Needs you.';

/** A controlled value when one is given, the field's own otherwise. */
export function useValue<T>(value: T | undefined, initial: T, onChange?: (next: T) => void) {
  const [own, setOwn] = useState(initial);
  const current = value === undefined ? own : value;
  const set = (next: T) => {
    if (value === undefined) setOwn(next);
    onChange?.(next);
  };
  return [current, set] as const;
}

/** The label row: the label, then Required (a dot that asks in green) or Optional. */
export function FieldHead({ label, required, optional }: Pick<FieldProps, 'label' | 'required' | 'optional'>) {
  return (
    <div className="augur-field-head">
      <Label className="augur-field-label">{label}</Label>
      {required ? (
        <span className="augur-flag">
          <i className="augur-dot" aria-hidden="true" />
          Required
        </span>
      ) : optional ? (
        <span className="augur-flag">Optional</span>
      ) : null}
    </div>
  );
}

export const FieldHint = ({ hint }: { hint?: string }) =>
  hint ? (
    <Text slot="description" className="augur-hint">
      {hint}
    </Text>
  ) : null;

/** The mark at the end of a field's line for its state. */
export function StateMark({ state }: { state: FieldState }) {
  const name = state === 'error' ? 'error' : state === 'warning' ? 'warning' : state === 'valid' ? 'check' : null;
  return <span className="augur-state-mark" aria-hidden="true">{name ? <Icon name={name} size={16} /> : null}</span>;
}

/** The line under a field: its state's message, read as it changes. */
export function useMessage(message: string | undefined) {
  const id = useId();
  return {
    describedBy: message ? id : undefined,
    line: (extra?: ReactNode) => (
      <div className="augur-field-foot">
        <p className="augur-message" id={id} aria-live="polite">
          {message}
        </p>
        {extra}
      </div>
    ),
  };
}

/** The state to show: the one set from outside while it isn't idle, then the field's own check, then idle with any message given. */
export const shownState = (state: FieldState | undefined, message: string | undefined, own: { state: FieldState; message?: string }) =>
  state && state !== 'idle' ? { state, message } : own.state !== 'idle' ? own : { state: 'idle' as FieldState, message };

/** What a field tells the form around it, so the form's primary can check every field and go to the first gap. */
export interface FieldChecker {
  /** Check now and show the result. True when nothing needs fixing. */
  check(): boolean;
  focus(): void;
  name?: string;
  value(): string;
}

/** The fields inside a form (a Dialog's, for one), in the order they mounted. */
export const FieldChecks = createContext<Set<{ current: FieldChecker }> | null>(null);

/** Tell the surrounding form about this field, if there is one. */
export function useFieldCheck(checker: FieldChecker) {
  const checks = useContext(FieldChecks);
  const latest = useRef(checker);
  latest.current = checker;
  useEffect(() => {
    if (!checks) return;
    checks.add(latest);
    return () => {
      checks.delete(latest);
    };
  }, [checks]);
}
