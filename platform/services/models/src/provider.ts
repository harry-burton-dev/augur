/**
 * The model behind the gateway. The platform speaks one shape of chat to it,
 * the OpenAI-style chat completions API, which OpenRouter, LiteLLM and most
 * providers and local servers answer; which one is the server's setting
 * (MODEL_API_URL), never an app's.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** What an assistant message asked to use. */
  toolCalls?: ToolCall[];
  /** On a tool message: the call it answers. */
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Something the model may ask to use: the caller does it, never the gateway. */
export interface Tool {
  name: string;
  description: string;
  /** A JSON schema for the arguments, as an object. */
  parameters?: Record<string, unknown>;
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: Tool[];
}

export interface ChatAnswer {
  message: { role: 'assistant'; content: string; toolCalls?: ToolCall[] };
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

export interface Embeddings {
  /** One per text, in the order given; all the same length. */
  vectors: number[][];
  model: string;
  usage: { inputTokens: number };
}

export interface ModelProvider {
  /** Where it is, for admins: "openrouter.ai", "stand-in". */
  name: string;
  model: string;
  chat(request: ChatRequest): Promise<ChatAnswer>;
  /** The embedding model, when one is set up: what turns text into vectors, to match by meaning. */
  embeddingModel?: string;
  embed?(texts: string[]): Promise<Embeddings>;
}

/** The provider failed or refused; `status` is what to answer the caller with. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: 502 | 504 = 502,
  ) {
    super(message);
  }
}

interface OpenAiMessage {
  role: string;
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

const toOpenAi = (m: ChatMessage): OpenAiMessage => ({
  role: m.role,
  content: m.content,
  ...(m.toolCalls?.length
    ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: JSON.stringify(c.arguments) } })) }
    : {}),
  ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
});

/** A model's arguments are text it wrote: anything that isn't a JSON object counts as none. */
const parseArguments = (text: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(text || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

export interface OpenAiCompatibleOptions {
  /** The API's base, e.g. https://openrouter.ai/api/v1 or http://litellm:4000/v1; `/chat/completions` is added. */
  baseUrl: string;
  apiKey?: string;
  model: string;
  /** The model that turns text into vectors (`/embeddings` is added), when the API has one. */
  embeddingModel?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export const openAiCompatible = ({ baseUrl, apiKey, model, embeddingModel, timeoutMs = 60_000, fetchImpl = fetch }: OpenAiCompatibleOptions): ModelProvider => {
  const base = baseUrl.replace(/\/$/, '');
  /** Posts to the API, turning what goes wrong into words for whoever set it up. */
  const post = async (path: string, which: string, body: object) => {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if ((err as Error).name === 'TimeoutError') throw new ProviderError(`The model took longer than ${timeoutMs / 1000} seconds to answer.`, 504);
      throw new ProviderError(`The model provider can’t be reached (${(err as Error).message}).`);
    }
    if (!res.ok) {
      const why = res.status === 401 || res.status === 403 ? ': check MODEL_API_KEY' : res.status === 404 ? `: check MODEL_API_URL and that it serves ${which}` : '';
      throw new ProviderError(`The model provider answered ${res.status}${why}.`);
    }
    return res;
  };
  return {
    name: new URL(baseUrl).host,
    model,
    async chat({ messages, tools }) {
      const res = await post('/chat/completions', model, {
        model,
        messages: messages.map(toOpenAi),
        ...(tools?.length ? { tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters ?? { type: 'object', properties: {} } } })) } : {}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        model?: string;
        choices?: { message?: OpenAiMessage }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const said = body.choices?.[0]?.message;
      if (!said) throw new ProviderError('The model provider answered without a message.');
      const toolCalls = (said.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, arguments: parseArguments(c.function.arguments) }));
      return {
        message: { role: 'assistant', content: said.content ?? '', ...(toolCalls.length ? { toolCalls } : {}) },
        usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 },
        model: body.model ?? model,
      };
    },
    ...(embeddingModel
      ? {
          embeddingModel,
          async embed(texts: string[]): Promise<Embeddings> {
            const res = await post('/embeddings', embeddingModel, { model: embeddingModel, input: texts });
            const body = (await res.json().catch(() => ({}))) as { model?: string; data?: { index?: number; embedding?: number[] }[]; usage?: { prompt_tokens?: number } };
            const data = [...(body.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
            const vectors = data.map((d) => d.embedding ?? []);
            if (vectors.length !== texts.length || vectors.some((v) => !v.length || v.length !== vectors[0].length)) {
              throw new ProviderError('The model provider answered without a vector for each text.');
            }
            return { vectors, model: body.model ?? embeddingModel, usage: { inputTokens: body.usage?.prompt_tokens ?? 0 } };
          },
        }
      : {}),
  };
};

/** The stand-in's vectors' length. */
const STAND_IN_DIMENSIONS = 256;

/**
 * The stand-in's vectors: letter triples hashed into a fixed number of slots
 * and scaled to length 1. Texts spelt alike come out close; it knows nothing
 * of meaning, but the whole path can be tried without a provider.
 */
const standInVector = (text: string) => {
  const v = new Array<number>(STAND_IN_DIMENSIONS).fill(0);
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  for (let i = 0; i + 3 <= t.length; i++) {
    let h = 2166136261;
    for (const c of t.slice(i, i + 3)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    v[(h >>> 0) % STAND_IN_DIMENSIONS] += 1;
  }
  const length = Math.hypot(...v) || 1;
  return v.map((x) => x / length);
};

const words = (text: string) => text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
const count = (messages: ChatMessage[]) => messages.reduce((n, m) => n + words(m.content).length, 0);

/**
 * A model that doesn't think, for trying the platform without a provider:
 * the dev stack, tests, a server not ready for a real one. It offers the tool
 * whose name and description best match what the person last said, and
 * otherwise says plainly what it is.
 */
export const standIn = (): ModelProvider => ({
  name: 'stand-in',
  model: 'stand-in',
  embeddingModel: 'stand-in',
  async embed(texts) {
    return { vectors: texts.map(standInVector), model: 'stand-in', usage: { inputTokens: texts.reduce((n, t) => n + words(t).length, 0) } };
  },
  async chat({ messages, tools = [] }) {
    const last = messages[messages.length - 1];
    const answer = (message: ChatAnswer['message']): ChatAnswer => ({
      message,
      usage: { inputTokens: count(messages), outputTokens: words(message.content).length },
      model: 'stand-in',
    });
    if (last?.role === 'tool') return answer({ role: 'assistant', content: /declin|not now|refus/i.test(last.content) ? 'All right, I’ll leave that.' : 'Done.' });
    const said = last?.role === 'user' ? last.content : '';
    const asked = new Set(words(said));
    const best = tools
      .map((tool) => ({ tool, hits: [...new Set(words(`${tool.name.replace(/[_.-]/g, ' ')} ${tool.description}`))].filter((w) => asked.has(w)).length }))
      .filter((t) => t.hits > 0)
      .sort((a, b) => b.hits - a.hits)[0];
    if (best) {
      // Its first text argument gets what the person said: enough to see an action go through end to end.
      const props = (best.tool.parameters?.properties ?? {}) as Record<string, { type?: string }>;
      const first = Object.entries(props).find(([, p]) => p.type === 'string')?.[0];
      return answer({ role: 'assistant', content: '', toolCalls: [{ id: `call-${messages.length}`, name: best.tool.name, arguments: first ? { [first]: said } : {} }] });
    }
    return answer({ role: 'assistant', content: `I’m a stand-in model, so I can’t really answer. You said: “${said.slice(0, 200)}”` });
  },
});
