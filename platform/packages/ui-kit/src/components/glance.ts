import { LitElement, css, html, nothing } from 'lit';
import { base, label } from '../shared.js';
import './button.js';
import './icon.js';

export type GlanceVariant = 'veil' | 'sheet' | 'card' | 'split' | 'title';
export type GlanceSkin = 'hairline' | 'bubble';

export interface GlanceAction {
  label: string;
  onSelect?: (data: GlanceData) => void;
}

export interface GlanceData {
  eyebrow?: string;
  icon?: string;
  title?: string;
  summary?: string;
  /** At most three; extras are dropped. */
  facts?: { value: string | number; label: string }[];
  /** At most five, for looking, not clicking; extras are dropped. */
  rows?: { label: string; value: string }[];
  primary?: GlanceAction;
  secondary?: GlanceAction;
  loading?: boolean;
  /** A red line, with Try again as the primary. */
  error?: string;
  onRetry?: () => void;
  /** What isn't there yet: "No runs yet. It runs at 07:00." */
  empty?: string;
}

/**
 * A quick look at one thing before you go in: what it is in one line, at most
 * three facts and five rows, one primary action and one secondary word. Fills
 * the nearest positioned ancestor, like the menu it opens over.
 *
 * Opens with focus on the primary, so Enter does it; ← → or Tab move between
 * the two actions and stay inside; Esc goes back.
 *
 * @fires ui-action - detail `{ which: 'primary' | 'secondary', data }`
 * @fires ui-close - detail `{ data }`; put focus back on the menu here
 */
export class UiGlance extends LitElement {
  static override properties = {
    variant: { type: String, reflect: true },
    skin: { type: String, reflect: true },
    data: { attribute: false },
    isOpen: { type: Boolean, reflect: true, attribute: 'open' },
  };

  declare variant: GlanceVariant;
  declare skin: GlanceSkin;
  declare data: GlanceData;
  declare isOpen: boolean;

  constructor() {
    super();
    this.variant = 'veil';
    this.skin = 'hairline';
    this.data = {};
    this.isOpen = false;
  }

  open(data: GlanceData) {
    this.data = data;
    this.isOpen = true;
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.dispatchEvent(new CustomEvent('ui-close', { detail: { data: this.data }, bubbles: true, composed: true }));
  }

  override async updated(changed: Map<string, unknown>) {
    if (changed.has('isOpen') && this.isOpen) {
      await this.updateComplete;
      this.actions()[0]?.focus();
    }
  }

  private actions(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.primary, .secondary')];
  }

  private run(which: 'primary' | 'secondary') {
    const d = this.data;
    if (which === 'primary' && d.error) d.onRetry?.();
    else d[which]?.onSelect?.(d);
    this.dispatchEvent(new CustomEvent('ui-action', { detail: { which, data: d }, bubbles: true, composed: true }));
  }

  private onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }
    const list = this.actions();
    if (!list.length) return;
    const active = this.renderRoot instanceof ShadowRoot ? this.renderRoot.activeElement : null;
    const at = list.findIndex((el) => el === active || el.contains(active));
    const step = e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey) ? 1 : e.key === 'ArrowLeft' || e.key === 'Tab' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    list[(at + step + list.length) % list.length].focus();
  }

  static override styles = [
    base,
    label,
    css`
      :host {
        position: absolute;
        inset: 0;
        z-index: var(--layer-glance);
        overflow: hidden;
        visibility: hidden;
        opacity: 0;
        color: var(--ink);
        --g-font: var(--font-sans);
        --g-ease: cubic-bezier(0.2, 0.7, 0.2, 1);
        font-family: var(--g-font);
        transition: opacity var(--motion-slow) var(--ease-standard), visibility 0s var(--motion-slow);
      }
      :host([open]) { visibility: visible; opacity: 1; transition: opacity var(--motion-slow) var(--ease-standard); }
      :host([skin='bubble']) { --g-font: var(--font-rounded); }
      .frame { position: absolute; inset: 0; outline: none; }

      /* parts */
      ui-icon { color: var(--ink); margin-bottom: var(--space-4); }
      .title { margin: var(--space-3) 0 0; font-size: var(--type-title); line-height: var(--leading-title); font-weight: 300; letter-spacing: var(--tracking-tight); }
      .label + .title { margin-top: var(--space-3); }
      .summary { margin: var(--space-3) 0 0; max-width: var(--measure-prose); font-size: var(--type-body); line-height: var(--leading-body); color: var(--ink-muted); }
      .summary.error { color: var(--danger); }
      .facts { display: flex; gap: var(--space-7); margin: var(--space-6) 0 0; }
      .fact { display: flex; flex-direction: column-reverse; }
      .fact dd { margin: 0; font-size: var(--type-title-s); font-weight: 300; line-height: var(--leading-title-s); font-variant-numeric: tabular-nums; }
      .fact dt { white-space: nowrap; margin-top: var(--space-1); }
      .rows { list-style: none; margin: 0; padding: 0; }
      .rows li { display: flex; justify-content: space-between; gap: var(--space-5); padding: var(--space-3) 0; font-size: var(--type-meta); line-height: var(--leading-meta); border-bottom: 1px solid var(--hairline); }
      .rows li:last-child { border-bottom: 0; }
      .rows li span:last-child { color: var(--ink-muted); white-space: nowrap; }
      .actions { display: flex; align-items: center; gap: var(--space-5); margin-top: var(--space-6); }
      .secondary, .back {
        font: inherit; border: 0; background: none; cursor: pointer; padding: var(--space-2) 2px; border-radius: var(--radius-key);
        color: var(--ink-muted); font-size: var(--type-body);
      }
      .secondary:hover, .back:hover { color: var(--ink); }
      .secondary:focus-visible, .back:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 3px; }
      .back { position: absolute; left: 50%; bottom: var(--anchor-back); transform: translateX(-50%); z-index: 3; font-size: var(--type-small); line-height: var(--leading-small); }
      kbd { font: inherit; font-size: var(--type-label); line-height: var(--leading-label); border: 1px solid color-mix(in srgb, var(--ink-muted) 40%, transparent); border-radius: var(--radius-key); padding: 0 var(--space-1); margin-right: var(--space-2); }
      .skel { display: block; height: 12px; border-radius: var(--radius-pill); background: linear-gradient(90deg, color-mix(in srgb, var(--ink) 6%, transparent), color-mix(in srgb, var(--ink) 14%, transparent), color-mix(in srgb, var(--ink) 6%, transparent)); background-size: 200% 100%; animation: skel var(--motion-shimmer) var(--ease-standard) infinite; }
      @keyframes skel { from { background-position: 100% 0; } to { background-position: -100% 0; } }

      /* arrive: each part rises in turn */
      .col > *, .main > *, .side > *, .card > * { opacity: 0; transform: translateY(10px); transition: opacity var(--motion-calm) var(--ease-standard), transform var(--motion-calm) var(--g-ease); }
      :host([open]) :is(.col, .main, .side, .card) > * { opacity: 1; transform: none; }
      :host([open]) :is(.col, .main, .side, .card) > :nth-child(2) { transition-delay: var(--motion-instant); }
      :host([open]) :is(.col, .main, .side, .card) > :nth-child(3), :host([open]) :is(.col, .main, .side, .card) > :nth-child(4) { transition-delay: var(--motion-quick); }
      :host([open]) :is(.col, .main, .side, .card) > :nth-child(5) { transition-delay: var(--motion-base); }
      :host([open]) :is(.col, .main, .side, .card) > :nth-child(n + 6) { transition-delay: var(--motion-slow); }

      /* veil: no panel, the water darkens and the content stands in the middle */
      :host([variant='veil']) .frame { background: radial-gradient(ellipse 70% 70% at 50% 46%, color-mix(in srgb, var(--slate-deep) 55%, transparent), color-mix(in srgb, var(--slate-deep) 90%, transparent)); }
      .veil .col { position: absolute; left: 50%; top: var(--focal); transform: translate(-50%, -54%); width: min(var(--measure-glance), calc(100% - 2 * var(--edge))); display: flex; flex-direction: column; align-items: center; text-align: center; }
      .veil .facts, .veil .actions { justify-content: center; }

      /* sheet: frosted glass rises from the bottom */
      :host([variant='sheet']) .frame { background: linear-gradient(180deg, color-mix(in srgb, var(--slate-deep) 15%, transparent), color-mix(in srgb, var(--slate-deep) 55%, transparent)); }
      .sheet .panel {
        position: absolute; left: 50%; bottom: 0; width: min(var(--measure-wide), calc(100% - 2 * var(--edge-tight))); min-height: 60%;
        transform: translate(-50%, 100%); transition: transform var(--motion-calm) var(--g-ease);
        display: grid; grid-template-columns: 1.2fr 1fr; gap: var(--space-7); padding: var(--space-7) var(--space-7) var(--space-8);
        background: color-mix(in srgb, var(--slate-deep) 72%, transparent); backdrop-filter: blur(18px) saturate(1.2);
        border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); border-bottom: 0; border-radius: var(--radius-card) var(--radius-card) 0 0;
        box-shadow: 0 -20px 60px color-mix(in srgb, var(--shade) 35%, transparent);
      }
      :host([open]) .sheet .panel { transform: translate(-50%, 0); }
      .sheet .title, .card .title { font-size: var(--type-title-s); line-height: var(--leading-title-s); }
      .sheet .facts { margin: 0 0 var(--space-4); }

      /* card: one glass card with two ghosts behind it */
      :host([variant='card']) .frame { background: radial-gradient(ellipse 60% 60% at 50% 50%, color-mix(in srgb, var(--slate-deep) 35%, transparent), color-mix(in srgb, var(--slate-deep) 80%, transparent)); }
      .stack { position: absolute; left: 50%; top: var(--focal); width: min(var(--measure-card), calc(100% - 2 * var(--edge))); transform: translate(-50%, -50%) scale(0.94); transition: transform var(--motion-calm) var(--ease-spring); }
      :host([open]) .stack { transform: translate(-50%, -50%) scale(1); }
      .stack::before, .stack::after { content: ''; position: absolute; inset: 0; border-radius: var(--radius-card); background: var(--surface-raised); border: 1px solid var(--hairline); }
      .stack::before { transform: translateY(30px) scale(0.94); opacity: 0.7; }
      .stack::after { transform: translateY(58px) scale(0.88); opacity: 0.4; z-index: -1; }
      .card { position: relative; z-index: 1; padding: var(--space-6); border-radius: var(--radius-card); text-align: center; display: flex; flex-direction: column; align-items: center;
        background: var(--surface-overlay); backdrop-filter: blur(22px) saturate(1.25); border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent); box-shadow: var(--shadow-overlay); }
      .card .summary { font-size: var(--type-meta); line-height: var(--leading-meta); }
      .card .facts { gap: var(--space-6); justify-content: center; margin-top: var(--space-5); }
      .card .fact dd { font-size: var(--type-heading); line-height: var(--leading-heading); }
      .card .actions { flex-direction: column; gap: var(--space-2); width: 100%; margin-top: var(--space-5); }
      .card .primary { width: 100%; }

      /* split: darkened from the left, facts behind a hairline */
      :host([variant='split']) .frame { background: linear-gradient(90deg, color-mix(in srgb, var(--slate-deep) 92%, transparent) 0, color-mix(in srgb, var(--slate-deep) 78%, transparent) 50%, color-mix(in srgb, var(--slate-deep) 50%, transparent) 100%); }
      .split { position: absolute; inset: 0; display: grid; grid-template-columns: 1.2fr 1fr; gap: var(--space-8); align-items: center; padding: 0 8%; }
      .split .title { font-size: var(--type-display); line-height: var(--leading-display); font-weight: 200; }
      .split .side { padding-left: var(--space-7); border-left: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); }
      .split .facts { margin: 0 0 var(--space-5); gap: var(--space-6); }

      /* title: letterbox bars, thin tracked capitals, the action as an underlined word */
      :host([variant='title']) .frame { background: color-mix(in srgb, var(--slate-deep) 60%, transparent); }
      .bar { position: absolute; left: 0; right: 0; height: var(--letterbox); background: var(--slate-deep); z-index: 2; transition: transform var(--motion-calm) var(--ease-standard); }
      .bar.top { top: 0; transform: translateY(-100%); }
      .bar.bottom { bottom: 0; transform: translateY(100%); }
      :host([open]) .bar { transform: none; }
      .titled .col { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: calc(100% - 2 * var(--edge)); text-align: center; display: flex; flex-direction: column; align-items: center; }
      .titled .label { letter-spacing: var(--tracking-title); }
      .titled .title { font-size: var(--type-display-fluid); line-height: var(--leading-display-fluid); font-weight: 200; letter-spacing: var(--tracking-label); text-transform: uppercase; margin: var(--space-4) -0.2em 0 0; }
      .titled .facts { gap: var(--space-6); margin-top: var(--space-5); }
      .titled .fact { flex-direction: row-reverse; align-items: baseline; gap: var(--space-2); }
      .titled .fact dd { font-size: var(--type-lead); line-height: var(--leading-lead); }
      .titled .actions { margin-top: var(--space-7); gap: var(--space-6); }
      .word { font: inherit; border: 0; background: none; cursor: pointer; color: var(--ink); font-size: var(--type-lead); line-height: var(--leading-lead); padding: var(--space-1) 0; text-decoration: underline; text-decoration-color: var(--green); text-underline-offset: 8px; text-decoration-thickness: 1.5px; display: inline-flex; align-items: center; gap: var(--space-2); border-radius: var(--radius-key); }
      .word ui-icon { margin: 0; }
      .word:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 4px; }

      @media (max-width: 720px) {
        .sheet .panel, .split { grid-template-columns: 1fr; gap: var(--space-5); padding: var(--space-6) var(--space-5) var(--space-8); }
        .split { align-content: center; }
        .split .side { padding-left: 0; border-left: 0; border-top: 1px solid var(--hairline); padding-top: var(--space-5); }
        .facts { gap: var(--space-5); }
      }
      @media (prefers-reduced-motion: reduce) {
        :host, .col > *, .main > *, .side > *, .card > *, .panel, .stack, .bar { transition: none !important; transform: none; }
        .veil .col, .titled .col { transform: translate(-50%, -54%); }
        .stack { transform: translate(-50%, -50%); }
        .sheet .panel { transform: translate(-50%, 0); }
      }
    `,
  ];

  private renderIcon() {
    const d = this.data;
    if (!d.icon) return nothing;
    const bubble = this.skin === 'bubble';
    return html`<ui-icon name=${d.icon} ?bubble=${bubble} size=${bubble ? (this.variant === 'sheet' ? 56 : 64) : 48}></ui-icon>`;
  }

  private renderWords() {
    const d = this.data;
    const summary = d.error
      ? html`<p class="summary error" role="alert">${d.error}</p>`
      : d.loading
        ? html`<p class="summary" aria-busy="true"><span class="skel" style="width:22ch"></span></p>`
        : d.empty || d.summary
          ? html`<p class="summary">${d.empty || d.summary}</p>`
          : nothing;
    return [
      d.eyebrow ? html`<div class="label">${d.eyebrow}</div>` : nothing,
      html`<div class="title" id="title" role="heading" aria-level="2">${d.title}</div>`,
      summary,
    ];
  }

  private renderFacts() {
    const d = this.data;
    if (d.loading) return html`<div class="facts"><span class="skel" style="width:6ch"></span><span class="skel" style="width:6ch"></span></div>`;
    if (d.error || !d.facts?.length) return nothing;
    return html`<dl class="facts">
      ${d.facts.slice(0, 3).map((f) => html`<div class="fact"><dt class="label">${f.label}</dt><dd>${f.value}</dd></div>`)}
    </dl>`;
  }

  private renderRows() {
    const d = this.data;
    if (d.loading || d.error || !d.rows?.length) return nothing;
    return html`<ul class="rows">${d.rows.slice(0, 5).map((r) => html`<li><span>${r.label}</span><span>${r.value}</span></li>`)}</ul>`;
  }

  private renderActions() {
    const d = this.data;
    const primary = d.error ? { label: 'Try again' } : d.loading ? undefined : d.primary;
    const secondary = d.error || d.loading ? undefined : d.secondary;
    if (!primary && !secondary) return nothing;
    const word = this.variant === 'title';
    return html`<div class="actions">
      ${primary
        ? word
          ? html`<button class="primary word" @click=${() => this.run('primary')}>${primary.label}<ui-icon name="arrow" size="20"></ui-icon></button>`
          : html`<ui-button class="primary" kind="primary" ?ai=${this.skin === 'bubble'} @click=${() => this.run('primary')}>${primary.label}</ui-button>`
        : nothing}
      ${secondary ? html`<button class="secondary" @click=${() => this.run('secondary')}>${secondary.label}</button>` : nothing}
    </div>`;
  }

  private renderBody() {
    switch (this.variant) {
      case 'sheet':
        return html`<div class="sheet"><div class="panel">
          <div class="main">${this.renderIcon()}${this.renderWords()}${this.renderActions()}</div>
          <div class="side">${this.renderFacts()}${this.renderRows()}</div>
        </div></div>`;
      case 'card':
        return html`<div class="stack"><div class="card">${this.renderIcon()}${this.renderWords()}${this.renderFacts()}${this.renderActions()}</div></div>`;
      case 'split':
        return html`<div class="split">
          <div class="main">${this.renderWords()}${this.renderActions()}</div>
          <div class="side">${this.renderFacts()}${this.renderRows()}</div>
        </div>`;
      case 'title':
        return html`<div class="titled"><span class="bar top"></span><span class="bar bottom"></span>
          <div class="col">${this.renderWords().filter((_, i) => i !== 2)}${this.renderFacts()}${this.renderActions()}</div>
        </div>`;
      default:
        return html`<div class="veil"><div class="col">${this.renderIcon()}${this.renderWords()}${this.renderFacts()}${this.renderActions()}</div></div>`;
    }
  }

  override render() {
    return html`<div
      class="frame"
      role="dialog"
      aria-modal="true"
      aria-labelledby="title"
      aria-hidden=${this.isOpen ? 'false' : 'true'}
      ?inert=${!this.isOpen}
      @keydown=${this.onKeydown}
      @click=${(e: MouseEvent) => e.target === e.currentTarget && this.close()}
    >
      ${this.renderBody()}
      <button class="back" @click=${() => this.close()} tabindex="-1"><kbd>Esc</kbd>Back</button>
    </div>`;
  }
}

if (!customElements.get('ui-glance')) customElements.define('ui-glance', UiGlance);

declare global {
  interface HTMLElementTagNameMap {
    'ui-glance': UiGlance;
  }
}
