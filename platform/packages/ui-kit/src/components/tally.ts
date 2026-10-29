import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import type { StatusName } from './status.js';

/** One kind of thing in a tally. */
export interface TallyCount {
  /** How it's marked: `done` green, `warning` amber, `failed` red, `queued` faint; anything else plain. */
  status: StatusName;
  n: number;
  /** What one of them is, in words: "at risk", "achieved". */
  word: string;
  /** Said out loud under the bar. What needs attention is loud; quiet counts are only drawn. */
  loud?: boolean;
}

/**
 * Counts drawn as a short bar of segments, one per thing (proportional past
 * 24), with words under it only for the total and the counts that need
 * attention: "7 parts · 1 at risk · 1 blocked". Pointing at the bar names
 * every count, and screen readers hear them all.
 */
export class UiTally extends LitElement {
  static override properties = {
    counts: { attribute: false },
    noun: { attribute: false },
    size: { type: String, reflect: true },
  };

  /** Up to five kinds, drawn in order; extras are dropped. */
  declare counts: TallyCount[];
  declare noun: [string, string];
  /** `sm` (default) under a card, `md` on its own. */
  declare size: 'sm' | 'md';

  constructor() {
    super();
    this.counts = [];
    this.noun = ['thing', 'things'];
    this.size = 'sm';
  }

  static override styles = [
    base,
    css`
      :host { display: flex; flex-direction: column; gap: 6px; }
      .bar { display: flex; gap: 2px; height: 4px; }
      :host([size='md']) .bar { height: 8px; }
      .bar i { flex: 1 1 0; min-width: 2px; border-radius: 2px; background: color-mix(in srgb, var(--ink) 45%, transparent); }
      .bar i.queued, .bar i.paused { background: color-mix(in srgb, var(--ink) 18%, transparent); }
      .bar i.done { background: var(--success); }
      .bar i.warning, .bar i.needs { background: var(--warning); }
      .bar i.failed { background: var(--danger); }
      .words { font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      b { font-weight: 500; }
      b.warning, b.needs { color: var(--warning); }
      b.failed { color: var(--danger); }
      b.done { color: var(--success); }
    `,
  ];

  override render() {
    const counts = this.counts.slice(0, 5).filter((c) => c.n > 0);
    const total = counts.reduce((sum, c) => sum + c.n, 0);
    const [one, many] = this.noun;
    const all = `${total} ${total === 1 ? one : many}${counts.length ? `: ${counts.map((c) => `${c.n} ${c.word}`).join(', ')}` : ''}`;
    const proportional = total > 24;
    const segments = proportional
      ? counts.map((c) => html`<i class=${c.status} style=${`flex-grow:${c.n}`}></i>`)
      : counts.flatMap((c) => Array.from({ length: c.n }, () => html`<i class=${c.status}></i>`));
    const loud = counts.filter((c) => c.loud);
    return html`<div class="bar" role="img" aria-label=${all} title=${all}>${segments}</div>
      <div class="words" aria-hidden="true">${total} ${total === 1 ? one : many}${loud.map((c) => html` · <b class=${c.status}>${c.n} ${c.word}</b>`)}${!loud.length && !total ? nothing : nothing}</div>`;
  }
}

if (!customElements.get('ui-tally')) customElements.define('ui-tally', UiTally);

declare global {
  interface HTMLElementTagNameMap {
    'ui-tally': UiTally;
  }
}
