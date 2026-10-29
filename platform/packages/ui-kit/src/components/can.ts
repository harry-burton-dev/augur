import { LitElement, css, html, nothing } from 'lit';
import { base, label } from '../shared.js';
import './button.js';

/** Something you can do here. The first is a button, the second a word. */
export interface CanAction {
  id: string;
  label: string;
}

/** Something you can't do here, and who can: "To change it here, ask an admin." */
export interface CanBlocked {
  /** What it would take, as a verb phrase: "change it here". */
  what: string;
  /** Who can: "an admin", "Finance's leads". */
  who: string;
}

/**
 * The foot of a page or glance that says what you can do from here: up to
 * two actions, and for what you can't do, one sentence each on who can. It
 * keeps an explanation from turning into a paragraph, and keeps what's
 * unavailable in view.
 *
 * @slot - one more sentence, when the blocked lines need a reason ("Finance's rule covers every team inside it.")
 * @fires ui-action - detail `{ action }`
 */
export class UiCan extends LitElement {
  static override properties = {
    heading: { type: String },
    actions: { attribute: false },
    blocked: { attribute: false },
  };

  declare heading: string;
  /** At most two; extras are dropped. */
  declare actions: CanAction[];
  declare blocked: CanBlocked[];

  constructor() {
    super();
    this.heading = 'You can';
    this.actions = [];
    this.blocked = [];
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: flex; flex-direction: column; gap: var(--space-3); border-top: 1px solid var(--hairline); padding-top: var(--space-4); }
      .acts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3) var(--space-4); }
      p { margin: 0; font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); max-width: var(--measure-prose); }
      b { color: var(--ink); font-weight: 400; }
      .acts:empty { display: none; }
    `,
  ];

  override render() {
    const acts = this.actions.slice(0, 2);
    const pick = (action: CanAction) => this.dispatchEvent(new CustomEvent('ui-action', { detail: { action }, bubbles: true, composed: true }));
    return html`<div class="label" role="heading" aria-level="3">${this.heading}</div>
      <div class="acts">${acts.map(
        (a, i) => html`<ui-button kind=${i === 0 ? 'secondary' : 'tertiary'} size="sm" @click=${() => pick(a)}>${a.label}</ui-button>`,
      )}</div>
      ${this.blocked.length || this.childNodes.length
        ? html`<p>${this.blocked.map((b, i) => html`${i ? ' ' : nothing}To ${b.what}, ask <b>${b.who}</b>.`)} <slot></slot></p>`
        : nothing}`;
  }
}

if (!customElements.get('ui-can')) customElements.define('ui-can', UiCan);

declare global {
  interface HTMLElementTagNameMap {
    'ui-can': UiCan;
  }
}
