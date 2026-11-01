import { useId, type ReactNode } from 'react';

/**
 * Nothing is obtuse (docs/shell-principles.md): a control that can't be used now
 * stays where it is, stays focusable, and says why in one sentence: who can,
 * what it's waiting for, or what would turn it on. The reason shows under the
 * control on hover and focus, and is read with it.
 */
export function useReason(disabled: boolean | undefined, reason: string | undefined) {
  const id = useId();
  const reasoned = Boolean(disabled && reason);
  return {
    reasoned,
    /** Props for the control: still in the tab order, but announced as unavailable, with the reason as its description. */
    describe: reasoned ? { 'aria-disabled': true as const, 'aria-describedby': id } : {},
    caption: reasoned ? <Reason id={id}>{reason}</Reason> : null,
  };
}

function Reason({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} role="tooltip" className="augur-reason">
      {children}
    </span>
  );
}

const told = new WeakSet<object>();

/** Whether the kit tells developers about a disabled control that doesn't say why: on localhost, or with `data-kit-dev` on <html>. */
export const kitDev = () =>
  typeof document !== 'undefined' &&
  (document.documentElement.dataset.kitDev === 'true' ||
    (document.documentElement.dataset.kitDev !== 'false' && typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)));

/** Warn once per control, in development, when it is disabled without a reason. */
export const warnNoReason = (key: object, what: string, disabled: boolean | undefined, reason: string | undefined) => {
  if (!disabled || reason || told.has(key) || !kitDev()) return;
  told.add(key);
  console.warn(`AUGUR kit: ${what} is disabled without a reason. Say why in one sentence with reason="…" (Nothing is obtuse).`);
};
