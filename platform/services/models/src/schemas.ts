/**
 * The model gateway's wire shapes, once: Fastify validates requests against them, and
 * contracts/models.openapi.yaml is generated from them (pnpm contracts, ADR 0055).
 * A shape with an `$id` is a named schema in the contract; routes point at it with `ref`.
 */
import Type, { type Static, type TSchema } from 'typebox';

/** Points at a named schema, keeping its TypeScript type. */
export const ref = <T extends TSchema & { $id?: string }>(schema: T) => Type.Unsafe<Static<T>>(Type.Ref(schema.$id!));

/** Any JSON object: the caller's own, passed on as it is. */
const anyObject = (options: { description?: string } = {}) => Type.Unsafe<Record<string, unknown>>({ type: 'object', ...options });

export const ToolCall = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 100 }),
    name: Type.String({ maxLength: 64 }),
    arguments: anyObject(),
  },
  { $id: 'ToolCall', additionalProperties: false },
);

export const ChatMessage = Type.Object(
  {
    role: Type.Enum(['system', 'user', 'assistant', 'tool']),
    content: Type.String({ maxLength: 32_000 }),
    toolCalls: Type.Optional(Type.Array(ref(ToolCall), { maxItems: 8, description: 'On an assistant message' })),
    toolCallId: Type.Optional(Type.String({ minLength: 1, maxLength: 100, description: 'On a tool message, the call it answers' })),
  },
  { $id: 'ChatMessage', additionalProperties: false },
);

export const Tool = Type.Object(
  {
    name: Type.String({ pattern: '^[a-zA-Z0-9_-]{1,64}$' }),
    description: Type.String({ minLength: 1, maxLength: 1024 }),
    parameters: Type.Optional(anyObject({ description: 'A JSON schema for its arguments' })),
  },
  { $id: 'Tool', additionalProperties: false, description: 'Something the model may ask to use. The caller does it, never the gateway.' },
);

export const ChatRequest = Type.Object(
  {
    agent: Type.Optional(Type.String({ pattern: '^[a-z][a-z0-9-]{1,39}$', description: "A person's call only: assistant, or an AI app's id" })),
    messages: Type.Array(ref(ChatMessage), { minItems: 1, maxItems: 100 }),
    tools: Type.Optional(Type.Array(ref(Tool), { maxItems: 32 })),
  },
  { $id: 'ChatRequest', additionalProperties: false },
);

export const ChatAnswer = Type.Object(
  {
    message: Type.Object({
      role: Type.Literal('assistant'),
      content: Type.String(),
      toolCalls: Type.Optional(Type.Array(ref(ToolCall))),
    }),
    usage: Type.Object({ inputTokens: Type.Integer(), outputTokens: Type.Integer() }),
    model: Type.String({ description: 'The model that answered, as the provider names it' }),
  },
  { $id: 'ChatAnswer' },
);

export const Settings = Type.Object(
  {
    enabled: Type.Boolean(),
    dailyLimit: Type.Integer({ description: 'Calls per app per day, UTC' }),
    updatedBy: Type.Optional(Type.String()),
    updatedAt: Type.Optional(Type.String({ format: 'date-time' })),
    ready: Type.Boolean({ description: 'A model is set up on this server' }),
    provider: Type.Optional(Type.String({ description: 'Where the model is: "openrouter.ai", "stand-in"' })),
    model: Type.Optional(Type.String()),
    embeddingModel: Type.Optional(Type.String({ description: 'The model behind /embeddings, when one is set up' })),
  },
  { $id: 'Settings' },
);

export const Usage = Type.Object(
  {
    day: Type.String({ format: 'date' }),
    app: Type.String(),
    calls: Type.Integer(),
    inputTokens: Type.Integer(),
    outputTokens: Type.Integer(),
  },
  { $id: 'Usage' },
);

export const EmbeddingsRequest = Type.Object(
  { input: Type.Array(Type.String({ minLength: 1, maxLength: 8000 }), { minItems: 1, maxItems: 64 }) },
  { additionalProperties: false },
);

export const Embeddings = Type.Object(
  {
    vectors: Type.Array(Type.Array(Type.Number())),
    model: Type.String({ description: "The embedding model, as the provider names it; vectors from different models don't compare" }),
    usage: Type.Object({ inputTokens: Type.Integer() }),
  },
  { description: 'A vector per text, in the order given, all the same length' },
);

export const SettingsChange = Type.Object(
  {
    enabled: Type.Optional(Type.Boolean()),
    dailyLimit: Type.Optional(Type.Integer({ minimum: 0, maximum: 100_000 })),
  },
  { additionalProperties: false, minProperties: 1 },
);

export const ModelsStatus = Type.Object(
  {
    enabled: Type.Boolean({ description: 'Turned on, with a model set up' }),
    ready: Type.Boolean({ description: 'A model is set up on this server' }),
  },
  { description: 'The state' },
);

export const UsageReport = Type.Object(
  { dailyLimit: Type.Integer(), days: Type.Array(ref(Usage)) },
  { description: 'Use by day and app' },
);

/**
 * What every refusal carries: an RFC 9457 problem (`application/problem+json`, @augur/service-kit's
 * problemDetails), with AUGUR's `reason` and `whoCanChange`, and `error` and `message` for SDK 1.x clients.
 * A handler may send just `{ error, message }`: problemDetails adds the rest.
 */
export const Refusal = Type.Unsafe<{ error: string; message: string; [extension: string]: unknown }>(
  Type.Object(
    {
      type: Type.String({ description: 'about:blank unless the problem names its own type' }),
      title: Type.String({ description: "The status's own phrase" }),
      status: Type.Integer(),
      detail: Type.String({ description: 'Says why, and what would change it' }),
      instance: Type.Optional(Type.String()),
      reason: Type.String({ description: 'A stable code a client can switch on', examples: ['forbidden'] }),
      whoCanChange: Type.Optional(Type.String({ description: 'Who can fix it, in plain words, when someone can' })),
      error: Type.String({ description: 'The same as reason, for SDK 1.x clients' }),
      message: Type.String({ description: 'The same as detail, for SDK 1.x clients' }),
    },
    { $id: 'Refusal' },
  ),
);

/** A refusal, and when it happens. */
export const refused = (description: string) => ({ description, content: { 'application/problem+json': { schema: ref(Refusal) } } });

/** Every named schema, in the order the contract lists them. */
export const SCHEMAS = [Refusal, ChatRequest, ChatMessage, Tool, ToolCall, ChatAnswer, Settings, Usage];
