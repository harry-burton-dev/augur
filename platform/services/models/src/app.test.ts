import { afterEach, describe, expect, it } from 'vitest';
import { callerHeaders, GrantsUnavailable, serviceHeaders, type NewAuditEntry, type Scope } from '@augur/service-kit';
import { buildApp, type ModelsOptions } from './app.ts';
import { standIn, type ModelProvider } from './provider.ts';
import { DATABASE_URL, modelsDb } from './db.testing.ts';

const alex = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
const sam = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'], workspace: { id: 'w-finance', kind: 'team', role: 'member' } });
// Stands in for Keycloak: "Bearer app-<id>" is that app's token, "Bearer platform-<name>" a platform service's.
const verifyService = async (headers: Record<string, string | string[] | undefined>) => {
  const m = /^Bearer (app|platform)-(\S+)$/.exec(String(headers.authorization ?? ''));
  return m ? (m[1] === 'app' ? { kind: 'app' as const, app: m[2] } : { kind: 'platform' as const, name: m[2] }) : undefined;
};
const asApp = (app: string, workspace?: string) =>
  serviceHeaders({ name: app, getToken: async () => `app-${app}` }).then((h) => ({ ...h, ...(workspace ? { 'x-workspace-id': workspace } : {}) }));
// Library may use models on Finance only; Scribe, an AI app, everywhere.
const grants = async (app: string, workspace?: string): Promise<Scope[]> =>
  app === 'scribe' || (app === 'library' && workspace === 'w-finance') ? ['models:use'] : [];
// Scribe needs no role of its own unless a test says so.
const requiredRole = async (): Promise<string | null> => null;
const hello = { messages: [{ role: 'user', content: 'Hello' }] };

const db = modelsDb();

type App = Awaited<ReturnType<typeof buildApp>>;
let open: App | undefined;
afterEach(async () => {
  await open?.close();
  open = undefined;
});

/** A gateway with the stand-in model, turned on, recording into `audited`. */
const start = async (options: Partial<ModelsOptions> = {}, { on = true } = {}) => {
  const audited: { entry: NewAuditEntry; workspace?: string }[] = [];
  const store = options.store ?? db.store;
  if (on) await store.saveSettings({ enabled: true, dailyLimit: 500 }, 'u-1');
  open = await buildApp({ provider: standIn(), verifyService, grants, requiredRole, audit: async (entry, workspace) => void audited.push({ entry, workspace }), store, ...options });
  return { app: open, audited, store };
};

describe.runIf(DATABASE_URL)('models', () => {
  it('reports healthy', async () => {
    const { app } = await start();
    expect((await app.inject({ method: 'GET', url: '/healthz' })).json()).toMatchObject({ status: 'ok', service: 'models', api: 'v1' });
  });

  it('lets a person talk to the shell’s assistant, and records that they did but not what they said', async () => {
    const { app, audited, store } = await start();
    const res = await app.inject({ method: 'POST', url: '/v1/chat', headers: sam, payload: { agent: 'assistant', ...hello } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ message: { role: 'assistant', content: expect.stringContaining('Hello') }, model: 'stand-in' });
    expect(audited).toEqual([
      { entry: { actor: { id: 'u-2', kind: 'user' }, app: 'assistant', action: 'model.called', detail: { model: 'stand-in', messages: 1 } }, workspace: 'w-finance' },
    ]);
    expect(JSON.stringify(audited)).not.toContain('Hello');
    expect((await store.usage('2026-01-01'))[0]).toMatchObject({ app: 'assistant', calls: 1, inputTokens: 1 });
  });

  it('lets an app’s service call for itself only where it is granted models:use', async () => {
    const { app, audited } = await start();
    const call = async (headers: Record<string, string>, payload: object = hello) => app.inject({ method: 'POST', url: '/v1/chat', headers, payload });
    expect((await call(await asApp('library', 'w-finance'))).statusCode).toBe(200);
    expect(audited[0]).toMatchObject({ entry: { actor: { id: 'library', kind: 'service' }, app: 'library' }, workspace: 'w-finance' });
    const elsewhere = await call(await asApp('library', 'w-legal'));
    expect([elsewhere.statusCode, elsewhere.json().message]).toEqual([403, 'library isn’t granted models:use on that floor.']);
    expect((await call(await asApp('other'))).statusCode).toBe(403);
  });

  it('lets a person talk to an AI app’s agent only where that app is granted models:use', async () => {
    const { app } = await start();
    const call = (agent: string) => app.inject({ method: 'POST', url: '/v1/chat', headers: sam, payload: { agent, ...hello } });
    expect((await call('scribe')).statusCode).toBe(200);
    expect((await call('other')).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/v1/chat', headers: sam, payload: hello })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/v1/chat', payload: { agent: 'assistant', ...hello } })).statusCode).toBe(401);
  });

  it('passes tools to the model and its tool calls back', async () => {
    const { app, audited } = await start();
    const tools = [{ name: 'document_open', description: 'Open a document in Library', parameters: { type: 'object', properties: { title: { type: 'string' } } } }];
    const res = await app.inject({ method: 'POST', url: '/v1/chat', headers: sam, payload: { agent: 'assistant', messages: [{ role: 'user', content: 'open the budget document' }], tools } });
    expect(res.json().message.toolCalls).toEqual([{ id: 'call-1', name: 'document_open', arguments: { title: 'open the budget document' } }]);
    expect(audited[0].entry.detail).toEqual({ model: 'stand-in', messages: 1, tools: ['document_open'] });
    const bad = await app.inject({ method: 'POST', url: '/v1/chat', headers: sam, payload: { agent: 'assistant', ...hello, tools: [{ name: 'has spaces', description: 'x' }] } });
    expect(bad.statusCode).toBe(400);
  });

  it('holds each app to its calls a day', async () => {
    const store = db.store;
    await store.saveSettings({ enabled: true, dailyLimit: 2 }, 'u-1');
    const { app } = await start({ store }, { on: false });
    const call = (agent: string) => app.inject({ method: 'POST', url: '/v1/chat', headers: sam, payload: { agent, ...hello } });
    expect((await call('assistant')).statusCode).toBe(200);
    expect((await call('assistant')).statusCode).toBe(200);
    const third = await call('assistant');
    expect([third.statusCode, third.json().message]).toEqual([429, 'assistant has used its 2 model calls for today. More are allowed from midnight UTC.']);
    expect((await call('scribe')).statusCode).toBe(200);
  });

  it('makes no call while off, without a model, or when it can’t be recorded', async () => {
    const off = await start({}, { on: false });
    const call = (app: App) => app.inject({ method: 'POST', url: '/v1/chat', headers: sam, payload: { agent: 'assistant', ...hello } });
    expect((await call(off.app)).statusCode).toBe(403);
    await off.app.close();
    const failing = await start({ audit: async () => Promise.reject(new Error('events is down')) });
    expect((await call(failing.app)).statusCode).toBe(503);
    expect(await failing.store.usage('2026-01-01')).toMatchObject([{ calls: 1, inputTokens: 0 }]);
    await failing.app.close();
    const unchecked = await start({ grants: async () => Promise.reject(new GrantsUnavailable('down')) });
    expect((await unchecked.app.inject({ method: 'POST', url: '/v1/chat', headers: sam, payload: { agent: 'scribe', ...hello } })).statusCode).toBe(503);
  });

  it('holds a person to the role an AI app needs, as the gateway holds its own API', async () => {
    const chat = (app: App, headers: Record<string, string>) => app.inject({ method: 'POST', url: '/v1/chat', headers, payload: { agent: 'scribe', ...hello } });
    const analysts = await start({ requiredRole: async (app) => (app === 'scribe' ? 'analyst' : null) });
    const refused = await chat(analysts.app, sam);
    expect(refused.statusCode).toBe(403);
    expect(refused.json().message).toBe('scribe needs the analyst role, which an admin can give you.');
    // Nothing was spent or recorded for the refused call.
    expect(analysts.audited).toEqual([]);
    const analyst = callerHeaders({ id: 'u-3', name: 'Ana', departments: [], roles: ['analyst'], workspace: { id: 'w-finance', kind: 'team', role: 'member' } });
    expect((await chat(analysts.app, analyst)).statusCode).toBe(200);
    // The shell's own assistant needs no app role.
    expect((await analysts.app.inject({ method: 'POST', url: '/v1/chat', headers: sam, payload: { agent: 'assistant', ...hello } })).statusCode).toBe(200);
    await analysts.app.close();
    // A registry that can't say is a refusal for now, not a way in.
    const unsure = await start({ requiredRole: async () => undefined });
    expect((await chat(unsure.app, sam)).statusCode).toBe(503);
  });

  it('answers with the provider’s problem in words', async () => {
    const { ProviderError } = await import('./provider.ts');
    const broken: ModelProvider = { name: 'example', model: 'm', chat: async () => Promise.reject(new ProviderError('The model provider answered 401: check MODEL_API_KEY.')) };
    const { app } = await start({ provider: broken });
    const res = await app.inject({ method: 'POST', url: '/v1/chat', headers: sam, payload: { agent: 'assistant', ...hello } });
    expect([res.statusCode, res.json().message]).toEqual([502, 'The model provider answered 401: check MODEL_API_KEY.']);
  });

  it('tells anyone signed in whether agents can be used', async () => {
    const on = await start();
    expect((await on.app.inject({ method: 'GET', url: '/v1/status', headers: sam })).json()).toEqual({ enabled: true, ready: true });
    expect((await on.app.inject({ method: 'GET', url: '/v1/status' })).statusCode).toBe(401);
    await on.app.close();
    const none = await start({ provider: undefined });
    expect((await none.app.inject({ method: 'GET', url: '/v1/status', headers: sam })).json()).toEqual({ enabled: false, ready: false });
  });

  it('lets only admins turn models on and off and set the limit, recording each change', async () => {
    const { app, audited } = await start({}, { on: false });
    const put = (headers: Record<string, string>, payload: object) => app.inject({ method: 'PUT', url: '/v1/settings', headers, payload });
    expect((await put(sam, { enabled: true })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/v1/settings', headers: sam })).statusCode).toBe(403);
    const turned = await put(alex, { enabled: true, dailyLimit: 50 });
    expect(turned.json()).toMatchObject({ enabled: true, dailyLimit: 50, updatedBy: 'u-1', ready: true, provider: 'stand-in', model: 'stand-in' });
    expect(audited.map((a) => a.entry.action)).toEqual(['models.turned-on', 'models.limit-changed']);
    expect(audited[1].entry.detail).toEqual({ from: 500, to: 50 });
    await put(alex, { dailyLimit: 50 });
    expect(audited).toHaveLength(2);
    expect((await put(alex, {})).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/v1/settings', headers: alex })).json()).toMatchObject({ enabled: true, dailyLimit: 50 });
  });

  it('won’t turn on without a model, nor change anything it can’t record', async () => {
    const none = await start({ provider: undefined }, { on: false });
    const res = await none.app.inject({ method: 'PUT', url: '/v1/settings', headers: alex, payload: { enabled: true } });
    expect(res.statusCode).toBe(409);
    await none.app.close();
    const failing = await start({ audit: async () => Promise.reject(new Error('down')) }, { on: false });
    expect((await failing.app.inject({ method: 'PUT', url: '/v1/settings', headers: alex, payload: { enabled: true } })).statusCode).toBe(503);
    expect((await failing.store.settings()).enabled).toBe(false);
  });

  it('shows admins each app’s use over the last week', async () => {
    let now = new Date('2026-10-23T10:00:00Z');
    const { app } = await start({ now: () => now });
    await app.inject({ method: 'POST', url: '/v1/chat', headers: sam, payload: { agent: 'assistant', ...hello } });
    now = new Date('2026-10-24T10:00:00Z');
    await app.inject({ method: 'POST', url: '/v1/chat', headers: sam, payload: { agent: 'scribe', ...hello } });
    const usage = (await app.inject({ method: 'GET', url: '/v1/usage', headers: alex })).json();
    expect(usage.dailyLimit).toBe(500);
    expect(usage.days.map((u: { day: string; app: string; calls: number }) => [u.day, u.app, u.calls])).toEqual([
      ['2026-10-24', 'scribe', 1],
      ['2026-10-23', 'assistant', 1],
    ]);
  });

  it('turns an app’s texts into vectors, as one call, recorded without the texts', async () => {
    const { app, audited, store } = await start();
    const res = await app.inject({ method: 'POST', url: '/v1/embeddings', headers: await asApp('scribe', 'w-finance'), payload: { input: ['Northern Tern', 'N. Tern'] } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ model: 'stand-in', vectors: [expect.any(Array), expect.any(Array)] });
    expect(audited).toEqual([{ entry: { actor: { id: 'scribe', kind: 'service' }, app: 'scribe', action: 'model.embedded', detail: { model: 'stand-in', texts: 2 } }, workspace: 'w-finance' }]);
    expect(JSON.stringify(audited)).not.toContain('Tern');
    expect((await store.usage('2026-01-01'))[0]).toMatchObject({ app: 'scribe', calls: 1 });
    // People don't ask for vectors; apps that aren't granted models:use there don't either.
    expect((await app.inject({ method: 'POST', url: '/v1/embeddings', headers: sam, payload: { input: ['x'] } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/v1/embeddings', headers: await asApp('library', 'w-legal'), payload: { input: ['x'] } })).statusCode).toBe(403);
  });

  it('says when there’s no embedding model to ask', async () => {
    const chatOnly: ModelProvider = { ...standIn(), embed: undefined, embeddingModel: undefined };
    const { app } = await start({ provider: chatOnly });
    const res = await app.inject({ method: 'POST', url: '/v1/embeddings', headers: await asApp('scribe'), payload: { input: ['x'] } });
    expect(res.statusCode).toBe(503);
    expect(res.json().message).toMatch(/MODEL_EMBEDDING_NAME/);
    expect((await app.inject({ method: 'GET', url: '/v1/settings', headers: alex })).json().embeddingModel).toBeUndefined();
  });
});
