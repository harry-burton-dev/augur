import { describe, expect, it, vi } from 'vitest';
import { notify, recordAudit } from './events.js';

const credentials = { name: 'library', getToken: async () => 't' };
const ok = vi.fn(async () => new Response('{}', { status: 202 }));

describe('events helpers', () => {
  it('posts notifications and audit entries to the events service', async () => {
    await notify({
      eventsUrl: 'http://events:8084',
      credentials,
      fetchImpl: ok,
      notification: { app: 'library', recipients: ['u-1'], level: 'needs', title: 'Review the budget paper' },
    });
    await recordAudit({
      eventsUrl: 'http://events:8084/',
      credentials,
      fetchImpl: ok,
      entry: { actor: { id: 'u-1', kind: 'user' }, app: 'library', action: 'document.published', target: 'doc-1' },
    });
    expect(ok.mock.calls.map(([url]) => url)).toEqual(['http://events:8084/v1/notifications', 'http://events:8084/v1/audit']);
  });
});
