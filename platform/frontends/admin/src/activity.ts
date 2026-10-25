import { LitElement, html, nothing } from 'lit';
import type { Fact, SelectOption, TableColumn, TableRow } from '@augur/ui-kit';
import { fullName, type AdminApi, type AuditEntry, type AuditQuery, type CatalogueApp, type Department, type Person } from './api.js';
import { floorTree } from './apps.js';
import { page } from './parts.js';

const PAGE = 50;
const ANYONE = '*';

/** The names Activity writes sentences with, looked up by id. */
export interface Names {
  person(id: string): string;
  department(id: string): string;
  app(id: string): string;
}

export const namesFrom = (people: Person[], departments: Department[], apps: CatalogueApp[]): Names => {
  const p = new Map(people.map((x) => [x.id, fullName(x)]));
  const d = new Map(departments.map((x) => [x.id, x.name]));
  const a = new Map(apps.map((x) => [x.id, x.name]));
  return { person: (id) => p.get(id) ?? id, department: (id) => d.get(id) ?? id, app: (id) => a.get(id) ?? id };
};

/** Where an entry was recorded, in words: the platform's own services by what they look after. */
export const areaName = (app: string, names: Names) => (app === 'identity' ? 'People and departments' : app === 'registry' ? 'App catalogue' : names.app(app));

const changedWords: Record<string, string> = { firstName: 'name', lastName: 'name', email: 'email', roles: 'roles', departments: 'departments', enabled: 'sign-in' };

/** One audit entry as a sentence: "Alex Rivera added Sam Okafor to Finance". */
export const describe = (e: AuditEntry, names: Names): string => {
  const who = e.actor.kind === 'user' ? names.person(e.actor.id) : names.app(e.actor.id);
  const target = e.target ?? '';
  const d = e.detail ?? {};
  switch (e.action) {
    case 'person.added':
      return `${who} added ${names.person(target)}`;
    case 'person.updated': {
      const what = [...new Set(Object.keys(d).map((k) => changedWords[k]).filter(Boolean))];
      return `${who} changed ${names.person(target)}’s ${what.length ? what.join(' and ') : 'details'}`;
    }
    case 'person.enabled':
      return `${who} turned on ${names.person(target)}’s sign-in`;
    case 'person.disabled':
      return `${who} turned off ${names.person(target)}’s sign-in`;
    case 'person.password-reset':
      return `${who} gave ${names.person(target)} a new password`;
    case 'department.created':
      return `${who} created the ${String(d.name ?? names.department(target))} department`;
    case 'department.renamed':
      return `${who} renamed ${String(d.from)} to ${String(d.to)}`;
    case 'department.member-added':
      return `${who} added ${names.person(String(d.person))} to ${names.department(target)}`;
    case 'department.member-removed':
      return `${who} took ${names.person(String(d.person))} out of ${names.department(target)}`;
    case 'app.registered':
      return `${names.app(target)} was registered${d.version ? `, version ${String(d.version)}` : ''}`;
    case 'app.updated':
      return d.heldAt
        ? `${names.app(target)} registered version ${String(d.version)}, kept but not used while it’s held at ${String(d.heldAt)}`
        : `${names.app(target)} was updated${d.version ? ` to version ${String(d.version)}` : ''}`;
    case 'app.pinned':
      return `${who} held ${names.app(target)} at version ${String(d.version)}`;
    case 'app.unpinned':
      return `${who} let ${names.app(target)} follow new versions again, now ${String(d.version)}`;
    case 'app.enabled':
      return `${who} turned ${names.app(target)} on${d.workspace ? ` for ${names.department(String(d.workspace))}` : ''}`;
    case 'app.disabled':
      return `${who} turned ${names.app(target)} off${d.workspace ? ` for ${names.department(String(d.workspace))}` : ''}`;
    case 'app.blocked':
      return `${who} blocked ${names.app(target)} for ${names.department(String(d.workspace))} and every team below it`;
    case 'app.inherited':
      return `${who} let ${names.app(target)} follow the floor above on ${names.department(String(d.workspace))}`;
    case 'app.scopes-granted':
      return d.shipsWithAugur ? `${names.app(target)} may now do what its release asks` : `${who} changed what ${names.app(target)} may do`;
    case 'app.setting-changed': {
      const setting = `“${String(d.label ?? d.setting)}”`;
      return d.value === null
        ? `${who} put ${names.app(target)}’s ${setting} back to its default`
        : `${who} set ${names.app(target)}’s ${setting} to ${String(d.value)}${d.unit ? ` ${String(d.unit)}` : ''}`;
    }
    case 'team-notices.on':
      return `${who} turned on team notices for ${names.department(target)}`;
    case 'team-notices.off':
      return `${who} turned off team notices for ${names.department(target)}`;
    case 'app.removed':
      return `${who} removed ${names.app(target)} from the catalogue`;
    case 'origin.allowed':
      return `${who} let apps load from ${target}`;
    case 'origin.removed':
      return `${who} stopped apps loading from ${target}`;
    case 'platform.upgrade-requested':
      return `${who} asked to upgrade AUGUR from ${String(d.from)} to ${target}`;
    case 'platform.upgrade-cancelled':
      return `${who} cancelled the upgrade to AUGUR ${target}`;
    case 'platform.upgraded':
      return `AUGUR was upgraded from ${String(d.from)} to ${target}`;
    case 'platform.upgrade-rolled-back':
      return `The upgrade to AUGUR ${target} didn’t finish and went back to ${String(d.from)}`;
    case 'platform.upgrade-failed':
      return `The upgrade to AUGUR ${target} stopped partway and needs a person`;
    case 'platform.updates-checked':
      return d.available
        ? `${who} checked for updates: AUGUR ${String(d.available)} is out`
        : d.problem
          ? `${who} checked for updates, but the release feed couldn’t be read`
          : `${who} checked for updates: AUGUR ${target} is the newest`;
    default:
      return `${who}: ${e.action}${target ? ` (${target})` : ''}`;
  }
};

export type Period = 'today' | 'week' | 'month' | 'all' | 'custom';

/** The time range a period covers, ending now; a custom range runs from the start of `from` to the end of `to`. */
export const rangeFor = (period: Period, now: Date, from = '', to = ''): Pick<AuditQuery, 'since' | 'until'> => {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysAgo = (n: number) => new Date(startOfDay(now).getTime() - n * 86_400_000).toISOString();
  switch (period) {
    case 'today':
      return { since: startOfDay(now).toISOString() };
    case 'week':
      return { since: daysAgo(6) };
    case 'month':
      return { since: daysAgo(29) };
    case 'custom': {
      const day = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : undefined);
      const a = day(from);
      const b = day(to);
      return { ...(a ? { since: a.toISOString() } : {}), ...(b ? { until: new Date(b.getTime() + 86_400_000).toISOString() } : {}) };
    }
    default:
      return {};
  }
};

const periods: SelectOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'all', label: 'Any time' },
  { value: 'custom', label: 'Between dates' },
];

/** The audit log, readable: who did what, where and when, newest first. */
export class AdminActivity extends LitElement {
  static override properties = {
    api: { attribute: false },
    entries: { state: true },
    names: { state: true },
    filterOptions: { state: true },
    loading: { state: true },
    more: { state: true },
    loadingMore: { state: true },
    error: { state: true },
    open: { state: true },
    who: { state: true },
    area: { state: true },
    floor: { state: true },
    period: { state: true },
    from: { state: true },
    to: { state: true },
  };

  declare api: AdminApi;
  declare entries: AuditEntry[];
  declare names: Names;
  declare filterOptions: { people: SelectOption[]; areas: SelectOption[]; floors: SelectOption[] };
  declare loading: boolean;
  declare more: boolean;
  declare loadingMore: boolean;
  declare error: string;
  declare open: string | undefined;
  declare who: string;
  declare area: string;
  /** Only this floor and the floors below it. */
  declare floor: string;
  declare period: Period;
  declare from: string;
  declare to: string;
  /** Answers to an older ask are dropped when filters change mid-flight. */
  private ask = 0;

  constructor() {
    super();
    this.entries = [];
    this.names = namesFrom([], [], []);
    this.filterOptions = { people: [], areas: [], floors: [] };
    this.loading = true;
    this.more = false;
    this.loadingMore = false;
    this.error = '';
    this.who = ANYONE;
    this.area = ANYONE;
    this.floor = ANYONE;
    this.period = 'week';
    this.from = '';
    this.to = '';
  }

  override createRenderRoot() {
    return this;
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('api') && this.api) {
      void this.loadNames();
      void this.load();
    }
  }

  /** Names for the sentences and the filters. Without them the log still shows, with ids. */
  async loadNames() {
    const [people, departments, apps, org] = await Promise.all([
      this.api.people().catch(() => [] as Person[]),
      this.api.departments().catch(() => [] as Department[]),
      this.api.apps().catch(() => [] as CatalogueApp[]),
      this.api.org().catch(() => undefined),
    ]);
    // The org's name reads like a department's in sentences about floors.
    this.names = namesFrom(people, org ? [...departments, { id: org.id, name: org.name, members: [] }] : departments, apps);
    const floors = org ? floorTree(org, departments) : [];
    this.filterOptions = {
      people: [{ value: ANYONE, label: 'Anyone' }, ...people.map((p) => ({ value: p.id, label: fullName(p) })).sort((a, b) => a.label.localeCompare(b.label))],
      areas: [
        { value: ANYONE, label: 'Anywhere' },
        { value: 'identity', label: 'People and departments' },
        { value: 'registry', label: 'App catalogue' },
        ...apps.filter((a) => !a.platform).map((a) => ({ value: a.id, label: a.name })),
      ],
      floors: [
        { value: ANYONE, label: 'Any floor' },
        ...floors.map((f) => ({ value: f.id, label: f.path.map((id) => floors.find((x) => x.id === id)?.name ?? '').join(' / '), detail: f.path.length > 1 ? 'and below' : 'everything on a floor' })),
      ],
    };
  }

  private query(before?: string): AuditQuery {
    return {
      ...(this.who !== ANYONE ? { actor: this.who } : {}),
      ...(this.area !== ANYONE ? { app: this.area } : {}),
      ...(this.floor !== ANYONE ? { workspace: this.floor } : {}),
      ...rangeFor(this.period, new Date(), this.from, this.to),
      ...(before ? { before } : {}),
      limit: PAGE,
    };
  }

  async load() {
    const ask = ++this.ask;
    this.loading = true;
    this.error = '';
    this.open = undefined;
    try {
      const page = await this.api.audit(this.query());
      if (ask !== this.ask) return;
      this.entries = page;
      this.more = page.length === PAGE;
    } catch (err) {
      if (ask === this.ask) this.error = (err as Error).message;
    } finally {
      if (ask === this.ask) this.loading = false;
    }
  }

  async loadOlder() {
    const last = this.entries.at(-1);
    if (!last) return;
    const ask = this.ask;
    this.loadingMore = true;
    try {
      const page = await this.api.audit(this.query(last.id));
      if (ask !== this.ask) return;
      this.entries = [...this.entries, ...page];
      this.more = page.length === PAGE;
    } catch (err) {
      if (ask === this.ask) this.error = (err as Error).message;
    } finally {
      this.loadingMore = false;
    }
  }

  private set(key: 'who' | 'area' | 'floor' | 'period' | 'from' | 'to', value: string) {
    (this as Record<typeof key, string>)[key] = value;
    if (this.period === 'custom' && (key === 'from' || key === 'to' || key === 'period') && !this.from && !this.to) return;
    void this.load();
  }

  private readonly columns: TableColumn[] = [
    { key: 'at', label: 'When', kind: 'date', sortable: true, sortFirst: 'desc' },
    { key: 'what', label: 'What happened', wrap: true },
    { key: 'area', label: 'Where', sortable: true },
  ];

  private filters() {
    const on = (key: 'who' | 'area' | 'floor' | 'period' | 'from' | 'to') => (e: CustomEvent<{ value: string }>) => this.set(key, e.detail.value);
    return html`<div style="display:flex;flex-wrap:wrap;gap:var(--space-4);align-items:flex-end;padding:var(--space-4) var(--space-4) 0">
      <ui-select label="Who" .options=${this.filterOptions.people} .value=${this.who} @ui-change=${on('who')} style="min-width:12rem"></ui-select>
      <ui-select label="Where" .options=${this.filterOptions.areas} .value=${this.area} @ui-change=${on('area')} style="min-width:12rem"></ui-select>
      <ui-select label="Floor" .options=${this.filterOptions.floors} .value=${this.floor} @ui-change=${on('floor')} style="min-width:12rem"></ui-select>
      <ui-select label="When" .options=${periods} .value=${this.period} @ui-change=${on('period')} style="min-width:10rem"></ui-select>
      ${this.period === 'custom'
        ? html`<ui-text-field label="From" type="date" .value=${this.from} @ui-change=${on('from')}></ui-text-field>
            <ui-text-field label="To" type="date" .value=${this.to} @ui-change=${on('to')}></ui-text-field>`
        : nothing}
    </div>`;
  }

  private details() {
    const e = this.entries.find((x) => x.id === this.open);
    if (!e) return nothing;
    const facts: Fact[] = [
      { label: 'When', value: new Date(e.at).toLocaleString() },
      { label: 'Who', value: e.actor.kind === 'user' ? this.names.person(e.actor.id) : `${this.names.app(e.actor.id)} (a service)` },
      { label: 'Where', value: areaName(e.app, this.names) },
      { label: 'Action', value: e.action },
      ...(e.target ? [{ label: 'About', value: e.target }] : []),
      ...(e.workspace ? [{ label: 'Floor', value: e.workspace.path.map((id) => this.names.department(id)).join(' / ') }] : []),
      ...Object.entries(e.detail ?? {}).map(([k, v]) => ({ label: k, value: typeof v === 'string' ? v : JSON.stringify(v) })),
    ];
    return html`<ui-dialog
      open
      light
      size="glance"
      eyebrow="Activity"
      heading=${describe(e, this.names)}
      summary="Everything recorded about this change. Entries can’t be edited or removed."
      cancel-label="Close"
      @ui-close=${() => (this.open = undefined)}
    >
      <ui-facts .items=${facts}></ui-facts>
    </ui-dialog>`;
  }

  override render() {
    const rows: TableRow[] = this.entries.map((e) => ({ id: e.id, at: e.at, what: describe(e, this.names), area: areaName(e.app, this.names) }));
    return page(
      'Admin',
      'Activity',
      'Every change made through the platform: who, what, where and when. Nothing here can be edited or removed.',
      html`${this.filters()}
        <ui-table
          noun="changes"
          .columns=${this.columns}
          .rows=${rows}
          ?loading=${this.loading}
          .error=${this.error}
          empty="Nothing was changed in this time."
          @ui-open=${(e: CustomEvent<{ row: TableRow }>) => (this.open = e.detail.row.id)}
          @ui-retry=${() => this.load()}
        ></ui-table>
        ${this.more && !this.loading
          ? html`<div style="display:flex;justify-content:center;padding:var(--space-4)">
              <ui-button kind="secondary" size="sm" ?busy=${this.loadingMore} @click=${() => this.loadOlder()}>Show older</ui-button>
            </div>`
          : nothing}
        ${this.details()}`,
    );
  }
}

if (!customElements.get('admin-activity')) customElements.define('admin-activity', AdminActivity);
