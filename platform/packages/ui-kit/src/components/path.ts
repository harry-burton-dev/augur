import { LitElement, css, html, nothing } from 'lit';
import { base, label } from '../shared.js';
import type { FloorKind } from './floors.js';
import { floorIcon } from './floors.js';
import { floorMark } from './card.js';
import './icon.js';

/** One step on a path: a floor, or something kept on one. */
export interface PathStep {
  id?: string;
  /** Which kind of floor it's on: its disc is drawn in that floor's colour. */
  floor: FloorKind;
  title: string;
  /** One line under it: who set it, when, what it says. */
  line?: string;
  /** A word or two after the title, in tracked capitals: "Decides it", "You're here". */
  mark?: string;
  /** `no` marks a step that refuses or blocks (red); otherwise the mark is green. */
  markTone?: 'yes' | 'no';
  /** The step you're on: ringed. */
  here?: boolean;
}

/**
 * A chain of floors or steps with one of them marked: how a rule was decided,
 * an intent's line of sight, where a thing came from. Each step is a disc in
 * its floor's colour, joined to the next by a line.
 *
 * @fires ui-open - detail `{ step }`, when a step with an `id` is pressed
 */
export class UiPath extends LitElement {
  static override properties = {
    steps: { attribute: false },
  };

  declare steps: PathStep[];

  constructor() {
    super();
    this.steps = [];
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: block; }
      ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      li { position: relative; display: grid; grid-template-columns: 32px minmax(0, 1fr); column-gap: var(--space-3); padding-bottom: var(--space-4); }
      li:last-child { padding-bottom: 0; }
      li:not(:last-child)::before { content: ''; position: absolute; left: 15.5px; top: 34px; bottom: 2px; width: 1px; background: var(--hairline-strong); }
      .disc { grid-row: span 2; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--floor) 82%, var(--slate-deep)); color: var(--slate-deep); }
      .here .disc { box-shadow: 0 0 0 2px var(--slate), 0 0 0 3.5px var(--green); }
      .title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 var(--space-3); padding-top: 6px; font-size: var(--type-meta); line-height: var(--leading-meta); }
      .title button { all: unset; cursor: pointer; border-radius: var(--radius-key); }
      .title button:hover { text-decoration: underline; text-underline-offset: 3px; }
      .title button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      .line { font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      .mark { color: var(--green); }
      .mark.no { color: var(--danger); }
    `,
  ];

  override render() {
    const open = (step: PathStep) => this.dispatchEvent(new CustomEvent('ui-open', { detail: { step }, bubbles: true, composed: true }));
    return html`<ol>
      ${this.steps.map(
        (s) => html`<li class=${s.here ? 'here' : ''} style=${`--floor:${floorMark[s.floor]}`} aria-current=${s.here ? 'step' : nothing}>
          <span class="disc" aria-hidden="true"><ui-icon name=${floorIcon[s.floor]} size="14"></ui-icon></span>
          <span class="title">${s.id && !s.here ? html`<button @click=${() => open(s)}>${s.title}</button>` : html`<span>${s.title}</span>`}${s.mark
              ? html`<span class="label mark ${s.markTone === 'no' ? 'no' : ''}">${s.mark}</span>`
              : nothing}</span>
          ${s.line ? html`<span class="line">${s.line}</span>` : html`<span></span>`}
        </li>`,
      )}
    </ol>`;
  }
}

if (!customElements.get('ui-path')) customElements.define('ui-path', UiPath);

declare global {
  interface HTMLElementTagNameMap {
    'ui-path': UiPath;
  }
}
