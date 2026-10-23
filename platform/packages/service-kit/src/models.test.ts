import { describe, expect, it } from 'vitest';
import { askModel } from './models.js';
import { ServiceCallError } from './service.js';

const credentials = { name: 'library', getToken: async () => 't' };

describe('askModel', () => {
  it('asks the model gateway as the app, on its floor', async () => {
    let sent: { url: string; init: RequestInit } | undefined;
    const answer = { message: { role: 'assistant', content: 'Hi' }, usage: { inputTokens: 1, outputTokens: 1 }, model: 'm' };
    const got = await askModel({
      modelsUrl: 'http://models:8085/',
      credentials,
      workspace: 'w-finance',
      messages: [{ role: 'user', content: 'Hello' }],
      fetchImpl: async (url, init) => {
        sent = { url: String(url), init: init! };
        return Response.json(answer);
      },
    });
    expect(got).toEqual(answer);
    expect(sent!.url).toBe('http://models:8085/v1/chat');
    expect(new Headers(sent!.init.headers).get('x-workspace-id')).toBe('w-finance');
    expect(JSON.parse(String(sent!.init.body))).toEqual({ messages: [{ role: 'user', content: 'Hello' }] });
  });

  it('says why when the gateway refuses', async () => {
    const refused = askModel({
      modelsUrl: 'http://models:8085',
      credentials,
      messages: [{ role: 'user', content: 'Hello' }],
      fetchImpl: async () => Response.json({ message: 'library has used its 500 model calls for today.' }, { status: 429 }),
    });
    await expect(refused).rejects.toBeInstanceOf(ServiceCallError);
    await expect(refused).rejects.toThrow('Could not ask the model: it answered 429: library has used its 500 model calls for today.');
  });
});
