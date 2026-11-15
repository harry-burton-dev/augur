import { describe, expect, it } from 'vitest';
import { UNDECLARED_LOG_MS, undeclaredLog, undeclaredWarning } from './undeclared.ts';

describe('undeclared domain events (PER-462)', () => {
  it('warns only an app on contract 3 or later that leaves a side undeclared', () => {
    expect(undeclaredWarning('folio', undefined, 'reads')).toBeUndefined();
    expect(undeclaredWarning('folio', { publishes: [], contract: 2 }, 'publishes')).toBeUndefined();
    expect(undeclaredWarning('folio', { publishes: [], reads: [], contract: 3 }, 'reads')).toBeUndefined();
    expect(undeclaredWarning('folio', { publishes: [], contract: 3 }, 'reads')).toMatch(/doesn’t say what it reads/);
    expect(undeclaredWarning('folio', { publishes: [], contract: 3 }, 'publishes')).toMatch(/declares no types it publishes/);
  });

  it('logs each app and side at most once per interval', () => {
    let at = 0;
    const logged: object[] = [];
    const log = undeclaredLog((o) => logged.push(o), () => at);
    log('folio', 'reads');
    log('folio', 'reads');
    log('folio', 'publishes');
    log('notes', 'reads');
    expect(logged).toHaveLength(3);
    at = UNDECLARED_LOG_MS;
    log('folio', 'reads');
    expect(logged).toEqual([
      { app: 'folio', field: 'contributes.events.reads' },
      { app: 'folio', field: 'contributes.events.publishes' },
      { app: 'notes', field: 'contributes.events.reads' },
      { app: 'folio', field: 'contributes.events.reads' },
    ]);
  });
});
