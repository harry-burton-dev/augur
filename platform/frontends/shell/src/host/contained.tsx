import { StateBoundary } from '@augur/shell-kit';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { productName } from './menus.js';

/**
 * What a stopped part of the shell says: the fault is the deployment's to fix, not the person's, and an admin is who
 * passes it on to whoever runs it. Home says the same in its own words (platform/frontends/home/src/entry.tsx).
 */
export const stoppedWords = (part: string, { rest, product = productName() }: { rest: boolean; product?: string }) => ({
  heading: `${part} stopped`,
  body: `It's a fault in ${product}, not in anything you did${rest ? ', and the rest of the screen still works' : ''}. An admin of ${product} here can pass it on to whoever runs it: when it happened helps them find it.`,
});

/** Reported as an uncaught error is, so the deployment's browser telemetry (ADR 0059) hears of it. */
const reportStopped = (err: unknown) => {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(err);
};

/**
 * Holds a throw in one of the shell's own parts to that part (FE-3), with the kit's StateBoundary: the rest of the
 * screen keeps working, and the stopped part says so and who can put it right. An app's faults stop only its own
 * pane, as before.
 */
export function Contained({ part, resetOn, again, onStopped = reportStopped, page = false, children }: {
  /** What a person calls the part, as it starts a sentence: "The Inbox". */
  part: string;
  /** Once stopped, it starts again by itself when this changes (a new notice, another section). Changes while it works do nothing. */
  resetOn?: unknown;
  /** In place of Try again: Reload for the whole screen, or Close for a part over it. Pressing it also draws the part again. */
  again?: { label: string; onPress: () => void };
  /** Told of the throw. By default it's reported as an uncaught error is, for the console and telemetry. */
  onStopped?: (err: unknown) => void;
  /** The part is the whole screen. */
  page?: boolean;
  children: ReactNode;
}) {
  const [round, setRound] = useState(0);
  const stoppedOn = useRef<{ on: unknown } | null>(null);
  useEffect(() => {
    if (stoppedOn.current && !Object.is(stoppedOn.current.on, resetOn)) {
      stoppedOn.current = null;
      setRound((n) => n + 1);
    }
  }, [resetOn]);
  return (
    <StateBoundary
      key={round}
      {...stoppedWords(part, { rest: !page })}
      action={again?.label ?? 'Try again'}
      onReset={() => {
        stoppedOn.current = null;
        again?.onPress();
      }}
      size={page ? 'page' : 'region'}
      onError={(err) => {
        stoppedOn.current = { on: resetOn };
        onStopped(err);
      }}
    >
      {children}
    </StateBoundary>
  );
}
