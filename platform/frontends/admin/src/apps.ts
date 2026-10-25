import { LitElement, html, nothing } from 'lit';
import semver from 'semver';
import { SDK_VERSION } from '@augur/mfe-sdk';
import type { DialogSubmit, Fact, Row, SelectOption, StatusName, TableColumn, TableRow } from '@augur/ui-kit';
import type { AdminApi, AllowedOrigin, AppVersion, CatalogueApp, Department, FloorChoice, FloorRule, IssuedSignIn } from './api.js';
import { page } from './parts.js';

/** Where an app stands: off, on, or on but unable to open in this platform. */
export const appStatus = (app: CatalogueApp, sdkVersion = SDK_VERSION): { status: StatusName; label: string; why?: string } => {
  if (!app.enabled) return { status: 'paused', label: 'Off', why: 'Nobody is offered it until it’s turned on.' };
  if (app.blocked) return { status: 'warning', label: 'Blocked', why: app.blocked };
  const range = semver.validRange(app.sdk);
  if (!range || !semver.satisfies(sdkVersion, range, { includePrerelease: true })) {
    return { status: 'warning', label: 'Won’t open', why: `It works with platform SDK ${app.sdk}; this platform has ${sdkVersion}.` };
  }
  return { status: 'done', label: 'On' };
};

/** "Follow new versions" in the version picker. */
const NEWEST = '';

/** Why rolling back might not be all it seems: the manifest changes, the code at the entry address may not. */
export const rollbackNote = (current: CatalogueApp, target?: AppVersion): string =>
  target && target.version !== current.version && target.entry.entry === current.entry
    ? `Version ${target.version} loads from the same address as ${current.version}, so the shell gets that version’s menu and settings but runs whatever code is there now. Redeploy that version’s service to run its code too.`
    : '';

/** What each scope lets an app's service do, in words. */
export const SCOPE_WORDS: Record<string, string> = {
  'notifications:send': 'Notify people',
  'audit:write': 'Write to the activity log',
  'models:use': 'Use AI models',
  'events:publish': 'Tell other services what happened',
  'events:subscribe': 'Hear what other services did',
  'people:read': 'Look up people and teams',
};

/** What an app may do on the platform, as a fact's value. */
export const scopeWords = (scopes: string[] | undefined) =>
  scopes?.length ? scopes.map((s) => SCOPE_WORDS[s] ?? s).join(', ') : 'Nothing beyond registering itself';

/** A floor an app can be set on, in tree order: the org first, then each team below the one it sits in. */
export interface AppFloor {
  id: string;
  name: string;
  /** Ids from the org down to this floor, itself included. */
  path: string[];
}

/** The org and its teams as floors, parents before children. */
export const floorTree = (org: { id: string; name: string }, departments: Department[]): AppFloor[] => {
  const out: AppFloor[] = [{ id: org.id, name: org.name, path: [org.id] }];
  const walk = (parent: string | undefined, path: string[]) => {
    for (const d of departments.filter((x) => x.parentId === parent).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ id: d.id, name: d.name, path: [...path, d.id] });
      walk(d.id, [...path, d.id]);
    }
  };
  walk(undefined, [org.id]);
  return out;
};

/**
 * Whether an app is on for a floor, in words, the way the registry decides
 * it: off everywhere while it's turned off, a block on the floor or above
 * wins, then the nearest rule from the floor upwards that carries on, and on
 * with no rule at all.
 */
export const floorStatus = (app: CatalogueApp, floor: AppFloor, rules: FloorRule[], names: Map<string, string>): { on: boolean; words: string } => {
  if (!app.enabled) return { on: false, words: 'Off: the app is turned off' };
  const kind = floor.path.length === 1 ? 'org' : 'team';
  if (app.floors && !app.floors.includes(kind)) return { on: false, words: `Off: it doesn’t work on ${kind === 'org' ? 'the org' : 'teams'}` };
  const block = rules.find((r) => r.state === 'blocked' && floor.path.includes(r.workspace));
  if (block) return { on: false, words: block.workspace === floor.id ? 'Blocked here and below' : `Off: blocked by ${names.get(block.workspace) ?? 'a floor above'}` };
  for (let i = floor.path.length - 1; i >= 0; i--) {
    const here = i === floor.path.length - 1;
    const rule = rules.find((r) => r.workspace === floor.path[i] && r.state !== 'blocked' && (here || r.carriesOn));
    if (rule) return { on: rule.state === 'on', words: `${rule.state === 'on' ? 'On' : 'Off'}${here ? '' : `, as ${names.get(rule.workspace) ?? 'the floor above'}`}` };
  }
  return { on: true, words: 'On' };
};

/** What an admin can lower an app's upload limit to: what it asks, or any of these below that. */
const UPLOAD_STEPS = [500, 200, 100, 50, 25, 10, 5, 1];
const DEFAULT_UPLOAD_MB = 10;

/** The choices for an app's upload limit, its own first. */
export const uploadChoices = (app: Pick<CatalogueApp, 'maxUpload' | 'uploadLimit' | 'uploadLimitLowered'>): SelectOption[] => {
  const asked = app.maxUpload ?? DEFAULT_UPLOAD_MB;
  // A limit set another way than this list still shows as chosen.
  const steps = new Set(UPLOAD_STEPS.filter((mb) => mb < asked));
  if (app.uploadLimitLowered && app.uploadLimit) steps.add(app.uploadLimit);
  return [{ value: 'asked', label: `${asked} MB, as it asks` }, ...[...steps].sort((a, b) => b - a).map((mb) => ({ value: String(mb), label: `${mb} MB` }))];
};

const FLOOR_CHOICES: SelectOption[] = [
  { value: 'inherit', label: 'As the floor above' },
  { value: 'on', label: 'On here and below' },
  { value: 'off', label: 'Off here and below' },
  { value: 'blocked', label: 'Blocked here and below', detail: 'No team below can turn it on' },
];

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Every app in the catalogue with its version, a switch to stop offering one, and its kept versions to go back to. */
export class AdminApps extends LitElement {
  static override properties = {
    api: { attribute: false },
    apps: { state: true },
    loading: { state: true },
    error: { state: true },
    open: { state: true },
    versions: { state: true },
    versionsError: { state: true },
    choice: { state: true },
    saving: { state: true },
    saveError: { state: true },
    origins: { state: true },
    originsOpen: { state: true },
    originsError: { state: true },
    working: { state: true },
    issuing: { state: true },
    issued: { state: true },
    floorRules: { state: true },
    floorList: { state: true },
    floorsError: { state: true },
  };

  declare api: AdminApi;
  declare apps: CatalogueApp[];
  declare loading: boolean;
  declare error: string;
  declare open: string | undefined;
  declare versions: AppVersion[] | undefined;
  declare versionsError: string;
  /** The version picked in the open app's picker, before Use this. */
  declare choice: string;
  declare saving: boolean;
  declare saveError: string;
  /** Sites apps may load from besides the platform itself; undefined until loaded. */
  declare origins: AllowedOrigin[] | undefined;
  declare originsOpen: boolean;
  declare originsError: string;
  declare working: boolean;
  /** The app whose sign-in is about to be replaced, while the admin confirms. */
  declare issuing: CatalogueApp | undefined;
  /** The secret just issued, shown once. */
  declare issued: (IssuedSignIn & { name: string }) | undefined;
  /** What each floor says about the open app; undefined until loaded. */
  declare floorRules: FloorRule[] | undefined;
  /** The org and its teams; loaded once. */
  declare floorList: AppFloor[] | undefined;
  declare floorsError: string;

  constructor() {
    super();
    this.apps = [];
    this.loading = true;
    this.error = '';
    this.versionsError = '';
    this.choice = NEWEST;
    this.saving = false;
    this.saveError = '';
    this.originsOpen = false;
    this.originsError = '';
    this.working = false;
    this.floorsError = '';
  }

  override createRenderRoot() {
    return this;
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('api') && this.api) void this.load();
    if (changed.has('originsOpen') && this.originsOpen) void this.loadOrigins();
    if (changed.has('open')) {
      this.versions = undefined;
      this.versionsError = '';
      this.saveError = '';
      const app = this.apps.find((a) => a.id === this.open);
      this.choice = app?.pinnedVersion ?? NEWEST;
      this.floorRules = undefined;
      this.floorsError = '';
      if (app && !app.platform) {
        void this.loadVersions(app.id);
        void this.loadFloors(app.id);
      }
    }
  }

  async loadFloors(id: string) {
    try {
      const [rules, list] = await Promise.all([
        this.api.appFloors(id),
        this.floorList ?? Promise.all([this.api.org(), this.api.departments()]).then(([org, departments]) => floorTree(org, departments)),
      ]);
      this.floorList = list;
      if (this.open === id) this.floorRules = rules;
    } catch (err) {
      if (this.open === id) this.floorsError = (err as Error).message;
    }
  }

  async setFloor(app: CatalogueApp, floor: AppFloor, state: FloorChoice) {
    this.floorsError = '';
    try {
      const { rules } = await this.api.setAppFloor(app.id, floor.id, state);
      if (this.open === app.id) this.floorRules = rules;
    } catch (err) {
      this.floorsError = (err as Error).message;
    }
  }

  async limitUploads(app: CatalogueApp, choice: string) {
    this.floorsError = '';
    try {
      const updated = await this.api.limitUploads(app.id, choice === 'asked' ? null : Number(choice));
      this.apps = this.apps.map((a) => (a.id === updated.id ? updated : a));
    } catch (err) {
      this.floorsError = (err as Error).message;
    }
  }

  async allowScopes(app: CatalogueApp) {
    this.floorsError = '';
    try {
      const updated = await this.api.grantScopes(app.id, [...(app.grantedScopes ?? []), ...(app.awaitingScopes ?? [])]);
      this.apps = this.apps.map((a) => (a.id === updated.id ? updated : a));
    } catch (err) {
      this.floorsError = (err as Error).message;
    }
  }

  /** Where the app is on, floor by floor, and a choice for each. */
  private floors(app: CatalogueApp) {
    const rules = this.floorRules;
    const list = this.floorList;
    if (this.floorsError && !rules) return html`<p style="color:var(--danger)">${this.floorsError}</p>`;
    if (!rules || !list) return html`<ui-rows loading count="3"></ui-rows>`;
    const names = new Map(list.map((f) => [f.id, f.name]));
    return html`<div data-floors style="display:flex;flex-direction:column;gap:var(--space-2)">
      <p>Where it’s on. Everyone’s own floor follows the org.</p>
      ${this.floorsError ? html`<p style="color:var(--danger)">${this.floorsError}</p>` : nothing}
      ${list.map((floor) => {
        const rule = rules.find((r) => r.workspace === floor.id);
        const status = floorStatus(app, floor, rules, names);
        return html`<ui-select
          data-floor=${floor.id}
          style=${`margin-inline-start:calc(var(--space-4) * ${floor.path.length - 1})`}
          label=${floor.name}
          hint=${status.words}
          .options=${FLOOR_CHOICES}
          .value=${rule?.state ?? 'inherit'}
          @ui-change=${(e: CustomEvent<{ value: FloorChoice }>) => this.setFloor(app, floor, e.detail.value)}
        ></ui-select>`;
      })}
    </div>`;
  }

  async loadVersions(id: string) {
    try {
      const versions = await this.api.appVersions(id);
      if (this.open === id) this.versions = versions;
    } catch (err) {
      if (this.open === id) this.versionsError = (err as Error).message;
    }
  }

  /** Serves the picked version and holds the app there, or follows new versions again. */
  async useChoice(app: CatalogueApp) {
    this.saving = true;
    this.saveError = '';
    try {
      const updated = await this.api.pinApp(app.id, this.choice === NEWEST ? null : this.choice);
      this.apps = this.apps.map((a) => (a.id === updated.id ? updated : a));
      await this.loadVersions(app.id);
    } catch (err) {
      this.saveError = (err as Error).message;
    } finally {
      this.saving = false;
    }
  }

  private history(app: CatalogueApp) {
    if (this.versionsError) return html`<p style="color:var(--danger)">${this.versionsError}</p>`;
    const versions = this.versions;
    const rows: Row[] = (versions ?? []).map((v) => ({
      label: `Version ${v.version}`,
      value: `${day(v.registeredAt)}${v.serving ? ' · in use' : ''}${v.version === app.pinnedVersion ? ', held' : ''}`,
    }));
    const options: SelectOption[] = [
      { value: NEWEST, label: 'The newest, as it registers' },
      ...(versions ?? []).map((v) => ({ value: v.version, label: `Version ${v.version}, and hold it` })),
    ];
    const current = app.pinnedVersion ?? NEWEST;
    const note = rollbackNote(app, versions?.find((v) => v.version === this.choice));
    return html`<ui-rows .items=${rows} ?loading=${!versions} count="2" empty="No versions are kept yet."></ui-rows>
      <ui-select
        label="Give the shell"
        hint=${app.pinnedVersion ? `Held at ${app.pinnedVersion}: new versions are kept but not used.` : 'Each new version is used as soon as it registers.'}
        .options=${options}
        .value=${this.choice}
        ?disabled=${!versions}
        @ui-change=${(e: CustomEvent<{ value: string }>) => (this.choice = e.detail.value)}
      ></ui-select>
      ${note ? html`<p>${note}</p>` : nothing}
      ${this.saveError ? html`<p style="color:var(--danger)">${this.saveError}</p>` : nothing}
      <div>
        <ui-button kind="secondary" size="sm" ?disabled=${this.choice === current} ?busy=${this.saving} @click=${() => this.useChoice(app)}>
          ${this.choice === NEWEST ? 'Follow new versions' : `Use version ${this.choice}`}
        </ui-button>
      </div>`;
  }

  async load() {
    this.loading = true;
    this.error = '';
    try {
      this.apps = await this.api.apps();
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.loading = false;
    }
  }

  async loadOrigins() {
    this.originsError = '';
    try {
      this.origins = await this.api.origins();
    } catch (err) {
      this.originsError = (err as Error).message;
    }
  }

  /** Allows a site, then stays open with the field cleared for the next. */
  allowOrigin: DialogSubmit = async (values, dialog) => {
    const added = await this.api.allowOrigin(values.origin.trim());
    this.origins = [...(this.origins ?? []).filter((o) => o.origin !== added.origin), added];
    const field = dialog.querySelector<HTMLElement & { value: string }>('ui-text-field[name="origin"]');
    if (field) field.value = '';
    // An app registered from it before is offered again.
    await this.load();
    return false as const;
  };

  async removeOrigin(origin: string) {
    this.working = true;
    this.originsError = '';
    try {
      await this.api.removeOrigin(origin);
      this.origins = (this.origins ?? []).filter((o) => o.origin !== origin);
      await this.load();
    } catch (err) {
      this.originsError = (err as Error).message;
    } finally {
      this.working = false;
    }
  }

  private originsDialog() {
    if (!this.originsOpen) return nothing;
    const origins = this.origins;
    return html`<ui-dialog
      open
      size="glance"
      eyebrow="Apps"
      heading="Where apps load from"
      summary="Apps on the platform’s own address can always load. An app whose entry is on another site can only register, and only open, if that site is here."
      action-label="Allow"
      busy-label="Allowing…"
      cancel-label="Done"
      .submit=${this.allowOrigin}
      @ui-close=${() => (this.originsOpen = false)}
    >
      <div data-origins style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${this.originsError ? html`<p style="color:var(--danger)">${this.originsError}</p>` : nothing}
        ${!origins
          ? this.originsError
            ? nothing
            : html`<ui-rows loading count="2"></ui-rows>`
          : origins.length
            ? origins.map(
                (o) => html`<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);min-height:40px;border-bottom:1px solid var(--hairline)">
                  <span style="color:var(--ink)">${o.origin}<span style="color:var(--ink-muted);font-size:var(--type-small)"> since ${day(o.addedAt)}</span></span>
                  <ui-button kind="tertiary" size="sm" ?disabled=${this.working} @click=${() => this.removeOrigin(o.origin)}>Remove</ui-button>
                </div>`,
              )
            : html`<p>No other sites yet, so apps can only load from the platform itself.</p>`}
      </div>
      <p>The server must allow a site too, so the browser will run its code; see Deploy in the platform’s guides.</p>
      <ui-text-field slot="fields" name="origin" label="Allow a site" placeholder="https://apps.example.org" required></ui-text-field>
    </ui-dialog>`;
  }

  /** Replaces the app's secret, then shows the new one once. */
  issueSignIn: DialogSubmit = async () => {
    const app = this.issuing!;
    const issued = await this.api.issueSignIn(app.id);
    this.issued = { ...issued, name: app.name };
  };

  private issueDialog() {
    const app = this.issuing;
    if (!app) return nothing;
    return html`<ui-dialog
      open
      size="glance"
      danger
      eyebrow=${app.name}
      heading="Issue a new sign-in?"
      summary="The app’s service signs in to the platform with a secret. A new one stops the old one working straight away, so the service can’t register, notify or write to the log until it’s given the new one."
      action-label="Issue a new sign-in"
      busy-label="Issuing…"
      cancel-label="Keep the old one"
      .submit=${this.issueSignIn}
      @ui-close=${() => (this.issuing = undefined)}
    ></ui-dialog>`;
  }

  /** Shown once, straight after it is made: it isn't kept anywhere the admin can see it again. */
  private secretNote() {
    const issued = this.issued;
    if (!issued) return nothing;
    return html`<ui-dialog
      open
      size="glance"
      eyebrow="New sign-in"
      heading=${`Give ${issued.name}’s service this secret`}
      summary=${`Set it as SERVICE_CLIENT_SECRET where the service runs, then restart it. It signs in as ${issued.clientId}.`}
      cancel-label="Done"
      @ui-close=${() => (this.issued = undefined)}
    >
      <p
        data-secret
        style="margin:0;padding:var(--space-4);border-radius:var(--radius-inset);background:color-mix(in srgb, var(--ink) 6%, transparent);font-family:var(--font-mono, monospace);font-size:var(--type-body);color:var(--ink);word-break:break-all;user-select:all"
      >${issued.secret}</p>
      <p>It won’t be shown again. If it’s lost, issue a new one.</p>
      <div>
        <ui-button kind="secondary" size="sm" @click=${() => navigator.clipboard?.writeText(issued.secret).catch(() => undefined)}>Copy it</ui-button>
      </div>
    </ui-dialog>`;
  }

  private readonly columns: TableColumn[] = [
    { key: 'name', label: 'App', sortable: true },
    { key: 'version', label: 'Version', sortable: true },
    { key: 'route', label: 'Address', sortable: true },
    { key: 'state', label: 'Status', sortable: true, format: (v, row) => html`<ui-status status=${String(row.stateStatus)} label=${String(v)}></ui-status>` },
    { key: 'source', label: 'From', sortable: true },
  ];

  private details() {
    const app = this.apps.find((a) => a.id === this.open);
    if (!app) return nothing;
    const state = appStatus(app);
    const facts: Fact[] = [
      { label: 'Version', value: app.pinnedVersion ? `${app.version}, held` : app.version },
      { label: 'AUGUR SDK', value: app.sdk },
      { label: 'Address', value: app.route },
      ...(app.entry.startsWith('/') && !app.entry.startsWith('//') ? [] : [{ label: 'Loads from', value: app.entry }]),
      ...(app.requiredRole ? [{ label: 'Only for', value: app.requiredRole }] : []),
      ...(app.platform ? [] : [{ label: 'May', value: scopeWords(app.grantedScopes ?? app.scopes) }]),
    ];
    return html`<ui-dialog
      open
      light
      size="glance"
      eyebrow=${app.platform ? 'Part of the platform' : `Registered by ${app.registeredBy ?? 'its service'}`}
      heading=${app.name}
      summary=${app.description ?? ''}
      cancel-label="Close"
      @ui-close=${() => (this.open = undefined)}
    >
      <ui-facts .items=${facts}></ui-facts>
      ${app.platform
        ? html`<p>Built-in apps are always on.</p>`
        : html`<ui-toggle
            label="Offered to people"
            hint=${state.why ?? 'Everyone it’s meant for sees it in Apps and Title.'}
            ?checked=${app.enabled}
            .change=${async (enabled: boolean) => {
              const updated = await this.api.setAppEnabled(app.id, enabled);
              this.apps = this.apps.map((a) => (a.id === updated.id ? updated : a));
            }}
          ></ui-toggle>`}
      ${app.awaitingScopes?.length
        ? html`<p>Version ${app.version} also asks to: ${scopeWords(app.awaitingScopes)}. It runs without that until you allow it.</p>
            <div><ui-button kind="secondary" size="sm" @click=${() => this.allowScopes(app)}>Allow it</ui-button></div>`
        : nothing}
      ${app.platform
        ? nothing
        : html`<ui-select
            data-upload-limit
            label="Largest upload"
            hint="What one request to its service may carry. You can lower what it asks for, not raise it."
            .options=${uploadChoices(app)}
            .value=${app.uploadLimitLowered ? String(app.uploadLimit) : 'asked'}
            @ui-change=${(e: CustomEvent<{ value: string }>) => this.limitUploads(app, e.detail.value)}
          ></ui-select>`}
      ${app.platform ? nothing : this.floors(app)}
      ${app.handles?.length ? html`<p>Answers ${app.handles.join(', ')}.</p>` : nothing}
      ${app.platform ? nothing : this.history(app)}
      ${app.platform
        ? nothing
        : html`<div>
            <ui-button kind="tertiary" size="sm" @click=${() => (this.issuing = app)}>Issue a new sign-in</ui-button>
          </div>`}
      ${app.updatedAt ? html`<p>Registered ${day(app.registeredAt)}, last updated ${day(app.updatedAt)}.</p>` : nothing}
    </ui-dialog>`;
  }

  override render() {
    const rows: TableRow[] = this.apps.map((a) => {
      const state = appStatus(a);
      return {
        id: a.id,
        name: a.name,
        version: a.pinnedVersion ? `${a.version}, held` : a.version,
        route: a.route,
        state: state.label,
        stateStatus: state.status,
        source: a.platform ? 'AUGUR' : (a.registeredBy ?? ''),
      };
    });
    return page(
      'Admin',
      'Apps',
      'Every app in the catalogue. Turn one off to stop offering it, or go back to an earlier version, without removing it.',
      html`<ui-table
          noun="apps"
          .columns=${this.columns}
          .rows=${rows}
          ?loading=${this.loading}
          .error=${this.error}
          empty="No apps are registered."
          @ui-open=${(e: CustomEvent<{ row: TableRow }>) => (this.open = e.detail.row.id)}
          @ui-retry=${() => this.load()}
        >
          <ui-button slot="actions" kind="secondary" size="sm" @click=${() => (this.originsOpen = true)}>Where apps load from</ui-button>
        </ui-table>
        ${this.details()} ${this.originsDialog()} ${this.issueDialog()} ${this.secretNote()}`,
    );
  }
}

if (!customElements.get('admin-apps')) customElements.define('admin-apps', AdminApps);
