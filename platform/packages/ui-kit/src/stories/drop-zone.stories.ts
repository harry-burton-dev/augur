import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/drop-zone.js';
import '../components/surface.js';

const meta: Meta = {
  title: 'Inputs/Drop zone',
  component: 'ui-drop-zone',
  args: { heading: 'Drop files to add them here', hint: 'PDF, Word, HTML, Markdown or text, up to 200 MB', action: 'Choose files', busy: false, disabled: false },
  render: (a) => html`<ui-surface style="max-width:var(--measure-read)">
    <ui-drop-zone heading=${a.heading} hint=${a.hint} action=${a.action} accept=".pdf,.docx,.html,.htm,.md,.markdown,.txt" ?busy=${a.busy} ?disabled=${a.disabled}></ui-drop-zone>
  </ui-surface>`,
};
export default meta;
type Story = StoryObj;

/** Drop files, or press Choose files: what it doesn't take, it says so. */
export const Default: Story = {};
export const Busy: Story = { args: { busy: true } };
export const Off: Story = { args: { disabled: true } };
/** One line, for a dialog: the next version of a document. */
export const Compact: Story = {
  render: () => html`<ui-surface style="max-width:var(--measure-read)"><ui-drop-zone compact heading="Drop the next version here" action="Choose a file" .multiple=${false}></ui-drop-zone></ui-surface>`,
};
