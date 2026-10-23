import { LitElement, html, nothing, type TemplateResult } from 'lit';
import type { Fact } from '@augur/ui-kit';
import { ApiError, type AdminApi, type PlatformUpdates, type Upgrade, type UpgradeStepState } from './api.js';
import { page } from './parts.js';

const channelWord = (c: PlatformUpdates['channel']) => (c === 'stable' ? 'Stable' : 'Beta');
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** How often the page asks again while an upgrade is waiting or under way. */
const UPGRADE_REFRESH_MS = 5_000;

export const isOpen = (up?: Upgrade) => up?.state === 'requested' || up?.state === 'running';

const stepWords: Record<UpgradeStepState['step'], string> = {
  preflight: 'Check the server can take it',
  backup: 'Back up and test the backup',
  pull: 'Fetch the new images',
  'roll-forward': 'Start each part on the new version',
  verify: 'Check everything is running',
  'roll-back': 'Go back to the old version',
};

/** The heading: an upgrade under way or just ended, something's out, all's current, or the feed can't be read. */
export const headline = (u?: PlatformUpdates, error?: string): { heading: string; summary: string } => {
  if (error || !u) return { heading: 'Updates', summary: 'Whether a newer AUGUR release is out, and what it needs first.' };
  const up = u.upgrade;
  if (up?.state === 'requested') {
    return { heading: `Upgrading to ${up.version}`, summary: u.updaterSeenAt ? 'Waiting for the updater to start.' : 'Waiting for an updater. None has asked for work since the registry started.' };
  }
  if (up?.state === 'running') return { heading: `Upgrading to ${up.version}`, summary: 'There’s a short gap while each part restarts. This page follows along.' };
  if (up?.state === 'rolled-back' && up.from === u.running.version) return { heading: `Back on ${up.from}`, summary: up.message ?? `The upgrade to ${up.version} didn’t finish, so it went back by itself.` };
  if (up?.state === 'failed' && up.from === u.running.version) return { heading: `The upgrade to ${up.version} needs you`, summary: up.message ?? 'It stopped partway. See “Going back” in docs/upgrade.md.' };
  if (u.feed === 'off') return { heading: 'Updates', summary: 'This deployment doesn’t check for new releases: RELEASE_FEED_URL is off.' };
  if (u.available) {
    const n = u.needsYou.length;
    return { heading: `AUGUR ${u.available.version} is out`, summary: `You’re on ${u.running.version}. ${n ? `${n === 1 ? '1 thing needs' : `${n} things need`} you before upgrading.` : 'Nothing needs you before upgrading.'}` };
  }
  if (u.problem) return { heading: 'Updates can’t be checked', summary: u.problem };
  return { heading: 'You’re up to date', summary: `AUGUR ${u.running.version} is the newest ${u.channel} release.` };
};

const section = (title: string, body: TemplateResult | typeof nothing) =>
  html`<section style="display:flex;flex-direction:column;gap:var(--space-2)">
    <div style="font-size:var(--type-label);color:var(--ink-muted)">${title}</div>
    ${body}
  </section>`;

const line = (content: TemplateResult | string, end?: TemplateResult | string) =>
  html`<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);min-height:40px;border-bottom:1px solid var(--hairline);color:var(--ink)">
    <span>${content}</span>${end ? html`<span style="color:var(--ink-muted);font-size:var(--type-small)">${end}</span>` : nothing}
  </div>`;

/**
 * Whether a newer AUGUR release is out, what changes, and what has to be done before upgrading,
 * and the button that asks the deployment's updater to do it. The registry only records the ask;
 * the updater does the work and reports each step, which this page follows.
 */
export class AdminUpdates extends LitElement {
  static override properties = {
    api: { attribute: false },
    updates: { state: true },
    loading: { state: true },
    checking: { state: true },
    error: { state: true },
    confirming: { state: true },
  };

  declare api: AdminApi;
  declare updates: PlatformUpdates | undefined;
  declare loading: boolean;
  declare checking: boolean;
  declare error: string;
  /** Asking "Upgrade to …?" */
  declare confirming: boolean;
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this.loading = true;
    this.checking = false;
    this.error = '';
    this.confirming = false;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.timer);
  }

  override updated() {
    // Follow an upgrade while it's open; stop once it ends.
    if (isOpen(this.updates?.upgrade) && !this.timer) this.timer = setInterval(() => void this.refresh(), UPGRADE_REFRESH_MS);
    if (!isOpen(this.updates?.upgrade) && this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** A quiet reload: while parts restart the platform may not answer, and the last answer stays. */
  private async refresh() {
    try {
      this.updates = await this.api.updates();
    } catch {
      // Restarting; ask again next time.
    }
  }

  /** Back from entering the password again (`?upgrade=<version>`): ask once more. */
  private resume() {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get('upgrade');
    if (!wanted) return;
    params.delete('upgrade');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
    if (wanted === this.updates?.next && !isOpen(this.updates.upgrade)) this.confirming = true;
  }

  /** Asks for the upgrade; when the password is needed again, goes to enter it and comes back here. */
  private upgrade = async () => {
    const version = this.updates!.next!;
    try {
      this.updates = await this.api.upgrade(version);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sign_in_again') {
        const back = `${window.location.pathname}?upgrade=${encodeURIComponent(version)}`;
        window.location.assign(`/auth/again?return=${encodeURIComponent(back)}`);
        return false;
      }
      throw err;
    }
  };

  private async cancel() {
    try {
      this.updates = await this.api.cancelUpgrade();
      this.error = '';
    } catch (err) {
      this.error = (err as Error).message;
    }
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
      this.updates = await this.api.updates();
      this.resume();
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.loading = false;
    }
  }

  async checkNow() {
    this.checking = true;
    try {
      this.updates = await this.api.checkUpdates();
      this.error = '';
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.checking = false;
    }
  }

  private facts(u: PlatformUpdates) {
    const facts: Fact[] = [
      { label: 'Running', value: `AUGUR ${u.running.version}` },
      { label: 'Following', value: `${channelWord(u.channel)} releases` },
      ...(u.available ? [{ label: 'Newest', value: `AUGUR ${u.available.version}${u.available.released ? `, ${day(u.available.released)}` : ''}` }] : []),
      ...(u.feed === 'on' ? [{ label: 'Last checked', value: u.checkedAt ? new Date(u.checkedAt).toLocaleString() : 'Not yet' }] : []),
    ];
    return html`<ui-facts .items=${facts}></ui-facts>`;
  }

  /** The upgrade asked for: each step as the updater reports it, or how it ended. */
  private progress(u: PlatformUpdates) {
    const up = u.upgrade;
    if (!up || up.state === 'cancelled') return nothing;
    const mark = (s: UpgradeStepState) => (s.state === 'done' ? 'done' : s.state === 'failed' ? 'failed' : 'running');
    const ended =
      up.state === 'done'
        ? html`<ui-status status="done" label=${`Upgraded from ${up.from} to ${up.version}${up.finishedAt ? `, ${day(up.finishedAt)}` : ''}.`}></ui-status>`
        : up.state === 'rolled-back'
          ? html`<ui-status status="warning" label=${`Back on ${up.from}: ${up.message ?? 'the upgrade didn’t finish.'}`}></ui-status>`
          : up.state === 'failed'
            ? html`<ui-status status="failed" label=${up.message ?? 'The upgrade stopped partway.'}></ui-status>
                <p style="margin:0">It couldn’t go back by itself. Follow “Going back” in docs/upgrade.md, with the backup it took first.</p>`
            : nothing;
    return section(
      `Upgrade to ${up.version}`,
      html`<div data-progress>
          ${up.steps.length
            ? up.steps.map((s) => line(html`<ui-status status=${mark(s)} mark-only></ui-status> ${stepWords[s.step]}${s.message ? html`: ${s.message}` : nothing}`, new Date(s.at).toLocaleTimeString()))
            : line(
                html`<ui-status status="queued" mark-only></ui-status> ${u.updaterSeenAt
                    ? 'The updater will pick it up within a minute.'
                    : 'No updater has asked for work yet. Without one, cancel this and upgrade by hand.'}`,
              )}
        </div>
        ${ended}
        ${up.state === 'requested' ? html`<div><ui-button kind="tertiary" size="sm" @click=${() => this.cancel()}>Cancel the upgrade</ui-button></div>` : nothing}`,
    );
  }

  /** "Upgrade to …?", with what needs doing first. */
  private confirmDialog(u: PlatformUpdates) {
    if (!this.confirming || !u.next) return nothing;
    return html`<ui-dialog
      open
      eyebrow="Updates"
      heading=${`Upgrade to AUGUR ${u.next}?`}
      summary="Everyone is cut off for a minute or two while the parts restart. It backs up first and goes back by itself if anything fails."
      action-label="Upgrade"
      busy-label="Asking…"
      cancel-label="Not now"
      .submit=${this.upgrade}
      @ui-close=${() => (this.confirming = false)}
    >
      ${u.needsYou.length
        ? html`<p>Before you go ahead:</p>
            <ul style="margin:0;padding-left:var(--space-5)">
              ${u.needsYou.map((n) => html`<li>${n.message}</li>`)}
            </ul>`
        : html`<p>Nothing needs doing first.</p>`}
      <p>You may be asked for your password again.</p>
    </ui-dialog>`;
  }

  private details(u: PlatformUpdates) {
    const a = u.available;
    return html`
      ${this.progress(u)}
      ${u.problem && a ? html`<ui-status status="warning" label=${`The last check failed, so this is from before. ${u.problem}`}></ui-status>` : nothing}
      ${a && u.needsYou.length
        ? section(
            'Needs you first',
            html`<div data-needs>${u.needsYou.map((n) => line(html`<ui-status status=${n.kind === 'setting' && !n.required ? 'queued' : 'needs'} mark-only></ui-status> ${n.message}`))}</div>`,
          )
        : nothing}
      ${a?.parts.length ? section(`What changes in ${a.version}`, html`<div data-parts>${a.parts.map((p) => line(p.name, p.from ? `${p.from} → ${p.to}` : p.to))}</div>`) : nothing}
      ${u.newer.length > 1
        ? section(
            'Releases since yours',
            html`<div data-releases>
              ${u.newer.map((r) =>
                line(
                  r.notesUrl ? html`<a href=${r.notesUrl} target="_blank" rel="noopener" style="color:var(--ink)">AUGUR ${r.version}</a>` : `AUGUR ${r.version}`,
                  [r.channel === 'beta' ? 'Beta' : 'Stable', day(r.released), r.breaking.length ? 'Breaking' : ''].filter(Boolean).join(' · '),
                ),
              )}
            </div>`,
          )
        : nothing}
      ${u.next && !isOpen(u.upgrade)
        ? section(
            `Upgrading to ${u.next}`,
            html`<p style="margin:0">
                It takes a backup first and checks it restores, then restarts each part on the new version. If anything doesn’t come up, it goes
                back to ${u.running.version} by itself. ${a?.notesUrl ? html`<a href=${a.notesUrl} target="_blank" rel="noopener">Read the release notes</a>.` : nothing}
              </p>
              <div><ui-button data-upgrade kind="primary" size="sm" @click=${() => (this.confirming = true)}>Upgrade to ${u.next}</ui-button></div>
              <p style="margin:0;color:var(--ink-muted);font-size:var(--type-small)">
                Or by hand: set <code>PLATFORM_VERSION=${u.next}</code> in <code>infra/deploy/.env</code>, check out <code>augur@${u.next}</code>, run the
                preflight, then pull and start, as docs/upgrade.md says.
              </p>`,
          )
        : nothing}
      ${u.beta ? html`<p style="margin:0;color:var(--ink-muted)">AUGUR ${u.beta.version} is out on beta. To follow beta, set <code>RELEASE_CHANNEL=beta</code> in <code>.env</code>.</p>` : nothing}
    `;
  }

  override render() {
    const u = this.updates;
    const { heading, summary } = headline(u, this.error);
    const body = this.loading
      ? html`<ui-rows loading count="3"></ui-rows>`
      : this.error && !u
        ? html`<ui-state kind="error" heading="Updates can’t be shown" body=${this.error} action="Try again" @ui-action=${() => this.load()}></ui-state>`
        : u
          ? html`${this.facts(u)} ${this.details(u)} ${this.confirmDialog(u)}
              ${this.error ? html`<p style="margin:0;color:var(--danger)">${this.error}</p>` : nothing}
              ${u.feed === 'on'
                ? html`<div><ui-button data-check kind="secondary" size="sm" ?busy=${this.checking} @click=${() => this.checkNow()}>Check now</ui-button></div>`
                : nothing}`
          : nothing;
    return page('Admin', heading, summary, html`<div style="display:flex;flex-direction:column;gap:var(--space-5);padding:var(--space-4)">${body}</div>`);
  }
}

if (!customElements.get('admin-updates')) customElements.define('admin-updates', AdminUpdates);
