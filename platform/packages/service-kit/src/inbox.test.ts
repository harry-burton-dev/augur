import { describe, expect, it, vi } from 'vitest';
import { getInboxItem, inboxItem, updateInboxItem } from './inbox.js';

const credentials = { name: 'mandate', getToken: async () => 't' };

describe('inbox calls', () => {
  it('puts, changes and reads an item by the app’s own key, on the floor named', async () => {
    const sent = vi.fn(async () => new Response('{"id":"i-1"}', { status: 200 }));
    const base = { eventsUrl: 'http://events:8084/', credentials, fetchImpl: sent, app: 'mandate', key: 'intent/42', workspace: 'team-1' };
    await inboxItem({ ...base, item: { kind: 'assignment', owner: { kind: 'person', id: 'u-1' }, title: 'Plan the move', subject: { kind: 'ref', app: 'mandate', id: '42' } } });
    await updateInboxItem({ ...base, change: { state: 'done' } });
    expect(await getInboxItem(base)).toEqual({ id: 'i-1' });
    const calls = sent.mock.calls.map(([url, init]) => [url, (init as RequestInit).method, (init as RequestInit).body === undefined]);
    expect(calls).toEqual([
      ['http://events:8084/v1/inbox/items/mandate/intent%2F42', 'PUT', false],
      ['http://events:8084/v1/inbox/items/mandate/intent%2F42', 'PATCH', false],
      ['http://events:8084/v1/inbox/items/mandate/intent%2F42', 'GET', true],
    ]);
    expect(((sent.mock.calls[0][1] as RequestInit).headers as Record<string, string>)['x-workspace-id']).toBe('team-1');
  });

  it('doesn’t retry a refusal', async () => {
    const refused = vi.fn(async () => new Response('{"message":"That kind isn’t declared."}', { status: 400 }));
    await expect(
      inboxItem({ eventsUrl: 'http://events:8084', credentials, fetchImpl: refused, app: 'mandate', key: 'k', item: { kind: 'nope', owner: { kind: 'person', id: 'u-1' }, title: 't', subject: { kind: 'ref', id: '1' } } }),
    ).rejects.toThrow('answered 400: That kind isn’t declared');
    expect(refused).toHaveBeenCalledTimes(1);
  });
});
