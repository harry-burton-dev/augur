import { defineMicroFrontend, type MountContext } from '@platform/mfe-sdk';
import { html, render } from 'lit';
import '@platform/ui-kit';

export interface Colour {
  name: string;
  hex: string;
}

export const colours: Colour[] = [
  { name: 'Moss', hex: '#4a8f6d' },
  { name: 'Harbour', hex: '#3d6f9e' },
  { name: 'Ochre', hex: '#c99a3b' },
  { name: 'Brick', hex: '#b5543c' },
  { name: 'Heather', hex: '#8a6fa8' },
];

const page = 'max-width:var(--measure-read);margin:0 auto;padding:var(--space-7) var(--edge);display:flex;flex-direction:column;gap:var(--space-6)';
const swatches = 'display:flex;flex-wrap:wrap;gap:var(--space-4)';
const swatch = (c: Colour) =>
  `display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--ink);font:inherit;cursor:pointer;--dot:${c.hex}`;
const dot = 'width:20px;height:20px;border-radius:50%;background:var(--dot)';

/**
 * Palette, a sample app. Asked for a colour (the colour.pick intent through
 * ctx.request), it shows the swatches and answers with the one picked. Opened
 * as a page, it just shows them. It knows nothing about who asks.
 */
export default defineMicroFrontend({
  mount(el: HTMLElement, ctx: MountContext) {
    const purpose = (ctx.intent?.payload as { purpose?: string } | undefined)?.purpose;
    const reply = ctx.reply;
    render(
      html`<div style=${reply ? 'display:flex;flex-direction:column;gap:var(--space-5)' : page}>
        ${reply
          ? html`<p style="margin:0;color:var(--ink-muted)">Pick a colour${purpose ? ` for ${purpose}` : ''}.</p>`
          : html`<ui-heading eyebrow="Sample app" heading="Palette" summary="Other apps ask Palette for a colour; it never knows who they are."></ui-heading>`}
        <div style=${swatches} role="list">
          ${colours.map(
            (c) => html`<button role="listitem" style=${swatch(c)} data-colour=${c.name} ?disabled=${!reply} @click=${() => reply?.respond(c)}>
              <i style=${dot}></i>${c.name}
            </button>`,
          )}
        </div>
      </div>`,
      el,
    );
  },
  unmount(el: HTMLElement) {
    render(html``, el);
  },
});
