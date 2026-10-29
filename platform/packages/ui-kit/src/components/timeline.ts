import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { base, label } from '../shared.js';

/** One thing that happened. */
export interface TimelineItem {
  id?: string;
  /** When, as an ISO date and time. */
  at: string;
  /** Who did it, in bold: "Sam Okafor", "You", "Halden harbour". */
  who: string;
  /** What they did, as the rest of the sentence: "judged it at risk". It can hold a `ui-ref`. */
  what: string | TemplateResult;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today", "Yesterday", or the day as "Tue 27 Oct" (with the year when it isn't this year). */
export const dayWords = (at: Date, now = new Date()) => {
  if (sameDay(at, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(at, yesterday)) return 'Yesterday';
  return at.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(at.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) });
};

/**
 * What happened, newest first, grouped by day: each line is who, then what,
 * at a time of day. Five show; the rest wait behind "Earlier". No avatars,
 * and no "3 days ago": the day says it.
 */
export class UiTimeline extends LitElement {
  static override properties = {
    items: { attribute: false },
    limit: { type: Number },
    open: { state: true },
  };

  declare items: TimelineItem[];
  /** How many show before "Earlier"; 0 shows them all. */
  declare limit: number;
  declare open: boolean;
  /** Today, for tests and stories. */
  now = new Date();

  constructor() {
    super();
    this.items = [];
    this.limit = 5;
    this.open = false;
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: block; }
      ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); font-size: var(--type-meta); line-height: var(--leading-meta); }
      .day { padding-top: var(--space-2); }
      .day:first-child { padding-top: 0; }
      .ev { display: grid; grid-template-columns: 3.2rem minmax(0, 1fr); gap: var(--space-3); }
      time { color: var(--ink-muted); font-size: var(--type-small); font-variant-numeric: tabular-nums; padding-top: 1px; }
      b { font-weight: 500; }
      button { all: unset; cursor: pointer; font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); border-radius: var(--radius-key); margin-top: var(--space-3); }
      button:hover { color: var(--ink); }
      button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
    `,
  ];

  override render() {
    const sorted = [...this.items].sort((a, b) => b.at.localeCompare(a.at));
    const folds = this.limit > 0 && sorted.length > this.limit;
    const shown = folds && !this.open ? sorted.slice(0, this.limit) : sorted;
    const rows: TemplateResult[] = [];
    let last = '';
    for (const item of shown) {
      const at = new Date(item.at);
      const day = dayWords(at, this.now);
      if (day !== last) rows.push(html`<li class="day label">${day}</li>`);
      last = day;
      rows.push(html`<li class="ev"><time datetime=${item.at}>${at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time><span><b>${item.who}</b> ${item.what}</span></li>`);
    }
    return html`<ol>${rows}</ol>${folds ? html`<button aria-expanded=${this.open ? 'true' : 'false'} @click=${() => (this.open = !this.open)}>${this.open ? 'Fewer' : 'Earlier'}</button>` : nothing}`;
  }
}

if (!customElements.get('ui-timeline')) customElements.define('ui-timeline', UiTimeline);

declare global {
  interface HTMLElementTagNameMap {
    'ui-timeline': UiTimeline;
  }
}
