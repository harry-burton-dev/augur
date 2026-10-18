import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/keycap.js';

const meta: Meta = {
  title: 'Primitives/Keycap',
  component: 'ui-keycap',
  args: { label: 'Esc' },
  render: (a) => html`<ui-keycap label=${a.label}></ui-keycap>`,
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
export const Keys: Story = {
  render: () => html`<div class="w-cluster" style="align-items: center">
    ${['Esc', 'Enter', '/', '← →', '⌘ K'].map((k) => html`<ui-keycap label=${k}></ui-keycap>`)}
  </div>`,
};
export const InAHint: Story = {
  render: () => html`<p style="font-size: var(--type-meta); line-height: var(--leading-meta); color: var(--ink-muted)">
    Press <ui-keycap>/</ui-keycap> to find anything, <ui-keycap>Enter</ui-keycap> to open it.
  </p>`,
};
export const Back: Story = {
  render: () => html`<ui-back @click=${() => console.log('back')}></ui-back>`,
};
