import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from './button.js';
import { Dialog, type DialogProps } from './dialog.js';
import { Heading } from './heading.js';
import { Select } from './select.js';
import { TextField } from './text-field.js';

function Opener(props: Omit<DialogProps, 'open' | 'onClose'>) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onPress={() => setOpen(true)}>Open</Button>
      <Dialog {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const meta = { title: 'Common/Dialog', component: Opener, args: { heading: 'New collection' } } satisfies Meta<typeof Opener>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Press Create with the name empty: it asks for it in green and goes there. */
export const Form: Story = {
  args: {
    eyebrow: 'Library',
    actionLabel: 'Create',
    busyLabel: 'Creating',
    onSubmit: () => new Promise((done) => setTimeout(done, 1200)),
    fields: (
      <>
        <TextField label="Name" name="name" required />
        <Select label="Kind" name="kind" options={['Plans', 'Reports', 'Notes']} optional />
      </>
    ),
  },
};
/** Focus starts on Cancel, and the primary acts on one press. */
export const Danger: Story = {
  args: { heading: 'Delete this collection?', actionLabel: 'Delete', danger: true, children: <p>Its 12 records move to the library’s top level. Nobody loses access.</p> },
};
export const Fails: Story = {
  args: { heading: 'Publish to every floor', actionLabel: 'Publish', busyLabel: 'Publishing', onSubmit: () => new Promise((_, fail) => setTimeout(() => fail(new Error('The library is read-only during the upgrade. Try again in ten minutes.')), 900)) },
};

export const Headings = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
      <Heading eyebrow="Library" heading="Plans" summary="Three need you." size="l" level={1} />
      <Heading eyebrow="Collection" heading="Quarterly plans" summary="12 records." />
      <Heading heading="Recent" size="s" />
    </div>
  ),
};
