import { defineMicroFrontend, type MountContext } from '@augur/mfe-sdk';
import '@augur/ui-kit';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './app.js';
import styles from './styles.css?inline';

const roots = new WeakMap<HTMLElement, Root>();
const STYLE_ID = 'augur-upgrades-styles';

/**
 * The Upgrade Centre (ADR 0030): what this deployment runs, what's on offer, and
 * how each unit moves. Every read and change goes to the registry through the gateway.
 */
export default defineMicroFrontend({
  mount(el: HTMLElement, ctx: MountContext) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = styles;
      document.head.append(style);
    }
    const root = createRoot(el);
    roots.set(el, root);
    root.render(<App ctx={ctx} />);
  },
  unmount(el: HTMLElement) {
    roots.get(el)?.unmount();
    roots.delete(el);
  },
});
