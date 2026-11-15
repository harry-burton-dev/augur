import { describe, expect, it } from 'vitest';
import { needsYou } from './needs-you.js';
import type { Overview } from './types.js';

const overview = (needs: Overview['needsYou']): Overview => ({ units: [], needsYou: needs }) as unknown as Overview;

describe('needs you', () => {
  it('lists an app still on contract 2 after the results, sending the admin to the apps (PER-472)', () => {
    const items = needsYou(
      overview([
        { kind: 'contract-2', unit: 'library', message: 'Library is on contract 2 and opens only because IN_PAGE_APPS names it.' },
        { kind: 'failed', unit: 'augur', message: 'AUGUR didn’t finish.' },
      ]),
      [],
    );
    expect(items.map((i) => i.kind)).toEqual(['failed', 'contract-2']);
    expect(items[1]).toMatchObject({ unit: 'library', title: 'An app is still on contract 2', why: 'Library is on contract 2 and opens only because IN_PAGE_APPS names it.', action: { verb: 'See the apps', to: '/apps' } });
  });
});
