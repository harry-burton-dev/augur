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

  it('says a preview’s notifications and audit entries come from it', async () => {
    const sent = vi.fn(async () => new Response('{}', { status: 202 }));
    const env = { APP_PREVIEW: 'pr-12' };
    await notify({ eventsUrl: 'http://events:8084', credentials, fetchImpl: sent, env, notification: { app: 'notes', recipients: ['u-1'], level: 'info', title: 'Saved' } });
    await recordAudit({ eventsUrl: 'http://events:8084', credentials, fetchImpl: sent, env, entry: { actor: { id: 'u-1', kind: 'user' }, app: 'notes', action: 'note.saved', detail: { words: 3 } } });
    const bodies = sent.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    expect(bodies[0].title).toBe('Preview #12: Saved');
    expect(bodies[1].detail).toEqual({ words: 3, preview: 12 });
  });
});
