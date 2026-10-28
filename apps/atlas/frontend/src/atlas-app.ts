import { LitElement, html, nothing } from 'lit';
import { ago, type DialogSubmit, type ListItem, type SelectOption } from '@augur/ui-kit';
import { AtlasError, detailsOf, entityLine, pathFor, typeTree, whyShown, type AtlasApi, type Entity, type EntityFields, type Ontology, type Place } from './api.js';

type Dialog = 'new' | 'edit' | 'retire';

/** Other names as one line to edit, comma separated. */
const aliasesFrom = (text: string) => [...new Set(text.split(',').map((a) => a.trim()).filter(Boolean))];

/**
 * Data Atlas: the things the organisation keeps track of, as seen from the
 * floor the person is standing on. A floor shows what is kept on it and on the
 * floors above it; whatever can't be seen or done says why (explain, never hide).
 *
 * @fires atlas-place - the person moved within the app, detail is the new Place
 */
export class AtlasApp extends LitElement {
  static override properties = {
    api: { attribute: false },
    floorName: { type: String, attribute: 'floor-name' },
    floorKind: { type: String, attribute: 'floor-kind' },
    place: { attribute: false },
    ontology: { state: true },
    entities: { state: true },
    total: { state: true },
    seeing: { state: true },
    q: { state: true },
    type: { state: true },
    open: { state: true },
    unseen: { state: true },
    loading: { state: true },
    error: { state: true },
    dialog: { state: true },
    newType: { state: true },
  };

  declare api: AtlasApi;
  declare floorName: string;
  declare floorKind: 'personal' | 'team' | 'org';
  declare place: Place;
  declare ontology: Ontology | undefined;
  declare entities: Entity[];
  declare total: number;
  declare seeing: string[];
  declare q: string;
  declare type: string;
  declare open: Entity | undefined;
  /** Why the entity asked for can't be seen from here. */
  declare unseen: string;
  declare loading: boolean;
  declare error: string;
  declare dialog: Dialog | undefined;
  /** The kind being added, which decides the details asked for. */
  declare newType: string;
  private searching: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.floorName = '';
    this.floorKind = 'personal';
    this.place = { page: 'entities' };
    this.entities = [];
    this.total = 0;
    this.seeing = [];
    this.q = '';
    this.type = '';
    this.unseen = '';
    this.loading = false;
    this.error = '';
    this.newType = '';
  }

  override createRenderRoot() {
    return this;
  }

  override willUpdate(changed: Map<string, unknown>) {
    if ((changed.has('api') || changed.has('place')) && this.api) void this.go(this.place);
  }

  /** Shows a place: the list, the list with Add open, or one entity. */
  async go(place: Place) {
    this.loading = true;
    this.error = '';
    this.unseen = '';
    try {
      this.ontology ??= await this.api.ontology();
      if (place.page === 'entity') {
        this.open = undefined;
        this.open = await this.api.entity(place.id);
      } else {
        this.open = undefined;
        await this.list();
        this.dialog = place.page === 'new' ? 'new' : undefined;
      }
    } catch (err) {
      if (err instanceof AtlasError && err.code === 'unseen') this.unseen = err.message;
      else this.error = (err as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private move(place: Place) {
    this.place = place;
    this.dispatchEvent(new CustomEvent('atlas-place', { detail: place }));
  }

  private async list() {
    const found = await this.api.entities({ q: this.q, type: this.type, limit: 200 });
    this.entities = found.entities;
    this.total = found.total;
    this.seeing = found.seeing;
  }

  private search(q: string) {
    this.q = q;
    clearTimeout(this.searching);
    this.searching = setTimeout(() => void this.list().catch((err: Error) => (this.error = err.message)), 250);
  }

  /** The kinds to pick from when adding: only those an entity can be made of. */
  private kindOptions(): SelectOption[] {
    return this.ontology ? typeTree(this.ontology).filter(({ type }) => !type.abstract).map(({ type }) => ({ value: type.key, label: type.label })) : [];
  }

  /** The kinds to filter by: every kind, a heading meaning everything under it. */
  private filterOptions(): SelectOption[] {
    const all = { value: '', label: 'Every kind' };
    if (!this.ontology) return [all];
    return [all, ...typeTree(this.ontology).map(({ type, depth }) => ({ value: type.key, label: `${'  '.repeat(depth)}${type.abstract ? `All ${type.plural.toLowerCase()}` : type.plural}` }))];
  }

  /** The fields as the dialog gave them, turned into what the service takes. */
  private fieldsFrom(values: Record<string, string>, type: string): EntityFields {
    const details: Record<string, string> = {};
    for (const d of this.ontology ? detailsOf(this.ontology, type) : []) details[d.key] = values[`detail:${d.key}`] ?? '';
    return { label: values.label, aliases: aliasesFrom(values.aliases ?? ''), description: values.description ?? '', details };
  }

  /** Says a refusal; an identity key someone else holds offers the entity that has it, when it can be seen. */
  private refusal(err: unknown): never {
    if (err instanceof AtlasError && err.code === 'key-taken') {
      const holder = err.body.holder as { id: string; hidden?: boolean } | undefined;
      if (holder && !holder.hidden) {
        this.dialog = undefined;
        this.move({ page: 'entity', id: holder.id });
      }
    }
    throw err;
  }

  private submitNew: DialogSubmit = async (values) => {
    const type = this.newType || this.kindOptions()[0]?.value;
    if (!type) return false;
    try {
      const made = await this.api.createEntity({ ...this.fieldsFrom(values, type), type, label: values.label });
      this.dialog = undefined;
      this.move({ page: 'entity', id: made.id });
    } catch (err) {
      this.refusal(err);
    }
  };

  private submitEdit: DialogSubmit = async (values) => {
    const open = this.open;
    if (!open) return false;
    try {
      this.open = await this.api.updateEntity(open.id, this.fieldsFrom(values, open.type));
      this.dialog = undefined;
    } catch (err) {
      this.refusal(err);
    }
  };

  private submitRetire: DialogSubmit = async () => {
    if (!this.open) return false;
    this.open = await this.api.retireEntity(this.open.id);
    this.dialog = undefined;
  };

  private closeDialog = () => {
    const wasNew = this.dialog === 'new';
    this.dialog = undefined;
    if (wasNew && this.place.page === 'new') this.move({ page: 'entities' });
  };

  /** Where knowledge shows from, said plainly: the fence is a rule, not a mystery. */
  private seeingLine() {
    const levels = this.seeing.join(', ');
    if (this.floorKind === 'org') return 'From the org floor, only the org’s own knowledge shows. Your own floor shows every level you belong to.';
    if (this.floorKind === 'personal') return `From your own floor, everything you can reach shows: ${levels}.`;
    return `From here, what’s kept on this floor and the floors above it shows: ${levels}. Teams below keep their own.`;
  }

  private listPage() {
    const rows: ListItem[] = this.entities.map((e) => ({
      id: e.id,
      title: e.label,
      detail: entityLine(this.ontology, e),
      icon: this.ontology?.types.find((t) => t.key === e.type)?.icon ?? 'atlas',
      meta: e.aliases.length ? `aka ${e.aliases[0]}` : undefined,
    }));
    return html`<div class="atlas-head">
        <ui-heading eyebrow=${this.floorName || 'Data Atlas'} heading="Everything here" summary=${this.seeingLine()}></ui-heading>
        <ui-button kind="secondary" size="sm" @click=${() => this.move({ page: 'new' })}>Add an entity</ui-button>
      </div>
      <div class="atlas-filters">
        <ui-text-field label="Find" placeholder="A name, another name, or a code such as an IMO number" .value=${this.q}
          @ui-input=${(e: CustomEvent<{ value: string }>) => this.search(e.detail.value)}></ui-text-field>
        <ui-select label="Kind" .options=${this.filterOptions()} .value=${this.type}
          @ui-change=${(e: CustomEvent<{ value: string }>) => {
            if (e.detail.value === this.type) return;
            this.type = e.detail.value;
            void this.list();
          }}></ui-select>
      </div>
      <ui-list label=${this.floorName || 'Data Atlas'} .noun=${['entity', 'entities']} .items=${rows} ?loading=${this.loading} error=${this.error}
        empty=${this.q || this.type ? 'Nothing here matches.' : 'Nothing is kept here yet. Add the first ship, port, organisation or person this floor tracks.'}
        @ui-open=${(e: CustomEvent<{ item: ListItem }>) => this.move({ page: 'entity', id: e.detail.item.id })}
        @ui-retry=${() => void this.go(this.place)}></ui-list>
      ${this.total > this.entities.length ? html`<p class="atlas-note">Showing the first ${this.entities.length} of ${this.total}. Narrow it with Find or Kind.</p>` : nothing}`;
  }

  private entityPage() {
    const back = html`<ui-button kind="ghost" size="sm" @click=${() => this.move({ page: 'entities' })}>Everything here</ui-button>`;
    if (this.unseen) {
      return html`${back}<ui-state kind="empty" heading="You can’t see this from here" body=${this.unseen}></ui-state>`;
    }
    if (this.error) return html`${back}<ui-state kind="error" heading="Couldn’t open it" body=${this.error} action="Try again" @ui-action=${() => void this.go(this.place)}></ui-state>`;
    const e = this.open;
    if (!e || !this.ontology) return html`${back}<ui-state kind="loading" heading="Opening…"></ui-state>`;
    const type = this.ontology.types.find((t) => t.key === e.type);
    const details = detailsOf(this.ontology, e.type);
    return html`${back}
      <div class="atlas-head">
        <ui-heading eyebrow=${type?.label ?? e.type} heading=${e.label} summary=${e.description}></ui-heading>
        <div class="atlas-actions">
          <ui-button kind="secondary" size="sm" ?disabled=${!e.can.edit} @click=${() => (this.dialog = 'edit')}>Edit</ui-button>
          <ui-button kind="ghost" size="sm" ?disabled=${!e.can.retire} @click=${() => (this.dialog = 'retire')}>Retire</ui-button>
        </div>
      </div>
      ${e.can.why ? html`<p class="atlas-note">${e.can.why}</p>` : nothing}
      ${e.state === 'retired' ? html`<p class="atlas-note atlas-retired">Retired ${ago(e.updatedAt)}. Its id stays, so whatever points at it still says what it was.</p>` : nothing}
      ${e.aliases.length ? html`<div class="atlas-tags">${e.aliases.map((a) => html`<ui-tag quiet label=${a}></ui-tag>`)}</div>` : nothing}
      <dl class="atlas-details">
        ${details.map(
          (d) => html`<dt>${d.label}</dt>
            <dd>${e.details[d.key] ?? html`<span class="atlas-missing">Not known</span>`}${d.identity ? html` <span class="atlas-key">identity key</span>` : nothing}</dd>`,
        )}
        <dt>Kept on</dt>
        <dd>${e.floorName}</dd>
        <dt>Why it shows here</dt>
        <dd class=${this.place.page === 'entity' && this.place.explain ? 'atlas-explained' : ''}>${whyShown(e, this.floorKind, this.floorName)}</dd>
        <dt>Added</dt>
        <dd>${ago(e.createdAt)}</dd>
        ${type ? html`<dt>In the ontology</dt><dd>${type.packTerm} <span class="atlas-key">${type.pack.toUpperCase()}</span></dd>` : nothing}
      </dl>
      <p class="atlas-note">Observations, facts over time and links to other entities come next.</p>`;
  }

  private detailFields(type: string, values: Record<string, string> = {}) {
    if (!this.ontology) return nothing;
    return detailsOf(this.ontology, type).map(
      (d) => html`<ui-text-field slot="fields" name=${`detail:${d.key}`} label=${d.label} optional maxlength="200" hint=${[d.hint, d.identity ? 'Says which one it is: no two entities share it' : ''].filter(Boolean).join('. ')} .value=${values[d.key] ?? ''}></ui-text-field>`,
    );
  }

  private dialogs() {
    switch (this.dialog) {
      case 'new': {
        const type = this.newType || this.kindOptions()[0]?.value || '';
        return html`<ui-dialog open eyebrow=${this.floorName || 'Data Atlas'} heading="Add an entity"
          summary=${this.floorKind === 'personal' ? 'It’s kept on your own floor: only you see it.' : this.floorKind === 'org' ? 'It’s kept on the org floor: everyone sees it.' : 'It’s kept on this floor: its members and the teams below see it, not the floors above.'}
          action-label="Add it" busy-label="Adding…" .submit=${this.submitNew} @ui-close=${this.closeDialog}>
          <ui-select slot="fields" label="Kind" .options=${this.kindOptions()} .value=${type} @ui-change=${(e: CustomEvent<{ value: string }>) => { if (e.detail.value !== this.newType) this.newType = e.detail.value; }}></ui-select>
          <ui-text-field slot="fields" name="label" label="Name" required maxlength="200"></ui-text-field>
          <ui-text-field slot="fields" name="aliases" label="Other names" optional hint="Separate them with commas" maxlength="2000"></ui-text-field>
          <ui-text-field slot="fields" name="description" label="What it is" optional multiline maxlength="2000"></ui-text-field>
          ${this.detailFields(type)}
        </ui-dialog>`;
      }
      case 'edit': {
        const e = this.open;
        if (!e) return nothing;
        return html`<ui-dialog open eyebrow=${e.floorName} heading=${`Edit ${e.label}`} action-label="Save" busy-label="Saving…" .submit=${this.submitEdit} @ui-close=${() => (this.dialog = undefined)}>
          <ui-text-field slot="fields" name="label" label="Name" required maxlength="200" .value=${e.label}></ui-text-field>
          <ui-text-field slot="fields" name="aliases" label="Other names" optional hint="Separate them with commas" maxlength="2000" .value=${e.aliases.join(', ')}></ui-text-field>
          <ui-text-field slot="fields" name="description" label="What it is" optional multiline maxlength="2000" .value=${e.description}></ui-text-field>
          ${this.detailFields(e.type, e.details)}
        </ui-dialog>`;
      }
      case 'retire': {
        const e = this.open;
        if (!e) return nothing;
        return html`<ui-dialog open danger eyebrow=${e.floorName} heading=${`Retire ${e.label}?`} action-label="Retire" busy-label="Retiring…" .submit=${this.submitRetire} @ui-close=${() => (this.dialog = undefined)}>
          <p>It stops showing in lists and its identity keys are free again. It keeps its id, so whatever points at it still says what it was.</p>
        </ui-dialog>`;
      }
      default:
        return nothing;
    }
  }

  override render() {
    return html`<style>
        /* Data Atlas's own ground: the shell's water stays outside the app. */
        atlas-app { display: block; min-height: 100%; background: var(--slate); }
        atlas-app .atlas-main { max-width: var(--measure-wide); margin: 0 auto; padding: var(--space-6) var(--edge); display: flex; flex-direction: column; gap: var(--space-5); }
        atlas-app .atlas-head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; }
        atlas-app .atlas-actions { display: flex; gap: var(--space-2); }
        atlas-app .atlas-filters { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--space-4); }
        atlas-app .atlas-note { margin: 0; font-size: var(--type-small); color: var(--ink-muted); }
        atlas-app .atlas-retired { color: var(--ink); }
        atlas-app .atlas-tags { display: flex; flex-wrap: wrap; gap: var(--space-2); }
        atlas-app .atlas-details { display: grid; grid-template-columns: minmax(8rem, max-content) minmax(0, 1fr); gap: var(--space-2) var(--space-5); margin: 0; }
        atlas-app .atlas-details dt { color: var(--ink-muted); font-size: var(--type-small); }
        atlas-app .atlas-details dd { margin: 0; font-variant-numeric: tabular-nums; }
        atlas-app .atlas-missing { color: var(--ink-muted); }
        /* Asked why it shows (entity.explain): the answer is marked, not hidden among the rest. */
        atlas-app .atlas-details dd.atlas-explained { border-left: 2px solid var(--green); padding-left: var(--space-3); }
        atlas-app .atlas-key { font-size: var(--type-small); color: var(--ink-muted); letter-spacing: 0.04em; }
        @media (max-width: 640px) { atlas-app .atlas-filters { grid-template-columns: minmax(0, 1fr); } }
      </style>
      <main class="atlas-main">${this.place.page === 'entity' ? this.entityPage() : this.listPage()}</main>
      ${this.dialogs()}`;
  }
}

if (!customElements.get('atlas-app')) customElements.define('atlas-app', AtlasApp);

declare global {
  interface HTMLElementTagNameMap {
    'atlas-app': AtlasApp;
  }
}
