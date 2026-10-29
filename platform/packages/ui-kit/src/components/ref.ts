import { LitElement, css, html, nothing } from 'lit';
import { base } from '../shared.js';
import { reasonBox } from '../reason.js';
import { floorMark } from './card.js';
import type { FloorKind } from './floors.js';
import './icon.js';

/** What a reference points at. Entities, documents and intents come from apps; people and teams from identity. */
export type RefKind = 'entity' | 'document' | 'intent' | 'person' | 'team';

/**
 * A thing from any app, as a chip shows it: the SDK's `EntityRef`,
 * `DocumentRef` and `IntentRef` all fit, as do people and teams.
 */
export interface RefShown {
  kind: RefKind;
  id: string;
  /** Its name; documents and intents call it `title`. */
  label?: string;
  title?: string;
  /** An entity's kind in the ontology ("vessel"), which picks its icon. */
  type?: string;
  /** Set when it's kept on another floor than this page's: the chip shows a dot in that floor's colour. */
  floorKind?: FloorKind;
  floorName?: string;
  /** Where it came from, when it isn't this page's own ("From Keep the coast watched"): it can't be removed here. */
  from?: string;
}

const entityIcons = new Set(['vessel', 'aircraft', 'vehicle', 'place', 'port', 'facility', 'event']);
/** The kit icon for a reference: an entity's own kind where the kit draws one. */
export const refIcon = (ref: Pick<RefShown, 'kind' | 'type'>) =>
  ref.kind === 'entity'
    ? ref.type && entityIcons.has(ref.type) ? ref.type : 'atlas'
    : { document: 'document', intent: 'compass', person: 'person', team: 'people' }[ref.kind];

export const refName = (ref: RefShown) => ref.label || ref.title || 'Untitled';

/**
 * A thing from any app as a small chip: its kind's icon, its name, and a
 * floor dot when it's kept on another floor. Pressing it fires `ui-open`, and
 * the app raises the matching intent so the person sees it without leaving
 * the page. Text never links; things open.
 *
 * @fires ui-open - {ref} it was pressed
 * @fires ui-remove - {ref} its × was pressed (only when `removable`)
 */
export class UiRef extends LitElement {
  static override properties = {
    ref: { attribute: false },
    removable: { type: Boolean },
  };

  declare ref: RefShown;
  /** Shows × to take it off this page; refs that come `from` somewhere else never show it. */
  declare removable: boolean;

  constructor() {
    super();
    this.ref = { kind: 'entity', id: '' };
    this.removable = false;
  }

  static override styles = [
    base,
    css`
      :host { display: inline-flex; max-width: 100%; vertical-align: middle; }
      .chip { display: inline-flex; align-items: center; max-width: 100%; border: 1px solid var(--hairline); border-radius: var(--radius-key); background: var(--surface-pane);
        font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink); transition: border-color var(--motion-instant) var(--ease-standard); }
      .chip:hover { border-color: var(--hairline-strong); }
      button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-width: 0; padding: 3px var(--space-3) 3px var(--space-2); border-radius: var(--radius-key); }
      button:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      ui-icon { flex: none; color: var(--ink-muted); }
      .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--floor); }
      .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      .remove { padding: 3px var(--space-2); color: var(--ink-muted); border-left: 1px solid var(--hairline); border-radius: 0 var(--radius-key) var(--radius-key) 0; }
      .remove:hover { color: var(--ink); }
    `,
  ];

  override render() {
    const ref = this.ref;
    const name = refName(ref);
    const where = ref.floorName ? `Kept on ${ref.floorName}` : '';
    const title = [ref.from ? `From ${ref.from}` : '', where].filter(Boolean).join(' · ');
    const fire = (type: string) => this.dispatchEvent(new CustomEvent(type, { detail: { ref }, bubbles: true, composed: true }));
    return html`<span class="chip" part="chip">
      <button class="open" title=${title || nothing} @click=${() => fire('ui-open')}>
        <ui-icon name=${refIcon(ref)} size="14" aria-hidden="true"></ui-icon>
        <span class="name">${name}</span>
        ${ref.floorKind ? html`<span class="dot" style=${`--floor:${floorMark[ref.floorKind]}`} aria-hidden="true"></span>` : nothing}
        ${title ? html`<span class="sr">, ${title}</span>` : nothing}
      </button>
      ${this.removable && !ref.from
        ? html`<button class="remove" aria-label=${`Remove ${name}`} @click=${() => fire('ui-remove')}><ui-icon name="close" size="12" aria-hidden="true"></ui-icon></button>`
        : nothing}
    </span>`;
  }
}

/**
 * References as a wrapping row of chips. The ones the person can't read are
 * counted, not dropped: a last chip says "2 you can't open" and, on hover or
 * focus, where they're kept and who to ask.
 *
 * @fires ui-open - {ref} from a chip
 * @fires ui-remove - {ref} from a chip
 */
export class UiRefs extends LitElement {
  static override properties = {
    refs: { attribute: false },
    closedCount: { type: Number, attribute: 'closed-count' },
    closedReason: { type: String, attribute: 'closed-reason' },
    removable: { type: Boolean },
    empty: { type: String },
  };

  declare refs: RefShown[];
  /** How many the person can't open. */
  declare closedCount: number;
  /** Where those are kept and who to ask, in one sentence. */
  declare closedReason: string;
  declare removable: boolean;
  /** Said when there are none at all; empty says nothing. */
  declare empty: string;

  constructor() {
    super();
    this.refs = [];
    this.closedCount = 0;
    this.closedReason = '';
    this.removable = false;
    this.empty = '';
  }

  static override styles = [
    base,
    reasonBox,
    css`
      :host { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
      .closed { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 3px var(--space-3) 3px var(--space-2); border: 1px dashed var(--hairline-strong); border-radius: var(--radius-key);
        font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
      .closed:focus-visible { outline: 1.5px solid var(--focus); outline-offset: 2px; }
      .closed:hover .reason, .closed:focus .reason { opacity: 1; transform: none; }
      .empty { font-size: var(--type-small); line-height: var(--leading-small); color: var(--ink-muted); }
    `,
  ];

  override render() {
    if (!this.refs.length && !this.closedCount) return this.empty ? html`<span class="empty">${this.empty}</span>` : nothing;
    return html`${this.refs.map((ref) => html`<ui-ref .ref=${ref} ?removable=${this.removable}></ui-ref>`)}
      ${this.closedCount
        ? html`<span class="closed" tabindex=${this.closedReason ? '0' : nothing} aria-describedby=${this.closedReason ? 'closed-reason' : nothing}>
            <ui-icon name="lock" size="12" aria-hidden="true"></ui-icon>${this.closedCount} you can’t open
            ${this.closedReason ? html`<span class="reason" id="closed-reason" role="tooltip">${this.closedReason}</span>` : nothing}
          </span>`
        : nothing}`;
  }
}

if (!customElements.get('ui-ref')) customElements.define('ui-ref', UiRef);
if (!customElements.get('ui-refs')) customElements.define('ui-refs', UiRefs);

declare global {
  interface HTMLElementTagNameMap {
    'ui-ref': UiRef;
    'ui-refs': UiRefs;
  }
}
