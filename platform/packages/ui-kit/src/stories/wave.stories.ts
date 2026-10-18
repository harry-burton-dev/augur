import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/wave.js';
import { wavePresets } from '../components/wave.js';

const meta: Meta = {
  title: 'Foundations/Wave background',
  component: 'ui-wave-background',
  parameters: { layout: 'fullscreen' },
  argTypes: { preset: { control: 'select', options: Object.keys(wavePresets) } },
  args: { preset: 'Calm Tide' },
};
export default meta;
type Story = StoryObj<{ preset: string }>;

const tag = (name: string) => html`<span style="position:relative;z-index:1;display:inline-block;margin:var(--space-3);font-size:var(--type-small);color:var(--ink)">${name}</span>`;

/** Calm Tide is the background. Use it unless a screen has a reason not to. */
export const CalmTide: Story = {
  render: ({ preset }) => html`<div style="position:relative;height:100vh;min-height:480px"><ui-wave-background preset=${preset}></ui-wave-background>${tag(preset)}</div>`,
};

/** The variants, for screens that need a different mood. One per screen, never per panel. */
export const Variants: Story = {
  render: () => html`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--space-3);padding:var(--space-3);background:var(--slate-deep)">
    ${Object.keys(wavePresets).map(
      (name) => html`<div style="position:relative;height:200px;border-radius:var(--radius-inset)"><ui-wave-background preset=${name}></ui-wave-background>${tag(name)}</div>`,
    )}
  </div>`,
};
