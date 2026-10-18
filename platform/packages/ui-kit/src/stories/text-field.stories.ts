import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/text-field.js';

const meta: Meta = { title: 'Inputs/TextField', component: 'ui-text-field' };
export default meta;
type Story = StoryObj;

const narrow = (inner: unknown) => html`<div style="max-width: var(--measure-decision)" class="w-stack">${inner}</div>`;

export const Default: Story = {
  render: () => narrow(html`<ui-text-field label="Title" placeholder="What is this document?" hint="Shown in the library and the reader."></ui-text-field>`),
};
export const States: Story = {
  render: () =>
    narrow(html`
      <ui-text-field label="Title" required state="attention" message="Needs you."></ui-text-field>
      <ui-text-field label="Email" value="harry@mod" state="error" message="That email is missing its domain, like @mod.uk"></ui-text-field>
      <ui-text-field label="Title" value="A very long title that will be cut off in lists" state="warning" message="Long titles get cut off in lists"></ui-text-field>
      <ui-text-field label="Reference" value="POL-2026-014" state="valid" message="Reference found"></ui-text-field>
      <ui-text-field label="Owner" value="Finance" readonly></ui-text-field>
      <ui-text-field label="Owner" value="Finance" disabled></ui-text-field>
      <ui-text-field label="Owner" value="Look" busy></ui-text-field>
    `),
};
export const Multiline: Story = {
  render: () => narrow(html`<ui-text-field label="Summary" multiline maxlength="280" optional></ui-text-field>`),
};
