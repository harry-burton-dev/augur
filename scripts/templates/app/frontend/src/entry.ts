import { defineMicroFrontend, type MountContext } from '@platform/mfe-sdk';
import { html, render } from 'lit';
import '@platform/ui-kit';

/** Asks the app's own service, through the gateway, with the person's token. */
const greeting = async (ctx: MountContext) => {
  const res = await fetch('/api/__ID__/v1/greeting', { headers: { authorization: `Bearer ${await ctx.getToken()}` } });
  if (!res.ok) throw new Error(String(res.status));
  return ((await res.json()) as { message: string }).message;
};

const view = (ctx: MountContext, summary: string) =>
  html`<div style="max-width:var(--measure-read);margin:0 auto;padding:var(--space-7) var(--edge);display:flex;flex-direction:column;gap:var(--space-6)">
    <ui-heading eyebrow="__NAME__" heading=${`Hello, ${ctx.user.name.split(' ')[0]}`} summary=${summary}></ui-heading>
    <div>
      <ui-button kind="secondary" @click=${() => ctx.notify({ title: 'Hello from __NAME__' })}>Send a notification</ui-button>
    </div>
  </div>`;

/** __NAME__: what the shell mounts at /__ID__. */
export default defineMicroFrontend({
  async mount(el: HTMLElement, ctx: MountContext) {
    render(view(ctx, 'Asking the service…'), el);
    const summary = await greeting(ctx).catch(() => "The app's service isn't answering. Is it running?");
    render(view(ctx, summary), el);
  },
  unmount(el: HTMLElement) {
    render(html``, el);
  },
});
