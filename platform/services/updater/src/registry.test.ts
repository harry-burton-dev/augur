import { describe, expect, it } from 'vitest';
import { appRunnerClient, registryClient } from './registry.ts';
import { Withdrawn } from './upgrade.ts';

const credentials = { name: 'updater', getToken: async () => 'tok' };

describe('the registry client', () => {
  it('asks for the target as the updater, and reads nothing to do', async () => {
    const seen: (string | undefined)[] = [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      seen.push((init?.headers as Record<string, string>).authorization);
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    expect(await registryClient({ registryUrl: 'http://registry:8082/', credentials, fetchImpl }).target()).toBeUndefined();
    expect(seen).toEqual(['Bearer tok']);
  });

  it('keeps reporting while the registry restarts, and stops when the upgrade is gone', async () => {
    const answers = [new Error('ECONNREFUSED'), 503, 200, 404];
    const bodies: unknown[] = [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      const next = answers.shift()!;
      if (next instanceof Error) throw next;
      return new Response('{}', { status: next });
    }) as typeof fetch;
    const report = registryClient({ registryUrl: 'http://registry:8082', credentials, retryMs: 1, fetchImpl }).reporter('up-1');
    await report({ step: 'roll-forward', state: 'running' });
    expect(bodies).toHaveLength(3);
    expect(bodies[0]).toEqual({ id: 'up-1', step: 'roll-forward', state: 'running' });
    await expect(report({ step: 'verify', state: 'done' })).rejects.toBeInstanceOf(Withdrawn);
  });

  it('gives the registry a version’s frontend bundle as gzip, as the updater', async () => {
    const seen: { url: string; method?: string; type?: string; bytes: number; auth?: string }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      seen.push({ url, method: init?.method, type: headers['content-type'], bytes: (init?.body as Uint8Array).byteLength, auth: headers.authorization });
      return seen.length === 1 ? new Response('{}', { status: 201 }) : Response.json({ message: 'This deployment doesn’t keep apps’ frontends by version.' }, { status: 501 });
    }) as typeof fetch;
    const apps = appRunnerClient({ registryUrl: 'http://registry:8082/', identityUrl: 'http://identity:8081', credentials, oidc: { tokenUrl: 'http://k/token' }, fetchImpl });
    await apps.calls.putFrontend('notes', '1.0.0', Buffer.from('gzip bytes'));
    expect(seen).toEqual([{ url: 'http://registry:8082/v1/apps/notes/versions/1.0.0/frontend', method: 'PUT', type: 'application/gzip', bytes: 10, auth: 'Bearer tok' }]);
    await expect(apps.calls.putFrontend('notes', '1.0.0', Buffer.from('x'))).rejects.toThrow('The registry didn’t keep notes 1.0.0’s frontend: it answered 501, This deployment doesn’t keep apps’ frontends by version.');
  });

  it('tells the registry the deployment’s own networks, as the updater', async () => {
    const seen: { url: string; method?: string; body: unknown; auth?: string }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      seen.push({ url, method: init?.method, body: JSON.parse(String(init?.body)), auth: (init?.headers as Record<string, string>).authorization });
      return new Response('{}', { status: seen.length === 1 ? 200 : 400 });
    }) as typeof fetch;
    const apps = appRunnerClient({ registryUrl: 'http://registry:8082/', identityUrl: 'http://identity:8081', credentials, oidc: { tokenUrl: 'http://k/token' }, fetchImpl });
    await apps.setOwnNetworks(['172.18.0.0/16']);
    expect(seen).toEqual([{ url: 'http://registry:8082/v1/runner/networks', method: 'PUT', body: { networks: ['172.18.0.0/16'] }, auth: 'Bearer tok' }]);
    await expect(apps.setOwnNetworks(['x'])).rejects.toThrow('The registry didn’t take the deployment’s own networks: it answered 400.');
  });
});
