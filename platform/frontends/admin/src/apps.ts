import { LitElement, html, nothing } from 'lit';
import semver from 'semver';
import { SDK_VERSION } from '@platform/mfe-sdk';
import type { Fact, Row, SelectOption, StatusName, TableColumn, TableRow } from '@platform/ui-kit';
import type { AdminApi, AppVersion, CatalogueApp } from './api.js';
import { page } from './parts.js';

/** Where an app stands: off, on, or on but unable to open in this platform. */
export const appStatus = (app: CatalogueApp, sdkVersion = SDK_VERSION): { status: StatusName; label: string; why?: string } => {
  if (!app.enabled) return { status: 'paused', label: 'Off', why: 'Nobody is offered it until it’s turned on.' };
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

  constructor() {
    super();
    this.apps = [];
    this.loading = true;
    this.error = '';
    this.versionsError = '';
    this.choice = NEWEST;
    this.saving = false;
    this.saveError = '';
  }

  override createRenderRoot() {
    return this;
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('api') && this.api) void this.load();
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
      ...(app.requiredRole ? [{ label: 'Only for', value: app.requiredRole }] : []),
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
        ></ui-table>
        ${this.details()}`,
    );
  }
}

if (!customElements.get('admin-apps')) customElements.define('admin-apps', AdminApps);
