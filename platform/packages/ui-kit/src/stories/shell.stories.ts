import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/shell.js';
import '../components/heading.js';
import type { ShellFloor } from '../components/floors.js';
import type { ShellAgent, ShellApp, ShellNotification, UiShell } from '../components/shell.js';

const meta: Meta = { title: 'Frame/Shell', component: 'ui-shell', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

const apps: ShellApp[] = [
  { id: 'home', name: 'Home', icon: 'home', line: 'What needs you' },
  { id: 'library', name: 'Library', icon: 'library', line: 'Documents and publishing' },
  { id: 'reader', name: 'Reader', icon: 'document', line: 'Read published documents' },
  { id: 'assistant', name: 'Assistant', icon: 'agents', line: 'Ask your libraries', ai: true },
  { id: 'admin', name: 'Admin', icon: 'admin', line: 'People and departments' },
];
const min = 60_000;
const now = Date.now();
const notifications: ShellNotification[] = [
  { id: '1', app: 'library', level: 'needs', title: 'Approve the travel policy', detail: 'Sam asked for your review', time: now - 4 * min },
  { id: '2', app: 'library', level: 'needs', title: 'Procurement is due for review', detail: 'Review by Friday', time: now - 50 * min },
  { id: '3', app: 'library', level: 'done', title: 'Expenses guide published', detail: 'Finance', time: now - 3 * 60 * min },
  { id: '4', app: 'admin', level: 'info', title: 'Two people joined HR', time: now - 30 * 60 * min },
];
const agents: ShellAgent[] = [
  { id: 'a', name: 'Summariser', detail: 'Writing reader summaries for 3 documents', status: 'running', app: 'library' },
  { id: 'b', name: 'Reviewer', detail: 'Two summaries are waiting for your check', status: 'needs', app: 'library' },
  { id: 'c', name: 'Indexer', detail: 'Next run at 02:00', status: 'queued' },
];

const acme = { id: 'org', kind: 'org' as const, name: 'Acme' };
const fin = { id: 'fin', kind: 'team' as const, name: 'Finance' };
const floors: ShellFloor[] = [
  { id: 'me', kind: 'personal', name: 'You', path: [{ id: 'me', kind: 'personal', name: 'You' }] },
  { ...acme, path: [acme] },
  { ...fin, path: [acme, fin] },
  { id: 'pay', kind: 'team', name: 'Payroll', path: [acme, fin, { id: 'pay', kind: 'team', name: 'Payroll' }] },
  { id: 'leg', kind: 'team', name: 'Legal', path: [acme, { id: 'leg', kind: 'team', name: 'Legal' }] },
];

/** Floors in a story: the host's part, going wherever the shell asks. */
const goTo = (e: CustomEvent<{ id: string }>) => ((e.currentTarget as UiShell).floor = e.detail.id);

const shell = (opts: { notes?: ShellNotification[]; online?: boolean; view?: string; open?: boolean; floor?: string } = {}) => html`
  <div style="height:100vh;min-height:620px">
    <ui-shell
      product="Platform"
      workspace="Finance"
      .user=${{ name: 'Harry Burton', email: 'harry@example.org' }}
      .apps=${apps}
      current="library"
      .recent=${['home']}
      .notifications=${opts.notes ?? notifications}
      .agents=${agents}
      .online=${opts.online ?? true}
      version="0.3.0 · SDK 1.0.0"
      .floors=${opts.floor ? floors : []}
      floor=${opts.floor ?? ''}
      @ui-floor=${goTo}
      @ui-open-app=${(e: CustomEvent) => console.info('open app', e.detail.id)}
    >
      <div style="padding:var(--space-6) var(--edge);max-width:var(--measure-wide);margin:0 auto">
        <ui-heading eyebrow="Finance" heading="Library" summary="12 documents. Three were updated this week."></ui-heading>
        <p style="color:var(--ink-muted);margin-top:var(--space-6)">Press <kbd>\`</kbd> or Ctrl K, or choose the handle at the top, to look up at the Shell.</p>
      </div>
    </ui-shell>
  </div>`;

const opened = (view = '') => ({
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const el = canvasElement.querySelector('ui-shell') as UiShell;
    await el.updateComplete;
    if (view) el.openView(view);
    else el.open();
  },
});

export const Closed: Story = { render: () => shell() };
export const LookingUp: Story = { render: () => shell(), ...opened() };
export const Quiet: Story = { render: () => shell({ notes: [] }), ...opened() };
export const Stream: Story = { render: () => shell(), ...opened('stream') };
export const Offline: Story = { render: () => shell({ online: false }), ...opened('stream') };
export const Apps: Story = { render: () => shell(), ...opened('apps') };
export const Find: Story = { render: () => shell(), ...opened('find') };
export const Agents: Story = { render: () => shell(), ...opened('agents') };
export const Account: Story = { render: () => shell(), ...opened('account') };
export const Settings: Story = { render: () => shell(), ...opened('settings') };
/** Floors: the breadcrumb top left, the gauge at the edge, each kind of floor's water. Page Up and Page Down move; so do the notches. */
export const FloorYou: Story = { render: () => shell({ floor: 'me' }) };
export const FloorTeam: Story = { render: () => shell({ floor: 'pay' }) };
export const FloorOrg: Story = { render: () => shell({ floor: 'org' }) };
export const FloorsInAccount: Story = { render: () => shell({ floor: 'fin' }), ...opened('account') };
