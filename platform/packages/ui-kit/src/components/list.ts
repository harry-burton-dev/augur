import { LitElement, css, html, nothing } from 'lit';
import { base, label } from '../shared.js';
import type { StatusName } from './status.js';
import './icon.js';
import './state.js';

/** A thing to do about one row, shown as a word at its end ("Approve", "Open"). */
export interface ListAction {
  id: string;
  label: string;
}

export interface ListItem {
  id: string;
  title: string;
  /** One line under the title: where it's from, what it's about. */
  detail?: string;
  /** A time or a count at the end: "4 min", "3". */
  meta?: string;
  /** The lead mark: `needs` is green, and the first that needs you pings. */
  status?: StatusName;
  /** A kit icon for the lead mark instead of a status. */
  icon?: string;
  /** Rows with the same group sit under one header, in the order they first appear. */
  group?: string;
  /** At most two, at the row's end; extras are dropped. */
  actions?: ListAction[];
  /** Shown at 40%, can't be opened. */
  disabled?: boolean;
}

/**
 * Things you can act on, one per row: a lead mark, a title, a line of detail,
 * a time or count at the end, then the row's own actions as words. It sits on
 * a pane. The bar above says what's there ("3 THINGS").
 *
 * What needs you is green, and the trail rule holds: the first row that
 * needs you pings; the rest are a still green.
 *
 * Keys: ↑ ↓ move, Home / End, Enter opens. Tab reaches a row's actions.
 *
 * Not built yet, from the design: selection and the bulk bar, the ⋯ menu per
 * row, Undo, "Show more" paging. They come with the first screen that needs them.
 *
 * @fires ui-open - detail `{ item }`
 * @fires ui-action - detail `{ item, action }`
 * @fires ui-retry - Try again was chosen after an error
 */
export class UiList extends LitElement {
  static override properties = {
    label: { type: String },
    noun: { attribute: false },
    items: { attribute: false },
    density: { type: String, reflect: true },
    loading: { type: Boolean, reflect: true },
    error: { type: String },
    empty: { type: String },
    bar: { type: Boolean },
  };

  declare label: string;
  /** What a row is, one and many: ['thing', 'things']. */
  declare noun: [string, string];
  declare items: ListItem[];
  declare density: 'comfortable' | 'compact';
  declare loading: boolean;
  /** Couldn't load: said in red with Try again, in place of the rows. */
  declare error: string;
  /** Said when there are no rows. */
  declare empty: string;
  /** Whether to show the bar that counts the rows. */
  declare bar: boolean;

  constructor() {
    super();
    this.label = '';
    this.noun = ['item', 'items'];
    this.items = [];
    this.density = 'comfortable';
    this.loading = false;
    this.error = '';
    this.empty = 'Nothing here.';
    this.bar = true;
  }

  override focus(options?: FocusOptions) {
    this.rows()[0]?.focus(options);
  }

  private rows() {
    return [...this.renderRoot.querySelectorAll<HTMLButtonElement>('.row:not([disabled])')];
  }

  private onKey(e: KeyboardEvent) {
    const rows = this.rows();
    const at = rows.indexOf((this.renderRoot as ShadowRoot).activeElement as HTMLButtonElement);
    if (at < 0) return;
    const to = e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : -2;
    if (to === -2) return;
    e.preventDefault();
    rows[Math.max(0, Math.min(rows.length - 1, to))]?.focus();
  }

  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: block; }
      .bar { display: flex; align-items: center; min-height: 40px; padding: var(--space-2) var(--space-4); border-bottom: 1px solid var(--hairline); }
      .group { padding: var(--space-5) var(--space-4) var(--space-2); }
      .group.needs { color: var(--green); }
      ul { list-style: none; margin: 0; padding: 0; }
      li { display: flex; align-items: center; gap: var(--space-2); padding-right: var(--space-3); border-bottom: 1px solid var(--hairline); }
      li:last-child { border-bottom: 0; }
      .row { all: unset; box-sizing: border-box; flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--space-4); min-height: 60px; padding: var(--space-2) var(--space-4); cursor: pointer; border-radius: var(--radius-key); }
      :host([density='compact']) .row { min-height: 44px; }
      .row:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
      .row:focus-visible { box-shadow: inset 0 0 0 1.5px var(--focus); }
      .row[disabled] { opacity: 0.4; cursor: default; }
      .lead { flex: none; position: relative; width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--ink-muted); }
      .lead.needs { background: var(--green); border-color: var(--green); opacity: 0.75; }
      .lead.needs.first { opacity: 1; }
      .lead.needs.first::after { content: ''; position: absolute; inset: -2px; border-radius: 50%; border: 1px solid var(--green); animation: ui-ping var(--motion-ping) var(--ease-ping) infinite; }
      .lead.failed { border-color: var(--danger); }
      .lead.running { border-color: var(--ink); }
      .lead.done { background: var(--ink-muted); }
      ui-icon.mark { flex: none; color: var(--ink-muted); }
      .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .text b { font-weight: 400; font-size: var(--type-body); line-height: var(--leading-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .text span, .meta { font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .meta { flex: none; font-variant-numeric: tabular-nums; }
      .act { flex: none; padding: var(--space-1) var(--space-3); border-radius: var(--radius-pill); border: 1px solid var(--hairline-strong); background: none; font: inherit; font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink); white-space: nowrap; cursor: pointer; }
      .act:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
      .act:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      .act.main { border-color: var(--green); }
      .skel { display: block; height: 60px; border-bottom: 1px solid var(--hairline); background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--ink) 5%, transparent), transparent); background-size: 200% 100%; animation: ui-shimmer 1.6s linear infinite; }
      :host([density='compact']) .skel { height: 44px; }
      @keyframes ui-shimmer { to { background-position: -200% 0; } }
    `,
  ];

  override render() {
    const [one, many] = this.noun;
    const count = this.items.length;
    const bar = this.bar ? html`<div class="bar label">${this.loading ? `${many}…` : `${count} ${count === 1 ? one : many}`}</div>` : nothing;
    if (this.loading) return html`${bar}<div aria-busy="true" aria-label=${this.label || nothing}><span class="skel"></span><span class="skel"></span><span class="skel"></span></div>`;
    if (this.error) return html`${bar}<ui-state kind="error" heading=${this.error} body="Nothing was changed." action="Try again" @ui-action=${() => this.emit('ui-retry', {})}></ui-state>`;
    if (!count) return html`${bar}<ui-state kind="empty" heading=${this.empty}></ui-state>`;
    const groups: [string | undefined, ListItem[]][] = [];
    for (const item of this.items) {
      const g = groups.find(([name]) => name === item.group);
      if (g) g[1].push(item);
      else groups.push([item.group, [item]]);
    }
    const pinging = this.items.find((i) => i.status === 'needs' && !i.disabled)?.id;
    return html`${bar}${groups.map(
      ([name, rows]) => html`${name !== undefined ? html`<div class="group label ${rows.every((r) => r.status === 'needs') ? 'needs' : ''}">${name}</div>` : nothing}
        <ul aria-label=${name ?? this.label} @keydown=${this.onKey}>
          ${rows.map(
            (item) => html`<li>
              <button class="row" ?disabled=${item.disabled} @click=${() => !item.disabled && this.emit('ui-open', { item })}>
                ${item.icon && !item.status
                  ? html`<ui-icon class="mark" name=${item.icon} size="16"></ui-icon>`
                  : html`<span class="lead ${item.status ?? ''} ${item.id === pinging ? 'first' : ''}" aria-hidden="true"></span>`}
                <span class="text"><b>${item.title}</b>${item.detail ? html`<span>${item.detail}</span>` : nothing}</span>
                ${item.meta ? html`<span class="meta">${item.meta}</span>` : nothing}
              </button>
              ${(item.actions ?? []).slice(0, 2).map(
                (action, i) => html`<button class="act ${i === 0 && item.status === 'needs' ? 'main' : ''}" ?disabled=${item.disabled}
                  aria-label=${`${action.label}: ${item.title}`} @click=${() => this.emit('ui-action', { item, action })}>${action.label}</button>`,
              )}
            </li>`,
          )}
        </ul>`,
    )}`;
  }
}

if (!customElements.get('ui-list')) customElements.define('ui-list', UiList);

declare global {
  interface HTMLElementTagNameMap {
    'ui-list': UiList;
  }
}
