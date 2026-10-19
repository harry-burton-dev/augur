import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/toggle.js';

const meta: Meta = { title: 'Inputs/Toggle', component: 'ui-toggle' };
export default meta;
type Story = StoryObj;

const narrow = (inner: unknown) => html`<div style="max-width: var(--measure-decision)" class="w-stack">${inner}</div>`;
const wait = (ok: boolean) => () => new Promise((resolve, reject) => setTimeout(() => (ok ? resolve(undefined) : reject(new Error('The sign-in service can’t be reached. Nothing was changed.'))), 1400));

export const States: Story = {
  render: () =>
    narrow(html`
      <ui-toggle label="Ask before sending" hint="Every message waits for your approval."></ui-toggle>
      <ui-toggle label="Ask before sending" hint="Every message waits for your approval." checked></ui-toggle>
      <ui-toggle label="Sync calendar" checked busy></ui-toggle>
      <ui-toggle label="Share with Fleet HQ" disabled hint="Your workspace doesn’t allow this."></ui-toggle>
      <ui-toggle label="Morning brief" checked on-word="Daily" off-word="Paused"></ui-toggle>
    `),
};
export const WaitsForTheChange: Story = {
  render: () =>
    narrow(html`
      <ui-toggle label="Let agents read Mail" .change=${wait(true)}></ui-toggle>
      <ui-toggle label="Can sign in" checked .change=${wait(false)}></ui-toggle>
    `),
};
