import { Button, IconButton, type ButtonKind } from '@augur/kit-common';

export interface SelectionAction {
  id: string;
  label: string;
  /** Destroys something: it asks twice. */
  danger?: boolean;
  /** Can't be done to what's picked: it stays, and says why. */
  disabled?: boolean;
  reason?: string;
}

export interface SelectionBarProps {
  /** How many are picked. The bar shows only while it's one or more. */
  count: number;
  /** What they are: one, then several ("record", "records"). */
  noun: [string, string];
  /** At most four; the main one first, danger last. */
  actions: SelectionAction[];
  onAction: (id: string) => void;
  /** Unpick them all. */
  onClear: () => void;
}

/**
 * What to do with several things picked at once, across cards, tiles and
 * tables. It rises at the bottom of the main column while anything is picked.
 */
export function SelectionBar({ count, noun, actions, onAction, onClear }: SelectionBarProps) {
  if (count < 1) return null;
  return (
    <div className="quill-selection" role="toolbar" aria-label={`${count} ${count === 1 ? noun[0] : noun[1]} picked`}>
      <span className="quill-selection-count" aria-live="polite">{`${count} ${count === 1 ? noun[0] : noun[1]} picked`}</span>
      <span className="quill-selection-actions">
        {actions.map((a, i) => (
          <Button
            key={a.id}
            kind={(a.danger ? 'danger' : i === 0 ? 'secondary' : 'ghost') as ButtonKind}
            size="sm"
            disabled={a.disabled}
            reason={a.reason}
            onPress={() => onAction(a.id)}
          >
            {a.label}
          </Button>
        ))}
      </span>
      <IconButton icon="close" label="Unpick all" size="sm" onPress={onClear} />
    </div>
  );
}
