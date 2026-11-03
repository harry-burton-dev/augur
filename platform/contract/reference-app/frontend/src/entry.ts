import { defineMicroFrontend, type MountContext } from '@augur/mfe-sdk';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Glance, Reference } from './view.js';

/**
 * Uses every part of the mount context the SDK promises, and shows what it got
 * in data-check elements for tests/contract.spec.ts to read. Builds of this app
 * from past SDK releases are kept in frozen/, and must keep working in today's shell.
 * Since SDK 1.10 it is drawn the way apps are: React and Quill, both served by the shell.
 */
declare global {
  interface Window {
    referenceUnmounts?: number;
  }
}

const roots = new WeakMap<HTMLElement, Root>();
const draw = (el: HTMLElement, view: ReactElement) => {
  const root = createRoot(el);
  roots.set(el, root);
  root.render(view);
};
const clear = (el: HTMLElement) => {
  roots.get(el)?.unmount();
  roots.delete(el);
};

export default defineMicroFrontend({
  mount(el: HTMLElement, ctx: MountContext) {
    draw(el, createElement(Reference, { ctx }));
  },
  unmount(el: HTMLElement) {
    clear(el);
    window.referenceUnmounts = (window.referenceUnmounts ?? 0) + 1;
  },
  // SDK 1.2: a glance card, which Home places on the person's own floor.
  surfaces: {
    './Glance': {
      mount(el: HTMLElement, ctx: MountContext) {
        draw(el, createElement(Glance, { ctx }));
      },
      unmount(el: HTMLElement) {
        clear(el);
      },
    },
  },
});
