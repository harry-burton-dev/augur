import { useRef, useState } from 'react';
import { Switch } from 'react-aria-components';
import { cx } from './cx.js';
import { useValue } from './field.js';
import { Icon } from './icon.js';
import { useReason, warnNoReason } from './reason.js';

export interface ToggleProps {
  label: string;
  hint?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  /**
   * Applies the change. Return a Promise and the toggle shows saving until it
   * settles; reject and it turns back and says why (the error's message, or a
   * plain sentence when it has none).
   */
  onChange?: (checked: boolean) => void | Promise<unknown>;
  disabled?: boolean;
  /** Why it can't be changed, in one sentence. */
  reason?: string;
  /** The words beside the switch. */
  onWord?: string;
  offWord?: string;
  name?: string;
  className?: string;
}

/**
 * On or off, and you can always tell which: the track fills with ink, the knob
 * moves, its mark turns from a dash to a tick, and the word changes. A toggle
 * acts at once; a choice that waits for a form's primary is a Checkbox.
 */
export function Toggle({ label, hint, checked, defaultChecked = false, onChange, disabled, reason, onWord = 'On', offWord = 'Off', name, className }: ToggleProps) {
  const [on, setOn] = useValue(checked, defaultChecked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { reasoned, describe, caption } = useReason(disabled, reason);
  const key = useRef({});
  warnNoReason(key.current, `Toggle "${label}"`, disabled, reason);

  const flip = async (next: boolean) => {
    if (disabled || busy) return;
    setOn(next);
    try {
      const pending = onChange?.(next);
      if (pending instanceof Promise) {
        setBusy(true);
        await pending;
      }
      setError('');
    } catch (err) {
      setOn(!next);
      const said = err instanceof Error && err.message ? err.message : '';
      setError(said || `Couldn’t change that. It’s still ${(next ? offWord : onWord).toLowerCase()}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cx('augur-toggle augur-control relative', className)} data-unavailable={disabled || undefined}>
      <Switch
        {...describe}
        isSelected={on}
        onChange={flip}
        isDisabled={disabled && !reasoned}
        isReadOnly={reasoned || busy}
        name={name}
        aria-busy={busy || undefined}
        data-busy={busy || undefined}
        className="augur-toggle-row"
      >
        <span className="augur-toggle-text">
          <span className="augur-toggle-label">{label}</span>
          {hint ? <span className="augur-hint">{hint}</span> : null}
        </span>
        <span className="augur-toggle-control">
          <span className="augur-toggle-word" aria-hidden="true">
            {on ? onWord : offWord}
          </span>
          <span className="augur-switch">
            <span className="augur-knob">{on ? <Icon name="check" size={13} /> : <i className="augur-knob-off" />}</span>
          </span>
        </span>
      </Switch>
      {error ? (
        <p className="augur-message" data-state="error" role="alert">
          {error}
        </p>
      ) : null}
      {caption}
    </div>
  );
}
