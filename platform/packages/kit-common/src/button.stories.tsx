import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button.js';

const meta = {
  title: 'Common/Button',
  component: Button,
  args: { children: 'Publish', kind: 'secondary' },
  argTypes: { kind: { control: 'inline-radio', options: ['primary', 'secondary', 'tertiary', 'ghost', 'danger'] } },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Secondary: Story = {};
export const Primary: Story = { args: { kind: 'primary' } };
export const Tertiary: Story = { args: { kind: 'tertiary', children: 'Show all' } };
export const Ghost: Story = { args: { kind: 'ghost', children: 'Cancel' } };
/** Asks twice: press once to arm it. */
export const Danger: Story = { args: { kind: 'danger', children: 'Delete' } };
export const Small: Story = { args: { size: 'sm' } };
export const Busy: Story = { args: { busy: true, busyLabel: 'Publishing' } };
/** Stays focusable and says why on hover and focus. */
export const Unavailable: Story = { args: { disabled: true, reason: 'Only an admin of this floor can publish.' } };
/** Asks the AI. */
export const AI: Story = { args: { kind: 'primary', ai: true, children: 'Summarise' } };
export const Every: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
      <Button kind="primary">Publish</Button>
      <Button>Save draft</Button>
      <Button kind="tertiary">Show all</Button>
      <Button kind="ghost">Cancel</Button>
      <Button kind="danger">Delete</Button>
    </div>
  ),
};
