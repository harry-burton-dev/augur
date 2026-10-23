import { describe, expect, it } from 'vitest';
import { registryClient } from './registry.ts';
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
});
