import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon, iconNames } from './icon.js';
import { IconButton } from './icon-button.js';

const meta = { title: 'Common/Icons', component: Icon, args: { name: 'home' } } satisfies Meta<typeof Icon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const One: Story = {};
/** Every icon, by AUGUR's name for it. */
export const Every: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 'var(--space-4)', color: 'var(--ink)' }}>
      {iconNames.map((name) => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--type-small)', color: 'var(--ink-muted)' }}>
          <Icon name={name} style={{ color: 'var(--ink)' }} />
          {name}
        </div>
      ))}
    </div>
  ),
};
export const Buttons: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
      <IconButton icon="close" label="Close" />
      <IconButton icon="find" label="Find" />
      <IconButton icon="agents" label="Ask" ai />
      <IconButton icon="delete" label="Delete" disabled reason="You can only delete what you made." />
      <IconButton icon="more" label="More" size="sm" />
    </div>
  ),
};
