// What an app declares about domain events (ADR 0104): a payload schema that reads, and a type that only grows
// within its version.
import { describe, expect, it } from 'vitest';
import type { AppManifest3 } from '@augur/app-tools/validate';
import { declaredEvents, eventsChangeProblems, eventsProblems, schemaProblem } from './event-types.ts';

const notes = (publishes: object[], more: Partial<AppManifest3> = {}): AppManifest3 =>
  ({ id: 'notes', name: 'Notes', version: '1.2.0', contract: 3, scopes: ['events:publish'], contributes: { events: { publishes } }, ...more }) as AppManifest3;
const added = (schema: object, version = 1) => ({ topic: 'notes.note.added', version, schema });

describe('a payload schema', () => {
  it('reads when its keywords have JSON Schema’s shape and its references lead somewhere', () => {
    expect(schemaProblem({ type: 'object', required: ['note'], properties: { note: { $ref: '#/$defs/id' } }, $defs: { id: { type: 'string', pattern: '^n-' } } })).toBeUndefined();
    expect(schemaProblem({ type: 'object', properties: 5 })).toMatch(/properties is not an object of schemas/);
    expect(schemaProblem({ type: 'object', required: 'note' })).toMatch(/required is not a list of names/);
    expect(schemaProblem({ type: 'object', properties: { a: { type: 'strin' } } })).toMatch(/\/properties\/a\/type "strin" is not a JSON type/);
    expect(schemaProblem({ type: 'object', properties: { a: { $ref: '#/nope' } } })).toMatch(/points at nothing/);
    expect(schemaProblem({ type: 'object', properties: { a: { $ref: 'https://example.org/s.json' } } })).toMatch(/must point inside the schema/);
    expect(schemaProblem({ type: 'object', properties: { a: { type: 'string', pattern: '(' } } })).toMatch(/not a regular expression/);
    expect(schemaProblem({ type: 'object', anyOf: { type: 'string' } })).toMatch(/anyOf is not a list/);
  });
});

describe('what a manifest declares', () => {
  it('says every problem at once, and measures the limit in bytes', () => {
    const wide = { type: 'object', description: 'é'.repeat(9000) };
    expect(eventsProblems(notes([added({ type: 'object' }), added({ type: 'object' }), { ...added(wide), version: 2 }, { topic: 'folio.x.y', version: 1, schema: { type: 'object' } }], { scopes: [] }))).toEqual([
      expect.stringMatching(/doesn't ask for events:publish/),
      expect.stringMatching(/version 1 twice/),
      expect.stringMatching(/version 2 is over 16 KB/),
      expect.stringMatching(/can't publish folio\.x\.y/),
    ]);
    // Saying it reads nothing needs no scope.
    expect(eventsProblems(notes([], { contributes: { events: { reads: [] } } }))).toEqual([]);
  });

  it('is told to AUGUR’s services only when there is something to tell', () => {
    expect(declaredEvents(notes([], { contributes: { events: {} } }))).toBeUndefined();
    expect(declaredEvents(notes([], { contributes: { events: { reads: [] } } }))).toEqual({ reads: [], publishes: [] });
  });
});

describe('a type across releases', () => {
  const was = notes([added({ type: 'object', required: ['note'], properties: { note: { type: 'string' } } })]);
  const now = (schema: object, version = 1) => notes([added(schema, version)], { version: '1.3.0' });

  it('may gain optional fields, or new words, within its version', () => {
    expect(eventsChangeProblems(was, now({ type: 'object', required: ['note'], description: 'Added.', properties: { note: { type: 'string', description: 'Its id.' }, by: { type: 'string' } } }))).toEqual([]);
    expect(eventsChangeProblems(undefined, now({ type: 'object' }))).toEqual([]);
  });

  it('needs a new version for anything else, and may stop declaring an old one', () => {
    expect(eventsChangeProblems(was, now({ type: 'object', required: ['note', 'by'], properties: { note: { type: 'string' }, by: { type: 'string' } } }))).toEqual([expect.stringMatching(/version 1 changes which fields it requires from 1\.2\.0's: .*needs version 2\./)]);
    expect(eventsChangeProblems(was, now({ type: 'object', required: ['note'], properties: {} }))).toEqual([expect.stringMatching(/drops note/)]);
    expect(eventsChangeProblems(was, now({ type: 'object', required: ['note'], properties: { note: { type: 'string' } }, additionalProperties: false }))).toEqual([expect.stringMatching(/changes more than its fields/)]);
    expect(eventsChangeProblems(was, now({ type: 'object', properties: { note: { type: 'integer' } } }, 2))).toEqual([]);
  });
});
