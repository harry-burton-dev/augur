import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import { quill } from './quill.js';
import type { Slot, View } from './view.js';

/** What a page shows while something it needs is on its way, or couldn't be read: nothing when it's there. */
export const waiting = (slots: Slot<unknown>[], heading: string, size: 'page' | 'region' = 'page'): RemoteNode | undefined => {
  const failed = slots.find((s) => s.error);
  if (failed) return quill('quill-state', { kind: 'error', heading, body: failed.error, size });
  if (slots.some((s) => s.value === undefined)) return quill('quill-state', { kind: 'loading', heading, size });
  return undefined;
};

/** Why a change pressed at `where` didn't work, and what one that acts at once did. */
export const said = (v: View, where: string): RemoteNode => [
  v.ui.problem?.where === where ? quill('quill-notice', { tone: 'refused' }, v.ui.problem.words) : null,
  v.ui.done?.where === where ? quill('quill-notice', { tone: 'info' }, v.ui.done.words) : null,
];

/** A control that can't be used now, saying why; nothing when it can. */
export const off = (why: string | false | undefined) => (why ? { disabled: true, reason: why } : {});

/** The open question's busy state and error, and closing it back to `back`. */
export const asking = (v: View, back: string) => ({ open: true, busy: v.ui.dialog.busy, error: v.ui.dialog.error, onClose: () => v.on.go(back) });

/** A secret or password shown once, straight after it's made. */
export const shownOnce = (v: View): RemoteNode => {
  const s = v.ui.shown;
  if (!s) return null;
  return quill('quill-dialog', { open: true, size: 'glance', heading: s.heading, summary: s.summary, cancelLabel: 'Done', onClose: () => ((v.ui.shown = undefined), v.on.draw()) }, [
    quill('quill-text-field', { label: s.label, value: s.value, readOnly: true }),
    quill('quill-notice', { tone: 'warning' }, 'It won’t be shown again. If it’s lost, make a new one.'),
  ]);
};

/** "3 people", "1 person". */
export const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
