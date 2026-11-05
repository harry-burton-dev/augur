import { describe, expect, it, vi } from 'vitest';
import { DIRECTORY_PATH, DirectoryUnavailable, namePrincipals, searchPrincipals } from './index.js';

const answer = {
  people: [{ id: 'u1', name: 'Nora Briggs', email: 'nora@example.org' }, { id: 'u2', name: 'Ben Norris' }],
  teams: [{ id: 't1', name: 'Payroll', within: ['Finance', 'Pay'] }, { id: 't2', name: 'Ops', within: [] }],
};

const ctxAnswering = (res: Response | Promise<Response>) => {
  const fetch = vi.fn(async (_path: string, _init?: RequestInit) => res);
  return { fetch };
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('the directory', () => {
  it('finds people, then teams, shaped for the people picker', async () => {
    const ctx = ctxAnswering(json(answer));
    expect(await searchPrincipals(ctx, ' nor ')).toEqual([
      { kind: 'person', id: 'u1', name: 'Nora Briggs', detail: 'nora@example.org' },
      { kind: 'person', id: 'u2', name: 'Ben Norris' },
      { kind: 'team', id: 't1', name: 'Payroll', detail: 'Finance › Pay' },
      { kind: 'team', id: 't2', name: 'Ops' },
    ]);
    expect(ctx.fetch.mock.calls[0]![0]).toBe(`${DIRECTORY_PATH}?q=nor`);
  });

  it('keeps to the kinds asked for, and a limit identity takes', async () => {
    const ctx = ctxAnswering(json(answer));
    expect((await searchPrincipals(ctx, 'o', { kinds: 'teams', limit: 500 })).map((p) => p.id)).toEqual(['t1', 't2']);
    expect(ctx.fetch.mock.calls[0]![0]).toBe(`${DIRECTORY_PATH}?q=o&limit=50`);
  });

  it('asks nothing for an empty query', async () => {
    const ctx = ctxAnswering(json(answer));
    expect(await searchPrincipals(ctx, '  ')).toEqual([]);
    expect(ctx.fetch).not.toHaveBeenCalled();
  });

  it('says why when it can’t answer', async () => {
    await expect(searchPrincipals(ctxAnswering(json({ error: 'unavailable', message: 'Sign-in service is down.' }, 503)), 'a')).rejects.toMatchObject({
      name: 'DirectoryUnavailable',
      status: 503,
      message: 'Sign-in service is down.',
    });
    await expect(searchPrincipals(ctxAnswering(new Response('nope', { status: 502 })), 'a')).rejects.toThrow('Can’t search people right now. Try again in a minute.');
    await expect(searchPrincipals(ctxAnswering(Promise.reject(new TypeError('offline'))), 'a')).rejects.toBeInstanceOf(DirectoryUnavailable);
  });

  it('names who something is shared with, leaving out ones it no longer knows', async () => {
    const ctx = ctxAnswering(json(answer));
    const named = await namePrincipals(ctx, [{ kind: 'person', id: 'u1' }, { kind: 'team', id: 't2' }, { kind: 'person', id: 'gone' }]);
    expect(named.map((p) => `${p.kind}:${p.id}`)).toEqual(['person:u1', 'team:t2']);
    expect(ctx.fetch.mock.calls[0]![0]).toBe(`${DIRECTORY_PATH}?ids=u1%2Ct2%2Cgone`);
    expect(await namePrincipals(ctx, [])).toEqual([]);
  });
});
