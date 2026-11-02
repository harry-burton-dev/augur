import { describe, expect, it } from 'vitest';
import { MAX_TOASTS, toastFor, withToast } from './toasts.js';

const note = (id: string, app = 'folio') => ({ id, app, level: 'info' as const, title: `Note ${id}`, time: 0 });

describe('toasts', () => {
  it('are off unless the person turned them on, and muted apps stay silent', () => {
    expect(toastFor(note('a'), { on: false, muted: [] })).toBeNull();
    expect(toastFor(note('a'), { on: true, muted: ['folio'] })).toBeNull();
    expect(toastFor(note('a'), { on: true, muted: [] })).toEqual({ id: 'a', text: 'Note a', open: true });
    expect(toastFor(note('b', 'platform'), { on: true, muted: [] })?.open).toBe(false);
  });

  it('keep the newest few, once each', () => {
    let list = [toastFor(note('a'), { on: true, muted: [] })!];
    for (const id of ['b', 'c', 'd', 'a']) list = withToast(list, toastFor(note(id), { on: true, muted: [] })!);
    expect(list.map((t) => t.id)).toEqual(['c', 'd', 'a'].slice(-MAX_TOASTS));
  });
});
