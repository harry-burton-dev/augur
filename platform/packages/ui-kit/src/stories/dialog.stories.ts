import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/dialog.js';
import '../components/text-field.js';
import '../components/button.js';
import type { UiDialog } from '../components/dialog.js';

const meta: Meta = { title: 'Overlays/Dialog', component: 'ui-dialog' };
export default meta;
type Story = StoryObj;

const opener = (id: string) => html`<ui-button kind="secondary" @click=${() => (document.getElementById(id) as UiDialog).show()}>Open</ui-button>`;

export const PublishForm: Story = {
  render: () => html`${opener('publish')}
    <ui-dialog id="publish" open eyebrow="Finance library" heading="Publish the travel policy" action-label="Publish" busy-label="Publishing…"
      .submit=${() => new Promise((r) => setTimeout(r, 1200))}>
      <p>Everyone in Finance will see it in their library.</p>
      <ui-text-field slot="fields" name="note" label="Note to readers" required></ui-text-field>
      <ui-text-field slot="fields" name="review" label="Review by" optional placeholder="e.g. 1 Apr 2027"></ui-text-field>
    </ui-dialog>`,
};
export const FailsAndStays: Story = {
  render: () => html`${opener('fail')}
    <ui-dialog id="fail" open heading="Move to Reports" action-label="Move" busy-label="Moving…"
      .submit=${() => new Promise((_, reject) => setTimeout(() => reject(new Error('Nothing was changed; try again.')), 800))}>
      <p>The document keeps its history.</p>
    </ui-dialog>`,
};
export const Danger: Story = {
  render: () => html`${opener('danger')}
    <ui-dialog id="danger" open light heading="Delete the Minutes library?" action-label="Delete library" danger>
      <p>12 documents and their history go with it. This can't be undone.</p>
    </ui-dialog>`,
};
