import type { EventBus } from './contract.js';

type Handler = (payload: unknown) => unknown;

/** The browser's own report of an uncaught error (the console, `error` listeners), without stopping anything. */
const report = (err: unknown) => {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(err);
  else setTimeout(() => { throw err; });
};

/** How a bus made with createEventBus deals with a handler that fails. */
export interface EventBusOptions {
  /**
   * Told of each handler that threw, or whose promise rejected, with the type it was handling, once the others
   * have run. By default the error is reported as an uncaught one is (`reportError`). The test context's bus
   * throws it instead, so a failing check in a handler fails the test.
   */
  onError?: (err: unknown, type: string) => void;
}

/**
 * The bus the shell hands each app. A handler that throws doesn't stop the others: each one runs, then
 * `onError` hears of the throw, as it does of a rejected promise from an async handler. As with the DOM's events,
 * a handler is held once however often it's added, one added while its type is being emitted waits for the next
 * emit, and one removed before its turn isn't called.
 */
export const createEventBus = ({ onError = (err) => report(err) }: EventBusOptions = {}): EventBus => {
  // Each handler's registration is an object of its own, so one removed and added again during an emit is new.
  const handlers = new Map<string, Map<Handler, { handler: Handler }>>();
  return {
    emit(type, payload) {
      const held = handlers.get(type);
      if (!held) return;
      const failed: unknown[] = [];
      for (const entry of [...held.values()]) {
        if (held.get(entry.handler) !== entry) continue;
        try {
          const result = entry.handler(payload);
          if (result instanceof Promise) result.catch((err: unknown) => onError(err, type));
        } catch (err) {
          failed.push(err);
        }
      }
      for (const err of failed) onError(err, type);
    },
    on(type, handler) {
      const fn = handler as Handler;
      let held = handlers.get(type);
      if (!held) handlers.set(type, (held = new Map()));
      const entry = held.get(fn) ?? { handler: fn };
      held.set(fn, entry);
      return () => {
        const now = handlers.get(type);
        if (now?.get(fn) !== entry) return;
        now.delete(fn);
        if (now.size === 0) handlers.delete(type);
      };
    },
  };
};
