import { describe, expect, it } from 'vitest';
import { isIntentCancelled, isIntentError, isRef, type Ref } from './index.js';

/** How an error reaches a worker from the shell: rebuilt as a plain Error carrying its name. */
const crossed = (name: string) => Object.assign(new Error('from the shell'), { name });

describe('sdk3 entry (PER-468)', () => {
  it('carries Ref and the intent checks, so a contract 3 app needs nothing from the package root', () => {
    const ref: Ref = { kind: 'ref', app: 'folio', type: 'document', id: 'd7' };
    expect(isRef(ref)).toBe(true);
  });

  it('tells a closed request from a failed one by name, as errors cross from the shell', () => {
    expect([isIntentCancelled(crossed('IntentCancelled')), isIntentError(crossed('IntentCancelled'))]).toEqual([true, false]);
    expect([isIntentCancelled(crossed('IntentError')), isIntentError(crossed('IntentError'))]).toEqual([false, true]);
    expect([isIntentCancelled(crossed('Error')), isIntentError(crossed('Error'))]).toEqual([false, false]);
  });
});
