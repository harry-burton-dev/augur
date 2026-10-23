import { describe, expect, it, vi } from 'vitest';
import { callerHeaders } from '@platform/service-kit';
import { buildApp } from './app.ts';
import { ensureClients, KeycloakAppClients, MemoryAppClients, parseClientSecrets } from './clients.ts';
import type { KeycloakDirectory } from './directory.ts';

const admin = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });

describe('apps’ sign-ins', () => {
  it('lets an admin issue one, audited without the secret', async () => {
    const entries: unknown[] = [];
    const appClients = new MemoryAppClients();
    const app = await buildApp({ appClients, audit: async (e) => void entries.push(e) });
    const res = await app.inject({ method: 'POST', url: '/v1/admin/apps/library/credential', headers: admin });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ clientId: 'app-library', secret: appClients.secrets.get('app-library') });
    expect(entries).toEqual([{ actor: { id: 'u-1', kind: 'user' }, app: 'identity', action: 'app.credential-issued', target: 'library' }]);
    expect((await app.inject({ method: 'POST', url: '/v1/admin/apps/library/credential', headers: editor })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/v1/admin/apps/Not_An_App/credential', headers: admin })).statusCode).toBe(400);
  });

  it('answers 503 without the sign-in service', async () => {
    const app = await buildApp();
    expect((await app.inject({ method: 'POST', url: '/v1/admin/apps/library/credential', headers: admin })).statusCode).toBe(503);
  });

  it('makes a client that can only get short tokens for the platform’s services, or replaces its secret', async () => {
    const calls: [string, string, unknown][] = [];
    let exists = false;
    const call = vi.fn(async (method: string, path: string, body?: unknown) => {
      calls.push([method, path, body]);
      if (method === 'GET') return { data: exists ? [{ id: 'kc-1', clientId: 'app-library' }] : [] };
      if (path.endsWith('/client-secret')) return { data: { value: 'rotated' } };
      return { data: undefined };
    });
    const clients = new KeycloakAppClients({ call } as unknown as KeycloakDirectory);
    const made = await clients.issue('library');
    const created = calls.find(([m]) => m === 'POST')![2] as Record<string, unknown>;
    expect(created).toMatchObject({ clientId: 'app-library', publicClient: false, serviceAccountsEnabled: true, standardFlowEnabled: false, secret: made.secret });
    expect(JSON.stringify(created.protocolMappers)).toContain('platform-services');
    exists = true;
    expect(await clients.issue('library')).toEqual({ clientId: 'app-library', secret: 'rotated' });
    expect(calls.at(-1)?.slice(0, 2)).toEqual(['POST', '/clients/kc-1/client-secret']);
  });
});

describe('the server’s own sign-ins', () => {
  it('reads them from the settings', () => {
    expect(parseClientSecrets(' platform-registry=a=b , app-library=c,,broken=')).toEqual([
      ['platform-registry', 'a=b'],
      ['app-library', 'c'],
    ]);
    expect(parseClientSecrets(undefined)).toEqual([]);
  });

  it('keeps trying while the sign-in service starts', async () => {
    let up = false;
    const ensured: string[] = [];
    const clients = { issue: vi.fn(), ensure: vi.fn(async (id: string) => (up ? void ensured.push(id) : Promise.reject(new Error('down')))) };
    setTimeout(() => (up = true), 5);
    await ensureClients(clients, [['platform-events', 's']], () => undefined, 2);
    expect(ensured).toEqual(['platform-events']);
  });

  it('gives an existing client its secret back and the audience it needs', async () => {
    const calls: [string, string, unknown][] = [];
    const call = vi.fn(async (method: string, path: string, body?: unknown) => {
      calls.push([method, path, body]);
      if (path.startsWith('/clients?')) return { data: [{ id: 'kc-2', clientId: 'platform-events' }] };
      if (path.endsWith('/models') && method === 'GET') return { data: [] };
      return { data: undefined };
    });
    await new KeycloakAppClients({ call } as unknown as KeycloakDirectory).ensure('platform-events', 's3cret');
    expect(calls.map(([m, p]) => `${m} ${p}`)).toEqual([
      'GET /clients?clientId=platform-events',
      'PUT /clients/kc-2',
      'GET /clients/kc-2/protocol-mappers/models',
      'POST /clients/kc-2/protocol-mappers/models',
    ]);
    expect(calls[1][2]).toMatchObject({ secret: 's3cret', serviceAccountsEnabled: true, name: 'events (platform service)' });
  });
});
