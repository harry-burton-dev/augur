import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from './icon-button.js';
import { Menu } from './menu.js';
import { Tab, TabList, TabPanel, Tabs } from './tabs.js';

const meta = {
  title: 'Common/Menu',
  component: Menu,
  args: {
    label: 'Collection actions',
    onAction: () => {},
    items: [
      { id: 'open', label: 'Open', icon: 'arrow' },
      { id: 'rename', label: 'Rename', icon: 'rename', key: 'R' },
      { id: 'move', label: 'Move to another library', icon: 'folder', disabled: true, reason: 'This floor has only one library.' },
      '-',
      { id: 'delete', label: 'Delete', danger: true, key: 'D' },
    ],
    children: <IconButton icon="more" label="More" />,
  },
} satisfies Meta<typeof Menu>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Press the ⋯ to open it. */
export const Actions: Story = {};

export const Views: Story = {
  render: () => (
    <Tabs defaultSelected="records" unavailable={{ history: 'Only the library’s owner sees its history.' }}>
      <TabList label="Collection views">
        <Tab id="records" count={12}>
          Records
        </Tab>
        <Tab id="needs" count={3}>
          Needs you
        </Tab>
        <Tab id="history">History</Tab>
      </TabList>
      <TabPanel id="records">Twelve records.</TabPanel>
      <TabPanel id="needs">Three need you.</TabPanel>
      <TabPanel id="history">The history.</TabPanel>
    </Tabs>
  ),
};
