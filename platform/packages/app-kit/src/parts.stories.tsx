import type { Meta, StoryObj } from '@storybook/react-vite';
import { DateField, DropZone } from './date.js';
import { List, Table } from './list.js';
import { PageHead, Section } from './page.js';
import { Details, Facts, Note, Notice, Rows, State, Status, Tag } from './states.js';
import { Card, Cards, Path, Refs, Tally, Timeline } from './things.js';

function Parts() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-7)', padding: 'var(--space-6)', maxWidth: 'var(--measure-wide)' }}>
      <PageHead
        trail={[{ id: 'p', label: 'Policies' }, { id: 'h', label: 'HR' }]}
        eyebrow="Collection"
        heading="Leave"
        summary="Three documents, one waiting for you."
        actions={[{ id: 'add', label: 'Add', kind: 'primary' }, { id: 'share', label: 'Share' }, { id: 'archive', label: 'Archive' }]}
      >
        <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Tag label="HR" />
          <Tag label="Finance" icon="org" quiet />
        </span>
      </PageHead>
      <Notice tone="needs" heading="Waiting for your back-brief." action="Write it" more={1}>
        Sam asked on Friday.
      </Notice>
      <Note why="Floors below see it once it's published up.">Only this floor sees drafts.</Note>
      <Facts items={[{ value: 12, label: 'Documents' }, { value: '2 h', label: 'Since last' }, { value: '92%', label: 'Read' }]} />
      <Section label="Parts" why="Each part is one thing a team owns." action="Sort by risk">
        <Cards>
          <Card heading="Keep the coast watched" status="needs" floorKind="team" floorName="Ops" meta={['By 13 Nov']} note="1 part blocked" tally={<Tally noun={['part', 'parts']} counts={[{ status: 'done', n: 4, word: 'done' }, { status: 'failed', n: 1, word: 'blocked', loud: true }]} />} />
          <Card heading="Budget" unavailable reason="Kept on Finance. Ask its leads." />
        </Cards>
      </Section>
      <List label="Things" noun={['thing', 'things']} items={[{ id: '1', title: 'Approve the roster', detail: 'From Ops', meta: '4 min', status: 'needs', actions: [{ id: 'ok', label: 'Approve' }] }, { id: '2', title: 'Read the brief', status: 'done' }]} />
      <Table noun="documents" filterable selectable columns={[{ key: 'name', label: 'Name', sortable: true }, { key: 'state', label: 'State', kind: 'status', sortable: true }, { key: 'size', label: 'Pages', kind: 'number' }]} rows={[{ id: 'a', name: 'Leave', state: 'needs', size: 4 }, { id: 'b', name: 'Travel', state: 'done', size: 12 }]} />
      <Rows items={[{ label: 'Owner', value: 'Sam Okafor' }, { label: 'Floor', value: 'Ops' }]} />
      <Details items={[{ label: 'Kind', value: 'Vessel', note: 'identity key' }, { label: 'Flag', value: '' }]} />
      <Timeline items={[{ at: new Date().toISOString(), who: 'Sam', what: 'judged it at risk' }]} />
      <Path steps={[{ floor: 'org', title: 'Organisation', mark: 'Decides it' }, { floor: 'team', title: 'Ops', here: true, mark: 'You’re here' }]} />
      <Refs refs={[{ kind: 'document', id: 'd', title: 'Leave policy' }, { kind: 'entity', id: 'e', label: 'Halden', type: 'port', floorKind: 'org', floorName: 'Organisation' }]} closedCount={2} closedReason="Kept on Finance. Ask its leads." />
      <span style={{ display: 'flex', gap: 'var(--space-4)' }}>
        <Status status="needs" next />
        <Status status="running" />
        <Status status="failed" />
      </span>
      <DateField label="Due" hint="Say it in words: 13 nov, friday, +2w." />
      <DropZone hint="PDF, Word or text" />
      <State kind="empty" heading="No views yet." action="Save this one" />
    </div>
  );
}

const meta: Meta<typeof Parts> = { title: 'Quill/From the Lit kit', component: Parts };
export default meta;
export const AllParts: StoryObj<typeof Parts> = {};
