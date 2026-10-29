import { LitElement, css, html, nothing } from 'lit';
import { base, label } from '../shared.js';
import type { ButtonKind } from './button.js';
import type { UiMenu, MenuAction } from './menu.js';
import './button.js';
import './icon-button.js';
import './menu.js';

/** A step in the trail: what this page is inside. */
export interface TrailStep {
  id: string;
  label: string;
}

/** One of the page's actions. Two show as buttons; the rest go in ⋯. */
export interface PageAction {
  id: string;
  label: string;
  /** `primary` at most once on a page; a second primary shows as secondary. Defaults to secondary. */
  kind?: ButtonKind;
  danger?: boolean;
  disabled?: boolean;
  /** Why it's disabled, in one sentence. */
  reason?: string;
}

/**
 * The top of an app's page: the trail of what this is inside (folders, the
 * intent above), an eyebrow, the title, one line of summary, and the page's
 * actions. The trail is the page's own content, not a breadcrumb of the
 * shell's levels.
 *
 * Holds the page's limits: three trail steps, then the middle folds to "…";
 * the summary is one line; two actions show, with at most one primary, and
 * the rest go in the ⋯ menu.
 *
 * @slot - anything that belongs to the title and comes under it: tags, a status
 * @fires ui-trail - detail `{ step }`: a trail step was pressed
 * @fires ui-action - detail `{ action }`
 */
export class UiPageHead extends LitElement {
  static override properties = {
    trail: { attribute: false },
    eyebrow: { type: String },
    heading: { type: String },
    summary: { type: String },
    actions: { attribute: false },
    level: { type: Number },
    unfolded: { state: true },
  };

  declare trail: TrailStep[];
  declare eyebrow: string;
  declare heading: string;
  /** One line about now; it's cut with an ellipsis, and shows in full on hover. */
  declare summary: string;
  declare actions: PageAction[];
  /** The heading level of the title, 1 by default: it's the page's one heading. */
  declare level: number;
  declare unfolded: boolean;

  constructor() {
    super();
    this.trail = [];
    this.eyebrow = '';
    this.heading = '';
    this.summary = '';
    this.actions = [];
    this.level = 1;
    this.unfolded = false;
  }

  static override styles = [
    base,
    label,
    css`
      :host { display: flex; flex-direction: column; gap: var(--space-3); }
      ol { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      li { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
      li + li::before { content: '›'; }
      ol button { all: unset; cursor: pointer; border-radius: var(--radius-key); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 28ch; }
      ol button:hover { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
      ol button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      .row { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; }
      .text { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; flex: 1 1 320px; }
      .title { margin: 0; font-size: var(--type-title-s); line-height: var(--leading-title-s); font-weight: 300; letter-spacing: var(--tracking-tight); color: var(--ink); text-wrap: balance; }
      .summary { margin: 0; color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 64ch; }
      .acts { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
    `,
  ];

  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private steps() {
    const t = this.trail;
    if (t.length <= 3 || this.unfolded) return t.map((s) => this.step(s));
    return [
      this.step(t[0]),
      html`<li><button aria-label=${`Show ${t.length - 2} more steps`} @click=${() => (this.unfolded = true)}>…</button></li>`,
      this.step(t[t.length - 1]),
    ];
  }

  private step(s: TrailStep) {
    return html`<li><button @click=${() => this.emit('ui-trail', { step: s })}>${s.label}</button></li>`;
  }

  private more(e: Event, rest: PageAction[]) {
    const menu = this.renderRoot.querySelector<UiMenu>('ui-menu')!;
    menu.toggle(e.currentTarget as HTMLElement);
    menu.items = rest.map((a): MenuAction => ({ id: a.id, label: a.label, danger: a.danger, disabled: a.disabled, reason: a.reason }));
  }

  override render() {
    let primary = false;
    const shown = this.actions.slice(0, 2).map((a) => {
      let kind: ButtonKind = a.danger ? 'danger' : (a.kind ?? 'secondary');
      if (kind === 'primary') {
        if (primary) kind = 'secondary';
        primary = true;
      }
      return { ...a, kind };
    });
    const rest = this.actions.slice(2);
    const level = Math.min(6, Math.max(1, this.level || 1));
    return html`${this.trail.length ? html`<ol aria-label="What this is inside">${this.steps()}</ol>` : nothing}
      <div class="row">
        <div class="text">
          ${this.eyebrow ? html`<div class="label" part="eyebrow">${this.eyebrow}</div>` : nothing}
          <div class="title" role="heading" aria-level=${level} part="title">${this.heading}</div>
          ${this.summary ? html`<p class="summary" title=${this.summary} part="summary">${this.summary}</p>` : nothing}
          <slot></slot>
        </div>
        ${shown.length
          ? html`<div class="acts">
              ${shown.map(
                (a) => html`<ui-button kind=${a.kind} size="sm" ?disabled=${Boolean(a.disabled)} reason=${a.reason ?? ''}
                  @click=${() => this.emit('ui-action', { action: a })}>${a.label}</ui-button>`,
              )}
              ${rest.length
                ? html`<ui-icon-button icon="more" label="More" size="sm" nameless @click=${(e: Event) => this.more(e, rest)}></ui-icon-button>
                    <ui-menu label="More" @ui-select=${(e: CustomEvent<{ item: MenuAction }>) => this.emit('ui-action', { action: rest.find((a) => a.id === e.detail.item.id) })}></ui-menu>`
                : nothing}
            </div>`
          : nothing}
      </div>`;
  }
}

if (!customElements.get('ui-page-head')) customElements.define('ui-page-head', UiPageHead);

declare global {
  interface HTMLElementTagNameMap {
    'ui-page-head': UiPageHead;
  }
}
