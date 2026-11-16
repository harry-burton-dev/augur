import { describe, expect, it } from 'vitest';
import { IntentCancelled, isIntentCancelled, isRef, type Ref } from './index.js';

describe('sdk3 entry (PER-468)', () => {
  it('carries Ref and the intent errors, so a contract 3 app needs nothing from the package root', () => {
    const ref: Ref = { kind: 'ref', app: 'folio', type: 'document', id: 'd7' };
    expect(isRef(ref)).toBe(true);
    expect(isIntentCancelled(new IntentCancelled())).toBe(true);
  });
});
