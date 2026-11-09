import type { AppManifestEntry } from '@augur/mfe-sdk';
import { CURRENT_SDK } from '../current-sdk.js';
import { describe, expect, it, vi } from 'vitest';
import { DEV_EVENT, DEV_INBOX, devHome, devUser, standInFetch } from './standin.js';

const app: AppManifestEntry = { id: 'hello', name: 'Hello', route: '/hello', entry: '/@fs/apps/hello/frontend/src/entry.ts', version: '0.0.0', sdk: CURRENT_SDK, requiredRole: 'editor' };

describe('the stand-in platform', () => {
  it('signs in a person who has the role the app needs, and any extra', () => {
    expect(devUser(app, ['admin']).roles).toEqual(['admin', 'editor']);
    expect(devUser({ ...app, requiredRole: undefined }).roles).toEqual([]);
  });

  it('lists Home and the app being developed', async () => {
    const res = await standInFetch(app)('/api/registry/v1/manifest');
    expect(await res.json()).toEqual([devHome, app]);
    expect(await (await standInFetch(devHome)('/api/registry/v1/manifest')).json()).toEqual([devHome]);
  });

  it('lists the other apps it was given beside them', async () => {
    const folio: AppManifestEntry = { id: 'folio', name: 'Folio', route: '/folio', entry: '/apps/folio/entry.js', version: '0.1.0', sdk: CURRENT_SDK };
    const res = await standInFetch(app, undefined, [folio, app])('/api/registry/v1/manifest');
    expect(await res.json()).toEqual([devHome, app, folio]);
  });

  it('keeps preferences until the page reloads', async () => {
    const f = standInFetch(app);
    await f('/api/identity/v1/me/preferences', { method: 'PUT', body: JSON.stringify({ away: true }) });
    expect(await (await f('/api/identity/v1/me/preferences')).json()).toEqual({ away: true });
  });

  it('holds the notification stream open until the shell stops listening', async () => {
    const stop = new AbortController();
    const res = await standInFetch(app)('/api/events/v1/notifications/stream', { signal: stop.signal });
    const read = res.body!.getReader().read();
    stop.abort();
    await expect(read).rejects.toThrow('Aborted');
  });

  it('streams a domain event sent from the page, on the topics and floor asked for', async () => {
    const stop = new AbortController();
    const res = await standInFetch(app)('/api/events/v1/domain-events/stream?topics=hello.*', { headers: { 'x-workspace-id': 'dev-me' }, signal: stop.signal });
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    expect((await reader.read()).value).toContain(': connected');
    const send = (detail: object) => window.dispatchEvent(new CustomEvent(DEV_EVENT, { detail }));
    send({ topic: 'other.thing.changed' });
    send({ topic: 'hello.greeting.changed', workspace: 'dev-org' });
    send({ topic: 'hello.greeting.changed', payload: { greeting: 'g1' } });
    const text = (await reader.read()).value!;
    expect(text).toContain('event: domain-event');
    expect(JSON.parse(text.split('data: ')[1])).toMatchObject({ topic: 'hello.greeting.changed', publisher: 'hello', workspace: { id: 'dev-me' }, payload: { greeting: 'g1' } });
    stop.abort();
  });

  it('keeps an inbox: an item sent from the page is listed and counted, the stream says so, and marking it done closes it', async () => {
    const f = standInFetch({ ...app, inbox: { kinds: [{ id: 'check', label: 'To check' }] } });
    const stop = new AbortController();
    const reader = (await f('/api/events/v1/notifications/stream', { signal: stop.signal })).body!.pipeThrough(new TextDecoderStream()).getReader();
    window.dispatchEvent(new CustomEvent(DEV_INBOX, { detail: { title: 'Check this', allow: { selfComplete: true } } }));
    expect((await reader.read()).value).toContain('event: inbox');
    const [item] = await (await f('/api/events/v1/inbox?tab=you')).json();
    expect(item).toMatchObject({ app: 'hello', kind: 'check', title: 'Check this', state: 'open', owner: { kind: 'person', id: 'dev-person' }, allow: { decline: true, selfComplete: true } });
    expect(await (await f('/api/events/v1/inbox/counts')).json()).toEqual({ you: 1, teams: 0, overdue: 0 });
    await f(`/api/events/v1/inbox/${item.id}/done`, { method: 'POST' });
    expect(await (await f('/api/events/v1/inbox?tab=you')).json()).toEqual([]);
    expect((await (await f('/api/events/v1/inbox?tab=done')).json())[0]).toMatchObject({ id: item.id, state: 'done' });
    stop.abort();
  });

  it("sends anything else on, such as the app's own service", async () => {
    const real = vi.fn(async () => new Response('ok'));
    await standInFetch(app, real)('/api/hello/v1/greeting');
    expect(real).toHaveBeenCalledWith('/api/hello/v1/greeting', undefined);
  });
});
