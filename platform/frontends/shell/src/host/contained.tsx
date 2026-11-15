import { StateBoundary } from '@augur/shell-kit';
import type { ReactNode } from 'react';

/**
 * What a stopped part of AUGUR's own says: it's AUGUR's to fix, not the person's, and an admin is who passes it on
 * to whoever runs this AUGUR. Home says the same (platform/frontends/home).
 */
export const stoppedWords = (part: string, { rest }: { rest: boolean }) => ({
  heading: `${part} stopped`,
  body: `It's a fault in AUGUR, not in anything you did${rest ? ', and the rest of the screen still works' : ''}. An admin of this AUGUR can pass it on to whoever runs it: when it happened helps them find it.`,
});

/**
 * Holds a throw in one of the shell's own parts to that part (FE-3), with the kit's StateBoundary: the rest of the
 * screen keeps working, and the stopped part says so and who can put it right. An app's faults stop only its own
 * pane, as before.
 */
export function Contained({ part, resetOn, reload, onStopped, children }: {
  /** What a person calls the part, as it starts a sentence: "The Inbox", "AUGUR's screen". */
  part: string;
  /** Start again by itself when this changes (another section, another floor), as a fresh part would. */
  resetOn?: string | number;
  /** For the whole screen: Reload, since nothing outside it is left to draw it again. */
  reload?: () => void;
  /** Told of the throw, besides the console. */
  onStopped?: (err: unknown) => void;
  children: ReactNode;
}) {
  return (
    <StateBoundary
      key={resetOn}
      {...stoppedWords(part, { rest: !reload })}
      action={reload ? 'Reload' : 'Try again'}
      {...(reload ? { onReset: reload } : {})}
      size={reload ? 'page' : 'region'}
      onError={(err) => {
        console.error(`${part} stopped`, err);
        onStopped?.(err);
      }}
    >
      {children}
    </StateBoundary>
  );
}
