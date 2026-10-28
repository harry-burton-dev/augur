import { describe, expect, it } from 'vitest';
import { providerFromEnv } from './config.ts';
import { openAiCompatible, ProviderError, standIn } from './provider.ts';

const openTool = {
  name: 'document_open',
  description: 'Open a document in Library',
  parameters: { type: 'object', properties: { title: { type: 'string' } } },
};

describe('the OpenAI-style provider', () => {
  it('sends the conversation and tools, and reads back the answer and its tool calls', async () => {
    let sent: { url: string; init: RequestInit } | undefined;
    const provider = openAiCompatible({
      baseUrl: 'https://openrouter.ai/api/v1/',
      apiKey: 'sk-test',
      model: 'some/model',
      fetchImpl: async (url, init) => {
        sent = { url: String(url), init: init! };
        return Response.json({
          model: 'some/model-2026',
          choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'document_open', arguments: '{"title":"Q3"}' } }] } }],
          usage: { prompt_tokens: 40, completion_tokens: 9 },
        });
      },
    });
    expect(provider.name).toBe('openrouter.ai');
    const answer = await provider.chat({
      messages: [
        { role: 'user', content: 'Open Q3' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'c0', name: 'document_open', arguments: { title: 'Q2' } }] },
        { role: 'tool', content: 'Opened', toolCallId: 'c0' },
      ],
      tools: [openTool],
    });
    expect(sent!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(new Headers(sent!.init.headers).get('authorization')).toBe('Bearer sk-test');
    const body = JSON.parse(String(sent!.init.body));
    expect(body.model).toBe('some/model');
    expect(body.messages[1].tool_calls[0]).toEqual({ id: 'c0', type: 'function', function: { name: 'document_open', arguments: '{"title":"Q2"}' } });
    expect(body.messages[2]).toEqual({ role: 'tool', content: 'Opened', tool_call_id: 'c0' });
    expect(body.tools[0]).toEqual({ type: 'function', function: openTool });
    expect(answer).toEqual({
      message: { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'document_open', arguments: { title: 'Q3' } }] },
      usage: { inputTokens: 40, outputTokens: 9 },
      model: 'some/model-2026',
    });
  });

  it('says what to check when the provider refuses or is out of reach', async () => {
    const answering = (status: number) => openAiCompatible({ baseUrl: 'http://litellm:4000/v1', model: 'm', fetchImpl: async () => new Response('{}', { status }) });
    await expect(answering(401).chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/check MODEL_API_KEY/);
    await expect(answering(404).chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/serves m/);
    const away = openAiCompatible({ baseUrl: 'http://litellm:4000/v1', model: 'm', fetchImpl: async () => Promise.reject(new Error('ECONNREFUSED')) });
    await expect(away.chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toBeInstanceOf(ProviderError);
  });
});

describe('embeddings', () => {
  it('asks the embedding model for a vector per text, in order', async () => {
    let sent: { url: string; body: { model: string; input: string[] } } | undefined;
    const provider = openAiCompatible({
      baseUrl: 'http://litellm:4000/v1',
      model: 'chat',
      embeddingModel: 'text-embedding-3-small',
      fetchImpl: async (url, init) => {
        sent = { url: String(url), body: JSON.parse(String(init!.body)) };
        return Response.json({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }], usage: { prompt_tokens: 6 } });
      },
    });
    expect(provider.embeddingModel).toBe('text-embedding-3-small');
    expect(await provider.embed!(['Northern Tern', 'Grey Heron'])).toEqual({ vectors: [[1, 0], [0, 1]], model: 'text-embedding-3-small', usage: { inputTokens: 6 } });
    expect(sent).toEqual({ url: 'http://litellm:4000/v1/embeddings', body: { model: 'text-embedding-3-small', input: ['Northern Tern', 'Grey Heron'] } });
    expect(openAiCompatible({ baseUrl: 'http://litellm:4000/v1', model: 'chat' }).embed).toBeUndefined();
  });

  it('refuses an answer short of a vector for each text', async () => {
    const provider = openAiCompatible({ baseUrl: 'http://x/v1', model: 'm', embeddingModel: 'e', fetchImpl: async () => Response.json({ data: [{ index: 0, embedding: [1] }] }) });
    await expect(provider.embed!(['a', 'b'])).rejects.toThrow(/a vector for each text/);
  });

  it('has the stand-in put texts spelt alike close together', async () => {
    const { vectors } = await standIn().embed!(['Northern Tern', 'N. Tern', 'Port of Rotterdam']);
    const cos = (a: number[], b: number[]) => a.reduce((n, x, i) => n + x * b[i], 0);
    expect(cos(vectors[0], vectors[1])).toBeGreaterThan(cos(vectors[0], vectors[2]));
    expect(Math.hypot(...vectors[0])).toBeCloseTo(1);
  });
});

describe('the stand-in model', () => {
  it('offers the tool that matches what was said, and says what it is otherwise', async () => {
    const model = standIn();
    const asked = await model.chat({ messages: [{ role: 'user', content: 'Please open the Q3 document' }], tools: [openTool] });
    expect(asked.message.toolCalls).toEqual([{ id: 'call-1', name: 'document_open', arguments: { title: 'Please open the Q3 document' } }]);
    const chat = await model.chat({ messages: [{ role: 'user', content: 'Hello there' }], tools: [openTool] });
    expect(chat.message.content).toMatch(/stand-in model.*Hello there/);
    const after = await model.chat({ messages: [{ role: 'tool', content: 'The person said not now.', toolCallId: 'c' }] });
    expect(after.message.content).toBe('All right, I’ll leave that.');
  });
});

describe('the model from the server’s settings', () => {
  it('is none, the stand-in, or an OpenAI-style API with a named model', () => {
    expect(providerFromEnv({})).toBeUndefined();
    expect(providerFromEnv({ MODEL_API_URL: 'stand-in' })?.name).toBe('stand-in');
    expect(providerFromEnv({ MODEL_API_URL: 'http://litellm:4000/v1', MODEL_NAME: 'gpt-4o-mini' })).toMatchObject({ name: 'litellm:4000', model: 'gpt-4o-mini' });
    expect(() => providerFromEnv({ MODEL_API_URL: 'http://litellm:4000/v1' })).toThrow(/MODEL_NAME/);
    expect(providerFromEnv({ MODEL_API_URL: 'http://litellm:4000/v1', MODEL_NAME: 'm', MODEL_EMBEDDING_NAME: 'e' })?.embeddingModel).toBe('e');
    expect(() => providerFromEnv({ MODEL_API_URL: 'litellm' })).toThrow(/http/);
  });
});
