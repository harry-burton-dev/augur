import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/heading.js';

const meta: Meta = {
  title: 'Primitives/Heading',
  component: 'ui-heading',
  args: { eyebrow: 'Library', heading: 'Policies', summary: 'Twelve policies. Three are due for review this month.', size: 'm', level: 2 },
  argTypes: { size: { control: 'inline-radio', options: ['s', 'm', 'l'] }, level: { control: { type: 'number', min: 1, max: 6 } } },
  render: (a) => html`<ui-heading eyebrow=${a.eyebrow} heading=${a.heading} summary=${a.summary} size=${a.size} level=${a.level}></ui-heading>`,
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
export const Sizes: Story = {
  render: () => html`<div class="w-stack">
    <ui-heading size="s" eyebrow="Agent" heading="Briefing" summary="Tells you, in three lines, what needs you today."></ui-heading>
    <ui-heading eyebrow="Library" heading="Reports" summary="Twelve reports. Three were updated today and two are waiting for your review."></ui-heading>
    <ui-heading size="l" eyebrow="Workspace" heading="Libraries"></ui-heading>
  </div>`,
};
export const TitleOnly: Story = { args: { eyebrow: '', summary: '' } };
