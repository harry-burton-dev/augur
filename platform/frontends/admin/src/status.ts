import { LitElement, html, nothing } from 'lit';
import type { Fact, StatusName, TableColumn, TableRow } from '@augur/ui-kit';
import type { AdminApi, BackupStatus, ComponentStatus, PlatformUpdates } from './api.js';
import { page } from './parts.js';

/** How often the screen asks the gateway again while it is open. The gateway itself checks every 30 seconds. */
const REFRESH_MS = 15_000;

const kindWords: Record<ComponentStatus['kind'], string> = { gateway: 'AUGUR', service: 'AUGUR', app: 'App', 'sign-in': 'Sign-in' };

/** A component's state as a status mark and its word. */
export const stateOf = (c: Pick<ComponentStatus, 'state'>): { status: StatusName; label: string } =>
  c.state === 'up'
    ? { status: 'done', label: 'Running' }
    : c.state === 'slow'
      ? { status: 'warning', label: 'Slow' }
      : c.state === 'checking'
        ? { status: 'running', label: 'Checking' }
        : { status: 'failed', label: 'Down' };

/** The heading: everything's fine, or how many parts need a look, then backups. */
export const headline = (components: ComponentStatus[], backups?: BackupStatus): { heading: string; summary: string } => {
  const down = components.filter((c) => c.state === 'down').length;
  const slow = components.filter((c) => c.state === 'slow').length;
  if (!components.length) return { heading: 'Status', summary: 'Whether every part of the platform is answering.' };
  if (down) return { heading: `${down === 1 ? '1 part is' : `${down} parts are`} down`, summary: 'People may not be able to use what depends on it. Open a row to see what to check.' };
  if (slow) return { heading: `${slow === 1 ? '1 part is' : `${slow} parts are`} slow`, summary: 'Everything is answering, but not all of it quickly.' };
  if (backups?.state === 'attention') return { heading: 'Backups need a look', summary: backups.problem ?? 'Everything is running, but backups can’t be relied on right now.' };
  return { heading: 'Everything is running', summary: 'Every part of the platform answered its last check.' };
};

/** What to try for a part that's down, by kind. */
const advice = (c: ComponentStatus) =>
  c.kind === 'sign-in'
    ? 'Nobody can sign in while this is down. Check the sign-in service’s container and its database.'
    : c.kind === 'app'
      ? `People can’t use ${c.name} while its service is down; the rest of the platform is unaffected. Check its container.`
      : `Check the ${c.name} container and its logs. Other parts that depend on it may fail too.`;

/** Whether every part of the platform is answering, from the gateway's last checks. */
export class AdminStatus extends LitElement {
  static override properties = {
    api: { attribute: false },
    components: { state: true },
    loading: { state: true },
    backups: { state: true },
    updates: { state: true },
    error: { state: true },
    open: { state: true },
  };

  declare api: AdminApi;
  declare components: ComponentStatus[];
  declare backups: BackupStatus | undefined;
  declare updates: PlatformUpdates | undefined;
  declare loading: boolean;
  declare error: string;
  declare open: string | undefined;
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this.components = [];
    this.loading = true;
    this.error = '';
  }

  override createRenderRoot() {
    return this;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.timer = setInterval(() => void this.load(true), REFRESH_MS);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.timer);
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('api') && this.api) {
      void this.load();
      // Only to say an update is out; Status works the same without it.
      this.api.updates().then((u) => (this.updates = u), () => undefined);
    }
  }

  /** A quiet reload keeps the table as it is while it asks, and keeps the last answer if the ask fails. */
  async load(quiet = false) {
    if (!this.api) return;
    if (!quiet) {
      this.loading = true;
      this.error = '';
    }
    try {
      const { components, backups } = await this.api.status();
      this.components = components;
      this.backups = backups;
      this.error = '';
    } catch (err) {
      if (!quiet || !this.components.length) this.error = (err as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private readonly columns: TableColumn[] = [
    { key: 'name', label: 'Part', sortable: true },
    { key: 'kind', label: 'Kind', sortable: true },
    { key: 'version', label: 'Version', sortable: true },
    { key: 'state', label: 'Status', sortable: true, format: (v, row) => html`<ui-status status=${String(row.stateStatus)} label=${String(v)}></ui-status>` },
    { key: 'seenAt', label: 'Last answered', kind: 'date', sortable: true },
  ];

  private details() {
    const c = this.components.find((x) => x.name === this.open);
    if (!c) return nothing;
    const state = stateOf(c);
    const facts: Fact[] = [
      { label: 'Status', value: state.label },
      ...(c.version ? [{ label: 'Version', value: c.version }] : []),
      ...(c.api ? [{ label: 'API', value: c.api }] : []),
      ...(c.latencyMs !== undefined ? [{ label: 'Answered in', value: `${c.latencyMs} ms` }] : []),
      ...(c.seenAt ? [{ label: 'Last answered', value: new Date(c.seenAt).toLocaleString() }] : []),
      ...(c.checkedAt ? [{ label: 'Last checked', value: new Date(c.checkedAt).toLocaleString() }] : []),
    ];
    return html`<ui-dialog
      open
      light
      size="glance"
      eyebrow=${kindWords[c.kind]}
      heading=${c.name}
      summary=${c.problem ?? (c.state === 'slow' ? 'It answered, but took more than 2 seconds.' : '')}
      cancel-label="Close"
      @ui-close=${() => (this.open = undefined)}
    >
      <ui-facts .items=${facts}></ui-facts>
      ${c.state === 'down' ? html`<p>${advice(c)}</p>` : nothing}
    </ui-dialog>`;
  }

  /** A newer AUGUR release is out: the dot that sends an admin to Updates. */
  private updateNote() {
    const v = this.updates?.available?.version;
    if (!v) return nothing;
    return html`<div data-update style="padding:var(--space-4) var(--space-4) 0">
      <ui-status status="needs" label=${`AUGUR ${v} is out. You’re on ${this.updates!.running.version}: see Admin, Updates.`}></ui-status>
    </div>`;
  }

  /** Last night's backup and the last restore test, when the gateway knows about them. */
  private backupFacts() {
    const b = this.backups;
    if (!b) return nothing;
    const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never');
    const size = (bytes?: number) => (bytes === undefined ? '' : bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
    const r = b.lastRestoreTest;
    const facts: Fact[] = [
      { label: 'Last backup', value: b.lastBackup ? (b.lastBackup.ok ? when(b.lastBackup.at) : 'Failed') : 'Never' },
      ...(b.lastBackup?.ok && b.lastBackup.bytes !== undefined ? [{ label: 'Size', value: size(b.lastBackup.bytes) }] : []),
      { label: 'Last restore test', value: r ? when(r.at) : 'Never' },
      ...(r ? [{ label: 'Result', value: r.ok ? `Restored, ${r.people ?? 0} people` : 'Failed' }] : []),
    ];
    return html`<div style="padding:var(--space-5) var(--space-4) var(--space-4);display:flex;flex-direction:column;gap:var(--space-3)">
      <ui-status status=${b.state === 'ok' ? 'done' : 'warning'} label=${b.state === 'ok' ? 'Backups restore cleanly' : 'Backups need a look'}></ui-status>
      <ui-facts .items=${facts}></ui-facts>
      ${b.problem ? html`<p style="margin:0">${b.problem}</p>` : nothing}
    </div>`;
  }

  override render() {
    const rows: TableRow[] = this.components.map((c) => {
      const state = stateOf(c);
      return { id: c.name, name: c.name, kind: kindWords[c.kind], version: c.version ?? '', state: state.label, stateStatus: state.status, seenAt: c.seenAt ?? '' };
    });
    const { heading, summary } = this.error ? { heading: 'Status', summary: 'Whether every part of the platform is answering.' } : headline(this.components, this.backups);
    return page(
      'Admin',
      heading,
      summary,
      html`<ui-table
          noun="parts"
          .columns=${this.columns}
          .rows=${rows}
          ?loading=${this.loading}
          .error=${this.error}
          empty="Nothing has been checked yet."
          @ui-open=${(e: CustomEvent<{ row: TableRow }>) => (this.open = e.detail.row.id)}
          @ui-retry=${() => this.load()}
        ></ui-table>
        ${this.updateNote()} ${this.backupFacts()} ${this.details()}`,
    );
  }
}

if (!customElements.get('admin-status')) customElements.define('admin-status', AdminStatus);
