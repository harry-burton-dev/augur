import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import './icon.js';

/** One action in a menu, or '-' for the line before the next group (danger goes last, behind one). */
export interface MenuAction {
  id: string;
  label: string;
  icon?: string;
  /** Shown at the end; pressing it while the menu is open picks the item. */
  key?: string;
  danger?: boolean;
  /** Can't be used now: shown at 40% and skipped by the arrows. Prefer leaving it out. */
  disabled?: boolean;
}

export type MenuEntry = MenuAction | '-';

const isAction = (e: MenuEntry): e is MenuAction => e !== '-';

/**
 * A short list of actions that opens from a button: a row's or a group's ⋯,
 * or a tool in a bar. It opens under its button (above it near the bottom of
 * the screen) on a near-opaque surface, in the top layer, so a scrolling or
 * transformed parent never clips it.
 *
 * The main action goes first, danger last. Never more than about eight items:
 * past that it's a page, not a menu.
 *
 * Keys: ↑ ↓, Home / End, Enter or Space picks, an item's own key picks it,
 * Esc closes and puts focus back on the button, Tab closes. A click outside
 * closes it. One menu is open at a time.
 *
 * @fires ui-select - detail `{ item }`; the menu has closed
 * @fires ui-close - detail `{ picked }`
 */
export class UiMenu extends LitElement {
  static override properties = {
    label: { type: String },
    items: { attribute: false },
    isOpen: { type: Boolean, reflect: true, attribute: 'open' },
  };

  declare label: string;
  declare items: MenuEntry[];
  declare isOpen: boolean;

  private anchor: HTMLElement | null = null;
  private static openOne: UiMenu | null = null;
  private readonly onOutside = (e: PointerEvent) => {
    const path = e.composedPath();
    if (!path.includes(this) && !(this.anchor && path.includes(this.anchor))) this.close(false);
  };

  constructor() {
    super();
    this.label = '';
    this.items = [];
    this.isOpen = false;
  }

  /** Opens under `anchor` (usually the button that was pressed), with focus on the first item. */
  async show(anchor: HTMLElement, items?: MenuEntry[]) {
    if (UiMenu.openOne && UiMenu.openOne !== this) UiMenu.openOne.close(false);
    UiMenu.openOne = this;
    if (items) this.items = items;
    this.anchor = anchor;
    this.isOpen = true;
    if (typeof this.showPopover === 'function' && !this.matches(':popover-open')) {
      this.setAttribute('popover', 'manual');
      try {
        this.showPopover();
      } catch {
        // Not connected or no top layer: it still shows, positioned in place.
      }
    }
    this.place();
    document.addEventListener('pointerdown', this.onOutside, true);
    await this.updateComplete;
    this.buttons()[0]?.focus();
  }

  close(refocus = true, picked: MenuAction | null = null) {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (UiMenu.openOne === this) UiMenu.openOne = null;
    document.removeEventListener('pointerdown', this.onOutside, true);
    if (typeof this.hidePopover === 'function' && this.matches(':popover-open')) {
      try {
        this.hidePopover();
      } catch {
        // already hidden
      }
    }
    const back = this.anchor;
    this.anchor = null;
    if (refocus) (back as (HTMLElement & { focus(): void }) | null)?.focus();
    this.dispatchEvent(new CustomEvent('ui-close', { detail: { picked }, bubbles: true, composed: true }));
  }

  toggle(anchor: HTMLElement) {
    if (this.isOpen) this.close();
    else void this.show(anchor);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this.onOutside, true);
    if (UiMenu.openOne === this) UiMenu.openOne = null;
  }

  /** Under the button, right edges lined up; above it when there's no room below. */
  private place() {
    if (!this.anchor) return;
    const r = this.anchor.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    this.style.left = '';
    this.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    if (below < 240 && r.top > below) {
      this.style.top = '';
      this.style.bottom = `${window.innerHeight - r.top + 4}px`;
    } else {
      this.style.bottom = '';
      this.style.top = `${r.bottom + 4}px`;
    }
  }

  private buttons() {
    return [...this.renderRoot.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
  }

  private pick(item: MenuAction) {
    if (item.disabled) return;
    this.close(true, item);
    this.dispatchEvent(new CustomEvent('ui-select', { detail: { item }, bubbles: true, composed: true }));
  }

  private onKey(e: KeyboardEvent) {
    const buttons = this.buttons();
    const at = buttons.indexOf(this.renderRoot instanceof ShadowRoot ? (this.renderRoot.activeElement as HTMLButtonElement) : buttons[0]);
    const go = (i: number) => {
      e.preventDefault();
      buttons[(i + buttons.length) % buttons.length]?.focus();
    };
    // Keys stop here: an Esc that closes the menu mustn't also close what it opened over.
    e.stopPropagation();
    if (e.key === 'ArrowDown') return go(at + 1);
    if (e.key === 'ArrowUp') return go(at - 1);
    if (e.key === 'Home') return go(0);
    if (e.key === 'End') return go(buttons.length - 1);
    if (e.key === 'Escape') {
      e.preventDefault();
      return this.close();
    }
    if (e.key === 'Tab') return this.close(false);
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const keyed = this.items.filter(isAction).find((it) => !it.disabled && it.key?.toLowerCase() === e.key.toLowerCase());
      if (keyed) {
        e.preventDefault();
        this.pick(keyed);
      }
    }
  }

  static override styles = [
    base,
    css`
      :host { position: fixed; z-index: 30; margin: 0; padding: 0; border: 0; background: none; overflow: visible; inset: auto; }
      :host(:not([open])) { display: none; }
      [role='menu'] {
        min-width: 200px;
        max-width: 320px;
        padding: var(--space-1);
        background: var(--surface-overlay);
        backdrop-filter: blur(var(--surface-blur));
        border: 1px solid var(--hairline-strong);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow-overlay, 0 12px 32px rgba(0, 0, 0, 0.35));
      }
      button {
        all: unset;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        width: 100%;
        min-height: 36px;
        padding: var(--space-1) var(--space-3);
        border-radius: var(--radius-key);
        color: var(--ink);
        font-size: var(--type-meta);
        line-height: var(--leading-meta);
        cursor: pointer;
      }
      button:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
      button:focus-visible { outline: 0; box-shadow: inset 0 0 0 1.5px var(--focus); }
      button[disabled] { opacity: 0.4; cursor: default; }
      button.danger { color: var(--danger); }
      ui-icon { color: var(--ink-muted); }
      button.danger ui-icon { color: var(--danger); }
      .name { flex: 1; }
      kbd { font: inherit; font-size: var(--type-label); color: var(--ink-muted); }
      hr { border: 0; border-top: 1px solid var(--hairline); margin: var(--space-1) 0; }
    `,
  ];

  override render() {
    return html`<div role="menu" aria-label=${this.label || nothing} @keydown=${this.onKey}>
      ${this.items.map((it) =>
        isAction(it)
          ? html`<button role="menuitem" class=${it.danger ? 'danger' : ''} ?disabled=${it.disabled} tabindex="-1" @click=${() => this.pick(it)}>
              ${it.icon ? html`<ui-icon name=${it.danger ? 'error' : it.icon} size="16"></ui-icon>` : it.danger ? html`<ui-icon name="error" size="16"></ui-icon>` : nothing}
              <span class="name">${it.label}</span>
              ${it.key ? html`<kbd>${it.key}</kbd>` : nothing}
            </button>`
          : html`<hr role="separator" />`,
      )}
    </div>`;
  }
}

if (!customElements.get('ui-menu')) customElements.define('ui-menu', UiMenu);

declare global {
  interface HTMLElementTagNameMap {
    'ui-menu': UiMenu;
  }
}
