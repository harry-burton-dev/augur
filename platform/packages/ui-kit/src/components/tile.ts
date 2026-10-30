import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import './icon.js';

/**
 * One thing in a grid you walk into, shown by its shape alone: its picture or
 * icon, and its name. Nothing else: what it holds and what can be done with it
 * open with it, or sit in the drawer.
 *
 * `add` makes it the empty square after the last one: a dashed tile with a
 * plus, named for what it makes ("New collection"). Put it first among the
 * empty squares, so making one is where the next one would go.
 *
 * Its actions aren't on it: right-click it (or press the context-menu key)
 * and the app opens a `ui-radial-menu` around it.
 *
 * Everything that can be right-clicked answers the pointer. `rank` says how
 * high in the app's hierarchy it is, and the hover is as strong as that:
 * `high` (a collection) lifts and lights, `mid` (a folder) lifts a little,
 * `low` (a document) only firms its edge.
 *
 * @fires ui-open - it was pressed
 */
export class UiTile extends LitElement {
  static override properties = {
    heading: { type: String },
    icon: { type: String },
    picture: { type: String },
    add: { type: Boolean, reflect: true },
    selected: { type: Boolean, reflect: true },
    rank: { type: String, reflect: true },
  };

  declare heading: string;
  /** A kit icon, when there's no picture. */
  declare icon: string;
  /** An image's address, shown instead of the icon. */
  declare picture: string;
  /** The empty tile that makes a new one. */
  declare add: boolean;
  /** Its radial menu is open on it: it shows as the one chosen. */
  declare selected: boolean;
  /** How high it is in the hierarchy, which sets how strongly it answers hover: `high`, `mid` (default) or `low`. */
  declare rank: 'high' | 'mid' | 'low';

  constructor() {
    super();
    this.heading = '';
    this.icon = '';
    this.picture = '';
    this.add = false;
    this.selected = false;
    this.rank = 'mid';
  }

  static override styles = [
    base,
    css`
      :host { display: block; min-width: 0; animation: arrive var(--motion-slow) var(--ease-out) both; }
      .tile {
        all: unset;
        box-sizing: border-box;
        width: 100%;
        aspect-ratio: 4 / 3;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-4);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-inset);
        background: var(--surface-pane);
        cursor: pointer;
        transition: border-color var(--motion-quick) var(--ease-standard), background var(--motion-quick) var(--ease-standard), box-shadow var(--motion-base) var(--ease-out), transform var(--motion-base) var(--ease-out);
      }
      :host([rank='high']) .tile:hover { border-color: var(--hairline-strong); background: var(--surface-raised); transform: translateY(-3px); box-shadow: 0 10px 24px -14px color-mix(in srgb, var(--slate-deep) 90%, transparent); }
      :host([rank='mid']) .tile:hover { border-color: var(--hairline-strong); background: color-mix(in srgb, var(--surface-raised) 50%, var(--surface-pane)); transform: translateY(-1px); }
      :host([rank='low']) .tile:hover { border-color: var(--hairline-strong); }
      .tile:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      :host([selected]) .tile { border-color: var(--focus); background: var(--surface-raised); }
      :host([add]) .tile { border-style: dashed; background: none; justify-content: center; align-items: center; color: var(--ink-muted); }
      :host([add]) .tile:hover { color: var(--ink); }
      .mark { width: 40px; height: 40px; display: grid; place-items: center; border-radius: var(--radius-inset); background: var(--surface-inset); color: var(--ink-muted); }
      .mark img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
      .title { font-size: var(--type-body); line-height: var(--leading-body); color: var(--ink); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      :host([add]) .title { color: inherit; font-size: var(--type-small); }
      @keyframes arrive { from { opacity: 0; transform: translateY(6px); } }
      @media (prefers-reduced-motion: reduce) {
        :host { animation: none; }
        .tile:hover { transform: none !important; }
      }
    `,
  ];

  override render() {
    const open = () => this.dispatchEvent(new CustomEvent('ui-open', { bubbles: true, composed: true }));
    if (this.add)
      return html`<button class="tile" part="tile" @click=${open}><ui-icon name="plus" size="24" aria-hidden="true"></ui-icon><span class="title">${this.heading}</span></button>`;
    const mark = this.picture ? html`<img src=${this.picture} alt="" />` : this.icon ? html`<ui-icon name=${this.icon} size="20" aria-hidden="true"></ui-icon>` : nothing;
    return html`<button class="tile" part="tile" @click=${open}><span class="mark">${mark}</span><span class="title">${this.heading}</span></button>`;
  }
}

/** Lays tiles out in a grid: as many columns as fit, none narrower than 168px. */
export class UiTiles extends LitElement {
  static override styles = css`
    :host { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(168px, 100%), 1fr)); gap: var(--space-4); }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}

if (!customElements.get('ui-tile')) customElements.define('ui-tile', UiTile);
if (!customElements.get('ui-tiles')) customElements.define('ui-tiles', UiTiles);

declare global {
  interface HTMLElementTagNameMap {
    'ui-tile': UiTile;
    'ui-tiles': UiTiles;
  }
}
