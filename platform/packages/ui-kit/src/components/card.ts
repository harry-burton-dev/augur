import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import type { StatusName } from './status.js';
import type { FloorKind } from './floors.js';
import './status.js';
import './icon.js';

/** The floor colours a mark is drawn in: the readable, upper glow of each kind. */
export const floorMark: Record<FloorKind, string> = { personal: 'var(--floor-you-high)', team: 'var(--floor-team-high)', org: 'var(--floor-org-high)' };

/**
 * One thing in a grid of things: a title, its mark, one line of meta, and at
 * most one more line, only when it changes what you'd do ("1 part blocked").
 * The whole card opens it; there are no buttons inside a card.
 *
 * Its floor shows as a dot in the floor's colour with the floor's name, never
 * as a coloured edge: colour always comes with a word.
 *
 * Unavailable, it stays in the grid, dashed and quiet with a lock, and its
 * meta line says why ("Kept on Finance. Ask its leads.").
 *
 * @slot tally - a `ui-tally` under the lines
 * @fires ui-open - it was pressed
 */
export class UiCard extends LitElement {
  static override properties = {
    heading: { type: String },
    status: { type: String },
    statusLabel: { type: String, attribute: 'status-label' },
    icon: { type: String },
    floorKind: { type: String, attribute: 'floor-kind' },
    floorName: { type: String, attribute: 'floor-name' },
    meta: { attribute: false },
    note: { type: String },
    noteTone: { type: String, attribute: 'note-tone' },
    unavailable: { type: Boolean, reflect: true },
    reason: { type: String },
  };

  declare heading: string;
  declare status: StatusName | '';
  /** The status in words, when the kit's own word isn't the right one ("At risk", "Draft"). */
  declare statusLabel: string;
  /** A kit icon in the corner instead of a status. */
  declare icon: string;
  declare floorKind: FloorKind | '';
  declare floorName: string;
  /** Up to three short facts after the floor ("By 13 Nov"); extras are dropped. */
  declare meta: string[];
  /** The one line that changes what you'd do. */
  declare note: string;
  /** `warning` (default), `danger`, or `ink` for news that isn't trouble. */
  declare noteTone: 'warning' | 'danger' | 'ink';
  declare unavailable: boolean;
  /** Why it can't be opened, in one sentence; takes the meta line's place. */
  declare reason: string;

  constructor() {
    super();
    this.heading = '';
    this.status = '';
    this.statusLabel = '';
    this.icon = '';
    this.floorKind = '';
    this.floorName = '';
    this.meta = [];
    this.note = '';
    this.noteTone = 'warning';
    this.unavailable = false;
    this.reason = '';
  }

  static override styles = [
    base,
    css`
      :host { display: block; min-width: 0; }
      .card {
        all: unset;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-4);
        border: 1px solid var(--hairline);
        border-radius: var(--radius-inset);
        background: var(--surface-pane);
        cursor: pointer;
        transition: border-color var(--motion-instant) var(--ease-standard);
      }
      button.card:hover { border-color: var(--hairline-strong); }
      button.card:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      :host([unavailable]) .card { cursor: default; border-style: dashed; background: none; }
      .top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
      .title { font-size: var(--type-body); line-height: var(--leading-body); color: var(--ink); min-width: 0; }
      :host([unavailable]) .title, :host([unavailable]) .top ui-icon { color: var(--ink-muted); }
      .top ui-icon { flex: none; color: var(--ink-muted); margin-top: 3px; }
      ui-status { flex: none; }
      .meta { display: flex; flex-wrap: wrap; gap: 0 var(--space-2); font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      .meta > * + *::before { content: '·'; margin-right: var(--space-2); }
      .floor { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
      .floor::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--floor); flex: none; }
      .note { font-size: var(--type-small); line-height: var(--leading-small); color: var(--warning); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      :host([note-tone='danger']) .note { color: var(--danger); }
      :host([note-tone='ink']) .note { color: var(--ink); }
      ::slotted([slot='tally']) { margin-top: var(--space-1); }
    `,
  ];

  override render() {
    const facts = [
      ...(this.floorKind || this.floorName ? [html`<span class="floor" style=${`--floor:${this.floorKind ? floorMark[this.floorKind] : 'var(--ink-muted)'}`}>${this.floorName}</span>`] : []),
      ...this.meta.slice(0, 3).map((m) => html`<span>${m}</span>`),
    ];
    const mark = this.unavailable
      ? html`<ui-icon name="lock" size="14" aria-hidden="true"></ui-icon>`
      : this.status
        ? html`<ui-status status=${this.status} label=${this.statusLabel || nothing}></ui-status>`
        : this.icon
          ? html`<ui-icon name=${this.icon} size="14" aria-hidden="true"></ui-icon>`
          : nothing;
    const inner = html`<span class="top"><span class="title">${this.heading}</span>${mark}</span>
      <span class="meta">${this.unavailable && this.reason ? html`<span>${this.reason}</span>` : facts}</span>
      ${this.note && !this.unavailable ? html`<span class="note" title=${this.note}>${this.note}</span>` : nothing}
      <slot name="tally"></slot>`;
    return this.unavailable
      ? html`<div class="card" part="card" aria-disabled="true">${inner}</div>`
      : html`<button class="card" part="card" @click=${() => this.dispatchEvent(new CustomEvent('ui-open', { bubbles: true, composed: true }))}>${inner}</button>`;
  }
}

/** Lays cards out in a grid that fills its width: as many columns as fit, none narrower than 260px. */
export class UiCards extends LitElement {
  static override styles = css`
    :host { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap: var(--space-3); }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}

if (!customElements.get('ui-card')) customElements.define('ui-card', UiCard);
if (!customElements.get('ui-cards')) customElements.define('ui-cards', UiCards);

declare global {
  interface HTMLElementTagNameMap {
    'ui-card': UiCard;
    'ui-cards': UiCards;
  }
}
