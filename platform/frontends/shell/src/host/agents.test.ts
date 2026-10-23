import type { AppManifestEntry } from '@augur/mfe-sdk';
import { describe, expect, it, vi } from 'vitest';
import { AgentConversation, agentsFor, confirmFor, instructionsFor, screenFor, shellAgents, toolsFor } from './index.js';

const app = (id: string, extra: Partial<AppManifestEntry> = {}): AppManifestEntry => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  route: `/${id}`,
  entry: `/apps/${id}/entry.js`,
  version: '0.1.0',
  sdk: '^1.0.0',
  ...extra,
});
const open = { type: 'document.open', description: 'Open a document by its title', payload: { type: 'object', properties: { title: { type: 'string' } } }, confirm: 'Open “{title}”' };
const library = app('library', { description: 'Documents', handles: ['document.open', 'document.share'], intents: [open, { type: 'document.share', description: 'Share a document' }] });
const scribe = app('scribe', { ai: true, agent: { instructions: 'You write minutes.', greeting: 'Which meeting?' } });
const lens = app('lens', { ai: true });
const manifest = [library, scribe, lens];

describe('agents', () => {
  it('are the shell’s assistant and each AI app’s agent; an AI app without one opens as an app', () => {
    expect(agentsFor(manifest).map((a) => a.id)).toEqual(['assistant', 'scribe']);
    expect(shellAgents(manifest, (id) => (id === 'scribe' ? 'needs' : undefined))).toEqual([
      { id: 'assistant', name: 'Assistant', detail: expect.any(String), status: undefined },
      { id: 'scribe', name: 'Scribe', detail: undefined, status: 'needs' },
      { id: 'lens', name: 'Lens', detail: undefined, app: 'lens' },
    ]);
  });

  it('live at /agents/<id>, the shell’s own', () => {
    expect(screenFor(manifest, '/agents/scribe')).toEqual({ kind: 'agent', agent: 'scribe' });
    expect(screenFor(manifest, '/agents/')).toBeUndefined();
  });

  it('get as tools only the intents apps described, each to the app that would handle it', () => {
    const shadow = app('shadow', { handles: ['document.open'], intents: [{ type: 'document.open', description: 'Open it here instead' }] });
    const undeclared = app('stray', { intents: [{ type: 'thing.do', description: 'Not in handles' }] });
    const tools = toolsFor([...manifest, shadow, undeclared]);
    expect(tools.map((t) => [t.name, t.app.id, t.description])).toEqual([
      ['document_open', 'library', 'Open a document by its title (in Library)'],
      ['document_share', 'library', 'Share a document (in Library)'],
    ]);
    expect(tools[0].parameters).toEqual(open.payload);
  });

  it('ask the person in the app’s own words, filled in', () => {
    const [openTool, share] = toolsFor(manifest);
    expect(confirmFor(openTool, { title: 'Q3 report' })).toEqual({ heading: 'Open “Q3 report” in Library?' });
    expect(confirmFor(openTool, {})).toEqual({ heading: 'Open “…” in Library?' });
    expect(confirmFor(share, { id: 'd7' })).toEqual({ heading: 'Share a document in Library?', detail: 'id: d7' });
  });

  it('are told who they are, who they’re talking to and what apps are here', () => {
    const told = instructionsFor(agentsFor(manifest)[1], { person: 'Sam', floor: 'Finance', manifest });
    expect(told).toContain('You are Scribe');
    expect(told).toContain('You write minutes.');
    expect(told).toContain('talking with Sam, on Finance');
    expect(told).toContain('Library (Documents)');
  });
});

/** A model gateway that answers each call with the next of these. */
const gateway = (...answers: object[]) => {
  const asked: { messages: { role: string; content: string; toolCallId?: string }[]; tools?: { name: string }[]; agent: string }[] = [];
  const ask = vi.fn(async (body: unknown) => {
    asked.push(body as (typeof asked)[number]);
    const next = answers.shift() ?? { message: { content: 'Done.' } };
    return 'status' in next ? Response.json(next, { status: (next as { status: number }).status }) : Response.json(next);
  });
  return { ask, asked };
};

describe('a conversation with an agent', () => {
  const tools = toolsFor(manifest);
  const asks = { message: { content: '', toolCalls: [{ id: 'k1', name: 'document_open', arguments: { title: 'Q3 report' } }] } };

  it('sends what was said, with the instructions and tools, as the agent', async () => {
    const { ask, asked } = gateway({ message: { content: 'Hello Sam.' } });
    const changes = vi.fn();
    const c = new AgentConversation(agentsFor(manifest)[0], { ask, onChange: changes });
    await c.send('Hi', tools, 'You are Assistant.');
    expect(asked[0].agent).toBe('assistant');
    expect(asked[0].messages).toEqual([{ role: 'system', content: 'You are Assistant.' }, { role: 'user', content: 'Hi' }]);
    expect(asked[0].tools!.map((t) => t.name)).toEqual(['document_open', 'document_share']);
    expect(c.items.map((i) => ('text' in i ? [i.from, i.text] : i.from))).toEqual([['person', 'Hi'], ['agent', 'Hello Sam.']]);
    expect(changes).toHaveBeenCalled();
    expect(c.status).toBeUndefined();
  });

  it('does nothing an agent asks until the person allows it, then gives the intent to raise', async () => {
    const { ask, asked } = gateway(asks);
    const c = new AgentConversation(agentsFor(manifest)[0], { ask, onChange: () => undefined });
    await c.send('Open the Q3 report', tools, 'x');
    const card = c.items.at(-1)!;
    expect(card).toMatchObject({ from: 'confirm', heading: 'Open “Q3 report” in Library?', app: 'Library', state: 'asking' });
    expect(c.status).toBe('needs');
    await c.send('Something else', tools, 'x');
    expect(asked).toHaveLength(1);
    expect(c.allow('not-that-card')).toBeUndefined();
    expect(c.allow(card.id)).toEqual({ type: 'document.open', payload: { title: 'Q3 report' } });
    expect(c.items.find((i) => i.id === card.id)).toMatchObject({ state: 'allowed' });
    expect(c.items.at(-1)).toMatchObject({ from: 'note', text: 'Library opened.' });
    expect(c.allow(card.id)).toBeUndefined();
    await c.send('Thanks', tools, 'x');
    expect(asked[1].messages.slice(-3)).toEqual([
      { role: 'assistant', content: '', toolCalls: asks.message.toolCalls },
      { role: 'tool', toolCallId: 'k1', content: 'The person allowed it. Library opened to do it.' },
      { role: 'user', content: 'Thanks' },
    ]);
  });

  it('tells the agent when the person says not now, and lets it answer', async () => {
    const { ask, asked } = gateway(asks, { message: { content: 'All right.' } });
    const c = new AgentConversation(agentsFor(manifest)[0], { ask, onChange: () => undefined });
    await c.send('Open the Q3 report', tools, 'x');
    await c.decline(c.items.at(-1)!.id, tools, 'x');
    expect(asked[1].messages.at(-1)).toEqual({ role: 'tool', toolCallId: 'k1', content: 'The person said not now. It was not done.' });
    expect(c.items.map((i) => (i.from === 'confirm' ? i.state : i.from))).toEqual(['person', 'declined', 'agent']);
  });

  it('turns down tools it doesn’t have and more than one at a time', async () => {
    const { ask, asked } = gateway({
      message: {
        content: 'Let me do a few things.',
        toolCalls: [
          { id: 'a', name: 'delete_everything', arguments: {} },
          { id: 'b', name: 'document_open', arguments: { title: 'A' } },
          { id: 'c', name: 'document_share', arguments: {} },
        ],
      },
    });
    const c = new AgentConversation(agentsFor(manifest)[0], { ask, onChange: () => undefined });
    await c.send('Go', tools, 'x');
    expect(c.items.filter((i) => i.from === 'confirm')).toHaveLength(1);
    c.allow(c.items.at(-1)!.id);
    await c.send('Next', tools, 'x');
    expect(asked[1].messages.filter((m) => m.role === 'tool').map((m) => [m.toolCallId, m.content])).toEqual([
      ['a', 'There is no such tool here.'],
      ['c', 'Not done: ask for one thing at a time.'],
      ['b', 'The person allowed it. Library opened to do it.'],
    ]);
  });

  it('says why it couldn’t answer, and tries again with nothing new said', async () => {
    const { ask, asked } = gateway({ status: 429, message: 'assistant has used its 500 model calls for today.' }, { message: { content: 'Back.' } });
    const c = new AgentConversation(agentsFor(manifest)[0], { ask, onChange: () => undefined });
    await c.send('Hi', tools, 'x');
    expect([c.error, c.status, c.busy]).toEqual(['assistant has used its 500 model calls for today.', 'failed', false]);
    await c.retry(tools, 'x');
    expect(c.error).toBe('');
    expect(asked[1].messages.filter((m) => m.role === 'user')).toHaveLength(1);
    expect(c.items.at(-1)).toMatchObject({ from: 'agent', text: 'Back.' });
  });
});
