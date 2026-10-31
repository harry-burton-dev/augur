import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/app-frame.js';
import '../components/page-head.js';
import '../components/section.js';
import '../components/list.js';
import '../components/notice.js';
import '../components/tree.js';
import '../components/status.js';
import '../components/button.js';
import { onGround } from './app-ground.js';

/** Where things go on an app's page: the ground, the rail, the head, the sections. */
const meta: Meta = { title: 'App/Frame', parameters: { layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;

const parts = [
  { id: '1', title: 'Pilot cover for night tides', detail: 'Halden harbour · By 6 Nov', status: 'failed' as const, meta: 'Blocked' },
  { id: '2', title: 'Clear berth B1 backlog', detail: 'Halden harbour · By 9 Nov', status: 'needs' as const, meta: 'At risk' },
  { id: '3', title: 'Dredge the north channel', detail: 'Nora Briggs · By 12 Nov', status: 'running' as const },
  { id: '4', title: 'Customs surge staffing', detail: 'Kept on Finance. You see how it’s going, not what it says.', icon: 'lock', disabled: true, reason: 'Kept on Finance. You see how it’s going, not what it says.' },
];

export const IntentPage: Story = {
  render: () => html`<div style="height:100vh">
    <ui-app-frame rail-label="Intent">
      <div slot="rail" style="display:flex;flex-direction:column;gap:var(--space-5)">
        <ui-tree heading="Northern ports" label="On this floor" selected="floor"
          .items=${[{ id: 'floor', label: 'Intent', icon: 'compass', meta: '6' }, { id: 'drafts', label: 'Drafts', icon: 'document', meta: '1' }]}></ui-tree>
        <div><ui-button kind="ghost" size="sm">New intent</ui-button></div>
      </div>
      <ui-page-head
        .trail=${[{ id: 'a', label: 'Secure the northern approaches' }, { id: 'b', label: 'Secure northern ports' }]}
        eyebrow="Intent" heading="Keep Port Halden open to cargo" summary="Northern ports · held by Northern ports’ leads · by Fri 13 Nov"
        .actions=${[
          { id: 'pass', label: 'Pass down', kind: 'primary' },
          { id: 'judge', label: 'How is it going?' },
          { id: 'edit', label: 'Revise' },
          { id: 'withdraw', label: 'Withdraw', disabled: true, reason: 'Two parts below are still under way.' },
        ]}><ui-status status="running" label="On track"></ui-status></ui-page-head>
      <ui-notice tone="needs" heading="Waiting for your back-brief." action="Write it">Due Sat 31 Oct.</ui-notice>
      <ui-section label="Passed down" action="Sort by risk"><ui-list label="Passed down" .items=${parts}></ui-list></ui-section>
      <div slot="aside" style="display:flex;flex-direction:column;gap:var(--space-6)">
        <ui-section label="History" why="Versions issued, back-briefs and judgements, newest first.">
          <p style="margin:0">Sam Okafor judged Berth B1 at risk</p>
          <p style="margin:0">Halden harbour said Pilot cover is blocked</p>
          <p style="margin:0">You bound Northern Tern</p>
          <p style="margin:0">Version 2 issued</p>
          <p style="margin:0">Nora Briggs back-briefed</p>
          <p style="margin:0">Version 1 issued</p>
          <p style="margin:0">Passed down by Logistics</p>
        </ui-section>
      </div>
    </ui-app-frame>
  </div>`,
};

export const PageHead: Story = {
  parameters: { layout: 'padded' },
  render: () => onGround(html`<ui-page-head
    .trail=${['Policies', 'People and HR', 'Time off', 'Leave'].map((label) => ({ id: label, label }))}
    eyebrow="Leave" heading="Parental leave" summary="Four documents, last changed yesterday."
    .actions=${[{ id: 'folder', label: 'New folder', kind: 'secondary' }, { id: 'tags', label: 'Tags', kind: 'ghost' }, { id: 'rename', label: 'Rename' }, { id: 'archive', label: 'Archive', danger: true }]}></ui-page-head>`),
};

export const SectionFolds: Story = {
  parameters: { layout: 'padded' },
  render: () => onGround(html`<ui-section label="Observations" why="What sources said about it. An observation counts once a lead accepts it.">
    ${['Located at Port Halden', 'Flag state: Panama', 'Operated by Halden Shipping', 'Call sign D5RT2', 'Seen at berth B1', 'Left berth B1', 'Located at Port Arlen', 'Flag state: Liberia'].map(
      (t) => html`<p style="margin:0">${t}</p>`,
    )}
  </ui-section>`, 'var(--measure-read)'),
};
