import { LitElement, html, nothing } from 'lit';
import semver from 'semver';
import { SDK_VERSION } from '@platform/mfe-sdk';
import type { DialogSubmit, Fact, Row, SelectOption, StatusName, TableColumn, TableRow } from '@platform/ui-kit';
import type { AdminApi, AllowedOrigin, AppVersion, CatalogueApp, IssuedSignIn } from './api.js';
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
};

/** What an app may do on the platform, as a fact's value. */
export const scopeWords = (scopes: string[] | undefined) =>
  scopes?.length ? scopes.map((s) => SCOPE_WORDS[s] ?? s).join(', ') : 'Nothing beyond registering itself';

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
      if (app && !app.platform) void this.loadVersions(app.id);
    }
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
      { label: 'Platform SDK', value: app.sdk },
      { label: 'Address', value: app.route },
      ...(app.entry.startsWith('/') && !app.entry.startsWith('//') ? [] : [{ label: 'Loads from', value: app.entry }]),
      ...(app.requiredRole ? [{ label: 'Only for', value: app.requiredRole }] : []),
      ...(app.platform ? [] : [{ label: 'May', value: scopeWords(app.scopes) }]),
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
        ? html`<p>Platform apps are always on.</p>`
        : html`<ui-toggle
            label="Offered to people"
            hint=${state.why ?? 'Everyone it’s meant for sees it in Apps and Title.'}
            ?checked=${app.enabled}
            .change=${async (enabled: boolean) => {
              const updated = await this.api.setAppEnabled(app.id, enabled);
              this.apps = this.apps.map((a) => (a.id === updated.id ? updated : a));
            }}
          ></ui-toggle>`}
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
        source: a.platform ? 'Platform' : (a.registeredBy ?? ''),
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
