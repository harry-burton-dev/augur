import { LitElement, html, nothing, type TemplateResult } from 'lit';
import type { Fact } from '@augur/ui-kit';
import type { AdminApi, PlatformUpdates } from './api.js';
import { page } from './parts.js';

const channelWord = (c: PlatformUpdates['channel']) => (c === 'stable' ? 'Stable' : 'Beta');
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** The heading: something's out, all's current, or the feed can't be read. */
export const headline = (u?: PlatformUpdates, error?: string): { heading: string; summary: string } => {
  if (error || !u) return { heading: 'Updates', summary: 'Whether a newer AUGUR release is out, and what it needs first.' };
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
 * Whether a newer AUGUR release is out, what changes, and what has to be done before upgrading.
 * Read-only: upgrading is still the steps in docs/upgrade.md, which this page fills in.
 */
export class AdminUpdates extends LitElement {
  static override properties = {
    api: { attribute: false },
    updates: { state: true },
    loading: { state: true },
    checking: { state: true },
    error: { state: true },
  };

  declare api: AdminApi;
  declare updates: PlatformUpdates | undefined;
  declare loading: boolean;
  declare checking: boolean;
  declare error: string;

  constructor() {
    super();
    this.loading = true;
    this.checking = false;
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
      this.updates = await this.api.updates();
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

  private details(u: PlatformUpdates) {
    const a = u.available;
    return html`
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
      ${u.next
        ? section(
            'Upgrading',
            html`<p style="margin:0">
              Set <code>PLATFORM_VERSION=${u.next}</code> in <code>infra/deploy/.env</code>, check out <code>augur@${u.next}</code>, run the
              preflight, then pull and start, as docs/upgrade.md says. ${a?.notesUrl ? html`<a href=${a.notesUrl} target="_blank" rel="noopener">Read the release notes</a>.` : nothing}
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
          ? html`${this.facts(u)} ${this.details(u)}
              ${this.error ? html`<p style="margin:0;color:var(--danger)">${this.error}</p>` : nothing}
              ${u.feed === 'on'
                ? html`<div><ui-button kind="secondary" size="sm" ?busy=${this.checking} @click=${() => this.checkNow()}>Check now</ui-button></div>`
                : nothing}`
          : nothing;
    return page('Admin', heading, summary, html`<div style="display:flex;flex-direction:column;gap:var(--space-5);padding:var(--space-4)">${body}</div>`);
  }
}

if (!customElements.get('admin-updates')) customElements.define('admin-updates', AdminUpdates);
