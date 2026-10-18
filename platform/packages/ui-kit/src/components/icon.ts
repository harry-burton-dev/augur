import { LitElement, css, html, svg, type SVGTemplateResult } from 'lit';
import { base } from '../shared.js';

/** Line icons on a 24 grid, drawn in currentColor. Gloss only ever comes from the bubble. */
export const icons = {
  apps: svg`<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>`,
  find: svg`<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>`,
  agents: svg`<path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.7l-1.6-5.5L5 10.6 10.4 9z"/><path d="M18.5 16.5 19 18l1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z"/>`,
  account: svg`<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5"/>`,
  settings: svg`<path d="M5 7h9M18 7h1M5 12h3M12 12h7M5 17h11M20 17h-1"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>`,
  home: svg`<path d="M4.5 11 12 4.5l7.5 6.5"/><path d="M6.5 9.5v10h11v-10"/><path d="M10 19.5v-5h4v5"/>`,
  library: svg`<path d="M5 4.5h3v15H5zM10 4.5h3v15h-3z"/><path d="m15.2 5.6 2.9-.8 3.6 14-2.9.8z"/>`,
  document: svg`<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M9.5 12h6M9.5 15.5h6"/>`,
  folder: svg`<path d="M3.5 7v11.5h17V8.5h-8L10.5 6h-7z"/>`,
  admin: svg`<path d="M12 3.5 5 6v5.5c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>`,
  people: svg`<circle cx="9" cy="9" r="3"/><path d="M3.5 19c.9-3 3-4.5 5.5-4.5s4.6 1.5 5.5 4.5"/><circle cx="16.5" cy="8" r="2.5"/><path d="M15.5 13.3c2.4-.3 4.3 1 5 3.7"/>`,
  bell: svg`<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5h4"/>`,
  chart: svg`<path d="M4.5 19.5h15"/><path d="M7 16v-5M11.5 16V7M16 16v-3"/>`,
  close: svg`<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>`,
  back: svg`<path d="M19 12H5M11 6l-6 6 6 6"/>`,
  arrow: svg`<path d="M5 12h14M13 6l6 6-6 6"/>`,
  check: svg`<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
} satisfies Record<string, SVGTemplateResult>;

export type IconName = keyof typeof icons;

export const iconNames = Object.keys(icons) as IconName[];

/**
 * A line icon, bare (hairline) or inside a swirling soap bubble lit by one
 * light. Unknown names draw nothing rather than a broken glyph.
 */
export class UiIcon extends LitElement {
  static override properties = {
    name: { type: String },
    bubble: { type: Boolean, reflect: true },
    size: { type: Number },
    label: { type: String },
  };

  declare name: string;
  declare bubble: boolean;
  declare size: number;
  /** Set only when the icon carries meaning on its own; otherwise it is hidden from readers. */
  declare label: string;

  constructor() {
    super();
    this.name = '';
    this.bubble = false;
    this.size = 24;
    this.label = '';
  }

  static override styles = [
    base,
    css`
      :host { display: inline-flex; position: relative; flex: none; color: inherit; }
      svg { width: 100%; height: 100%; display: block; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; position: relative; z-index: 1; }
      .rim { display: none; }
      :host([bubble]) {
        border-radius: 50%;
        background:
          radial-gradient(circle at 34% 28%, color-mix(in srgb, var(--light) 75%, transparent) 0, color-mix(in srgb, var(--light) 12%, transparent) 13%, transparent 32%),
          radial-gradient(circle, transparent 58%, color-mix(in srgb, var(--ink) 10%, transparent) 100%);
        box-shadow: 0 0 26px color-mix(in srgb, var(--green) 35%, transparent), 0 10px 18px color-mix(in srgb, var(--shade) 30%, transparent);
      }
      :host([bubble]) svg { stroke-width: 1.75; }
      :host([bubble]) .rim {
        display: block;
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: conic-gradient(
          color-mix(in srgb, var(--green) 90%, transparent),
          color-mix(in srgb, var(--navy) 90%, transparent),
          color-mix(in srgb, var(--ink) 80%, transparent),
          color-mix(in srgb, var(--green) 60%, transparent),
          color-mix(in srgb, var(--navy) 90%, transparent),
          color-mix(in srgb, var(--green) 90%, transparent)
        );
        -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 2.5px), #000 calc(100% - 1.5px));
        mask: radial-gradient(closest-side, transparent calc(100% - 2.5px), #000 calc(100% - 1.5px));
        animation: ui-swirl var(--motion-drift) linear infinite;
      }
      @keyframes ui-swirl { to { transform: rotate(360deg); } }
    `,
  ];

  override willUpdate() {
    // `size` is the whole box; a bubble keeps its drawing a quarter in from each side.
    this.style.width = this.style.height = `${this.size}px`;
    this.style.padding = this.bubble ? `${this.size / 4}px` : '';
  }

  override render() {
    const drawing = icons[this.name as IconName];
    return html`<span class="rim"></span>${drawing
      ? html`<svg viewBox="0 0 24 24" role=${this.label ? 'img' : 'presentation'} aria-label=${this.label || ''} aria-hidden=${this.label ? 'false' : 'true'}>${drawing}</svg>`
      : ''}`;
  }
}

if (!customElements.get('ui-icon')) customElements.define('ui-icon', UiIcon);

declare global {
  interface HTMLElementTagNameMap {
    'ui-icon': UiIcon;
  }
}
