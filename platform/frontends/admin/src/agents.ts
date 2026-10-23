import { LitElement, html, nothing } from 'lit';
import type { Fact, TableColumn, TableRow } from '@augur/ui-kit';
import type { AdminApi, ModelSettings, ModelUsage } from './api.js';
import { page } from './parts.js';

/** Each app's use today, busiest first; the shell's own assistant by its name. */
export const todayRows = (days: ModelUsage[], today: string, limit: number): TableRow[] =>
  days
    .filter((d) => d.day === today)
    .sort((a, b) => b.calls - a.calls)
    .map((d) => ({
      id: d.app,
      app: d.app === 'assistant' ? 'Assistant (the Shell’s own)' : d.app,
      calls: d.calls,
      left: Math.max(0, limit - d.calls),
      tokens: d.inputTokens + d.outputTokens,
    }));

/**
 * Agents and AI: whether the model gateway is on, how many calls each app
 * gets a day, and what they used. The key and the model are the server's
 * settings, shown here but never changed or seen in full.
 */
export class AdminAgents extends LitElement {
  static override properties = {
    api: { attribute: false },
    settings: { state: true },
    usage: { state: true },
    loading: { state: true },
    error: { state: true },
    limitError: { state: true },
  };

  declare api: AdminApi;
  declare settings: ModelSettings | undefined;
  declare usage: ModelUsage[];
  declare loading: boolean;
  declare error: string;
  declare limitError: string;

  constructor() {
    super();
    this.usage = [];
    this.loading = true;
    this.error = '';
    this.limitError = '';
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
      const [settings, usage] = await Promise.all([this.api.models(), this.api.modelUsage()]);
      this.settings = settings;
      this.usage = usage.days;
    } catch (err) {
      this.error = (err as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private async setLimit(value: string) {
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 0 || limit > 100_000) {
      this.limitError = 'A whole number from 0 to 100,000.';
      return;
    }
    if (limit === this.settings?.dailyLimit) return;
    try {
      this.settings = await this.api.setModels({ dailyLimit: limit });
      this.limitError = '';
    } catch (err) {
      this.limitError = (err as Error).message;
    }
  }

  private readonly columns: TableColumn[] = [
    { key: 'app', label: 'App', sortable: true },
    { key: 'calls', label: 'Calls today', sortable: true },
    { key: 'left', label: 'Left today', sortable: true },
    { key: 'tokens', label: 'Tokens', sortable: true },
  ];

  override render() {
    const s = this.settings;
    const heading = !s ? 'Agents and AI' : s.enabled ? 'Agents are on' : 'Agents are off';
    const summary = !s
      ? 'Whether apps and the Shell’s Agents can use an AI model.'
      : !s.ready
        ? 'There’s no model on this server yet. Set MODEL_API_URL, MODEL_API_KEY and MODEL_NAME in its settings (see docs/agents.md), then turn them on here.'
        : s.enabled
          ? 'People can talk to agents in the Shell, and apps granted it can ask the model. Every call is in Activity.'
          : 'Nobody can use the model: the Shell has no Agents, and apps that ask are told it’s off.';
    if (this.loading || this.error || !s) {
      return page(
        'Admin',
        heading,
        summary,
        html`<ui-table noun="apps" .columns=${this.columns} .rows=${[]} ?loading=${this.loading} .error=${this.error} @ui-retry=${() => this.load()}></ui-table>`,
      );
    }
    const today = new Date().toISOString().slice(0, 10);
    const facts: Fact[] = [
      { label: 'Model', value: s.ready ? (s.model ?? '') : 'None set' },
      { label: 'From', value: s.ready ? (s.provider === 'stand-in' ? 'Stand-in (doesn’t think)' : (s.provider ?? '')) : '—' },
      ...(s.updatedAt ? [{ label: 'Last changed', value: new Date(s.updatedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }] : []),
    ];
    return page(
      'Admin',
      heading,
      summary,
      html`<div style="padding:var(--space-5) var(--space-4);display:flex;flex-direction:column;gap:var(--space-5)">
          <ui-facts .items=${facts}></ui-facts>
          <ui-toggle
            label="Agents and AI"
            hint=${s.ready ? 'Off by default. Changes are recorded in Activity.' : 'Set up a model on the server first.'}
            ?checked=${s.enabled}
            ?disabled=${!s.ready && !s.enabled}
            .change=${async (enabled: boolean) => {
              this.settings = await this.api.setModels({ enabled });
            }}
          ></ui-toggle>
          <ui-text-field
            name="limit"
            label="Calls a day for each app"
            hint="The Shell’s Assistant counts as one app. It starts again at midnight UTC."
            type="number"
            .value=${String(s.dailyLimit)}
            state=${this.limitError ? 'error' : 'idle'}
            message=${this.limitError}
            @ui-change=${(e: CustomEvent<{ value: string }>) => this.setLimit(e.detail.value)}
          ></ui-text-field>
        </div>
        <ui-table
          noun="apps"
          .columns=${this.columns}
          .rows=${todayRows(this.usage, today, s.dailyLimit)}
          empty="Nothing has asked the model today."
        ></ui-table>`,
    );
  }
}

if (!customElements.get('admin-agents')) customElements.define('admin-agents', AdminAgents);
