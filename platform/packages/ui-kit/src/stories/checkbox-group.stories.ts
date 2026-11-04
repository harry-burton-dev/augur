import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/checkbox-group.js';

const meta: Meta = { title: 'Inputs/CheckboxGroup', component: 'ui-checkbox-group' };
export default meta;
type Story = StoryObj;

const grid = (inner: unknown) => html`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--space-6);max-width:var(--measure-wide)">${inner}</div>`;
const sources = ['Mail', 'Calendar', 'Reports', 'Chat'];

export const States: Story = {
  render: () =>
    grid(html`
      <ui-checkbox-group label="Sources" .options=${sources} .values=${['Mail', 'Reports']}></ui-checkbox-group>
      <ui-checkbox-group label="Sources" required .options=${sources} state="attention" message="Needs you."></ui-checkbox-group>
      <ui-checkbox-group label="Who gets a copy" max="2" .options=${['Chief of Staff', 'Operations', 'Logistics', 'Comms']} .values=${['Chief of Staff', 'Logistics']}></ui-checkbox-group>
      <ui-checkbox-group
        label="Roles"
        optional
        .options=${[
          { value: 'admin', label: 'admin', detail: 'Runs AUGUR' },
          { value: 'editor', label: 'editor', detail: 'Can publish' },
          { value: 'auditor', label: 'auditor', detail: 'Not yet', disabled: true },
        ]}
        .values=${['editor']}
      ></ui-checkbox-group>
      <ui-checkbox-group label="Sources" disabled .options=${sources} .values=${['Mail']}></ui-checkbox-group>
    `),
};
