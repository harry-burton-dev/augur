import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/tag-picker.js';
import '../components/surface.js';
import type { TagOption, UiTagPicker } from '../components/tag-picker.js';

const options: TagOption[] = [
  { value: 'fin', label: 'Finance', detail: 'Org', icon: 'org' },
  { value: 'pol', label: 'Policy', detail: 'Org', icon: 'org' },
  { value: 'trv', label: 'Travel' },
  { value: 'exp', label: 'Expenses' },
  { value: 'drf', label: 'Draft' },
];

const meta: Meta = {
  title: 'Inputs/Tag picker',
  component: 'ui-tag-picker',
  args: { label: 'Tags', hint: 'The org’s tags and this library’s', creatable: false },
  render: (a) => html`<ui-surface style="max-width:var(--measure-read)">
    <ui-tag-picker label=${a.label} hint=${a.hint} ?creatable=${a.creatable} .options=${options} .values=${['pol']}></ui-tag-picker>
  </ui-surface>`,
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
/** Free tags: a word that isn't a tag yet can be added. Here the story adds it straight away. */
export const Creatable: Story = {
  render: () => html`<ui-surface style="max-width:var(--measure-read)">
    <ui-tag-picker label="Tags" creatable .options=${options}
      @ui-create=${(e: CustomEvent<{ name: string }>) => {
        const picker = e.target as UiTagPicker;
        const value = `new-${picker.options.length}`;
        picker.options = [...picker.options, { value, label: e.detail.name }];
        picker.values = [...picker.values, value];
      }}></ui-tag-picker>
  </ui-surface>`,
};
