import { defineMicroFrontend, isIntentCancelled, type MountContext } from '@platform/mfe-sdk';
import { html, render } from 'lit';
import '@platform/ui-kit';

interface Label {
  name: string;
  hex: string;
}

const page = 'max-width:var(--measure-read);margin:0 auto;padding:var(--space-7) var(--edge);display:flex;flex-direction:column;gap:var(--space-6)';
const chip = (hex: string) => `display:inline-flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-4);border-radius:999px;border:1px solid ${hex};color:var(--ink)`;

/**
 * Board, a sample app. It needs a colour for each new label and asks for one
 * with the colour.pick intent. It never names or imports the app that answers
 * (Palette, today); the shell finds whichever app handles colour.pick.
 */
export default defineMicroFrontend({
  mount(el: HTMLElement, ctx: MountContext) {
    const labels: Label[] = [];
    let note = '';

    const addLabel = async () => {
      try {
        const colour = await ctx.request<{ name: string; hex: string }>({ type: 'colour.pick', payload: { purpose: 'the new label' } });
        labels.push(colour);
        note = '';
      } catch (err) {
        // Closing the picker is a choice, not a failure.
        note = isIntentCancelled(err) ? '' : (err as Error).message;
      }
      draw();
    };

    const draw = () =>
      render(
        html`<div style=${page}>
          <ui-heading eyebrow="Sample app" heading="Board" summary="Each label gets a colour from whichever app answers colour.pick."></ui-heading>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-3)" data-labels>
            ${labels.length
              ? labels.map((l) => html`<span style=${chip(l.hex)}><i style=${`width:12px;height:12px;border-radius:50%;background:${l.hex}`}></i>${l.name}</span>`)
              : html`<span style="color:var(--ink-muted)">No labels yet.</span>`}
          </div>
          ${note ? html`<p role="alert" style="margin:0;color:var(--danger, var(--ink))">${note}</p>` : ''}
          <div style="display:flex;gap:var(--space-4)">
            <ui-button kind="primary" data-add @click=${addLabel}>Add a label</ui-button>
            <ui-button kind="secondary" data-browse @click=${() => ctx.raise({ type: 'colour.pick', payload: {} }).catch(() => undefined)}>Browse colours</ui-button>
          </div>
        </div>`,
        el,
      );

    draw();
  },
  unmount(el: HTMLElement) {
    render(html``, el);
  },
});
