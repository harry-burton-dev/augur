import { describe, expect, it, vi } from 'vitest';
import { floorMembers, floorPlaces, FloorsUnavailable, ruleChain } from './floors.js';

const credentials = { name: 'registry', getToken: async () => 'registry-token' };

describe('floor places', () => {
  it('asks identity once per floor while the answer is fresh, as a platform service', async () => {
    let t = 0;
    const payroll = { id: 'p', kind: 'team', path: ['o', 'f', 'p'], org: 'o' };
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer registry-token');
      return String(url).endsWith('/p') ? Response.json(payroll) : new Response(null, { status: 404 });
    });
    const places = floorPlaces({ identityUrl: 'http://identity/', credentials, fetchImpl: fetchImpl as typeof fetch, now: () => t });
    expect(await places('p')).toEqual(payroll);
    expect(await places('p')).toEqual(payroll);
    expect(await places('gone')).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0][0])).toBe('http://identity/v1/workspaces/p');
    t = 30_001;
    await places('p');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('fails when identity can’t say', async () => {
    const down = floorPlaces({ identityUrl: 'http://identity', credentials, fetchImpl: (async () => new Response(null, { status: 502 })) as typeof fetch });
    await expect(down('p')).rejects.toBeInstanceOf(FloorsUnavailable);
  });

  it('puts a personal floor under the org for rules', () => {
    expect(ruleChain({ id: 'me', kind: 'personal', path: ['me'], org: 'o' })).toEqual(['o', 'me']);
    expect(ruleChain({ id: 'p', kind: 'team', path: ['o', 'f', 'p'], org: 'o' })).toEqual(['o', 'f', 'p']);
  });

  it('asks who is on a team every time', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => (String(url).endsWith('/f/people') ? Response.json({ people: ['u-1', 'u-2'] }) : new Response(null, { status: 404 })));
    const members = floorMembers({ identityUrl: 'http://identity', credentials, fetchImpl: fetchImpl as typeof fetch });
    expect(await members('f')).toEqual(['u-1', 'u-2']);
    expect(await members('f')).toEqual(['u-1', 'u-2']);
    expect(await members('gone')).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const down = floorMembers({ identityUrl: 'http://identity', credentials, fetchImpl: (async () => new Response(null, { status: 500 })) as typeof fetch });
    await expect(down('f')).rejects.toBeInstanceOf(FloorsUnavailable);
  });
});
