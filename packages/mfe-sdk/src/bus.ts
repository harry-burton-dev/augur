import type { EventBus } from './contract.js';

export const createEventBus = (): EventBus => {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();
  return {
    emit(type, payload) {
      for (const handler of handlers.get(type) ?? []) handler(payload);
    },
    on(type, handler) {
      const set = handlers.get(type) ?? new Set();
      set.add(handler as (payload: unknown) => void);
      handlers.set(type, set);
      return () => set.delete(handler as (payload: unknown) => void);
    },
  };
};
