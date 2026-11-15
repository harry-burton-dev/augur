import type { EventBus } from './contract.js';

/** Says that a handler threw without stopping the rest: the browser's own report (the console, `error` listeners). */
const report = (err: unknown) => {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(err);
  else setTimeout(() => { throw err; });
};

/**
 * The bus the shell hands each app. A handler that throws doesn't stop the others: each one runs, and the throw
 * is reported as an uncaught error is. As with the DOM's events, a handler added while a type is being emitted
 * waits for the next one, and a handler removed before its turn isn't called.
 */
export const createEventBus = (): EventBus => {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();
  return {
    emit(type, payload) {
      const set = handlers.get(type);
      if (!set) return;
      for (const handler of [...set]) {
        if (!set.has(handler)) continue;
        try {
          handler(payload);
        } catch (err) {
          report(err);
        }
      }
    },
    on(type, handler) {
      const set = handlers.get(type) ?? new Set();
      set.add(handler as (payload: unknown) => void);
      handlers.set(type, set);
      return () => set.delete(handler as (payload: unknown) => void);
    },
  };
};
