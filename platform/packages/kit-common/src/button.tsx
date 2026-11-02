import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button as AriaButton, type ButtonProps as AriaButtonProps, type PressEvent } from 'react-aria-components';
import { cx } from './cx.js';
import { useReason, warnNoReason } from './reason.js';
import { ms } from './timing.js';

export type ButtonKind = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<AriaButtonProps, 'isDisabled' | 'isPending' | 'children' | 'className' | 'style'> {
  /** One primary per screen. Danger asks twice. */
  kind?: ButtonKind;
  size?: 'md' | 'sm';
  /** Marks an action that asks the AI (Bubble). Only primary and secondary take it. */
  ai?: boolean;
  disabled?: boolean;
  /** Why it is disabled, in one sentence. With one, it stays focusable and the reason shows on hover and focus. */
  reason?: string;
  /** Working: the press is taken but does nothing more, and it says so. */
  busy?: boolean;
  /** What it says while busy, in place of its label. */
  busyLabel?: string;
  /** Danger only: act on the first press, for a danger button already inside a confirmation. */
  once?: boolean;
  /** Danger only: how long a first press stays armed, in ms. Defaults to the `motion-still` token. */
  armFor?: number;
  className?: string;
  /** The label: name it for what it does ("Publish", never "OK"). */
  children?: ReactNode;
}

/**
 * A labelled action, set in tracked capitals. Its press, focus and keyboard
 * behaviour come from React Aria. A danger button asks twice: the first press
 * arms it ("Press again to confirm"), a second within `armFor` acts, and Esc,
 * leaving it or the time running out puts it back.
 */
export function Button({ kind = 'secondary', size = 'md', ai, disabled, reason, busy, busyLabel, once, armFor, className, children, onPress, ...rest }: ButtonProps) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { reasoned, describe, caption } = useReason(disabled, reason);
  const asks = kind === 'danger' && !once;
  const hold = armFor ?? ms('motion-still');
  const key = useRef({});
  warnNoReason(key.current, `Button "${typeof children === 'string' ? children : kind}"`, disabled, reason);

  const disarm = () => {
    clearTimeout(timer.current);
    setArmed(false);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const press = (e: PressEvent) => {
    if (disabled || busy) return;
    if (asks && !armed) {
      setArmed(true);
      timer.current = setTimeout(disarm, hold);
      return;
    }
    disarm();
    onPress?.(e);
  };

  return (
    <span className={cx('augur-control relative inline-block', className)}>
      <AriaButton
        {...rest}
        {...describe}
        isDisabled={disabled && !reasoned}
        isPending={busy}
        onPress={press}
        onBlur={(e) => {
          disarm();
          rest.onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && armed) {
            e.preventDefault();
            e.stopPropagation();
            disarm();
          } else e.continuePropagation();
          rest.onKeyDown?.(e);
        }}
        data-kind={kind}
        data-size={size}
        data-armed={armed || undefined}
        data-ai={(ai && (kind === 'primary' || kind === 'secondary')) || undefined}
        data-unavailable={disabled || undefined}
        aria-live={kind === 'danger' ? 'polite' : undefined}
        className="augur-button relative inline-flex items-center justify-center gap-2 rounded-pill font-sans whitespace-nowrap uppercase cursor-pointer select-none text-meta tracking-caps outline-none"
      >
        {busy ? <span className="augur-spinner" aria-hidden="true" /> : null}
        {armed ? (
          <>
            <span>Press again to confirm</span>
            <span className="augur-count" style={{ animationDuration: `${hold}ms` }} aria-hidden="true" />
          </>
        ) : busy && busyLabel ? (
          <span>{busyLabel}</span>
        ) : (
          children
        )}
      </AriaButton>
      {caption}
    </span>
  );
}
