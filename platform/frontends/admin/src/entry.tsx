import { defineMicroFrontend, type MountContext } from '@augur/mfe-sdk';
import { createRoot, type Root } from 'react-dom/client';
import { AdminApi } from './api.js';
import { AdminApp } from './app.js';
import styles from './styles.css?inline';

export { screenFor } from './app.js';

const roots = new WeakMap<HTMLElement, Root>();
const STYLE_ID = 'augur-admin-styles';

/**
 * Admin: people, departments, apps, and the platform's status, line and activity. Every read and
 * change goes to the platform's services through the gateway, with the caller's token.
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
    root.render(<AdminApp api={new AdminApi(() => ctx.getToken())} me={ctx.user.id} path={ctx.path} />);
  },
  unmount(el: HTMLElement) {
    roots.get(el)?.unmount();
    roots.delete(el);
  },
});
