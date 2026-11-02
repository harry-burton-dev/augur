import { Button, cx } from '@augur/kit-common';

/** One state of a lifecycle, in the words the app (or the org) uses for it. */
export interface LifecycleState {
  id: string;
  name: string;
}

export interface LifecycleProps {
  states: LifecycleState[];
  /** The state the record is in. */
  state: string;
  /** The states the person may move it to now. */
  moves?: string[];
  /** States off the main line, such as Retired: shown only while the record is in one. */
  offLine?: string[];
  /** Why the person can't move it, when they can't: "Only its library's leads can issue it." */
  why?: string;
  /** What the track is about, for screen readers: "Version 3". */
  label?: string;
  /** A move is under way: the buttons wait. */
  busy?: boolean;
  onMove?: (state: string) => void;
  className?: string;
}

/**
 * Where one record is in its lifecycle: every state in order, the ones it has
 * passed filled, the one it's in ringed and named, the rest hollow. Under the
 * track, a button for each state the person may move it to; with none, `why`
 * says what would let them. Take states from `@augur/records` so every app's
 * lifecycle reads the same (docs/app-patterns.md).
 */
export function Lifecycle({ states, state, moves = [], offLine = [], why, label, busy, onMove, className }: LifecycleProps) {
  const shown = states.filter((s) => !offLine.includes(s.id) || s.id === state);
  const at = shown.findIndex((s) => s.id === state);
  const name = (id: string) => states.find((s) => s.id === id)?.name ?? id;
  return (
    <div className={cx('quill-lifecycle', className)}>
      <ol aria-label={label ? `${label}: ${name(state)}` : name(state)}>
        {shown.map((s, i) => (
          <li key={s.id} data-at={i === at ? 'here' : i < at ? 'passed' : undefined} aria-current={i === at ? 'step' : undefined}>
            <span className="quill-lifecycle-disc" aria-hidden="true" />
            {s.name}
          </li>
        ))}
      </ol>
      {moves.length ? (
        <div className="quill-lifecycle-moves">
          {moves.map((m) => (
            <Button key={m} kind="secondary" size="sm" disabled={busy} reason="It’s moving now." onPress={() => onMove?.(m)}>
              Make it {name(m)}
            </Button>
          ))}
        </div>
      ) : why ? (
        <p className="quill-lifecycle-why">{why}</p>
      ) : null}
    </div>
  );
}
