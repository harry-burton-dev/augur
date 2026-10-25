import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/tag.js';
import '../components/surface.js';

const meta: Meta = {
  title: 'Inputs/Tag',
  component: 'ui-tag',
  args: { label: 'Finance', removable: false, quiet: false },
  render: (a) => html`<ui-surface style="max-width:var(--measure-read)"><ui-tag label=${a.label} ?removable=${a.removable} ?quiet=${a.quiet}></ui-tag></ui-surface>`,
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
/** As a filter that's on: its × takes it off. */
export const Removable: Story = { args: { removable: true } };
/** On a row, where several sit together. */
export const Quiet: Story = {
  render: () => html`<ui-surface style="max-width:var(--measure-read);display:flex;gap:var(--space-2)">
    <ui-tag quiet icon="org" label="Policy"></ui-tag><ui-tag quiet label="Travel"></ui-tag><ui-tag quiet label="Draft"></ui-tag>
  </ui-surface>`,
};
