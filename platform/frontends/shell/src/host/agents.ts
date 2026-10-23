import { resolveIntent, type AppManifestEntry, type Intent, type IntentInfo } from '@augur/mfe-sdk';
import type { ConversationItem, ShellAgent, StatusName } from '@augur/ui-kit';

/** The shell's own agent. Its calls count against the model gateway's limit under this name. */
export const ASSISTANT = 'assistant';
/** Where the shell keeps its Agents: `/agents/<id>` on any floor. No app can take it. */
export const AGENTS_ROUTE = '/agents';

/** An agent someone can talk to in the shell. */
export interface AgentDef {
  id: string;
  name: string;
  detail?: string;
  instructions: string;
  greeting?: string;
}

const assistant: AgentDef = {
  id: ASSISTANT,
  name: 'Assistant',
  detail: 'Ask anything, or have it open things for you',
  instructions:
    'You help people find their way around the apps they can open, and get things done in them by asking to use your tools. When nothing fits, say so plainly.',
  greeting: 'Hello. What can I help you find or do?',
};

/** The agents on this floor: the shell's assistant, then each AI app's own. */
export const agentsFor = (manifest: AppManifestEntry[]): AgentDef[] => [
  assistant,
  ...manifest
    .filter((a) => a.ai && a.agent)
    .map((a) => ({ id: a.id, name: a.name, detail: a.description, instructions: a.agent!.instructions, greeting: a.agent!.greeting })),
];

/** What the Shell's Agents view lists: every agent, and AI apps without one, which open as apps. */
export const shellAgents = (manifest: AppManifestEntry[], statusOf: (id: string) => StatusName | undefined): ShellAgent[] => [
  ...agentsFor(manifest).map((a) => ({ id: a.id, name: a.name, detail: a.detail, status: statusOf(a.id) })),
  ...manifest.filter((a) => a.ai && !a.agent).map((a) => ({ id: a.id, name: a.name, detail: a.description, app: a.id })),
];

/** An intent an app described, as a tool the model may ask to use. */
export interface AgentTool {
  /** As the model knows it: the intent type, with what a tool name can't hold made `_`. */
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  intent: IntentInfo;
  app: AppManifestEntry;
}

/**
 * Every intent described for agents by the apps the person can open here.
 * An intent goes to the app that would handle it if raised, so a tool always
 * opens the app the shell would open; an undescribed intent is never offered.
 */
export const toolsFor = (manifest: AppManifestEntry[]): AgentTool[] => {
  const tools: AgentTool[] = [];
  for (const app of manifest)
    for (const intent of app.intents ?? []) {
      if (!app.handles?.includes(intent.type) || resolveIntent(manifest, { type: intent.type, payload: {} })?.id !== app.id) continue;
      const base = intent.type.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
      let name = base;
      for (let n = 2; tools.some((t) => t.name === name); n++) name = `${base}_${n}`;
      tools.push({ name, description: `${intent.description} (in ${app.name})`, ...(intent.payload ? { parameters: intent.payload } : {}), intent, app });
    }
  return tools.slice(0, 32);
};

const shown = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));

/** What the person is asked: the app's own words with the payload filled in, and where. "Open Q3 report in Library?" */
export const confirmFor = (tool: AgentTool, args: Record<string, unknown>): { heading: string; detail?: string } => {
  const said = tool.intent.confirm?.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => (args[key] === undefined ? '…' : shown(args[key])));
  const heading = `${(said ?? tool.intent.description).replace(/[.?!]+$/, '')} in ${tool.app.name}?`;
  const facts = Object.entries(args).map(([k, v]) => `${k}: ${shown(v)}`).join(' · ');
  return facts && !said ? { heading, detail: facts } : { heading };
};

/** What the model is told: who it is, who it's talking to, and the apps here. */
export const instructionsFor = (agent: AgentDef, { person, floor, manifest }: { person: string; floor: string; manifest: AppManifestEntry[] }) =>
  [
    `You are ${agent.name}, an agent in AUGUR, the organisation's app platform. ${agent.instructions}`,
    `You are talking with ${person}, on ${floor}. The apps they can open here: ${manifest.map((a) => (a.description ? `${a.name} (${a.description})` : a.name)).join('; ') || 'none'}.`,
    'Your tools do things in those apps. Ask to use one at a time; the person is asked to allow it first, and it opens the app. Never say something was done until a tool result says so. Keep answers short and plain.',
  ].join('\n\n');

interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
  toolCallId?: string;
}

interface ModelAnswer {
  message: { content: string; toolCalls?: ModelMessage['toolCalls'] };
}

export interface ConversationDeps {
  /** POST to the model gateway's chat, on the current floor. */
  ask(body: unknown): Promise<Response>;
  /** Its state changed: show it again. */
  onChange(): void;
}

let ids = 0;
const nextId = () => `c${++ids}`;

/**
 * One conversation with one agent on one floor, held by the shell for as
 * long as the page is open. Every model call goes through the platform's
 * model gateway as the agent. When the model asks to use a tool, nothing
 * happens until the person allows it; then the shell raises the intent.
 */
export class AgentConversation {
  items: ConversationItem[] = [];
  busy = false;
  error = '';
  private messages: ModelMessage[] = [];
  /** The tool call waiting for the person, by its card's id. */
  private waiting?: { item: string; call: NonNullable<ModelMessage['toolCalls']>[number]; tool: AgentTool };

  constructor(
    readonly agent: AgentDef,
    private readonly deps: ConversationDeps,
  ) {}

  /** Where it is, for the Agents list: waiting for you, thinking, failed, or nothing going on. */
  get status(): StatusName | undefined {
    if (this.waiting) return 'needs';
    if (this.busy) return 'running';
    if (this.error) return 'failed';
    return undefined;
  }

  private changed() {
    this.items = [...this.items];
    this.deps.onChange();
  }

  /** What the person said; the model answers with the tools and instructions as they are now. */
  async send(text: string, tools: AgentTool[], instructions: string) {
    if (this.busy || this.waiting) return;
    this.items.push({ id: nextId(), from: 'person', text });
    this.messages.push({ role: 'user', content: text });
    await this.think(tools, instructions);
  }

  /** Asks again after an error, with nothing new said. */
  async retry(tools: AgentTool[], instructions: string) {
    if (this.busy || this.waiting || !this.error) return;
    await this.think(tools, instructions);
  }

  /**
   * The person allowed what the agent asked: the intent to raise, which the
   * host raises through the shell exactly as an app would. Undefined when
   * nothing was waiting on that card.
   */
  allow(item: string): Intent | undefined {
    const waiting = this.waiting;
    if (!waiting || waiting.item !== item) return undefined;
    this.waiting = undefined;
    this.answer(item, 'allowed');
    this.messages.push({ role: 'tool', toolCallId: waiting.call.id, content: `The person allowed it. ${waiting.tool.app.name} opened to do it.` });
    this.items.push({ id: nextId(), from: 'note', text: `${waiting.tool.app.name} opened.` });
    this.changed();
    return { type: waiting.tool.intent.type, payload: waiting.call.arguments };
  }

  /** The person said not now: the agent is told, and answers. */
  async decline(item: string, tools: AgentTool[], instructions: string) {
    const waiting = this.waiting;
    if (!waiting || waiting.item !== item) return;
    this.waiting = undefined;
    this.answer(item, 'declined');
    this.messages.push({ role: 'tool', toolCallId: waiting.call.id, content: 'The person said not now. It was not done.' });
    await this.think(tools, instructions);
  }

  private answer(item: string, state: 'allowed' | 'declined') {
    this.items = this.items.map((i) => (i.id === item && i.from === 'confirm' ? { ...i, state } : i));
  }

  private async think(tools: AgentTool[], instructions: string) {
    this.busy = true;
    this.error = '';
    this.changed();
    try {
      const res = await this.deps.ask({
        agent: this.agent.id,
        messages: [{ role: 'system', content: instructions }, ...this.messages.slice(-60)],
        ...(tools.length ? { tools: tools.map(({ name, description, parameters }) => ({ name, description, ...(parameters ? { parameters } : {}) })) } : {}),
      });
      const body = (await res.json().catch(() => ({}))) as ModelAnswer & { message?: unknown };
      if (!res.ok) throw new Error(typeof body.message === 'string' ? body.message : `${this.agent.name} couldn’t answer (${res.status}).`);
      this.heard(body.message as ModelAnswer['message'], tools);
    } catch (err) {
      this.error = (err as Error).message || `${this.agent.name} couldn’t answer.`;
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  /** The model's answer: what it said, and the first thing it asked to do, put to the person. Anything else it asked for is turned down. */
  private heard(message: ModelAnswer['message'], tools: AgentTool[]) {
    const calls = message.toolCalls ?? [];
    this.messages.push({ role: 'assistant', content: message.content ?? '', ...(calls.length ? { toolCalls: calls } : {}) });
    if (message.content?.trim()) this.items.push({ id: nextId(), from: 'agent', text: message.content.trim() });
    for (const call of calls) {
      const tool = tools.find((t) => t.name === call.name);
      if (!tool) {
        this.messages.push({ role: 'tool', toolCallId: call.id, content: 'There is no such tool here.' });
      } else if (this.waiting) {
        this.messages.push({ role: 'tool', toolCallId: call.id, content: 'Not done: ask for one thing at a time.' });
      } else {
        const item = nextId();
        this.waiting = { item, call, tool };
        this.items.push({ id: item, from: 'confirm', ...confirmFor(tool, call.arguments), app: tool.app.name, state: 'asking' });
      }
    }
    // A turn that ends with nothing to show still says something.
    if (!message.content?.trim() && !this.waiting) this.items.push({ id: nextId(), from: 'note', text: `${this.agent.name} had nothing to add.` });
  }
}
