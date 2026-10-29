import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/card.js';
import '../components/tally.js';
import '../components/details.js';
import '../components/timeline.js';
import '../components/path.js';
import '../components/section.js';
import { onGround } from './app-ground.js';

/** More than the shell shows, and still not much: marks, counts and one line, with the rest a press away. */
const meta: Meta = { title: 'App/More at a glance' };
export default meta;
type Story = StoryObj;

const hours = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const Cards: Story = {
  render: () =>
    onGround(html`<ui-cards>
      <ui-card heading="Keep Port Halden open through winter" status="warning" status-label="At risk" floor-kind="team" floor-name="Northern ports" .meta=${['By Fri 13 Nov']} note="1 part blocked">
        <ui-tally slot="tally" .noun=${['part', 'parts']} .counts=${[
          { status: 'done', n: 3, word: 'achieved' },
          { status: 'running', n: 2, word: 'on track' },
          { status: 'warning', n: 1, word: 'at risk', loud: true },
          { status: 'failed', n: 1, word: 'blocked', loud: true },
        ]}></ui-tally>
      </ui-card>
      <ui-card heading="Refit Hull 4 before the storms" status="running" status-label="On track" floor-kind="personal" floor-name="You" .meta=${['By 2 Dec', 'Passed by Dana Reyes']}></ui-card>
      <ui-card heading="Keep the coast watched" icon="compass" floor-kind="org" floor-name="Coastguard" .meta=${['Main effort']} note="New version this morning" note-tone="ink"></ui-card>
      <ui-card heading="Budget 2027" floor-name="Finance" unavailable reason="Kept on Finance. Ask its leads."></ui-card>
    </ui-cards>`),
};

export const Tally: Story = {
  render: () =>
    onGround(
      html`<div style="display:grid;gap:var(--space-5);max-width:320px">
        <ui-tally size="md" .noun=${['part', 'parts']} .counts=${[
          { status: 'done', n: 4, word: 'achieved' },
          { status: 'running', n: 2, word: 'on track' },
          { status: 'warning', n: 1, word: 'at risk', loud: true },
        ]}></ui-tally>
        <ui-tally .noun=${['document', 'documents']} .counts=${[{ status: 'done', n: 40, word: 'read' }, { status: 'queued', n: 12, word: 'unread', loud: true }]}></ui-tally>
      </div>`,
      '420px',
    ),
};

export const Details: Story = {
  render: () =>
    onGround(
      html`<ui-section label="Details" count="-1" limit="0">
        <ui-details .items=${[
          { label: 'Class', value: 'Type 31 frigate' },
          { label: 'Home port', value: 'Port Halden' },
          { label: 'Pennant', value: 'F92' },
          { label: 'In service', value: '2025' },
          { label: 'Crew', value: '' },
          { label: 'Status', value: 'In dock', note: 'Since 20 Oct, from the refit plan', explained: true },
          { label: 'Captain', value: 'Cdr J. Hart' },
          { label: 'Length', value: '138 m' },
          { label: 'Beam', value: '20 m' },
          { label: 'Builder', value: 'Rosyth' },
        ]}></ui-details>
      </ui-section>`,
      '560px',
    ),
};

export const Timeline: Story = {
  render: () =>
    onGround(
      html`<ui-section label="History" count="-1" limit="0">
        <ui-timeline .items=${[
          { at: hours(1), who: 'Dana Reyes', what: 'rated it at risk' },
          { at: hours(3), who: 'Jo Hart', what: 'gave a back-brief' },
          { at: hours(27), who: 'Dana Reyes', what: 'passed Refit Hull 4 to Jo Hart' },
          { at: hours(50), who: 'Dana Reyes', what: 'wrote version 2' },
          { at: hours(76), who: 'Nora Briggs', what: 'bound HMS Example' },
          { at: hours(120), who: 'Dana Reyes', what: 'wrote it' },
        ]}></ui-timeline>
      </ui-section>`,
      '520px',
    ),
};

export const LineOfSight: Story = {
  render: () =>
    onGround(
      html`<ui-section label="Line of sight" count="-1" limit="0">
        <ui-path .steps=${[
          { id: 'org', floor: 'org', title: 'Keep the coast watched', line: 'Coastguard · Main effort', mark: 'Main effort' },
          { id: 'team', floor: 'team', title: 'Keep Port Halden open through winter', line: 'Northern ports · At risk', mark: 'At risk', markTone: 'no' },
          { floor: 'personal', title: 'Refit Hull 4 before the storms', line: 'You · By 2 Dec', here: true },
        ]}></ui-path>
      </ui-section>`,
      '420px',
    ),
};
