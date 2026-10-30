import { LitElement, css, html, nothing } from 'lit';
import { base, label } from '../shared.js';
import './button.js';

/** One state of a lifecycle, in the words the app (or the org) uses for it. */
export interface LifecycleState {
  id: string;
  name: string;
}

/**
 * Where one record is in its lifecycle: every state in order, the ones it has
 * passed filled, the one it's in ringed and named, the rest hollow. A state off
 * the main line (such as Retired) shows only when the record is in it. Under the
 * track, a button for each state the caller may move it to; a state they can't
 * move it to isn't offered, and `why` says what would let them.
 *
 * Take states from `@augur/records` (`CONTENT_LIFECYCLE`, `CONTAINER_LIFECYCLE`),
 * so every app's lifecycle reads the same (docs/app-patterns.md).
 *
 * @fires ui-move - detail `{ state }`, when a move is pressed
 */
export class UiLifecycle extends LitElement {
  static override properties = {
    states: { attribute: false },
    state: { type: String },
    moves: { attribute: false },
    offLine: { attribute: false },
    why: { type: String },
    label: { type: String },
    busy: { type: Boolean },
  };

  declare states: LifecycleState[];
  declare state: string;
  /** The states the caller may move it to now. */
  declare moves: string[];
  /** States off the main line: shown only while the record is in one. */
  declare offLine: string[];
  /** Why the caller can't move it, when they can't: "Only its library's leads can issue it." */
  declare why: string;
  /** What the track is about, for screen readers: "Version 3". */
  declare label: string;
  declare busy: boolean;

  constructor() {
    super();
    this.states = [];
    this.state = '';
    this.moves = [];
    this.offLine = [];
    this.why = '';
    this.label = '';
    this.busy = false;
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: flex; flex-direction: column; gap: var(--space-3); }
      ol { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); margin: 0; padding: 0; list-style: none; }
      li { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted); }
      li + li::before { content: ''; width: var(--space-4); height: 1px; background: var(--rule); }
      .disc { flex: none; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--ink-muted); }
      .passed .disc { background: var(--ink-muted); }
      .here { color: var(--ink); font-weight: 600; }
      .here .disc { width: 10px; height: 10px; border-color: var(--ink); background: var(--ink); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ink) 15%, transparent); }
      .moves { display: flex; flex-wrap: wrap; gap: var(--space-2); }
      .why { margin: 0; font-size: var(--type-small); color: var(--ink-muted); }
    `,
  ];

  private move(state: string) {
    this.dispatchEvent(new CustomEvent('ui-move', { detail: { state }, bubbles: true, composed: true }));
  }

  override render() {
    const shown = this.states.filter((s) => !this.offLine.includes(s.id) || s.id === this.state);
    const at = shown.findIndex((s) => s.id === this.state);
    const name = (id: string) => this.states.find((s) => s.id === id)?.name ?? id;
    return html`
      <ol aria-label=${this.label ? `${this.label}: ${name(this.state)}` : name(this.state)}>
        ${shown.map(
          (s, i) =>
            html`<li class=${i === at ? 'here' : i < at ? 'passed' : ''} aria-current=${i === at ? 'step' : nothing}>
              <span class="disc" aria-hidden="true"></span>${s.name}
            </li>`,
        )}
      </ol>
      ${this.moves.length
        ? html`<div class="moves">
            ${this.moves.map(
              (m) => html`<ui-button kind="secondary" size="sm" ?disabled=${this.busy} reason="It’s moving now." @click=${() => this.move(m)}>Make it ${name(m)}</ui-button>`,
            )}
          </div>`
        : nothing}
      ${this.why && !this.moves.length ? html`<p class="why">${this.why}</p>` : nothing}
    `;
  }
}

if (!customElements.get('ui-lifecycle')) customElements.define('ui-lifecycle', UiLifecycle);

declare global {
  interface HTMLElementTagNameMap {
    'ui-lifecycle': UiLifecycle;
  }
}
