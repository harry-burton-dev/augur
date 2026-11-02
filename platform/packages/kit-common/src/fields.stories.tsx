import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox, CheckboxGroup } from './checkbox.js';
import { Select } from './select.js';
import { TextField } from './text-field.js';
import { Toggle } from './toggle.js';

const column = { display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '28rem' } as const;

const meta = { title: 'Common/Fields', component: TextField, args: { label: 'Title' } } satisfies Meta<typeof TextField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = { args: { hint: 'What people will see in the library.', placeholder: 'Q3 plan' } };
/** Leave it empty and move on: it asks in green, not red. */
export const Required: Story = { args: { required: true } };
export const Wrong: Story = { args: { label: 'Email', defaultValue: 'alex', state: 'error', message: 'That isn’t an email address.' } };
export const Warning: Story = { args: { label: 'Name', defaultValue: 'Plan', state: 'warning', message: 'Another collection is called this.' } };
export const Valid: Story = { args: { label: 'Address', defaultValue: 'alex@example.org', state: 'valid' } };
export const Several: Story = { args: { label: 'Summary', multiline: true, maxLength: 280 } };
export const Busy: Story = { args: { label: 'Address', defaultValue: 'alex@example.org', busy: true } };
export const ReadOnly: Story = { args: { label: 'Made by', defaultValue: 'Alex Morgan', readOnly: true } };
/** Can't be changed: it stays focusable and says why on hover and focus. */
export const Unavailable: Story = { args: { label: 'Owner', defaultValue: 'Alex Morgan', disabled: true, reason: 'Only the library’s owner can change this.' } };

export const Selects: Story = {
  render: () => (
    <div style={column}>
      <Select label="Kind" hint="What sort of record this is." options={['Report', 'Note', 'Plan']} />
      <Select
        label="Collection"
        required
        options={[
          { value: 'a', label: 'Plans', detail: '12 items' },
          { value: 'b', label: 'Reports', detail: '4 items' },
          { value: 'c', label: 'Archive', detail: 'Only admins can add here', disabled: true },
        ]}
      />
      <Select label="Collection" options={[]} empty="This library has no collections yet." />
      <Select label="Floor" options={['One']} defaultValue="One" disabled reason="Floors come from your department." />
    </div>
  ),
};

export const Toggles: Story = {
  render: () => (
    <div style={column}>
      <Toggle label="Notify me" hint="When someone shares a record with you." />
      <Toggle label="Saves, after a moment" onChange={() => new Promise((done) => setTimeout(done, 1200))} />
      <Toggle label="Fails, and turns back" onChange={() => new Promise((_, fail) => setTimeout(() => fail(new Error('The server said no. Try again in a minute.')), 900))} />
      <Toggle label="Sign in with your organisation" defaultChecked disabled reason="Your deployment admin set this for everyone." />
    </div>
  ),
};

export const Checkboxes: Story = {
  render: () => (
    <div style={column}>
      <Checkbox>Email me a copy</Checkbox>
      <CheckboxGroup label="Pillars" hint="Choose up to two." max={2} defaultValue={['artifacts']}>
        <Checkbox value="artifacts" detail="Records">Artifacts</Checkbox>
        <Checkbox value="mandate" detail="Intent">Mandate</Checkbox>
        <Checkbox value="atlas" detail="Data">Data Atlas</Checkbox>
      </CheckboxGroup>
      <Checkbox disabled reason="Only an admin can publish to every floor.">Publish to every floor</Checkbox>
    </div>
  ),
};
