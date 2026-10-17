import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/glance.js';
import type { GlanceData, GlanceSkin, GlanceVariant } from '../components/glance.js';

const meta: Meta = { title: 'Overlays/Glance', component: 'ui-glance', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

const library: GlanceData = {
  eyebrow: 'Finance',
  icon: 'library',
  title: 'Policies',
  summary: 'Three updated this week. One is due for review on Friday.',
  facts: [
    { value: 12, label: 'Documents' },
    { value: 3, label: 'Updated' },
    { value: 1, label: 'Review due' },
  ],
  rows: [
    { label: 'Travel and subsistence', value: 'Updated today' },
    { label: 'Procurement', value: 'Review by Fri' },
    { label: 'Expenses', value: '2 weeks ago' },
  ],
  primary: { label: 'Open library' },
  secondary: { label: 'Share' },
};

/** The glance fills its container, like the menu it opens over; the menu text stands in for that. */
const stage = (variant: GlanceVariant, data: GlanceData, skin: GlanceSkin = 'hairline') => html`
  <div style="position:relative;height:100vh;min-height:560px;overflow:hidden">
    <div style="position:absolute;inset:0;display:grid;place-items:center;font-size:48px;font-weight:200;letter-spacing:.3em;opacity:.25">LIBRARY · REPORTS · PEOPLE</div>
    <ui-glance variant=${variant} skin=${skin} .data=${data} open></ui-glance>
  </div>`;

export const Veil: Story = { render: () => stage('veil', library) };
export const Sheet: Story = { render: () => stage('sheet', library) };
export const Card: Story = {
  render: () =>
    stage('card', {
      eyebrow: 'People',
      icon: 'account',
      title: 'Sam Okafor',
      summary: 'Owns the Finance library. Away until Monday.',
      facts: [
        { value: 4, label: 'Libraries' },
        { value: 27, label: 'Published' },
      ],
      primary: { label: 'Message Sam' },
      secondary: { label: 'See their libraries' },
    }),
};
export const Split: Story = { render: () => stage('split', library) };
export const Title: Story = { render: () => stage('title', library) };
export const Bubble: Story = {
  render: () =>
    stage(
      'veil',
      { ...library, eyebrow: 'Agents', icon: 'agents', title: 'Reviewer', summary: 'Two summaries are waiting for your check.', primary: { label: 'Check summaries' } },
      'bubble',
    ),
};
export const Loading: Story = { render: () => stage('sheet', { eyebrow: 'Finance', title: 'Policies', loading: true }) };
export const Error: Story = { render: () => stage('veil', { eyebrow: 'Finance', icon: 'library', title: 'Policies', error: "Can't reach the library. Nothing was lost.", onRetry: () => {} }) };
export const Empty: Story = {
  render: () => stage('veil', { eyebrow: 'HR', icon: 'folder', title: 'Onboarding', empty: 'No documents yet. Add the first one to start.', primary: { label: 'Add a document' } }),
};
