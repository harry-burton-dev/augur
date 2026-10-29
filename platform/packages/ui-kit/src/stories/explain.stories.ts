import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/button.js';
import '../components/icon-button.js';
import '../components/list.js';
import '../components/notice.js';
import '../components/note.js';
import '../components/can.js';
import { onGround } from './app-ground.js';

/**
 * Nothing is obtuse: what you can't use stays in place and says why in one
 * sentence. Point at or tab to a dimmed control to read its reason.
 */
const meta: Meta = { title: 'App/Explain, never hide' };
export default meta;
type Story = StoryObj;

export const DisabledWithAReason: Story = {
  render: () => onGround(html`<div class="w-cluster" style="align-items:flex-start;min-height:140px">
    <ui-button kind="primary" disabled reason="Only Northern ports' leads can pass this down.">Pass down</ui-button>
    <ui-button kind="secondary" disabled reason="Waiting for the reader copy. Usually under a minute.">Publish</ui-button>
    <ui-icon-button icon="find" label="Find" disabled reason="Find opens when the library has loaded."></ui-icon-button>
  </div>`),
};

export const ListRowsAndActions: Story = {
  render: () => onGround(html`<ui-list label="Documents" .items=${[
    { id: '1', title: 'Travel policy', detail: 'Version 3 · PDF', icon: 'document', actions: [{ id: 'share', label: 'Share' }] },
    { id: '2', title: 'Security baseline', detail: 'Version 1 · HTML', icon: 'document', actions: [{ id: 'share', label: 'Share', disabled: true, reason: 'Withdrawn by Policies’ owner on 20 Oct.' }] },
    { id: '3', title: 'Q4 budget review', icon: 'lock', disabled: true, reason: 'Kept on Finance. Ask its leads.' },
  ]}></ui-list>`, 'var(--measure-read)'),
};

export const Notice: Story = {
  render: () => onGround(html`<div class="w-stack">
    <ui-notice tone="needs" heading="Waiting for your back-brief." action="Write it">Due Sat 31 Oct.</ui-notice>
    <ui-notice tone="warning" heading="Two floors disagree on its flag state." action="Compare"></ui-notice>
    <ui-notice tone="refused" heading="Not added.">Halden harbour's leads turned it down, 27 Oct.</ui-notice>
    <ui-notice action="Back to today">Shown as it stood on 1 Jun 2026.</ui-notice>
    <ui-notice tone="needs" heading="Pilot cover is blocked." action="Open it" more="2"></ui-notice>
  </div>`, 'var(--measure-read)'),
};

export const NoteWithWhy: Story = {
  render: () => onGround(html`<div class="w-stack">
    <ui-note why="A team's working view sits beside the org's confirmed record. Each fact says which floor holds it.">Facts as each floor holds them, today.</ui-note>
    <ui-note live>Saved.</ui-note>
  </div>`, 'var(--measure-read)'),
};

export const YouCan: Story = {
  render: () => onGround(html`<ui-can .actions=${[{ id: 'ask', label: 'Ask for access' }, { id: 'who', label: 'See who decides' }]}
    .blocked=${[{ what: 'change it here', who: 'an admin' }]}>Finance's rule covers every team inside it.</ui-can>`, 'var(--measure-read)'),
};
