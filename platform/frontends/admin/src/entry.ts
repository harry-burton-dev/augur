import { defineMicroFrontend, type MountContext } from '@augur/mfe-sdk';
import { html, render } from 'lit';
import '@augur/ui-kit';
import { AdminApi } from './api.js';
import './people.js';
import './departments.js';
import './apps.js';
import './status.js';
import './activity.js';
import './agents.js';

const screens = ['people', 'departments', 'apps', 'status', 'activity', 'agents'] as const;

/** Which screen a path inside Admin opens. Its Orbit lives at "/", so anything else falls back to People. */
export const screenFor = (path: string): { screen: (typeof screens)[number]; adding: boolean } => {
  const [first, second] = path.split('/').filter(Boolean);
  const screen = screens.find((s) => s === first) ?? 'people';
  return { screen, adding: second === 'new' };
};

/**
 * Admin: people, departments, apps, the platform's status and activity, and whether agents can use AI, so nobody needs
 * the sign-in service's own console or the command line. Every change goes through the platform's services, which check
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
          : screen === 'apps'
            ? html`<admin-apps .api=${api}></admin-apps>`
            : screen === 'status'
              ? html`<admin-status .api=${api}></admin-status>`
              : screen === 'agents'
                ? html`<admin-agents .api=${api}></admin-agents>`
                : html`<admin-activity .api=${api}></admin-activity>`,
      el,
    );
  },
  unmount(el: HTMLElement) {
    render(html``, el);
  },
});
