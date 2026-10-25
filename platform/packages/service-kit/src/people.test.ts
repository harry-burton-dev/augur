import { describe, expect, it, vi } from 'vitest';
import { identityAudience, identityDirectory, identityPrincipals, PeopleUnavailable } from './people.js';

const credentials = { name: 'folio', getToken: async () => 'folio-token' };

describe('people', () => {
  it('asks identity who someone stands for once while the answer is fresh, as the app', async () => {
    let t = 0;
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer folio-token');
      return Response.json({ person: 'u-1', principals: ['person:u-1', 'org'] });
    });
    const principals = identityPrincipals({ identityUrl: 'http://identity/', credentials, fetchImpl: fetchImpl as typeof fetch, now: () => t });
    expect(await principals('u-1')).toEqual(['person:u-1', 'org']);
    await principals('u-1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toBe('http://identity/v1/people/u-1/principals');
    t = 30_001;
    await principals('u-1');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fails, without remembering it, when identity can’t say', async () => {
    let up = false;
    const fetchImpl = vi.fn(async () => (up ? Response.json({ principals: ['org'] }) : new Response(null, { status: 403 })));
    const principals = identityPrincipals({ identityUrl: 'http://identity', credentials, fetchImpl: fetchImpl as typeof fetch });
    await expect(principals('u-1')).rejects.toBeInstanceOf(PeopleUnavailable);
    up = true;
    expect(await principals('u-1')).toEqual(['org']);
  });

  it('searches the directory, and names ids', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ people: [], teams: [] }));
    const find = identityDirectory({ identityUrl: 'http://identity', credentials, fetchImpl: fetchImpl as typeof fetch });
    await find({ q: 'alex', limit: 5 });
    await find({ ids: ['u-1', 't-1'] });
    expect(await find({ ids: [] })).toEqual({ people: [], teams: [] });
    expect(fetchImpl.mock.calls.map((c) => String((c as unknown[])[0]))).toEqual(['http://identity/v1/directory?q=alex&limit=5', 'http://identity/v1/directory?ids=u-1%2Ct-1']);
  });

  it('asks who an audience reaches', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ people: ['u-1'] }));
    const audience = identityAudience({ identityUrl: 'http://identity', credentials, fetchImpl: fetchImpl as typeof fetch });
    expect(await audience(['tree:t-1', 'org'])).toEqual(['u-1']);
    expect(await audience([])).toEqual([]);
    expect(fetchImpl.mock.calls.map((c) => String((c as unknown[])[0]))).toEqual(['http://identity/v1/members?principals=tree%3At-1%2Corg']);
  });
});
