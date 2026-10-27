import { defineMicroFrontend, type MountContext } from '@augur/mfe-sdk';
import { html, render } from 'lit';
import '@augur/ui-kit';
import { AtlasApi, pathFor, placeFor, type Place } from './api.js';
import './atlas-app.js';

/**
 * Where Data Atlas is in the address bar, so a place in it can be shared, and
 * Back goes to the last one: the shell mounts it again with that path.
 */
export const addressFor = (pathname: string, mountedAt: string, place: Place) => {
  const inner = mountedAt === '/' ? '' : mountedAt;
  if (!pathname.endsWith(inner)) return undefined;
  return `${pathname.slice(0, pathname.length - inner.length)}${pathFor(place)}`;
};

/** Data Atlas: the things the organisation knows about. What the shell mounts at /atlas. */
export default defineMicroFrontend({
  mount(el: HTMLElement, ctx: MountContext) {
    let mountedAt = ctx.path;
    const moved = (e: CustomEvent<Place>) => {
      const to = addressFor(window.location.pathname, mountedAt, e.detail);
      if (!to || to === window.location.pathname) return;
      window.history.pushState(window.history.state, '', to);
      mountedAt = pathFor(e.detail);
    };
    render(
      html`<atlas-app
        .api=${new AtlasApi((path, init) => ctx.fetch(path, init))}
        floor-name=${ctx.workspace.name}
        floor-kind=${ctx.workspace.kind}
        .place=${placeFor(ctx.path)}
        @atlas-place=${moved}
      ></atlas-app>`,
      el,
    );
  },
  unmount(el: HTMLElement) {
    render(html``, el);
  },
});
