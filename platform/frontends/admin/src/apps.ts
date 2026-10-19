import { LitElement, html, nothing } from 'lit';
import semver from 'semver';
import { SDK_VERSION } from '@platform/mfe-sdk';
import type { Fact, StatusName, TableColumn, TableRow } from '@platform/ui-kit';
import type { AdminApi, CatalogueApp } from './api.js';
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

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Every app in the catalogue with its version, and a switch to stop offering one. */
export class AdminApps extends LitElement {
  static override properties = {
    api: { attribute: false },
    apps: { state: true },
    loading: { state: true },
    error: { state: true },
    open: { state: true },
  };

  declare api: AdminApi;
  declare apps: CatalogueApp[];
  declare loading: boolean;
  declare error: string;
  declare open: string | undefined;

  constructor() {
    super();
    this.apps = [];
    this.loading = true;
    this.error = '';
  }

  override createRenderRoot() {
    return this;
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('api') && this.api) void this.load();
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
      { label: 'Version', value: app.version },
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
      ${app.updatedAt ? html`<p>Registered ${day(app.registeredAt)}, last updated ${day(app.updatedAt)}.</p>` : nothing}
    </ui-dialog>`;
  }

  override render() {
    const rows: TableRow[] = this.apps.map((a) => {
      const state = appStatus(a);
      return {
        id: a.id,
        name: a.name,
        version: a.version,
        route: a.route,
        state: state.label,
        stateStatus: state.status,
        source: a.platform ? 'Platform' : (a.registeredBy ?? ''),
      };
    });
    return page(
      'Admin',
      'Apps',
      'Every app in the catalogue. Turn one off to stop offering it without removing it.',
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
