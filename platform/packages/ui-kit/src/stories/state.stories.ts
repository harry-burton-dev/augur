import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/state.js';

const meta: Meta = {
  title: 'States/State',
  component: 'ui-state',
  args: { kind: 'empty', heading: 'Nothing needs you right now.', body: '', action: '' },
  render: (a) => html`<div style="max-width:var(--measure-read)"><ui-state kind=${a.kind} heading=${a.heading} body=${a.body} action=${a.action}></ui-state></div>`,
};
export default meta;
type Story = StoryObj;

export const Empty: Story = {};
export const Loading: Story = { args: { kind: 'loading', heading: 'Catching up…' } };
export const Error: Story = { args: { kind: 'error', heading: 'Couldn’t load what needs you.', body: 'Nothing was changed.', action: 'Try again' } };
export const Offline: Story = { args: { kind: 'offline', heading: 'Offline', body: 'What you see is from before you went offline.' } };
