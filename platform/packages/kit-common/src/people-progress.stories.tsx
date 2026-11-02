import type { Meta, StoryObj } from '@storybook/react-vite';
import { People, Person } from './person.js';
import { Progress, Steps } from './progress.js';
import { Tip } from './tip.js';

const meta = { title: 'Common/People and progress', component: Person, args: { name: 'Sam Ortiz', detail: 'Lead, Procurement' } } satisfies Meta<typeof Person>;
export default meta;
type Story = StoryObj<typeof meta>;

export const One: Story = {};
export const Floors: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Person name="Alex Morgan" detail="You" tone="you" />
      <Person name="Sam Ortiz" detail="Your team" tone="team" />
      <Person name="Priya Shah" detail="Department lead" tone="department" />
      <Person name="Lee Park" detail="Organisation admin" tone="org" />
      <People
        label="Shared with"
        people={[{ name: 'Alex Morgan', tone: 'you' }, { name: 'Sam Ortiz' }, { name: 'Priya Shah', tone: 'department' }, { name: 'Lee Park', tone: 'org' }, { name: 'Jo Bell' }, { name: 'Kim Ito' }]}
      />
    </div>
  ),
};
export const Bars: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: '28rem' }}>
      <Progress label="Uploading 5 files" value={40} valueText="2 of 5" />
      <Progress label="Upgrading" value={85} />
      <Progress label="Reading the document" />
      <Steps
        label="Extraction"
        steps={[
          { label: 'Read', state: 'done' },
          { label: 'Extract', state: 'now' },
          { label: 'Check', state: 'next' },
          { label: 'File', state: 'next' },
        ]}
      />
    </div>
  ),
};
/** Hover or focus the name. */
export const Tips: Story = {
  render: () => (
    <Tip content="Quarterly procurement plan for the northern region, second draft">
      <span tabIndex={0} style={{ display: 'inline-block', maxWidth: '14rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>
        Quarterly procurement plan for the northern region, second draft
      </span>
    </Tip>
  ),
};
