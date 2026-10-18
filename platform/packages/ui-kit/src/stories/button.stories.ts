import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/button.js';

const meta: Meta = {
  title: 'Actions/Button',
  component: 'ui-button',
  args: { label: 'Publish', kind: 'primary', size: 'md', ai: false, disabled: false, busy: false, busyLabel: 'Publishing…' },
  argTypes: {
    kind: { control: 'select', options: ['primary', 'secondary', 'tertiary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['md', 'sm'] },
  },
  render: (a) => html`<ui-button kind=${a.kind} size=${a.size} ?ai=${a.ai} ?disabled=${a.disabled} ?busy=${a.busy}
    busy-label=${a.busyLabel}>${a.label}</ui-button>`,
};
export default meta;
type Story = StoryObj;

export const Primary: Story = {};
export const Kinds: Story = {
  render: () => html`<div class="w-cluster">
    <ui-button kind="primary">Publish</ui-button>
    <ui-button kind="secondary">Duplicate</ui-button>
    <ui-button kind="tertiary">Later</ui-button>
    <ui-button kind="ghost">Share</ui-button>
    <ui-button kind="danger">Delete library</ui-button>
  </div>`,
};
export const AI: Story = {
  render: () => html`<div class="w-cluster">
    <ui-button kind="primary" ai>Summarise</ui-button>
    <ui-button kind="secondary" ai>Ask about this</ui-button>
  </div>`,
};
export const Small: Story = { args: { size: 'sm', label: 'Open' } };
export const Busy: Story = { args: { busy: true } };
export const DangerAsksTwice: Story = {
  render: () => html`<ui-button kind="danger" @click=${() => console.log('deleted')}>Delete library</ui-button>`,
};
