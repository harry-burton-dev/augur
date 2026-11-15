import { defineMicroFrontend, type MountContext } from '@augur/mfe-sdk';
import { StateBoundary } from '@augur/app-kit';
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
    // A throw in Home stops only Home (FE-3): the rail and the apps still work, and it says whose fault it is.
    // The same words as the shell's own stopped parts (shell/src/host/contained.tsx).
    root.render(
      <StateBoundary
        heading="Home stopped"
        body="It's a fault in AUGUR, not in anything you did, and the rest of the screen still works. An admin of this AUGUR can pass it on to whoever runs it: when it happened helps them find it."
        action="Try again"
        onError={(err) => console.error('Home stopped', err)}
      >
        <Home ctx={ctx} />
      </StateBoundary>,
    );
  },
  unmount(el: HTMLElement) {
    roots.get(el)?.unmount();
    roots.delete(el);
  },
});
