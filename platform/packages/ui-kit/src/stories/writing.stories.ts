import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/date.js';
import '../components/people-picker.js';
import '../components/editor.js';
import '../components/prose.js';
import type { Principal } from '../components/people-picker.js';
import type { MentionSource } from '../components/editor.js';
import { onGround } from './app-ground.js';

/** Write without a toolbar: formatting shows on a selection, mentions become references, days are said in words. */
const meta: Meta = { title: 'App/Writing kit' };
export default meta;
type Story = StoryObj;

const inDays = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PEOPLE: Principal[] = [
  { kind: 'person', id: 'u1', name: 'Nora Briggs', detail: 'Northern ports' },
  { kind: 'team', id: 't1', name: 'Northern ports', size: 12 },
  { kind: 'team', id: 't2', name: 'Northern logistics', detail: 'In Finance' },
  { kind: 'person', id: 'u2', name: 'Norman Pike', detail: 'Harbour office', meta: 'Can read' },
];
const search = async (q: string) => PEOPLE.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

const mentions: MentionSource = async (trigger, q) => {
  const all =
    trigger === '@'
      ? [
          { kind: 'person' as const, id: 'u1', label: 'Nora Briggs' },
          { kind: 'team' as const, id: 't1', label: 'Northern ports' },
        ]
      : [
          { kind: 'entity' as const, id: 'e1', type: 'port', label: 'Port Halden', floorName: 'Org' },
          { kind: 'entity' as const, id: 'e2', type: 'facility', label: 'Halden Shipping Ltd', floorName: 'Org' },
          { kind: 'intent' as const, id: 'i1', title: 'Keep Port Halden open', floorName: 'Northern ports' },
        ];
  const found = all.filter((r) => (r.label ?? r.title ?? '').toLowerCase().includes(q.toLowerCase()));
  return trigger === '#' ? { found, closedCount: 1, closedReason: 'Kept on Finance.' } : { found };
};

export const Day: Story = {
  render: () =>
    onGround(
      html`<div style="display:grid;gap:var(--space-6)">
        <ui-date label="Done by" optional value=${inDays(15)}></ui-date>
        <ui-date label="True from" optional empty="When it was seen" .quick=${[{ label: 'Today', value: 'today' }, { label: 'Yesterday', value: 'yesterday' }]}></ui-date>
        <ui-date label="Until" optional empty="Still holds" .quick=${[]}></ui-date>
      </div>`,
      '420px',
    ),
};

export const PeoplePicker: Story = {
  render: () =>
    onGround(
      html`<ui-people-picker label="Share with" .search=${search}
        .check=${(p: Principal) => (p.id === 't2' ? 'Can’t see this library. Its owner can add it.' : undefined)}></ui-people-picker>`,
      '460px',
    ),
  play: async ({ canvasElement }) => {
    const picker = canvasElement.querySelector('ui-people-picker')!;
    await picker.find('nor');
  },
};

export const Choosing: Story = {
  render: () => onGround(html`<ui-people-picker label="Who holds it" multiple kinds="teams" .search=${search} .value=${[PEOPLE[1]]}></ui-people-picker>`, '460px'),
};

export const Editor: Story = {
  render: () =>
    onGround(
      html`<ui-editor label="Purpose" required guide="2 sentences" hint="Why: what it’s in order to achieve." .mentionSource=${mentions}
        value="So that [#Port Halden](entity:e1) keeps taking cargo while the north channel is dredged, and ships for [@Northern ports](team:t1) aren’t sent south."></ui-editor>`,
      '560px',
    ),
};

export const Written: Story = {
  render: () =>
    onGround(
      html`<ui-prose value=${'So that **[#Port Halden](entity:e1)** keeps taking cargo while the north channel is dredged.\n\n- Refit _Hull 4_ before the storms\n- Keep pilot cover for night tides\n\n> Two hulls in dock until 20 Nov.'}></ui-prose>`,
      '560px',
    ),
};
