import { defineMicroFrontend, type MountContext } from '@augur/mfe-sdk';
import { createRoot, type Root } from 'react-dom/client';
import { Home } from './home.js';
import styles from './styles.css?inline';

export { HOME_CHANNEL, needsWords, type HomeState } from './home.js';

const roots = new WeakMap<HTMLElement, Root>();
const STYLE_ID = 'augur-home-styles';

/**
 * Home: the first place to look. The greeting, then every unread notification
 * that needs you, with its actions, then the glance cards apps contribute for
 * this floor. The shell owns all of it (notifications, mutes, the catalogue,
 * mounting each app's card); Home lays it out and passes on what's pressed.
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
    root.render(<Home ctx={ctx} />);
  },
  unmount(el: HTMLElement) {
    roots.get(el)?.unmount();
    roots.delete(el);
  },
});
