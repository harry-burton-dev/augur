import { describe, expect, it } from 'vitest';
import type { Meter } from '@opentelemetry/api';
import { GatewayMetrics, statusClass } from './metrics.ts';
import type { ComponentStatus } from './status.ts';

/** A meter that keeps what it's given, standing in for the SDK's. */
const fakeMeter = () => {
  const added: [number, Record<string, unknown>][] = [];
  const gauges = new Map<string, (r: { observe: (v: number, a?: Record<string, unknown>) => void }) => unknown>();
  const meter = {
    createCounter: () => ({ add: (n: number, a: Record<string, unknown>) => added.push([n, a]) }),
    createObservableGauge: (name: string) => ({ addCallback: (cb: never) => gauges.set(name, cb) }),
  } as unknown as Meter;
  const read = async (name: string) => {
    const seen: [number, Record<string, unknown> | undefined][] = [];
    await gauges.get(name)?.({ observe: (v, a) => seen.push([v, a]) });
    return seen;
  };
  return { meter, added, read, gauges };
};

describe('gateway metrics', () => {
  it('counts calls by part and status class', () => {
    const f = fakeMeter();
    const m = new GatewayMetrics(f.meter);
    m.request(503, 'apps');
    m.request(200, 'platform');
    expect(f.added).toEqual([
      [1, { part: 'apps', status_class: '5xx' }],
      [1, { part: 'platform', status_class: '2xx' }],
    ]);
    expect(statusClass(404)).toBe('4xx');
  });

  it('reports each checked part as up or down, and nothing for one not checked yet', async () => {
    const f = fakeMeter();
    const components: ComponentStatus[] = [
      { name: 'gateway', kind: 'gateway', state: 'up' },
      { name: 'registry', kind: 'service', state: 'slow' },
      { name: 'identity', kind: 'service', state: 'down' },
      { name: 'folio', kind: 'app', state: 'checking' },
    ];
    new GatewayMetrics(f.meter).watch({ components: () => components });
    expect(await f.read('augur.component.up')).toEqual([
      [1, { component: 'gateway', kind: 'gateway' }],
      [1, { component: 'registry', kind: 'service' }],
      [0, { component: 'identity', kind: 'service' }],
    ]);
    expect(f.gauges.has('augur.backup.ok')).toBe(false);
  });

  it('reports backups when the gateway can see them', async () => {
    const f = fakeMeter();
    new GatewayMetrics(f.meter).watch({ components: () => [], backups: async () => ({ state: 'attention', problem: 'No backup for 30 hours.' }) });
    expect(await f.read('augur.backup.ok')).toEqual([[0, undefined]]);
  });
});
