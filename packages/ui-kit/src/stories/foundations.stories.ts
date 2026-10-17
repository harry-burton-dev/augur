import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/heading.js';
import '../components/status.js';
import '../components/surface.js';

const meta: Meta = { title: 'Foundations/Primitives' };
export default meta;
type Story = StoryObj;

export const Surfaces: Story = {
  render: () => html`<div class="w-stack" style="max-width: var(--measure-read)">
    ${(['pane', 'raised', 'inset', 'overlay', 'bar'] as const).map(
      (k) => html`<ui-surface kind=${k} pad><ui-heading size="s" eyebrow="Surface" heading=${k}></ui-heading></ui-surface>`,
    )}
  </div>`,
};
export const Heading: Story = {
  render: () => html`<div class="w-stack">
    <ui-heading size="s" eyebrow="Finance" heading="Policies" summary="Three are due for review this month."></ui-heading>
    <ui-heading eyebrow="Library" heading="Travel and subsistence"></ui-heading>
    <ui-heading size="l" heading="Library"></ui-heading>
  </div>`,
};
export const Status: Story = {
  render: () => html`<div class="w-stack">
    <ui-status status="needs" next></ui-status>
    <ui-status status="needs"></ui-status>
    <ui-status status="running"></ui-status>
    <ui-status status="queued"></ui-status>
    <ui-status status="paused"></ui-status>
    <ui-status status="done"></ui-status>
    <ui-status status="failed"></ui-status>
    <ui-status status="warning"></ui-status>
  </div>`,
};
