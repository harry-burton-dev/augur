import { LitElement, css, html, nothing } from 'lit';
import { base, label } from '../shared.js';
import './icon.js';

export interface TreeItem {
  id: string;
  label: string;
  /** A kit icon before the label: `folder` for a folder. */
  icon?: string;
  /** A count or a word at the end: "12". */
  meta?: string;
  children?: TreeItem[];
}

interface Visible {
  item: TreeItem;
  level: number;
  parent?: TreeItem;
}

/** The ids from the top of the tree down to `id`, itself included, or [] when it isn't there. */
export const treePath = (items: readonly TreeItem[], id: string): string[] => {
  for (const item of items) {
    if (item.id === id) return [id];
    const below = treePath(item.children ?? [], id);
    if (below.length) return [item.id, ...below];
  }
  return [];
};

/**
 * Things inside things, such as a library's folders: one row each, indented
 * under its parent, with a chevron to open or close what's inside. One row is
 * the selected one; the rows above it open by themselves so it can be seen.
 *
 * `compact` shows only the top-level rows, as icons with their names on
 * hover, for a rail folded to a strip.
 *
 * Follows the ARIA tree pattern. Keys: ↑ ↓ move, → opens or goes in, ← closes
 * or goes up, Home / End, Enter or Space selects. Only one row takes Tab.
 *
 * @fires ui-select - detail `{ item }`, when a row is chosen
 * @fires ui-toggle - detail `{ item, open }`, when a row is opened or closed
 */
export class UiTree extends LitElement {
  static override properties = {
    label: { type: String },
    heading: { type: String },
    items: { attribute: false },
    selected: { type: String },
    open: { attribute: false },
    compact: { type: Boolean, reflect: true },
    focused: { state: true },
  };

  /** What the tree is, for screen readers: "Folders". */
  declare label: string;
  /** A small-capitals line above the rows, when the tree needs one on screen. */
  declare heading: string;
  declare items: TreeItem[];
  declare selected: string;
  /** Ids of the rows that show what's inside them. The selected row's parents are always open. */
  declare open: Set<string>;
  /** Icons only, one per top-level row, its name on hover: how a folded `ui-app-frame` rail shows it. */
  declare compact: boolean;
  declare focused: string;

  constructor() {
    super();
    this.label = '';
    this.heading = '';
    this.items = [];
    this.selected = '';
    this.open = new Set();
    this.compact = false;
    this.focused = '';
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('selected') || changed.has('items')) {
      const path = treePath(this.items, this.selected).slice(0, -1);
      if (path.some((id) => !this.open.has(id))) this.open = new Set([...this.open, ...path]);
    }
  }

  override focus(options?: FocusOptions) {
    this.rowFor(this.tabStop())?.focus(options);
  }

  /** The rows on screen, top to bottom. */
  private visible(): Visible[] {
    const out: Visible[] = [];
    const walk = (items: readonly TreeItem[], level: number, parent?: TreeItem) => {
      for (const item of items) {
        out.push({ item, level, parent });
        if (item.children?.length && this.open.has(item.id) && !this.compact) walk(item.children, level + 1, item);
      }
    };
    walk(this.items, 1);
    return out;
  }

  /** The one row Tab lands on: the focused row, else the selected one, else the first. */
  private tabStop() {
    const ids = this.visible().map((v) => v.item.id);
    return [this.focused, this.selected].find((id) => id && ids.includes(id)) ?? ids[0] ?? '';
  }

  private rowFor(id: string) {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('[role="treeitem"]')].find((r) => r.dataset.id === id);
  }

  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private toggle(item: TreeItem, open = !this.open.has(item.id)) {
    if (!item.children?.length || open === this.open.has(item.id)) return;
    const next = new Set(this.open);
    if (open) next.add(item.id);
    else next.delete(item.id);
    this.open = next;
    this.emit('ui-toggle', { item, open });
  }

  private choose(item: TreeItem) {
    this.focused = item.id;
    if (item.id !== this.selected) {
      this.selected = item.id;
      this.emit('ui-select', { item });
    }
  }

  private async moveTo(id: string | undefined) {
    if (!id) return;
    this.focused = id;
    await this.updateComplete;
    this.rowFor(id)?.focus();
  }

  private onKey(e: KeyboardEvent, at: Visible) {
    const rows = this.visible();
    const i = rows.findIndex((v) => v.item.id === at.item.id);
    const { item } = at;
    const hasKids = !!item.children?.length;
    const isOpen = this.open.has(item.id);
    switch (e.key) {
      case 'ArrowDown':
        void this.moveTo(rows[i + 1]?.item.id);
        break;
      case 'ArrowUp':
        void this.moveTo(rows[i - 1]?.item.id);
        break;
      case 'Home':
        void this.moveTo(rows[0]?.item.id);
        break;
      case 'End':
        void this.moveTo(rows.at(-1)?.item.id);
        break;
      case 'ArrowRight':
        if (hasKids && !isOpen) this.toggle(item, true);
        else if (hasKids) void this.moveTo(item.children![0].id);
        break;
      case 'ArrowLeft':
        if (hasKids && isOpen) this.toggle(item, false);
        else void this.moveTo(at.parent?.id);
        break;
      case 'Enter':
      case ' ':
        this.choose(item);
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: block; }
      .heading { padding: var(--space-3) var(--space-3) var(--space-2); }
      ul { list-style: none; margin: 0; padding: 0; }
      .row {
        display: flex; align-items: center; gap: var(--space-2); min-height: 36px;
        padding: 0 var(--space-3) 0 calc(var(--space-2) + (var(--level) - 1) * var(--space-5));
        border-radius: var(--radius-key); cursor: pointer; outline: none;
        font-size: var(--type-body); line-height: var(--leading-body);
      }
      .row:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
      .row:focus-visible { box-shadow: inset 0 0 0 1.5px var(--focus); }
      .row[aria-selected='true'] { background: color-mix(in srgb, var(--ink) 8%, transparent); font-weight: 500; }
      .chev { all: unset; flex: none; display: grid; place-items: center; width: 20px; height: 20px; border-radius: var(--radius-key); color: var(--ink-muted); cursor: pointer; }
      .chev ui-icon { transition: transform var(--motion-quick) var(--ease-standard); transform: rotate(-90deg); }
      .chev.open ui-icon { transform: none; }
      .chev:hover { color: var(--ink); }
      .spacer { flex: none; width: 20px; }
      ui-icon.mark { flex: none; color: var(--ink-muted); }
      .name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .meta { flex: none; font-size: var(--type-small); color: var(--ink-muted); font-variant-numeric: tabular-nums; }
      ul[role='group'] > li { animation: unfold var(--motion-base) var(--ease-out) both; }
      @keyframes unfold { from { opacity: 0; transform: translateY(-4px); } }
      :host([compact]) .heading { padding: 0; height: 1px; margin: var(--space-2) var(--space-2); background: var(--hairline); font-size: 0; }
      :host([compact]) .row { justify-content: center; width: 36px; min-height: 36px; padding: 0; margin: 0 auto; }
      :host([compact]) .chev, :host([compact]) .spacer, :host([compact]) .meta { display: none; }
      :host([compact]) .name { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      :host([compact]) ui-icon.mark { color: var(--ink); }
      @media (prefers-reduced-motion: reduce) {
        ul[role='group'] > li { animation: none; }
      }
    `,
  ];

  private renderItems(items: readonly TreeItem[], level: number, parent: TreeItem | undefined, stop: string): unknown {
    return items.map((item) => {
      const hasKids = !!item.children?.length;
      const isOpen = hasKids && this.open.has(item.id);
      const at: Visible = { item, level, parent };
      return html`<li role="none">
        <div
          class="row"
          role="treeitem"
          data-id=${item.id}
          style=${`--level:${level}`}
          title=${this.compact ? item.label : nothing}
          aria-level=${level}
          aria-selected=${item.id === this.selected ? 'true' : 'false'}
          aria-expanded=${hasKids ? String(isOpen) : nothing}
          tabindex=${item.id === stop ? '0' : '-1'}
          @click=${() => this.choose(item)}
          @keydown=${(e: KeyboardEvent) => this.onKey(e, at)}
        >
          ${hasKids
            ? html`<button class="chev ${isOpen ? 'open' : ''}" tabindex="-1" aria-hidden="true"
                @click=${(e: Event) => { e.stopPropagation(); this.toggle(item); }}><ui-icon name="chevron-down" size="14"></ui-icon></button>`
            : html`<span class="spacer"></span>`}
          ${item.icon ? html`<ui-icon class="mark" name=${item.icon} size="16"></ui-icon>` : nothing}
          <span class="name">${item.label}</span>
          ${item.meta ? html`<span class="meta">${item.meta}</span>` : nothing}
        </div>
        ${isOpen && !this.compact ? html`<ul role="group">${this.renderItems(item.children!, level + 1, item, stop)}</ul>` : nothing}
      </li>`;
    });
  }

  override render() {
    const stop = this.tabStop();
    return html`${this.heading ? html`<div class="heading label">${this.heading}</div>` : nothing}
      <ul role="tree" aria-label=${this.label || this.heading || nothing}>${this.renderItems(this.items, 1, undefined, stop)}</ul>`;
  }
}

if (!customElements.get('ui-tree')) customElements.define('ui-tree', UiTree);

declare global {
  interface HTMLElementTagNameMap {
    'ui-tree': UiTree;
  }
}
