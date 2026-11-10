import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forReaders, limitsOf, page, rows, settingsPage, typeOf } from './reference.mjs';

test('drops decision record numbers and spec pointers, which readers cannot open', () => {
  assert.equal(forReaders('What the shell draws (the VS Code split, ADR 0075 point 6).'), 'What the shell draws.');
  assert.equal(forReaders('The one major the app speaks (decision 8, option A). It fixes'), 'The one major the app speaks. It fixes');
  assert.equal(forReaders('Kept (for now) as it is.'), 'Kept (for now) as it is.');
});

test('says what a field is and what it must be, in words', () => {
  assert.equal(typeOf({ const: 3 }, {}), '`3` exactly');
  assert.equal(typeOf({ type: 'array', items: { enum: ['team', 'org'] } }, {}), 'list of one of `team`, `org`');
  assert.equal(typeOf({ $ref: '#/$defs/kind' }, { kind: { type: 'string' } }), 'string');
  assert.equal(limitsOf({ minLength: 1, maxLength: 60 }), 'At least 1 character; at most 60 characters.');
  assert.equal(limitsOf({}), '');
});

test('flattens nested objects and lists of objects into dotted paths', () => {
  const schema = {
    required: ['frontend'],
    properties: {
      $schema: { type: 'string' },
      frontend: { type: 'object', required: ['entry'], properties: { entry: { type: 'string' } } },
      places: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' } } } },
    },
  };
  assert.deepEqual(rows(schema, {}).map((r) => [r.path, r.required]), [
    ['frontend', true],
    ['frontend.entry', true],
    ['places', false],
    ['places[].id', false],
  ]);
});

test('a page is valid front matter with a status, and text from the schema is not HTML', () => {
  const md = page(
    { title: 'App manifest', intro: 'An app’s `manifest.json`.', file: 'x.json' },
    { $id: 'urn:x', description: 'About it.', properties: { id: { type: 'string', description: 'Its route is /<id>.', pattern: '^(?<a>x)$' } } },
  );
  assert.match(md, /^---\ntitle: App manifest\n/);
  assert.match(md, /\nstatus: beta\n/);
  assert.match(md, /Its route is \/&lt;id>\./);
  assert.match(md, /`\^\(\?<a>x\)\$`/);
});

test('the settings page lists what a deployment sets, not what compose sets for it', () => {
  const md = settingsPage({
    required: ['PLATFORM_URL'],
    properties: {
      PLATFORM_URL: { description: 'Where people reach AUGUR.' },
      POSTGRES_PASSWORD: { writeOnly: true, description: 'The database password.' },
      INTERNAL_THING: { 'x-internal': true, description: 'Set by compose.' },
    },
  });
  assert.ok(md.includes('| `PLATFORM_URL` | Yes |  |'));
  assert.ok(md.includes('| `POSTGRES_PASSWORD` |  | Yes |'));
  assert.doesNotMatch(md, /INTERNAL_THING/);
});
