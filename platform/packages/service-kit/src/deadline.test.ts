import { describe, expect, it } from 'vitest';
import { serviceTimeoutMs, withDeadline } from './deadline.js';
import { callService } from './service.js';
import { FloorsUnavailable, floorPlaces } from './floors.js';

/** A service that never answers, until the call is abandoned. */
const hangs: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));

const credentials = { name: 'library', getToken: async () => 's3cret' };

describe('withDeadline', () => {
  it('gives up on a service that never answers, and lets a quick one through', async () => {
    await expect(withDeadline(hangs, 20)('http://identity:8081/')).rejects.toThrow(/timeout|aborted/i);
    expect((await withDeadline(async () => new Response('ok'), 20)('http://identity:8081/')).status).toBe(200);
  });

  it('still stops when the caller gives up first', async () => {
    const mine = new AbortController();
    const call = withDeadline(hangs, 60_000)('http://identity:8081/', { signal: mine.signal });
    mine.abort(new Error('the person went away'));
    await expect(call).rejects.toThrow('the person went away');
  });

  it('reads SERVICE_CALL_TIMEOUT_SECONDS, five seconds when unset or nonsense', () => {
    expect(serviceTimeoutMs({ SERVICE_CALL_TIMEOUT_SECONDS: '2.5' })).toBe(2_500);
    expect(serviceTimeoutMs({})).toBe(5_000);
    expect(serviceTimeoutMs({ SERVICE_CALL_TIMEOUT_SECONDS: '' })).toBe(5_000);
    expect(serviceTimeoutMs({ SERVICE_CALL_TIMEOUT_SECONDS: '-1' })).toBe(5_000);
    expect(serviceTimeoutMs({ SERVICE_CALL_TIMEOUT_SECONDS: 'soon' })).toBe(5_000);
  });

  it('turns a hung service into the helpers’ own “can’t be reached” errors', async () => {
    await expect(callService({ method: 'GET', url: 'http://events:8084/v1/x', credentials, what: 'read x', fetchImpl: hangs, timeoutMs: 20 })).rejects.toThrow(/Could not read x: it could not be reached/);
    const lookup = floorPlaces({ identityUrl: 'http://identity:8081', credentials, fetchImpl: withDeadline(hangs, 20) });
    await expect(lookup('team-1')).rejects.toBeInstanceOf(FloorsUnavailable);
  });
});
