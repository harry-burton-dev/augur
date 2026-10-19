import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import './heading.js';
import './button.js';

/** Anything slotted that can be checked like a field (ui-text-field and future inputs). */
interface Checkable extends HTMLElement {
  check(): boolean;
  focus(): void;
  value?: string;
  name?: string;
}

export type DialogSubmit = (values: Record<string, string>, dialog: UiDialog) => void | false | Promise<void | false>;

/**
 * One decision or one small task, over everything, on the veil. Built on the
 * native <dialog>, so focus stays inside, the page behind is inert and focus
 * returns where it was on close.
 *
 * Pressing the primary checks every slotted field and goes to the first gap.
 * If `submit` returns a Promise the primary shows `busy-label`, nothing can be
 * pressed and Esc waits; a rejection keeps the dialog open with its message.
 *
 * @slot - body text or content
 * @slot fields - ui-text-field and other checkable inputs
 * @fires ui-close - detail `{ result }`; result is null when cancelled
 */
export class UiDialog extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    eyebrow: { type: String },
    heading: { type: String },
    summary: { type: String },
    size: { type: String, reflect: true },
    actionLabel: { type: String, attribute: 'action-label' },
    busyLabel: { type: String, attribute: 'busy-label' },
    cancelLabel: { type: String, attribute: 'cancel-label' },
    danger: { type: Boolean },
    ai: { type: Boolean },
    light: { type: Boolean },
    submit: { attribute: false },
    busy: { state: true },
    error: { state: true },
  };

  declare open: boolean;
  declare eyebrow: string;
  declare heading: string;
  declare summary: string;
  declare size: 'decision' | 'glance' | 'read';
  declare actionLabel: string;
  declare busyLabel: string;
  declare cancelLabel: string;
  declare danger: boolean;
  declare ai: boolean;
  /** A click on the veil closes it; leave off for forms so a stray click loses nothing. */
  declare light: boolean;
  declare submit: DialogSubmit | undefined;
  declare busy: boolean;
  declare error: string;

  constructor() {
    super();
    this.open = false;
    this.eyebrow = '';
    this.heading = '';
    this.summary = '';
    this.size = 'decision';
    this.actionLabel = '';
    this.busyLabel = '';
    this.cancelLabel = 'Cancel';
    this.danger = false;
    this.ai = false;
    this.light = false;
    this.busy = false;
    this.error = '';
  }

  private get dialog(): HTMLDialogElement | null {
    return this.renderRoot.querySelector('dialog');
  }

  private get fields(): Checkable[] {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="fields"]');
    return (slot?.assignedElements({ flatten: true }) ?? []).filter(
      (el): el is Checkable => typeof (el as Checkable).check === 'function',
    );
  }

  show() {
    this.open = true;
  }

  close(result: unknown = null) {
    if (!this.open) return;
    this.open = false;
    this.busy = false;
    this.dispatchEvent(new CustomEvent('ui-close', { detail: { result }, bubbles: true, composed: true }));
  }

  setError(message: string) {
    this.error = message;
  }

  override async updated(changed: Map<string, unknown>) {
    if (!changed.has('open')) return;
    const dialog = this.dialog;
    if (!dialog) return;
    if (this.open && !dialog.open) {
      this.error = '';
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      await this.updateComplete;
      this.initialFocus();
    } else if (!this.open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }

  private initialFocus() {
    const empty = this.fields.find((f) => !f.value);
    if (empty) return empty.focus();
    const primary = this.renderRoot.querySelector<HTMLElement>(this.danger ? '.cancel' : '.primary');
    primary?.focus();
  }

  /** Check every field, then run `submit`. Resolves true when the dialog closed. */
  async confirm(): Promise<boolean> {
    if (this.busy) return false;
    const fields = this.fields;
    const results = fields.map((f) => f.check());
    const firstGap = results.indexOf(false);
    if (firstGap >= 0) {
      fields[firstGap].focus();
      return false;
    }
    const values = Object.fromEntries(fields.filter((f) => f.name).map((f) => [f.name!, f.value ?? '']));
    try {
      const pending = this.submit?.(values, this);
      if (pending instanceof Promise) {
        this.busy = true;
        this.error = '';
        const outcome = await pending;
        this.busy = false;
        if (outcome === false) return false;
      } else if (pending === false) {
        return false;
      }
      this.close(values);
      return true;
    } catch (err) {
      this.busy = false;
      this.error = err instanceof Error && err.message ? err.message : 'Something went wrong. Nothing was changed; try again.';
      return false;
    }
  }

  private onCancel(e: Event) {
    // Native Esc: wait while working, otherwise close as cancelled.
    e.preventDefault();
    if (!this.busy) this.close(null);
  }

  private onVeilClick(e: MouseEvent) {
    if (this.light && !this.busy && e.target === this.dialog) this.close(null);
  }

  static override styles = [
    base,
    css`
      :host { display: contents; }
      dialog {
        width: min(var(--measure-decision), calc(100% - 2 * var(--edge)));
        max-width: none;
        margin: max(var(--space-6), calc(46vh - 180px)) auto var(--space-6);
        /* A long form scrolls inside the dialog rather than running off the bottom of the screen. */
        max-height: calc(100dvh - max(var(--space-6), calc(46vh - 180px)) - var(--space-6));
        overflow: auto;
        overscroll-behavior: contain;
        padding: var(--space-5);
        border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
        border-radius: var(--radius-card);
        background: var(--surface-overlay);
        backdrop-filter: blur(22px) saturate(1.25);
        box-shadow: var(--shadow-overlay), inset 0 1px 0 color-mix(in srgb, var(--light) 6%, transparent);
        color: var(--ink);
        font-family: var(--font-sans);
      }
      dialog[open] { display: flex; flex-direction: column; gap: var(--space-4); animation: rise var(--motion-slow) var(--ease-out); }
      dialog > * { flex-shrink: 0; }
      :host([size='glance']) dialog { width: min(var(--measure-glance), calc(100% - 2 * var(--edge))); }
      :host([size='read']) dialog { width: min(var(--measure-read), calc(100% - 2 * var(--edge))); }
      dialog::backdrop {
        background: radial-gradient(ellipse 60% 60% at 50% 46%, color-mix(in srgb, var(--slate-deep) 45%, transparent), var(--veil));
        backdrop-filter: blur(6px);
      }
      @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
      ui-heading { --x: 0; }
      .error {
        display: flex;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-inset);
        background: color-mix(in srgb, var(--danger) 10%, transparent);
        color: var(--danger);
        font-size: var(--type-meta);
        line-height: var(--leading-meta);
      }
      .body { display: flex; flex-direction: column; gap: var(--space-4); color: var(--ink-muted); }
      .body ::slotted(p) { margin: 0; }
      .fields { display: flex; flex-direction: column; gap: var(--space-5); }
      .actions { display: flex; align-items: center; gap: var(--space-5); flex-wrap: wrap; padding-top: var(--space-2); }
      .cancel {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        border: 0;
        background: none;
        color: var(--ink-muted);
        font: inherit;
        font-size: var(--type-body);
        cursor: pointer;
        padding: var(--space-2) 2px;
        border-radius: var(--radius-key);
      }
      .cancel:hover { color: var(--ink); }
      .cancel:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 3px; }
      .cancel[disabled] { opacity: 0.4; cursor: default; }
      kbd {
        font: inherit;
        font-size: var(--type-small);
        line-height: 1;
        padding: 3px 6px;
        border: 1px solid var(--hairline-strong);
        border-radius: var(--radius-key);
      }
      @media (prefers-reduced-motion: reduce) { dialog[open] { animation: none; } }
    `,
  ];

  override render() {
    return html`<dialog
      aria-label=${this.heading || nothing}
      @cancel=${this.onCancel}
      @click=${this.onVeilClick}
      @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT' && this.confirm()}
    >
      <ui-heading size="s" .eyebrow=${this.eyebrow} .heading=${this.heading} .summary=${this.summary}></ui-heading>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      <div class="body"><slot></slot></div>
      <div class="fields"><slot name="fields"></slot></div>
      <div class="actions">
        ${this.actionLabel
          ? html`<ui-button
              class="primary"
              kind=${this.danger ? 'danger' : 'primary'}
              ?once=${this.danger}
              ?ai=${this.ai}
              ?busy=${this.busy}
              busy-label=${this.busyLabel}
              @click=${() => this.confirm()}
            >${this.actionLabel}</ui-button>`
          : nothing}
        <button class="cancel" ?disabled=${this.busy} @click=${() => this.close(null)}><kbd>Esc</kbd>${this.cancelLabel}</button>
      </div>
    </dialog>`;
  }
}

if (!customElements.get('ui-dialog')) customElements.define('ui-dialog', UiDialog);

declare global {
  interface HTMLElementTagNameMap {
    'ui-dialog': UiDialog;
  }
}
