import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { iconNames } from '../components/icon.js';

const meta: Meta = {
  title: 'Primitives/Icon',
  component: 'ui-icon',
  args: { name: 'library', bubble: false, size: 48 },
  argTypes: { name: { control: 'select', options: iconNames }, size: { control: { type: 'range', min: 16, max: 96, step: 4 } } },
  render: (a) => html`<ui-icon name=${a.name} ?bubble=${a.bubble} size=${a.size}></ui-icon>`,
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
export const Bubble: Story = { args: { bubble: true, size: 64, name: 'agents' } };
export const AllIcons: Story = {
  render: () => html`<div class="w-cluster">${iconNames.map(
    (n) => html`<span style="display:inline-flex;flex-direction:column;align-items:center;gap:8px;width:72px;font-size:12px;color:var(--ink-muted)"><ui-icon name=${n} size="32"></ui-icon>${n}</span>`,
  )}</div>`,
};
export const HairlineAndBubble: Story = {
  render: () => html`<div class="w-stack">
    <div class="w-cluster">${['home', 'library', 'document', 'find', 'chart', 'settings', 'people', 'bell'].map((n) => html`<ui-icon name=${n} size="32"></ui-icon>`)}</div>
    <div class="w-cluster">${['home', 'library', 'document', 'find', 'chart', 'settings', 'people', 'bell'].map((n) => html`<ui-icon name=${n} bubble size="48"></ui-icon>`)}</div>
  </div>`,
};
