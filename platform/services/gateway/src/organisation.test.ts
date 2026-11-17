import { describe, expect, it } from 'vitest';
import { identityOrganisationFloor } from './organisation.ts';

/** Identity's organisation, answering `answers` in turn (the last one again after that) and counting the asks. */
const identity = (...answers: (Record<string, unknown> | number | 'hang')[]) => {
  const asked: string[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    asked.push(url);
    const next = answers.length > 1 ? answers.shift()! : answers[0]!;
    if (next === 'hang') return new Promise((_, fail) => init?.signal?.addEventListener('abort', () => fail(init.signal!.reason)));
    return typeof next === 'number' ? new Response('{}', { status: next }) : Response.json(next);
  }) as unknown as typeof fetch;
  return { asked, fetchImpl };
};

describe('the organisation’s floor, as the gateway signs it', () => {
  it('starts reading it at once, and keeps it', async () => {
    const { asked, fetchImpl } = identity({ id: 'o1', name: 'Acme' });
    const floor = identityOrganisationFloor({ identityUrl: 'http://identity:8081/', fetchImpl });
    await floor.settled();
    expect(floor()).toBe('o1');
    expect(floor()).toBe('o1');
    expect(asked).toEqual(['http://identity:8081/v1/organisation']);
  });

  it('never makes a call wait: while identity hangs, callers go without it', async () => {
    const { fetchImpl } = identity('hang');
    const floor = identityOrganisationFloor({ identityUrl: 'http://identity:8081', fetchImpl, timeoutMs: 20 });
    expect(floor()).toBeUndefined();
    await floor.settled();
    expect(floor()).toBeUndefined();
  });

  it('asks again after a while when identity can’t say, and reads a known id again later', async () => {
    let at = 0;
    const { asked, fetchImpl } = identity(503, { name: 'An older identity' }, { id: 'o1' }, { id: 'o2' });
    const floor = identityOrganisationFloor({ identityUrl: 'http://identity:8081', fetchImpl, retryMs: 1_000, refreshMs: 60_000, now: () => at });
    await floor.settled();
    at = 500;
    expect(floor()).toBeUndefined();
    expect(asked).toHaveLength(1);
    at = 1_000;
    floor();
    await floor.settled();
    expect(floor()).toBeUndefined();
    at = 2_000;
    floor();
    await floor.settled();
    expect(floor()).toBe('o1');
    at = 30_000;
    expect(floor()).toBe('o1');
    expect(asked).toHaveLength(3);
    at = 62_000;
    floor();
    await floor.settled();
    expect(floor()).toBe('o2');
  });
});
