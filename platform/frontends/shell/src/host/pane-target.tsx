import { useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

/**
 * Where the open app's pane goes (DR): the Shell draws a slot for it at the window's right edge and hands
 * over what goes at its top (the clock and the notification indicator) and whether it opens over the page.
 * The app's frame (worker-host.tsx) runs in a root of its own, so it reaches the slot through this store and
 * draws the pane into it with a portal.
 */
export interface PaneTarget {
  el: HTMLElement | null;
  top: ReactNode;
  over: boolean;
}

const EMPTY: PaneTarget = { el: null, top: null, over: false };
let now: PaneTarget = EMPTY;
const listeners = new Set<() => void>();
const set = (next: PaneTarget) => {
  now = next;
  for (const f of listeners) f();
};
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => void listeners.delete(f);
};
const get = () => now;

/** The slot the Shell draws: it publishes itself, with what goes at the pane's top, on every draw. */
export function PaneSlot({ top, over }: { top: ReactNode; over: boolean }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => set({ el, top, over }));
  useLayoutEffect(() => () => set(EMPTY), []);
  return <div ref={setEl} className="app-pane-target" />;
}

/** The slot the pane goes in now, if the Shell is drawing one. */
export const usePaneTarget = () => useSyncExternalStore(subscribe, get, get);
