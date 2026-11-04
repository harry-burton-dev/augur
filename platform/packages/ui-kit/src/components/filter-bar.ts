import { LitElement, css, html, nothing } from 'lit';
import { base, uid } from '../shared.js';
import type { SelectOption } from './select.js';
import './icon.js';
import './tag.js';

/** One way to narrow a list: its button in the bar, and the choices it opens. */
export interface FilterDef {
  id: string;
  /** The button's word, also said on each chip it puts up: "Tags". */
  label: string;
  options: (SelectOption & { icon?: string })[];
  /** One choice at a time, such as a time range: picking one replaces the last, and the list closes. */
  single?: boolean;
  /** A box at the top to narrow a long list of choices, such as tags. */
  search?: boolean;
}

/** What's chosen, by filter id. */
export type FilterValue = Record<string, string[]>;

/** Chosen values with any empty or unknown filter left out, so a value compares and saves cleanly. */
export const filterValue = (filters: readonly FilterDef[], value: FilterValue): FilterValue =>
  Object.fromEntries(filters.map((f) => [f.id, (value[f.id] ?? []).filter((v) => f.options.some((o) => o.value === v))]).filter(([, v]) => v.length));

/**
 * The bar above a long list: a button for each way to narrow it, a sort, how
 * many there are, and room for the page's own actions (Save view). What's on
 * shows below as tags, each with its ×, and one press clears them all.
 *
 * The bar holds no list itself; it says what changed and the page asks again.
 *
 * Keys: each button opens its choices; ↓ ↑ move, Enter or Space picks, Esc
 * closes and goes back to the button, Tab closes.
 *
 * @fires ui-change - detail `{ value, sort }`
 * @slot actions - after the count: buttons such as Save view
 */
export class UiFilterBar extends LitElement {
  static override properties = {
    label: { type: String },
    filters: { attribute: false },
    value: { attribute: false },
    sorts: { attribute: false },
    sort: { type: String },
    count: { type: Number },
    noun: { attribute: false },
    busy: { type: Boolean, reflect: true },
    opened: { state: true },
    search: { state: true },
  };

  /** What the bar narrows, for screen readers: "Filter documents". */
  declare label: string;
  declare filters: FilterDef[];
  declare value: FilterValue;
  declare sorts: SelectOption[];
  declare sort: string;
  /** How many match; left out, no count shows. */
  declare count: number | undefined;
  /** For the count: ['document', 'documents']. */
  declare noun: [string, string];
  /** A new count is on its way: the old one dims. */
  declare busy: boolean;
  /** Which list is open: a filter's id, `sort`, or none. */
  declare opened: string;
  declare search: string;

  private ids = { panel: uid('filters') };
  private anchor: HTMLElement | null = null;

  constructor() {
    super();
    this.label = 'Filters';
    this.filters = [];
    this.value = {};
    this.sorts = [];
    this.sort = '';
    this.count = undefined;
    this.noun = ['item', 'items'];
    this.busy = false;
    this.opened = '';
    this.search = '';
  }

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onOutside, true);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.onOutside, true);
  }

  private onOutside = (e: Event) => {
    if (!this.opened) return;
    const path = e.composedPath();
    if (!path.includes(this.panel as EventTarget) && !(this.anchor && path.includes(this.anchor))) this.close(false);
  };

  private get panel() {
    return this.renderRoot.querySelector<HTMLElement>('.panel');
  }

  /** The choices one filter (or the sort) offers, opened under its button. */
  async show(id: string, anchor: HTMLElement) {
    if (this.opened === id) return this.close();
    this.anchor = anchor;
    this.search = '';
    this.opened = id;
    await this.updateComplete;
    this.place();
    const panel = this.panel;
    (panel?.querySelector<HTMLElement>('input') ?? panel?.querySelector<HTMLElement>('[aria-checked="true"]') ?? panel?.querySelector<HTMLElement>('[role^="menuitem"]'))?.focus();
  }

  close(refocus = true) {
    if (!this.opened) return;
    this.opened = '';
    const panel = this.panel;
    if (panel && typeof panel.hidePopover === 'function' && panel.matches(':popover-open')) panel.hidePopover();
    if (refocus) this.anchor?.focus();
    this.anchor = null;
  }

  /** Under its button, left edges lined up; kept on screen. */
  private place() {
    const panel = this.panel;
    if (!panel || !this.anchor) return;
    if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) panel.showPopover();
    const r = this.anchor.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - panel.offsetWidth - 8))}px`;
    panel.style.top = `${r.bottom + 4}px`;
  }

  private changed(value: FilterValue, sort = this.sort) {
    this.value = filterValue(this.filters, value);
    this.sort = sort;
    this.dispatchEvent(new CustomEvent('ui-change', { detail: { value: this.value, sort }, bubbles: true, composed: true }));
  }

  private toggle(filter: FilterDef, option: string) {
    const now = this.value[filter.id] ?? [];
    const next = filter.single ? (now.includes(option) ? [] : [option]) : now.includes(option) ? now.filter((v) => v !== option) : [...now, option];
    this.changed({ ...this.value, [filter.id]: next });
    if (filter.single) this.close();
  }

  private clear() {
    this.changed({});
  }

  private onPanelKey(e: KeyboardEvent) {
    const items = [...(this.panel?.querySelectorAll<HTMLElement>('input, [role^="menuitem"]') ?? [])];
    const at = items.indexOf(this.renderRoot instanceof ShadowRoot ? (this.renderRoot.activeElement as HTMLElement) : items[0]);
    const go = (i: number) => {
      e.preventDefault();
      items[Math.max(0, Math.min(i, items.length - 1))]?.focus();
    };
    // Keys stop here: an Esc that closes the list mustn't also close what it's on.
    e.stopPropagation();
    if (e.key === 'ArrowDown') return go(at + 1);
    if (e.key === 'ArrowUp') return go(at - 1);
    if (e.key === 'Home') return go(0);
    if (e.key === 'End') return go(items.length - 1);
    if (e.key === 'Escape') {
      e.preventDefault();
      return this.close();
    }
    if (e.key === 'Tab') return this.close(false);
  }

  static override styles = [
    base,
    css`
      :host { display: flex; flex-direction: column; gap: var(--space-3); }
      .bar { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
      .filters { display: flex; gap: var(--space-2); flex-wrap: wrap; }
      .end { display: flex; align-items: center; gap: var(--space-3); margin-left: auto; }
      .count { font-size: var(--type-small); color: var(--ink-muted); white-space: nowrap; transition: opacity var(--motion-quick) var(--ease-standard); }
      :host([busy]) .count { opacity: 0.5; }
      .open {
        all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: var(--space-1); min-height: 32px;
        padding: 0 var(--space-3); border: 1px solid var(--hairline-strong); border-radius: var(--radius-pill);
        color: var(--ink); font-size: var(--type-meta); line-height: var(--leading-meta); cursor: pointer; white-space: nowrap;
      }
      .open:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
      .open:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      .open[aria-expanded='true'] { background: color-mix(in srgb, var(--ink) 8%, transparent); }
      .open.on { border-color: var(--ink); }
      .open .n { min-width: 18px; padding: 0 5px; border-radius: var(--radius-pill); background: var(--ink); color: var(--slate); font-size: var(--type-label); text-align: center; }
      .open.sort { border-color: transparent; color: var(--ink-muted); }
      .open.sort strong { color: var(--ink); font-weight: 500; }
      ui-icon { color: var(--ink-muted); }
      .chips { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
      .clear { all: unset; font-size: var(--type-small); color: var(--ink-muted); cursor: pointer; border-radius: var(--radius-key); }
      .clear:hover { color: var(--ink); text-decoration: underline; }
      .clear:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      .panel {
        position: fixed; inset: auto; margin: 0; min-width: 220px; max-width: 320px; padding: var(--space-1);
        background: var(--surface-overlay); backdrop-filter: blur(var(--surface-blur));
        border: 1px solid var(--hairline-strong); border-radius: var(--radius-card); box-shadow: var(--shadow-overlay); color: var(--ink);
      }
      .panel[hidden] { display: none; }
      .options { max-height: 280px; overflow-y: auto; }
      .find {
        box-sizing: border-box; width: 100%; margin-bottom: var(--space-1); padding: var(--space-2) var(--space-3); border: 0; border-bottom: 1px solid var(--hairline);
        background: none; color: var(--ink); font: inherit; font-size: var(--type-meta); outline: none;
      }
      .find:focus-visible { border-bottom-color: var(--focus); }
      .opt {
        all: unset; box-sizing: border-box; display: flex; align-items: center; gap: var(--space-3); width: 100%; min-height: 36px;
        padding: var(--space-1) var(--space-3); border-radius: var(--radius-key); font-size: var(--type-meta); line-height: var(--leading-meta); cursor: pointer;
      }
      .opt:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
      .opt:focus-visible { outline: 0; box-shadow: inset 0 0 0 1.5px var(--focus); }
      .opt .tick { display: flex; width: 16px; color: var(--ink); visibility: hidden; }
      .opt[aria-checked='true'] .tick { visibility: visible; }
      .opt .word { flex: 1; }
      .opt em { font-style: normal; font-size: var(--type-small); color: var(--ink-muted); }
      .none { padding: var(--space-2) var(--space-3); font-size: var(--type-small); color: var(--ink-muted); }
    `,
  ];

  private renderPanel() {
    if (this.opened === 'sort')
      return html`<div class="options" role="menu" aria-label="Sort by">
        ${this.sorts.map(
          (s) => html`<button class="opt" role="menuitemradio" aria-checked=${String(s.value === this.sort)} tabindex="-1"
            @click=${() => {
              this.changed(this.value, s.value);
              this.close();
            }}>
            <span class="tick" aria-hidden="true"><ui-icon name="check" size="16"></ui-icon></span><span class="word">${s.label}</span>
          </button>`,
        )}
      </div>`;
    const filter = this.filters.find((f) => f.id === this.opened);
    if (!filter) return nothing;
    const chosen = this.value[filter.id] ?? [];
    const word = this.search.trim().toLocaleLowerCase();
    const options = word ? filter.options.filter((o) => o.label.toLocaleLowerCase().includes(word)) : filter.options;
    return html`${filter.search
        ? html`<input class="find" type="search" placeholder=${`Find ${filter.label.toLocaleLowerCase()}`} aria-label=${`Find ${filter.label.toLocaleLowerCase()}`}
            .value=${this.search} @input=${(e: Event) => (this.search = (e.target as HTMLInputElement).value)} />`
        : nothing}
      <div class="options" role="menu" aria-label=${filter.label}>
        ${options.length
          ? options.map(
              (o) => html`<button class="opt" role=${filter.single ? 'menuitemradio' : 'menuitemcheckbox'} aria-checked=${String(chosen.includes(o.value))} tabindex="-1"
                ?disabled=${o.disabled} @click=${() => this.toggle(filter, o.value)}>
                <span class="tick" aria-hidden="true"><ui-icon name="check" size="16"></ui-icon></span>
                ${o.icon ? html`<ui-icon name=${o.icon} size="16"></ui-icon>` : nothing}
                <span class="word">${o.label}</span>${o.detail ? html`<em>${o.detail}</em>` : nothing}
              </button>`,
            )
          : html`<p class="none">${filter.options.length ? 'Nothing matches.' : 'Nothing to choose yet.'}</p>`}
      </div>`;
  }

  override render() {
    const on = this.filters.flatMap((f) => (this.value[f.id] ?? []).map((v) => ({ filter: f, option: f.options.find((o) => o.value === v) })).filter((c) => c.option));
    const sortLabel = this.sorts.find((s) => s.value === this.sort)?.label;
    return html`<div class="bar" role="group" aria-label=${this.label}>
        <div class="filters">
          ${this.filters.map((f) => {
            const n = (this.value[f.id] ?? []).length;
            return html`<button class="open ${n ? 'on' : ''}" aria-haspopup="menu" aria-expanded=${String(this.opened === f.id)} aria-controls=${this.ids.panel}
              @click=${(e: Event) => void this.show(f.id, e.currentTarget as HTMLElement)}>
              ${f.label}${n ? html`<span class="n" aria-label=${`${n} chosen`}>${n}</span>` : nothing}<ui-icon name="chevron-down" size="16"></ui-icon>
            </button>`;
          })}
        </div>
        <div class="end">
          ${this.count === undefined ? nothing : html`<span class="count" aria-live="polite">${this.count} ${this.count === 1 ? this.noun[0] : this.noun[1]}</span>`}
          ${this.sorts.length
            ? html`<button class="open sort" aria-haspopup="menu" aria-expanded=${String(this.opened === 'sort')} aria-controls=${this.ids.panel}
                @click=${(e: Event) => void this.show('sort', e.currentTarget as HTMLElement)}>
                <ui-icon name="sort" size="16"></ui-icon>Sort: <strong>${sortLabel ?? this.sorts[0].label}</strong>
              </button>`
            : nothing}
          <slot name="actions"></slot>
        </div>
      </div>
      ${on.length
        ? html`<div class="chips">
            ${on.map(
              ({ filter, option }) => html`<ui-tag removable label=${option!.label} icon=${option!.icon ?? ''} remove-label=${`${filter.label}: ${option!.label}`}
                @ui-remove=${() => this.changed({ ...this.value, [filter.id]: (this.value[filter.id] ?? []).filter((v) => v !== option!.value) })}></ui-tag>`,
            )}
            <button class="clear" @click=${this.clear}>Clear all</button>
          </div>`
        : nothing}
      <div class="panel" id=${this.ids.panel} popover="manual" ?hidden=${!this.opened} @keydown=${this.onPanelKey}>${this.opened ? this.renderPanel() : nothing}</div>`;
  }
}

if (!customElements.get('ui-filter-bar')) customElements.define('ui-filter-bar', UiFilterBar);

declare global {
  interface HTMLElementTagNameMap {
    'ui-filter-bar': UiFilterBar;
  }
}
