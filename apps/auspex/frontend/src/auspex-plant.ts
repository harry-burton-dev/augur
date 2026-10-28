import { LitElement, html, nothing } from 'lit';
import { ago } from '@augur/ui-kit';
import type { AuspexApi, BackupRun, Part, PlantStatus, PlantUpdates } from './api.js';

/** How often the plant room looks again while it's open. */
const REFRESH_MS = 30_000;
/** An answer this slow fills the meter. */
const FULL_MS = 1000;

const STATE_WORDS: Record<Part['state'], string> = { up: 'Answering', slow: 'Slow', down: 'Not answering', checking: 'Not checked yet' };

/** The parts in three rooms: the way in, the platform's services, and the apps on it. */
export const roomsOf = (parts: Part[]) => {
  const byName = (a: Part, b: Part) => a.name.localeCompare(b.name);
  return [
    { id: 'door', label: 'The way in', parts: parts.filter((p) => p.kind === 'gateway' || p.kind === 'sign-in').sort(byName) },
    { id: 'services', label: 'Services', parts: parts.filter((p) => p.kind === 'service').sort(byName) },
    { id: 'apps', label: 'Apps’ services', parts: parts.filter((p) => p.kind === 'app').sort(byName) },
  ].filter((r) => r.parts.length);
};

/** The plant room in one line: all answering, or how many need someone. */
export const plantLine = (parts: Part[]) => {
  const down = parts.filter((p) => p.state === 'down').length;
  const slow = parts.filter((p) => p.state === 'slow').length;
  if (!down && !slow) return `All ${parts.length} parts are answering.`;
  return [down ? `${down} not answering` : '', slow ? `${slow} slow` : ''].filter(Boolean).join(', ') + ` of ${parts.length} parts.`;
};

type Loaded<T> = T | Error | undefined;

/**
 * The plant room, for admins: every part AUGUR runs on as a machine with a
 * lamp (answering, slow, not answering), its version and how fast it
 * answered; the backups; and the running release against the newest one out.
 * It reads what Admin's Status and Updates read, as the person, and changes
 * nothing. Anyone else is told what it is and who can see it.
 */
export class AuspexPlant extends LitElement {
  static override properties = {
    api: { attribute: false },
    admin: { type: Boolean },
    status: { state: true },
    updates: { state: true },
  };

  declare api: AuspexApi;
  declare admin: boolean;
  declare status: Loaded<PlantStatus>;
  declare updates: Loaded<PlantUpdates>;

  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this.admin = false;
  }

  override createRenderRoot() {
    return this;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.timer = setInterval(() => void this.load(), REFRESH_MS);
  }

  override disconnectedCallback() {
    clearInterval(this.timer);
    super.disconnectedCallback();
  }

  override willUpdate(changed: Map<string, unknown>) {
    if ((changed.has('api') || changed.has('admin')) && this.api && this.admin) void this.load();
  }

  async load() {
    if (!this.admin || !this.api) return;
    const [status, updates] = await Promise.allSettled([this.api.status(), this.api.updates()]);
    this.status = status.status === 'fulfilled' ? status.value : (status.reason as Error);
    this.updates = updates.status === 'fulfilled' ? updates.value : (updates.reason as Error);
  }

  private machine(p: Part) {
    const meter = p.latencyMs === undefined ? 0 : Math.min(1, p.latencyMs / FULL_MS);
    const when = p.checkedAt ? (ago(p.checkedAt) === 'now' ? 'just now' : `${ago(p.checkedAt)} ago`) : '';
    const line = p.problem ?? [p.latencyMs !== undefined ? `${p.latencyMs} ms` : '', when].filter(Boolean).join(', ');
    return html`<li class="ax-machine ${p.state}" aria-label=${`${p.name}: ${STATE_WORDS[p.state]}${p.version ? `, version ${p.version}` : ''}. ${line}`}>
      <span class="lamp" aria-hidden="true"></span>
      <span class="nm">${p.name}</span>
      <span class="ver">${p.version ?? '—'}</span>
      <span class="meter" aria-hidden="true"><i style=${`width: ${Math.round(meter * 100)}%`}></i></span>
      <span class="st">${STATE_WORDS[p.state]}${line ? `: ${line}` : ''}</span>
    </li>`;
  }

  private backup(label: string, run: BackupRun | undefined, missing: string) {
    const state = !run ? 'checking' : run.ok ? 'up' : 'down';
    return html`<li class="ax-machine ${state}">
      <span class="lamp" aria-hidden="true"></span>
      <span class="nm">${label}</span>
      <span class="ver">${run ? new Date(run.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'}</span>
      <span class="st">${!run ? missing : run.ok ? `Worked, ${ago(run.at) === 'now' ? 'just now' : `${ago(run.at)} ago`}` : (run.problem ?? 'Failed')}</span>
    </li>`;
  }

  private renderRelease(updates: Loaded<PlantUpdates>) {
    if (updates instanceof Error) return html`<p class="ax-muted ax-meta">Couldn’t see which release is running: ${updates.message}</p>`;
    if (!updates) return nothing;
    const next = updates.available;
    return html`<div class="ax-release" aria-label=${next ? `AUGUR ${updates.running.version} is running; ${next.version} is out.` : `AUGUR ${updates.running.version} is running, the newest on ${updates.running.channel}.`}>
      <span class="ver now"><span class="ax-label">Running</span>${updates.running.version}</span>
      ${next
        ? html`<span class="arrow" aria-hidden="true"><ui-icon name="arrow" size="18"></ui-icon></span>
            <span class="ver out"><span class="ax-label">Out</span>${next.version}</span>`
        : html`<span class="ax-muted ax-meta">${updates.feed === 'off' ? 'This server doesn’t look for new releases.' : `The newest on ${updates.running.channel}.`}</span>`}
      ${next && updates.needsYou.length ? html`<span class="ax-muted ax-meta">${updates.needsYou.length} ${updates.needsYou.length === 1 ? 'thing needs' : 'things need'} you first</span>` : nothing}
    </div>`;
  }

  override render() {
    const heading = (summary: string) => html`<div class="ax-hero">
      <span class="ax-orb plant" aria-hidden="true"><ui-icon name="server" size="28"></ui-icon></span>
      <ui-heading eyebrow="Plant room" heading="What AUGUR runs on" summary=${summary} size="l" level="1"></ui-heading>
    </div>`;
    if (!this.admin)
      return html`${heading('Each part of AUGUR, whether it’s answering, and which version is running.')}
        <ui-state kind="empty" heading="The plant room is for admins" body="It shows the machinery under every floor, which is an admin’s to look after. If something seems down, tell an admin."></ui-state>`;
    const status = this.status;
    if (status instanceof Error) return html`${heading('')}<ui-state kind="error" heading="Couldn’t see the plant room" body=${status.message} action="Try again" @ui-action=${() => void this.load()}></ui-state>`;
    if (!status) return html`${heading('')}<ui-state kind="loading" heading="Checking each part" size="line"></ui-state>`;
    const parts = status.components;
    const backups = status.backups;
    return html`${heading(plantLine(parts))}
      ${this.renderRelease(this.updates)}
      ${roomsOf(parts).map(
        (room) => html`<section class="ax-section" aria-labelledby=${`ax-room-${room.id}`}>
          <h2 class="ax-label" id=${`ax-room-${room.id}`}>${room.label}</h2>
          <ul class="ax-machines">${room.parts.map((p) => this.machine(p))}</ul>
        </section>`,
      )}
      <section class="ax-section" aria-labelledby="ax-room-backups">
        <h2 class="ax-label" id="ax-room-backups">Backups</h2>
        ${backups
          ? html`<ul class="ax-machines">
              ${this.backup('Last backup', backups.lastBackup, 'None yet')} ${this.backup('Last restore test', backups.lastRestoreTest, 'None yet: it runs weekly')}
            </ul>
            ${backups.problem ? html`<p class="ax-meta">${backups.problem}</p>` : nothing}`
          : html`<p class="ax-muted ax-meta">Not shown: the gateway isn’t told where backups are kept (see docs/deploy.md).</p>`}
      </section>
      <div class="ax-can">
        <p class="ax-label">You can</p>
        <p>Watch it here: it looks again every 30 seconds. Nothing here changes anything. To upgrade, or see each check in full, open <b>Admin</b>, then Status or Updates.</p>
      </div>`;
  }
}

if (!customElements.get('auspex-plant')) customElements.define('auspex-plant', AuspexPlant);

declare global {
  interface HTMLElementTagNameMap {
    'auspex-plant': AuspexPlant;
  }
}
