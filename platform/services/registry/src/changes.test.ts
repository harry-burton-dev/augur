import { describe, expect, it } from 'vitest';
import { changesIn, mergeChanges, releaseChanges } from './changes.ts';

const registry = `### Minor Changes

- a9cfcf7: The floor gauge opens out smoothly.
  It closes the same way.

### Patch Changes

- 1234567: Fixes the Updates page.
- Updated dependencies [a9cfcf7]
  - @augur/mfe-sdk@1.6.0`;

describe('changelogs', () => {
  it('reads each change with its kind, leaving out dependency bumps', () => {
    expect(changesIn(registry, '@augur/registry')).toEqual([
      { id: 'a9cfcf7', kind: 'minor', text: 'The floor gauge opens out smoothly.\nIt closes the same way.', parts: ['@augur/registry'] },
      { id: '1234567', kind: 'patch', text: 'Fixes the Updates page.', parts: ['@augur/registry'] },
    ]);
  });

  it('reads AUGUR’s release notes headings too, and lines with no hash', () => {
    expect(changesIn('#### Major Changes\n\n- Removes SERVICE_TOKEN.', 'x')).toEqual([{ kind: 'major', text: 'Removes SERVICE_TOKEN.', parts: ['x'] }]);
  });

  it('gives a change in several parts once, with every part, biggest first', () => {
    const merged = mergeChanges([
      changesIn(registry, '@augur/registry'),
      changesIn('### Patch Changes\n\n- a9cfcf7: The floor gauge opens out smoothly.\n  It closes the same way.', '@augur/shell'),
      changesIn('### Major Changes\n\n- bbbbbbb: A breaking one.', '@augur/identity'),
    ]);
    expect(merged.map((c) => [c.id, c.kind, c.parts])).toEqual([
      ['bbbbbbb', 'major', ['@augur/identity']],
      ['a9cfcf7', 'minor', ['@augur/registry', '@augur/shell']],
      ['1234567', 'patch', ['@augur/registry']],
    ]);
    expect(releaseChanges(undefined)).toBeUndefined();
  });
});
