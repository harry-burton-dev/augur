import { defineMicroFrontend, type MountContext } from '@platform/mfe-sdk';
import { html, render } from 'lit';
import '@platform/ui-kit';

const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

/** Home: where someone lands. For now it greets them and proves the shell's notify path end to end. */
export default defineMicroFrontend({
  mount(el: HTMLElement, ctx: MountContext) {
    const first = ctx.user.name.split(' ')[0];
    render(
      html`<div style="max-width:var(--measure-read);margin:0 auto;padding:var(--space-7) var(--edge);display:flex;flex-direction:column;gap:var(--space-6)">
        <ui-heading eyebrow=${ctx.user.departments[0] ?? ''} heading=${`${greeting(new Date().getHours())}, ${first}`} summary="Nothing needs you right now."></ui-heading>
        <div>
          <ui-button kind="secondary" @click=${() => ctx.notify({ title: 'This is a test notification', body: 'Sent from Home', needsYou: true })}>
            Send a test notification
          </ui-button>
        </div>
      </div>`,
      el,
    );
  },
  unmount(el: HTMLElement) {
    render(html``, el);
  },
});
