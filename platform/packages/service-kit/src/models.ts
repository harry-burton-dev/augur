import { callService, type ServiceCredentials } from './service.js';

/** One turn of a conversation with the model, in the model gateway's shape. */
export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ModelToolCall[];
  /** On a tool message: the call it answers. */
  toolCallId?: string;
}

export interface ModelToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Something the model may ask the app to do. The app does it, never the gateway. */
export interface ModelTool {
  name: string;
  description: string;
  /** A JSON schema for its arguments. */
  parameters?: Record<string, unknown>;
}

export interface ModelAnswer {
  message: { role: 'assistant'; content: string; toolCalls?: ModelToolCall[] };
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

export interface AskModelOptions {
  /** The model gateway's internal address, e.g. http://models:8085. */
  modelsUrl: string;
  credentials: ServiceCredentials;
  /** The floor it's for; the app needs models:use granted there. */
  workspace?: string;
  messages: ModelMessage[];
  tools?: ModelTool[];
  fetchImpl?: typeof fetch;
}

/**
 * Asks the model, through the platform's model gateway, as the app: no app
 * holds a provider's key. Needs the `models:use` scope, counts against the
 * app's calls a day, and is recorded in the audit log. Throws ServiceCallError
 * when models are off, the limit is reached or the provider fails.
 */
export const askModel = async ({ modelsUrl, credentials, workspace, messages, tools, fetchImpl }: AskModelOptions): Promise<ModelAnswer> =>
  (await callService({
    method: 'POST',
    url: `${modelsUrl.replace(/\/$/, '')}/v1/chat`,
    credentials,
    body: { messages, ...(tools?.length ? { tools } : {}) },
    what: 'ask the model',
    workspace,
    fetchImpl,
  })) as ModelAnswer;
