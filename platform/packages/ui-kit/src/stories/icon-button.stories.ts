import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/icon-button.js';
import { iconNames } from '../components/icon.js';

const meta: Meta = {
  title: 'Primitives/IconButton',
  component: 'ui-icon-button',
  args: { icon: 'find', label: 'Find', size: 'md', ai: false, disabled: false, nameless: false },
  argTypes: { icon: { control: 'select', options: iconNames }, size: { control: 'inline-radio', options: ['md', 'sm'] } },
  render: (a) => html`<div style="padding-bottom: 24px">
    <ui-icon-button icon=${a.icon} label=${a.label} size=${a.size} ?ai=${a.ai} ?disabled=${a.disabled} ?nameless=${a.nameless}
      @click=${() => console.log('pressed', a.label)}></ui-icon-button>
  </div>`,
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
export const Together: Story = {
  render: () => html`<div class="w-cluster" style="align-items: center; padding-bottom: 24px">
    <ui-icon-button icon="find" label="Find"></ui-icon-button>
    <ui-icon-button icon="settings" label="Settings"></ui-icon-button>
    <ui-icon-button icon="account" label="Account"></ui-icon-button>
    <ui-icon-button icon="apps" label="Apps"></ui-icon-button>
    <ui-icon-button icon="agents" label="Ask the AI" ai></ui-icon-button>
    <ui-icon-button icon="document" label="Summarise" ai size="sm"></ui-icon-button>
    <ui-icon-button icon="find" label="Find" size="sm"></ui-icon-button>
  </div>`,
};
export const AI: Story = { args: { icon: 'agents', label: 'Ask the AI', ai: true } };
export const Small: Story = { args: { size: 'sm' } };
export const Disabled: Story = { args: { disabled: true } };
