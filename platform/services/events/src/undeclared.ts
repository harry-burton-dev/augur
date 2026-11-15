import type { DeclaredEvents } from '@augur/service-kit';

/** How often the log says it again for one app and one side, while the app keeps calling. */
export const UNDECLARED_LOG_MS = 10 * 60_000;

/**
 * What an app on contract 3 or later that doesn't declare its reads, or declares no types it publishes, is told (PER-462).
 * It must: for this release it is only warned, and the release after refuses it. Undefined for any other app.
 */
export const undeclaredWarning = (app: string, declared: DeclaredEvents | undefined, what: 'reads' | 'publishes'): string | undefined => {
  if ((declared?.contract ?? 0) < 3) return undefined;
  if (what === 'reads' ? declared!.reads !== undefined : declared!.publishes.length > 0) return undefined;
  const field = `contributes.events.${what}`;
  return `${app} is on contract ${declared!.contract} but its manifest ${what === 'reads' ? 'doesn’t say what it reads' : 'declares no types it publishes'} (${field}). It must: from the next release this is refused. Its publisher adds ${field} to its manifest.`;
};

/** Logs each app's warning at most once per UNDECLARED_LOG_MS for each side, so a follower polling every second doesn't flood the log. */
export const undeclaredLog = (warn: (obj: object, msg: string) => void, now: () => number = Date.now) => {
  const last = new Map<string, number>();
  return (app: string, what: 'reads' | 'publishes') => {
    const key = `${app} ${what}`;
    const at = last.get(key);
    if (at !== undefined && now() - at < UNDECLARED_LOG_MS) return;
    last.set(key, now());
    warn({ app, field: `contributes.events.${what}` }, 'undeclared domain events');
  };
};
