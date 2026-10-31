import { LitElement, css, html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import { base, uid } from '../shared.js';
import { fieldChrome, fieldHead } from './field-chrome.js';
import type { ListItem } from './list.js';
import './list.js';
import './ref.js';
import './icon.js';

/** A person or a team, as the picker shows and returns them. */
export interface Principal {
  kind: 'person' | 'team';
  id: string;
  name: string;
  /** For a person, their team or email; for a team, where it sits. */
  detail?: string;
  /** For a team, how many people are in it. */
  size?: number;
  /** A word at the end of the row, such as how far they're already let in ("Can read"). */
  meta?: string;
}

/** Finds people and teams by name. The app asks identity through the SDK, as Artifacts does. */
export type PrincipalSearch = (query: string) => Promise<Principal[]>;

const key = (p: Pick<Principal, 'kind' | 'id'>) => `${p.kind}:${p.id}`;

/**
 * Find people and teams by name. Each result says its team or its size. The
 * ones that can't be chosen stay in the list, dimmed, and say why (`check`
 * returns the reason). With `multiple`, choices gather above the field as
 * chips you can take off again; without it, each choice is handed over and
 * the field empties for the next.
 *
 * @fires ui-pick - {principal} one was chosen
 * @fires ui-change - {value} the chosen ones changed (with `multiple`)
 */
export class UiPeoplePicker extends LitElement {
  static override properties = {
    label: { type: String },
    hint: { type: String },
    placeholder: { type: String },
    kinds: { type: String },
    multiple: { type: Boolean },
    disabled: { type: Boolean, reflect: true },
    value: { attribute: false },
    search: { attribute: false },
    check: { attribute: false },
    query: { state: true },
    found: { state: true },
    looking: { state: true },
    failure: { state: true },
  };

  declare label: string;
  declare hint: string;
  declare placeholder: string;
  /** `people`, `teams`, or `both` (the default). */
  declare kinds: 'people' | 'teams' | 'both';
  declare multiple: boolean;
  declare disabled: boolean;
  /** The ones chosen so far, with `multiple`. */
  declare value: Principal[];
  declare search: PrincipalSearch | undefined;
  /** Why one can't be chosen, in one sentence; nothing when it can. */
  declare check: ((p: Principal) => string | undefined | void) | undefined;
  declare query: string;
  declare found: Principal[] | undefined;
  declare looking: boolean;
  declare failure: string;

  private timer?: ReturnType<typeof setTimeout>;
  private asked = 0;
  private ids = { input: uid('people'), hint: uid('hint') };

  constructor() {
    super();
    this.label = 'People and teams';
    this.hint = '';
    this.placeholder = 'A name, an email or a team';
    this.kinds = 'both';
    this.multiple = false;
    this.disabled = false;
    this.value = [];
    this.query = '';
    this.looking = false;
    this.failure = '';
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.timer);
  }

  override focus(options?: FocusOptions) {
    this.renderRoot.querySelector<HTMLInputElement>('.input')?.focus(options);
  }

  /** Look for `query` now, as typing does after a short pause. */
  async find(query: string) {
    this.query = query;
    clearTimeout(this.timer);
    const asked = ++this.asked;
    if (!query.trim() || !this.search) {
      this.found = undefined;
      this.looking = false;
      return;
    }
    this.looking = true;
    try {
      const found = (await this.search(query.trim())).filter((p) => this.kinds === 'both' || (this.kinds === 'people' ? p.kind === 'person' : p.kind === 'team'));
      if (asked !== this.asked) return;
      this.found = found;
      this.failure = '';
    } catch (err) {
      if (asked === this.asked) this.failure = (err as Error).message;
    } finally {
      if (asked === this.asked) this.looking = false;
    }
  }

  private typed(query: string) {
    this.query = query;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.find(query), 200);
  }

  private choose(principal: Principal) {
    this.dispatchEvent(new CustomEvent('ui-pick', { detail: { principal }, bubbles: true, composed: true }));
    if (this.multiple && !this.value.some((p) => key(p) === key(principal))) this.change([...this.value, principal]);
    this.query = '';
    this.found = undefined;
  }

  private change(value: Principal[]) {
    this.value = value;
    this.dispatchEvent(new CustomEvent('ui-change', { detail: { value }, bubbles: true, composed: true }));
  }

  private rows(): ListItem[] {
    return (this.found ?? []).map((p) => {
      const reason = this.check?.(p) || (this.multiple && this.value.some((v) => key(v) === key(p)) ? 'Already chosen.' : '');
      const detail = [p.detail, p.kind === 'team' && p.size !== undefined ? `${p.size} ${p.size === 1 ? 'person' : 'people'}` : ''].filter(Boolean).join(' · ');
      return {
        id: key(p),
        title: p.name,
        icon: p.kind === 'person' ? 'account' : 'people',
        ...(detail ? { detail } : p.kind === 'team' ? { detail: 'Team' } : {}),
        ...(p.meta ? { meta: p.meta } : {}),
        ...(reason ? { disabled: true, reason } : {}),
      };
    });
  }

  static override styles = [
    base,
    fieldChrome,
    css`
      .chosen { margin-bottom: var(--space-1); }
      ui-list { margin-top: var(--space-1); }
    `,
  ];

  override render() {
    const searching = this.query.trim() && (this.found !== undefined || this.failure);
    return html`${fieldHead(this.label, this.ids.input, false, false)}
      ${this.hint ? html`<p class="hint" id=${this.ids.hint}>${this.hint}</p>` : nothing}
      ${this.multiple && this.value.length
        ? html`<ui-refs class="chosen" removable .refs=${this.value.map((p) => ({ kind: p.kind, id: p.id, label: p.name }))}
            @ui-remove=${(e: CustomEvent<{ ref: { kind: string; id: string } }>) => this.change(this.value.filter((p) => key(p) !== `${e.detail.ref.kind}:${e.detail.ref.id}`))}
            @ui-open=${(e: Event) => e.stopPropagation()}></ui-refs>`
        : nothing}
      <div class="box" part="box">
        <ui-icon name="find" size="16" aria-hidden="true" style="color:var(--ink-muted)"></ui-icon>
        <input id=${this.ids.input} class="input" autocomplete="off" role="combobox" aria-expanded=${searching ? 'true' : 'false'}
          aria-describedby=${this.hint ? this.ids.hint : nothing}
          placeholder=${this.placeholder} .value=${live(this.query)} ?disabled=${this.disabled}
          @input=${(e: Event) => this.typed((e.target as HTMLInputElement).value)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.query) {
              e.stopPropagation();
              void this.find('');
            } else if (e.key === 'Enter') {
              e.preventDefault();
              void this.find(this.query);
            }
          }} />
      </div>
      ${searching
        ? html`<ui-list label="People and teams found" density="compact" .noun=${['match', 'matches']} .items=${this.rows()} ?loading=${this.looking}
            error=${this.failure} empty="No one by that name. Try part of a name or an email."
            @ui-open=${(e: CustomEvent<{ item: ListItem }>) => {
              e.stopPropagation();
              const p = this.found?.find((f) => key(f) === e.detail.item.id);
              if (p && !e.detail.item.disabled) this.choose(p);
            }}
            @ui-retry=${() => void this.find(this.query)}></ui-list>`
        : nothing}`;
  }
}

if (!customElements.get('ui-people-picker')) customElements.define('ui-people-picker', UiPeoplePicker);

declare global {
  interface HTMLElementTagNameMap {
    'ui-people-picker': UiPeoplePicker;
  }
}
