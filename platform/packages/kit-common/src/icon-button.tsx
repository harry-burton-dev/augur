import type { ReactNode } from 'react';
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import { cx } from './cx.js';
import { Icon, type IconName } from './icon.js';
import { useReason } from './reason.js';

export interface IconButtonProps extends Omit<AriaButtonProps, 'isDisabled' | 'children' | 'className' | 'style'> {
  /** The icon, by AUGUR's name for it. */
  icon: IconName;
  /** What it does, in a word or two: read aloud, and shown on hover and focus. */
  label: string;
  size?: 'md' | 'sm';
  ai?: boolean;
  disabled?: boolean;
  /** Why it is disabled, in one sentence; it then shows instead of the label. */
  reason?: string;
  className?: string;
  children?: ReactNode;
}

/** A named icon in a round target. Its name shows on hover and focus, so an icon is never the only clue. */
export function IconButton({ icon, label, size = 'md', ai, disabled, reason, className, onPress, ...rest }: IconButtonProps) {
  const { reasoned, describe, caption } = useReason(disabled, reason);
  return (
    <span className={cx('augur-control relative inline-block', className)}>
      <AriaButton
        {...rest}
        {...describe}
        aria-label={label}
        isDisabled={disabled && !reasoned}
        onPress={(e) => (disabled ? undefined : onPress?.(e))}
        data-size={size}
        data-ai={ai || undefined}
        data-unavailable={disabled || undefined}
        className="augur-icon-button relative inline-flex items-center justify-center rounded-pill text-ink cursor-pointer outline-none"
      >
        <Icon name={icon} size={size === 'sm' ? 18 : 20} />
      </AriaButton>
      {caption ?? (
        <span className="augur-reason augur-name" aria-hidden="true">
          {label}
        </span>
      )}
    </span>
  );
}
