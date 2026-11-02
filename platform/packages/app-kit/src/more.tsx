import { Button } from '@augur/kit-common';

export interface MoreProps {
  /** How many are showing. */
  shown: number;
  /** How many there are in all. */
  total: number;
  /** What they are, plural ("records"). */
  noun: string;
  /** How many the next press adds. */
  step?: number;
  onMore: () => void;
  /** Fetching the next lot. */
  busy?: boolean;
}

/** Under a long list or table: how many of how many are showing, and a button for more. Nothing shows when they all are. */
export function More({ shown, total, noun, step = 50, onMore, busy }: MoreProps) {
  if (shown >= total) return null;
  const next = Math.min(step, total - shown);
  return (
    <div className="quill-more" role="status">
      <span className="quill-more-count">{`Showing ${shown} of ${total} ${noun}`}</span>
      <Button kind="secondary" size="sm" busy={busy} busyLabel="Loading" onPress={onMore}>
        {`Show ${next} more`}
      </Button>
    </div>
  );
}
