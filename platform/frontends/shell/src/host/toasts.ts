import type { ShellNotification } from '@augur/ui-kit';

/** How many toasts show at once; an older one goes when a new one comes. They all stay in the stream. */
export const MAX_TOASTS = 3;

export interface ShellToast {
  id: string;
  text: string;
  /** "Open" when it came from an app, so it can be opened from the toast as from the stream. */
  open: boolean;
}

/**
 * Whether a notification is also said once as a toast. It is only when the
 * person turned toasts on in Settings: by default the shell never opens
 * itself, and a notification only changes the status words and pulses the
 * point. A muted app's notifications stay silent either way.
 */
export function toastFor(n: ShellNotification, opts: { on: boolean; muted: readonly string[] }): ShellToast | null {
  if (!opts.on || opts.muted.includes(n.app)) return null;
  return { id: n.id, text: n.title, open: n.app !== 'platform' };
}

/** Adds a toast at the end, dropping the oldest past MAX_TOASTS, and any earlier one for the same notification. */
export const withToast = (list: readonly ShellToast[], t: ShellToast): ShellToast[] => [...list.filter((x) => x.id !== t.id), t].slice(-MAX_TOASTS);
