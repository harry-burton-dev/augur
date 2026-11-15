import { describe, expect, it } from 'vitest';
import { previewsOnFor } from './feature-previews.ts';
import { APP, cases, DECLARED, PERSON, type PreviewCase } from './feature-previews.cases.testing.ts';
import type { AppRecord } from './store.ts';

const recordFor = (c: PreviewCase): AppRecord => ({
  entry: {
    id: APP,
    name: 'Notes',
    route: '/notes',
    entry: '/apps/notes/entry.js',
    version: '1.0.0',
    sdk: '^1.7.0',
    previews: [{ id: DECLARED, name: 'Board view', ...(c.until ? { until: c.until } : {}) }],
  },
  enabled: true,
  registeredBy: 'u-1',
  registeredAt: '',
  updatedAt: '',
  grantedScopes: [],
  featurePreviews: Object.fromEntries(
    Object.entries(c.chosen).map(([id, { mode, floors }]) => [id, { mode, ...(floors ? { floors: [...floors] } : {}), setBy: 'u-1', setAt: '2026-11-01T00:00:00Z' }]),
  ),
});

describe('previewsOnFor, as a table (PER-498)', () => {
  it('names each case once', () => {
    expect(new Set(cases.map((c) => c.name)).size).toBe(cases.length);
  });

  it.each(cases)('$name', (c) => {
    // As the routes do: only the asking person's opt-ins (store.featureOptIns({ person })).
    const optIns = c.optIns.filter((o) => o.person === PERSON);
    expect(previewsOnFor(recordFor(c), optIns, c.ring, new Date(c.now), [...c.chain])).toEqual(c.expected);
  });
});
