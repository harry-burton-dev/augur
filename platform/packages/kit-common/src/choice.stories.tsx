import type { Meta, StoryObj } from '@storybook/react-vite';
import { Choice, Segmented } from './choice.js';

const meta = {
  title: 'Common/Choice',
  component: Choice,
  args: {
    label: 'Who can read it',
    defaultValue: 'team',
    options: [
      { value: 'team', label: 'Your team', detail: 'Everyone on your team can read it.' },
      { value: 'department', label: 'Department', detail: 'Publish it up one floor.' },
      { value: 'org', label: 'Whole organisation', disabled: true, reason: 'Only a department lead can publish here. Ask Sam Ortiz.' },
    ],
  },
} satisfies Meta<typeof Choice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Options: Story = {};
export const Required: Story = { args: { defaultValue: null, required: true } };
export const Views: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'center' }}>
      <Segmented
        label="View"
        options={[
          { value: 'list', label: 'List', icon: 'list', iconOnly: true },
          { value: 'grid', label: 'Grid', icon: 'apps', iconOnly: true },
        ]}
      />
      <Segmented
        label="Panel"
        options={[
          { value: 'about', label: 'About' },
          { value: 'activity', label: 'Activity' },
        ]}
      />
    </div>
  ),
};
