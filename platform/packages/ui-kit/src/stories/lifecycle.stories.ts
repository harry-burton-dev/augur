import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/lifecycle.js';
import type { LifecycleState } from '../components/lifecycle.js';

const states: LifecycleState[] = [
  { id: 'in-progress', name: 'In progress' },
  { id: 'in-review', name: 'In review' },
  { id: 'complete', name: 'Complete' },
  { id: 'issued', name: 'Issued' },
  { id: 'retired', name: 'Retired' },
];

const meta: Meta = {
  title: 'Primitives/Lifecycle',
  component: 'ui-lifecycle',
  args: { state: 'in-review', moves: ['in-progress', 'complete'], why: '' },
  render: (a) => html`<ui-lifecycle label="Version 2" .states=${states} .offLine=${['retired']} state=${a.state} .moves=${a.moves} why=${a.why}></ui-lifecycle>`,
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
export const Issued: Story = { args: { state: 'issued', moves: ['retired'] } };
export const Retired: Story = { args: { state: 'retired', moves: [] } };
export const NoMoves: Story = { args: { state: 'complete', moves: [], why: 'Only whoever manages it can make it Issued.' } };
