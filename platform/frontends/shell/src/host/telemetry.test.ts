import { afterEach, describe, expect, it } from 'vitest';
import { appFromFrames, appFromUrl, appOnScreen, beforeSend, plainUrl, startTelemetry, telemetryOn, TELEMETRY_URL, type FaroStart, type Item } from './telemetry.js';

const answer = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('which app an error came from', () => {
  it('reads the app and version from the path every app is served at', () => {
    expect(appFromUrl('https://augur.example/apps/folio/0.4.1/assets/index-abc.js')).toEqual({ id: 'folio', version: '0.4.1' });
    expect(appFromUrl('https://cdn.example/apps/mandate/1.2.0-pr.7.3/x.js')).toEqual({ id: 'mandate', version: '1.2.0-pr.7.3' });
    expect(appFromUrl('https://augur.example/assets/shell.js')).toBeUndefined();
    expect(appFromUrl(undefined)).toBeUndefined();
  });

  it('takes the innermost app frame', () => {
    expect(appFromFrames([{ filename: '/assets/react.js' }, { filename: '/apps/atlas/0.2.0/a.js' }, { filename: '/apps/folio/0.4.1/b.js' }])).toEqual({ id: 'atlas', version: '0.2.0' });
  });
});

describe('before each send', () => {
  afterEach(() => appOnScreen(null));
  const exception = (frames: { filename?: string }[]): Item => ({
    type: 'exception',
    payload: { stacktrace: { frames }, context: { kept: 'yes' } },
    meta: { page: { url: 'https://augur.example/apps/folio?doc=42#top', id: 'p' }, user: { id: 'u-1', email: 'a@b.c' }, view: { name: 'default' } },
  });

  it('puts an exception down to the app in its stack, and keeps its own context', () => {
    const out = beforeSend(() => null)(exception([{ filename: '/apps/folio/0.4.1/b.js' }]));
    expect(out.payload.context).toEqual({ kept: 'yes', app: 'folio', 'app.version': '0.4.1' });
  });

  it('else to the app on screen, else to the shell', () => {
    expect(beforeSend(() => ({ id: 'atlas', version: '0.2.0' }))(exception([])).payload.context).toMatchObject({ app: 'atlas', 'app.version': '0.2.0' });
    expect(beforeSend(() => null)(exception([])).payload.context).toMatchObject({ app: 'shell' });
  });

  it('never sends who is signed in, nor the query and fragment of the page', () => {
    const out = beforeSend(() => null)(exception([]));
    expect(out.meta.user).toBeUndefined();
    expect(out.meta.page).toEqual({ url: 'https://augur.example/apps/folio', id: 'p' });
    expect(plainUrl('/x?y#z')).toBe('/x');
  });
});

describe('starting', () => {
  it('asks the gateway, and is off when it says so or can’t be asked', async () => {
    expect(await telemetryOn('t', answer({ on: true }))).toBe(true);
    expect(await telemetryOn('t', answer({ on: false, why: 'No collector.' }))).toBe(false);
    expect(await telemetryOn('t', answer({}, 503))).toBe(false);
    expect(await telemetryOn('t', (async () => Promise.reject(new Error('offline'))) as typeof fetch)).toBe(false);
  });

  it('starts Faro sending to the gateway with the person’s current token, only when on', async () => {
    const started: FaroStart[] = [];
    const start = async (c: FaroStart) => void started.push(c);
    let n = 0;
    const getToken = async () => `t${++n}`;
    expect(await startTelemetry({ getToken, version: '0.15.0', fetchImpl: answer({ on: false }), start })).toBe(false);
    expect(started).toHaveLength(0);
    expect(await startTelemetry({ getToken, version: '0.15.0', fetchImpl: answer({ on: true }), start })).toBe(true);
    expect(started[0]).toMatchObject({ version: '0.15.0', logsURL: `${TELEMETRY_URL}/v1/logs`, tracesURL: `${TELEMETRY_URL}/v1/traces` });
    expect(await started[0].authorization()).toMatch(/^Bearer t\d$/);
    appOnScreen({ id: 'folio', version: '0.4.1' });
    expect(started[0].beforeSend({ type: 'exception', payload: {}, meta: {} }).payload.context).toMatchObject({ app: 'folio' });
  });

  it('never throws when Faro can’t start', async () => {
    const start = async () => {
      throw new Error('blocked');
    };
    expect(await startTelemetry({ getToken: async () => 't', version: '1', fetchImpl: answer({ on: true }), start })).toBe(false);
  });
});
