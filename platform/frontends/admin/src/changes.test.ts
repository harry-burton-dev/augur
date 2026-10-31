import { render } from 'lit';
import { describe, expect, it } from 'vitest';
import { changeList, gatherChanges, historyList } from './changes.js';

describe('changelogs and history', () => {
  it('gathers several releases’ changes once each, breaking first', () => {
    const one = [{ id: 'a', kind: 'patch' as const, text: 'Fix', parts: ['@augur/registry'] }];
    const two = [{ id: 'a', kind: 'patch' as const, text: 'Fix', parts: ['@augur/shell'] }, { id: 'b', kind: 'major' as const, text: 'Break', parts: ['@augur/identity'] }];
    expect(gatherChanges([one, undefined, two]).map((c) => [c.id, c.parts])).toEqual([['b', ['@augur/identity']], ['a', ['@augur/registry', '@augur/shell']]]);
  });

  it('shows each change with its kind and parts, and says so when a release has none', () => {
    const el = document.createElement('div');
    render(changeList([{ id: 'b', kind: 'major', text: 'Removes SERVICE_TOKEN.', parts: ['@augur/identity'] }]), el);
    expect(el.textContent).toContain('Breaking');
    expect(el.textContent).toContain('identity');
    render(changeList([]), el);
    expect(el.textContent).toContain('No changelog');
  });

  it('lists upgrades with who asked, how it ended and the backup', () => {
    const el = document.createElement('div');
    render(historyList([{ id: 'u', from: '0.8.0', version: '0.9.0', requestedBy: 'u-1', requestedByName: 'Harry', requestedAt: '2026-10-29T10:00:00Z', finishedAt: '2026-10-29T10:06:00Z', state: 'rolled-back', backup: 'platform-x.sql.gz' }]), el);
    expect(el.textContent).toContain('0.8.0 → 0.9.0');
    expect(el.textContent).toContain('Went back by itself');
    expect(el.textContent).toContain('Asked by Harry');
    expect(el.textContent).toContain('took 6 min');
    expect(el.textContent).toContain('platform-x.sql.gz');
  });
});
