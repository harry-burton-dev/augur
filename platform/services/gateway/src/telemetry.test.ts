import { describe, expect, it } from 'vitest';
import { browserTelemetryFrom, BROWSER_SERVICE, forward, ForwardFailed, parsePairs, SendLimit, stamped } from './telemetry.ts';

const s = (stringValue: string) => ({ stringValue });
const attrs = (list: { key: string; value?: Record<string, unknown> }[] | undefined) => Object.fromEntries((list ?? []).map((a) => [a.key, (a.value as { stringValue?: string })?.stringValue]));

describe('browser telemetry settings', () => {
  it('is on when a collector is named, carrying the deployment’s own attributes but not a service’s name', () => {
    const t = browserTelemetryFrom({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-lgtm:4318/', OTEL_EXPORTER_OTLP_HEADERS: 'authorization=Basic%20abc', OTEL_RESOURCE_ATTRIBUTES: 'deployment.environment.name=preview,service.name=gateway' });
    expect(t).toEqual({ on: true, endpoint: 'http://otel-lgtm:4318', headers: { authorization: 'Basic abc' }, resource: { 'deployment.environment.name': 'preview' } });
  });

  it('is off, saying why and who can change it, without a collector', () => {
    expect(browserTelemetryFrom({})).toMatchObject({ on: false, why: expect.stringContaining('OTEL_EXPORTER_OTLP_ENDPOINT') });
    expect(browserTelemetryFrom({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-lgtm:4318', OTEL_SDK_DISABLED: 'true' })).toMatchObject({ on: false, why: expect.stringContaining('OTEL_SDK_DISABLED') });
  });

  it('reads OTEL-style pairs', () => {
    expect(parsePairs('a=1, b=x%3Dy,,=z,c')).toEqual({ a: '1', b: 'x=y' });
  });
});

describe('stamping what a browser sends', () => {
  const body = {
    resourceLogs: [
      {
        resource: { attributes: [{ key: 'service.name', value: s('registry') }, { key: 'service.version', value: s('0.15.0') }, { key: 'deployment.environment.name', value: s('production') }, { key: 'browser.platform', value: s('Linux') }, { key: 'user.id', value: s('u-1') }] },
        scopeLogs: [{ scope: { name: '@grafana/faro-web-sdk' }, logRecords: [{ attributes: [{ key: 'url.full', value: s('https://augur.example/apps/folio/doc?q=secret#x') }, { key: 'user.email', value: s('a@b.c') }, { key: 'exception.message', value: s('boom') }] }] }],
      },
    ],
  };

  it('names it augur-browser with the deployment’s attributes, whatever the browser claims', () => {
    const out = stamped(body, 'logs', { 'deployment.environment.name': 'preview', 'service.instance.id': 'augur-workbench' })!;
    const r = (out.resourceLogs as { resource: { attributes: never[] } }[])[0];
    expect(attrs(r.resource.attributes)).toEqual({
      'service.name': BROWSER_SERVICE,
      'deployment.environment.name': 'preview',
      'service.instance.id': 'augur-workbench',
      'augur.shell.version': '0.15.0',
      'browser.platform': 'Linux',
    });
  });

  it('takes out anything naming a person and the query from URLs', () => {
    const out = stamped(body, 'logs')!;
    const record = (out.resourceLogs as { scopeLogs: { logRecords: { attributes: never[] }[] }[] }[])[0].scopeLogs[0].logRecords[0];
    expect(attrs(record.attributes)).toEqual({ 'url.full': 'https://augur.example/apps/folio/doc', 'exception.message': 'boom' });
  });

  it('refuses a body that isn’t that signal', () => {
    expect(stamped(body, 'traces')).toBeUndefined();
    expect(stamped({ resourceLogs: [null] }, 'logs')).toBeUndefined();
    expect(stamped('nope', 'logs')).toBeUndefined();
  });
});

describe('the send limit', () => {
  it('lets one person send so many a minute, then again the next minute', () => {
    let now = 0;
    const limit = new SendLimit(2, () => now);
    expect([limit.take('a'), limit.take('a'), limit.take('a'), limit.take('b')]).toEqual([true, true, false, true]);
    now = 60_000;
    expect(limit.take('a')).toBe(true);
  });
});

describe('forwarding', () => {
  const t = { on: true, endpoint: 'http://c:4318', headers: { authorization: 'k' } };

  it('posts to the signal’s path with the collector’s headers', async () => {
    const calls: [string, RequestInit][] = [];
    await forward(t, 'traces', { resourceSpans: [] }, (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response('{}');
    }) as typeof fetch);
    expect(calls[0][0]).toBe('http://c:4318/v1/traces');
    expect(calls[0][1].headers).toMatchObject({ authorization: 'k', 'content-type': 'application/json' });
  });

  it('says why when the collector doesn’t take it', async () => {
    await expect(forward(t, 'logs', {}, (async () => new Response('', { status: 503 })) as typeof fetch)).rejects.toThrow(ForwardFailed);
    await expect(
      forward(t, 'logs', {}, (async () => {
        throw new Error('ECONNREFUSED');
      }) as typeof fetch),
    ).rejects.toThrow(/can’t be reached/);
  });
});
