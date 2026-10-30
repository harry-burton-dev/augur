import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import './icon.js';

/** One thing that can be done with the object the menu is open on. */
export interface RadialAction {
  id: string;
  label: string;
  /** A kit icon. */
  icon: string;
  /** Destroys or removes something: drawn in the danger colour. */
  danger?: boolean;
}

/** How far the ring sits beyond the object's edge, and how big each action's button is. */
const GAP = 44;
const BUTTON = 44;

/**
 * The actions of one object, in a ring around it: what opens when someone
 * right-clicks a tile (or presses the context-menu key, or Shift+F10). Every
 * action an object has lives here, so a screen shows things, not buttons.
 *
 * Opening it takes the rest of the screen out of focus (blurred and dimmed)
 * and leaves the object sharp in a cut-out, ringed as selected, with its
 * actions around it, the first at the top and the rest clockwise. Each one's
 * name shows beside it on hover or focus.
 *
 * Keys: ← → ↑ ↓ (or Tab) move round the ring, Enter or Space chooses, Esc closes.
 * A click anywhere off the ring closes it too.
 *
 * @fires ui-select - detail `{ action }`, when an action is chosen; the menu closes
 * @fires ui-close - the menu closed without a choice
 */
export class UiRadialMenu extends LitElement {
  static override properties = {
    actions: { attribute: false },
    label: { type: String },
    open: { type: Boolean, reflect: true },
    focused: { state: true },
    at: { state: true },
  };

  declare actions: RadialAction[];
  /** What the object is, for screen readers: "Actions for Policy & Guidance". */
  declare label: string;
  declare open: boolean;
  declare focused: number;
  /** The object's box on screen, from `show`. */
  declare at: DOMRect | undefined;

  private returnTo?: HTMLElement;

  constructor() {
    super();
    this.actions = [];
    this.label = '';
    this.open = false;
    this.focused = 0;
  }

  /** Opens the ring around `target`, which takes focus back when the menu closes. */
  show(target: HTMLElement) {
    this.returnTo = target;
    this.at = target.getBoundingClientRect();
    this.focused = 0;
    this.open = true;
  }

  close(chosen?: RadialAction) {
    if (!this.open) return;
    this.open = false;
    this.returnTo?.focus();
    this.dispatchEvent(chosen ? new CustomEvent('ui-select', { detail: { action: chosen }, bubbles: true, composed: true }) : new CustomEvent('ui-close', { bubbles: true, composed: true }));
  }

  static override styles = [
    base,
    css`
      :host { position: fixed; inset: 0; z-index: 60; pointer-events: none; }
      :host(:not([open])) { visibility: hidden; }
      .veil {
        position: absolute; inset: 0; pointer-events: auto;
        background: color-mix(in srgb, var(--slate-deep, #000) 55%, transparent);
        backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        opacity: 0; transition: opacity var(--motion-base) var(--ease-out);
      }
      :host([open]) .veil { opacity: 1; }
      .ring-mark { position: absolute; border: 1.5px solid var(--focus); border-radius: var(--radius-inset); box-shadow: 0 0 0 4px color-mix(in srgb, var(--focus) 18%, transparent); pointer-events: none; opacity: 0; transition: opacity var(--motion-base) var(--ease-out); }
      :host([open]) .ring-mark { opacity: 1; }
      ul { list-style: none; margin: 0; padding: 0; }
      li { position: absolute; width: ${BUTTON}px; height: ${BUTTON}px; margin: -${BUTTON / 2}px 0 0 -${BUTTON / 2}px; pointer-events: auto; }
      button {
        all: unset; box-sizing: border-box; width: 100%; height: 100%; display: grid; place-items: center; cursor: pointer;
        border-radius: 50%; color: var(--ink); background: var(--surface-overlay); border: 1px solid var(--hairline-strong);
        transform: translate(var(--from-x), var(--from-y)) scale(0.4); opacity: 0;
        transition: transform var(--motion-slow) var(--ease-spring), opacity var(--motion-base) var(--ease-out), background var(--motion-instant) var(--ease-standard), border-color var(--motion-instant) var(--ease-standard);
        transition-delay: calc(var(--i) * 18ms);
      }
      :host([open]) button { transform: none; opacity: 1; }
      button:hover, button:focus-visible { background: var(--surface-raised); border-color: var(--focus); outline: none; }
      button.danger { color: var(--danger); }
      .name {
        position: absolute; top: 50%; transform: translateY(-50%); white-space: nowrap; pointer-events: none;
        padding: 2px var(--space-2); border-radius: var(--radius-key); font-size: var(--type-small); color: var(--ink); background: var(--surface-overlay);
        opacity: 0; transition: opacity var(--motion-quick) var(--ease-out);
      }
      .name.right { left: calc(100% + var(--space-2)); }
      .name.left { right: calc(100% + var(--space-2)); }
      li:hover .name, button:focus-visible + .name { opacity: 1; }
      @media (prefers-reduced-motion: reduce) {
        button { transform: none; transition: opacity var(--motion-base) var(--ease-out); transition-delay: 0ms; }
      }
    `,
  ];

  override updated(changed: Map<string, unknown>) {
    if ((changed.has('open') || changed.has('focused')) && this.open) this.buttons()[this.focused]?.focus();
  }

  private buttons() {
    return [...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
  }

  private onKey(e: KeyboardEvent) {
    const n = this.actions.length;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (['ArrowRight', 'ArrowDown'].includes(e.key) || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      this.focused = (this.focused + 1) % n;
    } else if (['ArrowLeft', 'ArrowUp'].includes(e.key) || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      this.focused = (this.focused - 1 + n) % n;
    }
  }

  override render() {
    const at = this.at;
    if (!at) return nothing;
    const cx = at.left + at.width / 2;
    const cy = at.top + at.height / 2;
    const radius = Math.max(at.width, at.height) / 2 + GAP;
    const n = Math.max(this.actions.length, 1);
    // A cut-out the object's shape, so it stays sharp while everything else goes out of focus.
    const w = window.innerWidth;
    const h = window.innerHeight;
    const hole = `path(evenodd, 'M0 0H${w}V${h}H0Z M${at.left - 6} ${at.top - 6}h${at.width + 12}v${at.height + 12}h${-(at.width + 12)}Z')`;
    return html`<div class="veil" style=${`clip-path:${hole}`} @click=${() => this.close()} @contextmenu=${(e: Event) => { e.preventDefault(); this.close(); }}></div>
      <div class="ring-mark" style=${`left:${at.left - 6}px;top:${at.top - 6}px;width:${at.width + 12}px;height:${at.height + 12}px`}></div>
      <ul role="menu" aria-label=${this.label || 'Actions'} @keydown=${this.onKey}>
        ${this.actions.map((a, i) => {
          const angle = -Math.PI / 2 + (i * Math.PI * 2) / n;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          const side = Math.cos(angle) >= -0.01 ? 'right' : 'left';
          return html`<li role="none" style=${`left:${x}px;top:${y}px;--i:${i};--from-x:${cx - x}px;--from-y:${cy - y}px`}>
            <button role="menuitem" class=${a.danger ? 'danger' : ''} aria-label=${a.label} tabindex=${i === this.focused ? 0 : -1}
              @click=${() => this.close(a)} @focus=${() => (this.focused = i)}>
              <ui-icon name=${a.icon} size="18" aria-hidden="true"></ui-icon>
            </button>
            <span class=${`name ${side}`} aria-hidden="true">${a.label}</span>
          </li>`;
        })}
      </ul>`;
  }
}

if (!customElements.get('ui-radial-menu')) customElements.define('ui-radial-menu', UiRadialMenu);

declare global {
  interface HTMLElementTagNameMap {
    'ui-radial-menu': UiRadialMenu;
  }
}
