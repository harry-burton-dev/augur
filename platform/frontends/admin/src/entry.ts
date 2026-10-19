import { defineMicroFrontend, type MountContext } from '@platform/mfe-sdk';
import { html, render } from 'lit';
import '@platform/ui-kit';
import { AdminApi } from './api.js';
import './people.js';
import './departments.js';
import './apps.js';

/** Which screen a path inside Admin opens. Its Orbit lives at "/", so anything else falls back to People. */
export const screenFor = (path: string): { screen: 'people' | 'departments' | 'apps'; adding: boolean } => {
  const [first, second] = path.split('/').filter(Boolean);
  const screen = first === 'departments' || first === 'apps' ? first : 'people';
  return { screen, adding: second === 'new' };
};

/**
 * Admin: people, departments and apps, so nobody needs the sign-in service's
 * own console. Every change goes through the platform's services, which check
 * the caller is an admin and record it in the audit log.
 */
export default defineMicroFrontend({
  mount(el: HTMLElement, ctx: MountContext) {
    const api = new AdminApi(() => ctx.getToken());
    const { screen, adding } = screenFor(ctx.path);
    render(
      screen === 'people'
        ? html`<admin-people .api=${api} me=${ctx.user.id} ?adding=${adding}></admin-people>`
        : screen === 'departments'
          ? html`<admin-departments .api=${api} ?adding=${adding}></admin-departments>`
          : html`<admin-apps .api=${api}></admin-apps>`,
      el,
    );
  },
  unmount(el: HTMLElement) {
    render(html``, el);
  },
});
