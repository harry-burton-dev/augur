import { LitElement, html, nothing } from 'lit';
import type { Fact } from '@augur/ui-kit';
import { ApiError, type AdminApi, type FeedTrust, type PlatformUpdates, type Upgrade, type UpgradeStepState } from './api.js';
import { changeList, gatherChanges, historyList } from './changes.js';
import { lineSection } from './line.js';
import { line, page, section } from './parts.js';

/** Stable releases are on production, beta ones on preview (docs/release-channels.md). */
const channelWord = (c: PlatformUpdates['channel']) => (c === 'stable' ? 'Production' : c === 'dev' ? 'Dev build' : 'Preview');
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** How often the page asks again while an upgrade is waiting or under way. */
const UPGRADE_REFRESH_MS = 5_000;

/** Settings entered before going to enter the password again, kept for this tab until it's back. */
const ENTERED_KEY = 'augur.upgrade-settings';
const keepEntered = (settings: Record<string, string>) => {
  try {
    if (Object.keys(settings).length) sessionStorage.setItem(ENTERED_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing: they're typed again.
  }
};
const takeEntered = (): Record<string, string> => {
  try {
    const text = sessionStorage.getItem(ENTERED_KEY);
    sessionStorage.removeItem(ENTERED_KEY);
    return text ? (JSON.parse(text) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

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
  if (error || !u) return { heading: 'Upgrade Centre', summary: 'Where AUGUR is between dev and production, what this server runs, and what upgrading needs first.' };
  const up = u.upgrade;
  if (up?.state === 'requested') {
    return { heading: `Upgrading to ${up.version}`, summary: u.updaterSeenAt ? 'Waiting for the updater to start.' : 'Waiting for an updater. None has asked for work since the registry started.' };
  }
  if (up?.state === 'running') return { heading: `Upgrading to ${up.version}`, summary: 'There’s a short gap while each part restarts. This page follows along.' };
  if (up?.state === 'rolled-back' && up.from === u.running.version) return { heading: `Back on ${up.from}`, summary: up.message ?? `The upgrade to ${up.version} didn’t finish, so it went back by itself.` };
  if (up?.state === 'failed' && up.from === u.running.version) return { heading: `The upgrade to ${up.version} needs you`, summary: up.message ?? 'It stopped partway. See “Going back” in docs/upgrade.md.' };
  const halt = u.needsYou.find((n) => n.kind === 'halted');
  if (halt) return { heading: `AUGUR ${u.running.version} was halted`, summary: halt.message };
  if (u.feed === 'off') return { heading: 'Upgrade Centre', summary: 'This deployment doesn’t check for new releases: RELEASE_FEED_URL is off.' };
  if (u.available) {
    // A secret the updater makes up needs nothing from anyone.
    const n = u.needsYou.filter((x) => !x.madeUp).length;
    return { heading: `AUGUR ${u.available.version} is out`, summary: `You’re on ${u.running.version}. ${n ? `${n === 1 ? '1 thing needs' : `${n} things need`} you before upgrading.` : 'Nothing needs you before upgrading.'}` };
  }
  if (u.problem) return { heading: 'New releases can’t be checked', summary: u.problem };
  return { heading: 'You’re up to date', summary: `AUGUR ${u.running.version} is the newest ${u.channel} release.` };
};

/** The feed's trust, in words: signed and in date, the organisation's mirror, or read straight from GitHub. */
export const trustWords = (t: FeedTrust): string =>
  t.state === 'verified'
    ? `Signed by the publisher${t.expires ? `, good until ${new Date(t.expires).toLocaleDateString()}` : ''}`
    : t.state === 'mirror'
      ? `Your organisation’s mirror${t.note ? `. ${t.note}` : ''}`
      : `Not signed${t.note ? `. ${t.note}` : ''}`;

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
    goingBack: { state: true },
    entered: { state: true },
  };

  declare api: AdminApi;
  declare updates: PlatformUpdates | undefined;
  declare loading: boolean;
  declare checking: boolean;
  declare error: string;
  /** Asking "Upgrade to …?" */
  declare confirming: boolean;
  /** Asking "Go back to …?": the version. */
  declare goingBack: string | undefined;
  /** New settings typed into "Upgrade to …?", for the updater to write to .env. */
  declare entered: Record<string, string>;
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this.loading = true;
    this.checking = false;
    this.error = '';
    this.confirming = false;
    this.goingBack = undefined;
    this.entered = {};
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
    const back = params.get('go-back');
    if (!wanted && !back) return;
    params.delete('upgrade');
    params.delete('go-back');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
    if (back && this.updates?.goBack?.some((t) => t.version === back && !t.problem) && !isOpen(this.updates.upgrade)) this.goingBack = back;
    if (wanted && wanted === this.updates?.next && !isOpen(this.updates.upgrade)) {
      this.entered = takeEntered();
      this.confirming = true;
    }
  }

  /** Asks for the upgrade; when the password is needed again, goes to enter it and comes back here. */
  private upgrade = async () => {
    const version = this.updates!.next!;
    const settings = Object.fromEntries(Object.entries(this.entered).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
    try {
      this.updates = await this.api.upgrade(version, settings);
      this.entered = {};
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sign_in_again') {
        keepEntered(settings);
        const back = `${window.location.pathname}?upgrade=${encodeURIComponent(version)}`;
        window.location.assign(`/auth/again?return=${encodeURIComponent(back)}`);
        return false;
      }
      throw err;
    }
  };

  /** Asks to go back; when the password is needed again, goes to enter it and comes back here. */
  private goBack = async () => {
    const version = this.goingBack!;
    try {
      this.updates = await this.api.goBack(version);
      this.goingBack = undefined;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'sign_in_again') {
        const back = `${window.location.pathname}?go-back=${encodeURIComponent(version)}`;
        window.location.assign(`/auth/again?return=${encodeURIComponent(back)}`);
        return false;
      }
      throw err;
    }
  };

  /** "Go back to …?": what it undoes, and what stays. */
  private goBackDialog(u: PlatformUpdates) {
    if (!this.goingBack) return nothing;
    return html`<ui-dialog
      open
      eyebrow="Upgrade Centre"
      heading=${`Go back to AUGUR ${this.goingBack}?`}
      summary="Everyone is cut off for a minute or two while the parts restart. It backs up first, as an upgrade does."
      action-label="Go back"
      busy-label="Asking…"
      cancel-label="Not now"
      .submit=${this.goBack}
      @ui-close=${() => (this.goingBack = undefined)}
    >
      <p>The code goes back to ${this.goingBack}. The data stays as ${u.running.version} left it: no release between is breaking, so ${this.goingBack} works on it.</p>
      <p>You may be asked for your password again.</p>
    </ui-dialog>`;
  }

  /** Earlier releases, each with Go back, or why it can't straight. */
  private goBackSection(u: PlatformUpdates) {
    if (!u.goBack?.length) return nothing;
    return section(
      'Go back',
      html`<div data-go-back>
        ${u.goBack.map((t) =>
          line(
            html`<span style="display:flex;flex-direction:column;padding:var(--space-2) 0">
              <span>AUGUR ${t.version}</span>
              ${t.problem ? html`<span style="color:var(--ink-muted);font-size:var(--type-small)">${t.problem}</span>` : nothing}
            </span>`,
            html`<ui-button kind="tertiary" size="sm" ?disabled=${Boolean(t.problem) || isOpen(u.upgrade)} reason=${t.problem ?? 'Wait for the upgrade under way to finish.'} @click=${() => (this.goingBack = t.version)}>Go back</ui-button>`,
          ),
        )}
      </div>`,
    );
  }

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
      ...(u.ring ? [{ label: 'Server', value: u.ring === 'production' ? 'Production' : u.ring === 'dev' ? 'Workbench' : 'Preview' }] : []),
      { label: 'Following', value: u.channel === 'dev' ? 'Dev builds, taken by itself, and releases' : `${channelWord(u.channel)} releases` },
      ...(u.available ? [{ label: 'Newest', value: `AUGUR ${u.available.version}${u.available.released ? `, ${day(u.available.released)}` : ''}` }] : []),
      ...(u.feedTrust ? [{ label: 'Release feed', value: trustWords(u.feedTrust) }] : []),
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

  /**
   * A field for each new setting only a person can give. The updater writes what's entered to .env;
   * one left empty is left as .env has it. Secrets it makes up itself get no field.
   */
  private settingFields(u: PlatformUpdates) {
    const fields = u.needsYou.filter((n) => n.kind === 'setting' && n.key && !n.madeUp);
    if (!fields.length) return nothing;
    return html`<div data-new-settings style="display:flex;flex-direction:column;gap:var(--space-4)">
      ${fields.map(
        (n) => html`<ui-text-field
          data-setting=${n.key!}
          label=${n.key!}
          hint=${n.required ? 'Needed. Leave it empty if it’s already in .env.' : 'Optional.'}
          .value=${this.entered[n.key!] ?? ''}
          @ui-change=${(e: CustomEvent<{ value: string }>) => (this.entered = { ...this.entered, [n.key!]: e.detail.value })}
        ></ui-text-field>`,
      )}
    </div>`;
  }

  /** "Upgrade to …?", with what needs doing first. */
  private confirmDialog(u: PlatformUpdates) {
    if (!this.confirming || !u.next) return nothing;
    return html`<ui-dialog
      open
      eyebrow="Upgrade Centre"
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
      ${this.settingFields(u)}
      <p>You may be asked for your password again.</p>
    </ui-dialog>`;
  }

  private details(u: PlatformUpdates) {
    const a = u.available;
    return html`
      ${this.progress(u)}
      ${u.problem && a ? html`<ui-status status="warning" label=${`The last check failed, so this is from before. ${u.problem}`}></ui-status>` : nothing}
      ${(a || u.needsYou.some((n) => n.kind === 'halted')) && u.needsYou.length
        ? section(
            'Needs you first',
            html`<div data-needs>${u.needsYou.map((n) => line(html`<ui-status status=${n.kind === 'setting' && (!n.required || n.madeUp) ? 'queued' : 'needs'} mark-only></ui-status> ${n.message}`))}</div>`,
          )
        : nothing}
      ${a ? section(`What’s new since ${u.running.version}`, changeList(gatherChanges(u.newer.map((r) => r.changes)))) : nothing}
      ${a?.parts.length ? section(`What changes in ${a.version}`, html`<div data-parts>${a.parts.map((p) => line(p.name, p.from ? `${p.from} → ${p.to}` : p.to))}</div>`) : nothing}
      ${u.newer.length > 1
        ? section(
            'Releases since yours',
            html`<div data-releases>
              ${u.newer.map((r) =>
                line(
                  r.notesUrl ? html`<a href=${r.notesUrl} target="_blank" rel="noopener" style="color:var(--ink)">AUGUR ${r.version}</a>` : `AUGUR ${r.version}`,
                  [channelWord(r.channel), day(r.released), r.breaking.length ? 'Breaking' : '', r.halted ? `Halted: ${r.halted.reason}` : ''].filter(Boolean).join(' · '),
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
      ${u.history ? section('History', historyList(u.history)) : nothing}
      ${this.goBackSection(u)}
      ${u.channelNote ? html`<p data-channel-note style="margin:0;color:var(--ink-muted)">${u.channelNote}</p>` : nothing}
      ${u.beta ? html`<p style="margin:0;color:var(--ink-muted)">AUGUR ${u.beta.version} is out on preview. To follow preview releases, set <code>RELEASE_CHANNEL=beta</code> in <code>.env</code>.</p>` : nothing}
    `;
  }

  override render() {
    const u = this.updates;
    const { heading, summary } = headline(u, this.error);
    const body = this.loading
      ? html`<ui-rows loading count="3"></ui-rows>`
      : this.error && !u
        ? html`<ui-state kind="error" heading="The Upgrade Centre can’t be shown" body=${this.error} action="Try again" @ui-action=${() => this.load()}></ui-state>`
        : u
          ? html`${section('This server', this.facts(u))} ${lineSection(u.line, u.portalUrl)} ${this.details(u)} ${this.confirmDialog(u)} ${this.goBackDialog(u)}
              ${this.error ? html`<p style="margin:0;color:var(--danger)">${this.error}</p>` : nothing}
              ${u.feed === 'on'
                ? html`<div><ui-button data-check kind="secondary" size="sm" ?busy=${this.checking} @click=${() => this.checkNow()}>Check now</ui-button></div>`
                : nothing}`
          : nothing;
    return page('Admin', heading, summary, html`<div style="display:flex;flex-direction:column;gap:var(--space-5);padding:var(--space-4)">${body}</div>`);
  }
}

if (!customElements.get('admin-updates')) customElements.define('admin-updates', AdminUpdates);
