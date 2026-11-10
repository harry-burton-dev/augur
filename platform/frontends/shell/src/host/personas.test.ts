import { describe, expect, it, vi } from 'vitest';
import { ActingAs, PERSONA_HEADER, PersonaClient, PersonaError, withPersona, type ActingSession } from './personas.js';

const at = Date.parse('2026-11-20T09:00:00Z');
const session = (endsAt = '2026-11-20T10:00:00.000Z'): ActingSession => ({ id: 's-1', persona: 'admin.amara', reason: 'Upgrade', startedAt: '2026-11-20T09:00:00.000Z', endsAt });

describe('acting as an admin persona', () => {
  it('keeps the live session until its time, telling who listens', () => {
    let now = at;
    const acting = new ActingAs(() => now);
    const heard = vi.fn();
    acting.subscribe(heard);
    acting.set(session());
    expect(acting.persona()).toBe('admin.amara');
    expect(heard).toHaveBeenCalledTimes(1);
    now = Date.parse('2026-11-20T10:00:01Z');
    expect(acting.persona()).toBeUndefined();
    expect(acting.current()).toBeUndefined();
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('never keeps a session that has already ended', () => {
    const acting = new ActingAs(() => at);
    acting.set(session('2026-11-20T08:59:00.000Z'));
    expect(acting.current()).toBeUndefined();
  });

  it('sends the persona only to the gateway on this site, and ends the session when the gateway says it has', async () => {
    const acting = new ActingAs(() => at);
    acting.set(session());
    const sent: Headers[] = [];
    const answers = [Response.json({ ok: true }), Response.json({ ok: true }), Response.json({ error: 'persona_ended', message: 'Its time ran out.' }, { status: 403 })];
    const fetchImpl = (async (_: RequestInfo | URL, init?: RequestInit) => {
      sent.push(new Headers(init?.headers));
      return answers.shift() ?? Response.json({});
    }) as typeof fetch;
    const f = withPersona(fetchImpl, acting);
    await f('/api/registry/v1/platform', { headers: { authorization: 'Bearer t' } });
    expect(sent[0]!.get(PERSONA_HEADER)).toBe('admin.amara');
    expect(sent[0]!.get('authorization')).toBe('Bearer t');
    await f('https://elsewhere.example/api/x');
    expect(sent[1]!.get(PERSONA_HEADER)).toBeNull();
    const ended = await f('/api/registry/v1/platform');
    expect(ended.status).toBe(403);
    expect(acting.current()).toBeUndefined();
    await f('/api/registry/v1/platform');
    expect(sent[3]!.get(PERSONA_HEADER)).toBeNull();
  });
});

describe('the persona routes', () => {
  it('lists, starts and stops, and carries the service’s reason when it refuses', async () => {
    const calls: { url: string; method: string; body?: unknown }[] = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? 'GET', ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
      if (init?.method === 'POST') return Response.json({ reason: 'sign_in_again', detail: 'Sign in again to act as an admin persona.' }, { status: 403 });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return Response.json({ personas: [{ id: 'admin.amara', actAs: true, longestMinutes: 60 }] });
    }) as typeof fetch;
    const client = new PersonaClient({ getToken: async () => 't', fetchImpl });
    expect((await client.list()).personas).toEqual([{ id: 'admin.amara', actAs: true, longestMinutes: 60 }]);
    const refused = await client.start('admin.amara', 'Upgrade', 30).catch((err: unknown) => err);
    expect(refused).toBeInstanceOf(PersonaError);
    expect(refused).toMatchObject({ reason: 'sign_in_again', message: 'Sign in again to act as an admin persona.' });
    await client.stop();
    expect(calls).toEqual([
      { url: '/api/permissions/v1/personas', method: 'GET' },
      { url: '/api/permissions/v1/personas/admin.amara/sessions', method: 'POST', body: { reason: 'Upgrade', minutes: 30 } },
      { url: '/api/permissions/v1/personas/sessions/current', method: 'DELETE' },
    ]);
  });
});
