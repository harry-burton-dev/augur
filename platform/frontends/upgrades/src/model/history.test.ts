import { describe, expect, it } from 'vitest';
import { filterHistory, historyCsv, historyOf } from './history.js';
import type { DesiredState } from './types.js';

const setting = (over: Partial<DesiredState>): DesiredState => ({
  unit: 'augur',
  channel: 'stable',
  policy: 'ask',
  automaticUpTo: 'patch',
  windows: [],
  timeZone: 'Europe/London',
  setBy: 'default',
  setAt: '2026-10-01T00:00:00Z',
  ...over,
});

const entries = historyOf({
  upgrades: [
    { id: 'u1', from: '0.13.0', version: '0.13.1', requestedBy: 'p1', requestedByName: 'Sam', requestedAt: '2026-11-01T02:00:00Z', finishedAt: '2026-11-01T02:04:00Z', state: 'done', backup: 'b1.tar.gz' },
    { id: 'u2', from: '0.13.1', version: '0.13.2', requestedBy: 'automatic', requestedAt: '2026-11-02T02:00:00Z', state: 'rolled-back', watch: { until: '', checks: [], tripped: true } },
  ],
  jobs: [{ id: 'j1', app: 'folio', action: 'install', release: { version: '1.1.0', channel: 'stable' }, requestedBy: 'automatic', requestedAt: '2026-11-01T12:00:00Z', state: 'done' }],
  settings: { augur: [setting({}), setting({ policy: 'hold', setBy: 'p1', setAt: '2026-11-01T09:00:00Z' })] },
  names: { augur: 'AUGUR', folio: 'Artifacts' },
  augur: 'augur',
  zone: 'Europe/London',
  nameOf: (id, given) => given ?? (id === 'p1' ? 'Sam' : id),
});

describe('the history', () => {
  it('puts upgrades, app jobs and setting changes in one list, newest first, leaving out the default record', () => {
    expect(entries.map((e) => e.id)).toEqual(['u2', 'j1', 'setting-augur-2026-11-01T09:00:00Z', 'u1']);
    expect(entries[0]).toMatchObject({ who: 'watch', by: 'Watch', outcome: 'went-back' });
    expect(entries[1]).toMatchObject({ unitName: 'Artifacts', who: 'itself', by: 'By itself', how: 'Automatic', to: '1.1.0' });
    expect(entries[2]).toMatchObject({ by: 'Sam', before: 'Ask first: each new release waits for an admin.', after: 'On hold: nothing new is offered.' });
    expect(entries[3]).toMatchObject({ tookMs: 240_000, backup: 'b1.tar.gz' });
  });

  it('filters by unit, who and outcome', () => {
    expect(filterHistory(entries, { unit: 'folio' }).map((e) => e.id)).toEqual(['j1']);
    expect(filterHistory(entries, { who: 'person' }).map((e) => e.id)).toEqual(['setting-augur-2026-11-01T09:00:00Z', 'u1']);
    expect(filterHistory(entries, { outcome: 'changed' })).toHaveLength(1);
  });

  it('exports CSV with every cell quoted and no formulas', () => {
    const csv = historyCsv([{ ...entries[3]!, message: '=HYPERLINK("x")' }]);
    expect(csv.split('\r\n')[0]).toContain('"When (UTC)","Unit"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"4 min"');
  });
});
