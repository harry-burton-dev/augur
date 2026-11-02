import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, ms } from '@augur/kit-common';

export interface ToastItem {
  id: string;
  /** What just happened, in a few words ("Archived 3 records"). */
  text: string;
  /** One way to change your mind ("Undo"). */
  action?: { label: string; onPress: () => void };
}

export interface ToastsProps {
  toasts: ToastItem[];
  /** The toast went: by itself, closed, or its action was pressed. */
  onDone: (id: string) => void;
}

function Toast({ toast, onDone }: { toast: ToastItem; onDone: (id: string) => void }) {
  const [held, setHeld] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (held) return;
    timer.current = setTimeout(() => onDone(toast.id), ms('motion-toast'));
    return () => clearTimeout(timer.current);
  }, [held, toast.id, onDone]);
  return (
    <li
      className="aerie-toast"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHeld(false)}
    >
      <span className="aerie-toast-text">{toast.text}</span>
      {toast.action ? (
        <Button
          kind="tertiary"
          size="sm"
          onPress={() => {
            toast.action!.onPress();
            onDone(toast.id);
          }}
        >
          {toast.action.label}
        </Button>
      ) : null}
      <IconButton icon="close" label="Close" size="sm" onPress={() => onDone(toast.id)} />
    </li>
  );
}

/**
 * What just happened, said once at the bottom of the screen above everything
 * (`layer-toast`), with one way to change your mind. Each goes by itself after
 * `motion-toast`, and holds while it's hovered or focused. Apps ask the shell
 * for one; they never draw their own.
 */
export function Toasts({ toasts, onDone }: ToastsProps) {
  return (
    <ol className="aerie-toasts" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDone={onDone} />
      ))}
    </ol>
  );
}
