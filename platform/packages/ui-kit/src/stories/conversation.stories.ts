import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../components/conversation.js';
import '../components/surface.js';
import type { ConversationItem } from '../components/conversation.js';

const talk: ConversationItem[] = [
  { id: '1', from: 'person', text: 'Can you find the Q3 report?' },
  { id: '2', from: 'agent', text: 'The Q3 report is in Library, updated on Tuesday by Sam.' },
  { id: '3', from: 'person', text: 'Open it' },
];

const meta: Meta = {
  title: 'AI Design/Conversation',
  component: 'ui-conversation',
  args: { items: talk, busy: false, error: '', disabled: false },
  render: (a) => html`<ui-surface style="height:520px;max-width:var(--measure-wide);display:block">
    <ui-conversation agent="Assistant" greeting="Hello. What can I do for you?" .items=${a.items} ?busy=${a.busy} error=${a.error} ?disabled=${a.disabled}></ui-conversation>
  </ui-surface>`,
};
export default meta;
type Story = StoryObj;

/** The agent's lines carry the bubble; the person's sit at the right. */
export const Default: Story = {};
export const Thinking: Story = { args: { busy: true } };
/** The agent asks to raise an intent: nothing happens, and nothing can be sent, until the person answers. */
export const AsksFirst: Story = {
  args: { items: [...talk, { id: '4', from: 'confirm', heading: 'Open “Q3 report” in Library?', detail: 'Library opens over this conversation.', app: 'Library', state: 'asking' }] },
};
export const Allowed: Story = {
  args: {
    items: [...talk, { id: '4', from: 'confirm', heading: 'Open “Q3 report” in Library?', app: 'Library', state: 'allowed' }, { id: '5', from: 'note', text: 'Library opened.' }],
  },
};
export const CouldNotAnswer: Story = { args: { error: 'Assistant has used its 500 model calls for today. More are allowed from midnight UTC.' } };
export const Off: Story = { args: { items: [], disabled: true } };
