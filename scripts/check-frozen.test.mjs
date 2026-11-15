import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { judge, narrowings, removedApi, unwatchedLibraries } from './check-frozen.mjs';

const report = (body) => `## API Report File for "@augur/x"\n\n\`\`\`ts\n\n${body}\n\n\`\`\`\n`;

test('an API report that only adds removes nothing', () => {
  const before = report('// @public\nexport interface A {\n    id: string;\n}');
  const after = report('// @public\nexport interface A {\n    id: string;\n    name?: string;\n}');
  assert.deepEqual(removedApi(before, after), []);
});

test('an API report that drops or changes a member names the line', () => {
  const before = report('export interface A {\n    id: string;\n    name: string;\n}');
  assert.deepEqual(removedApi(before, report('export interface A {\n    id: string;\n}')), ['name: string;']);
  assert.deepEqual(removedApi(before, report('export interface A {\n    id: number;\n    name: string;\n}')), ['id: string;']);
});

test('comments and blank lines in a report are not API', () => {
  assert.deepEqual(removedApi(report('// (undocumented)\nexport const a = 1;'), report('// @public\n\nexport const a = 1;')), []);
});

const schema = (extra = {}) => ({
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: { id: { type: 'string', pattern: '^[a-z]+$', maxLength: 40 }, kind: { enum: ['a', 'b'] }, tags: { type: 'array', items: { type: 'string' }, maxItems: 5 } },
  ...extra,
});

test('a schema that only adds accepts everything it accepted', () => {
  const head = schema();
  head.properties.extra = { type: 'boolean' };
  head.properties.kind.enum.push('c');
  head.properties.id.maxLength = 60;
  head.properties.tags.maxItems = 10;
  assert.deepEqual(narrowings(schema(), head), []);
});

test('each way a schema can refuse an old document is found', () => {
  const cases = [
    [(s) => s.required.push('kind'), /"kind" is now required/],
    [(s) => delete s.properties.kind, /"kind" was removed/],
    [(s) => (s.properties.kind.enum = ['a']), /enum lost "b"/],
    [(s) => (s.properties.id.pattern = '^[a-z]{2,}$'), /pattern changed/],
    [(s) => (s.properties.id.maxLength = 20), /maxLength lowered/],
    [(s) => (s.properties.id.minLength = 2), /minLength raised or added/],
    [(s) => (s.properties.id.type = 'integer'), /type no longer allows string/],
    [(s) => (s.properties.tags.items = { type: 'string', maxLength: 3 }), /items: maxLength lowered or added/],
    [(s) => (s.properties.tags.uniqueItems = true), /must now be unique/],
    [(s) => (s.dependentRequired = { tags: ['kind'] }), /dependentRequired changed/],
  ];
  for (const [change, expected] of cases) {
    const head = schema();
    change(head);
    assert.match(narrowings(schema(), head).join('\n'), expected);
  }
});

test('closing an open schema, or dropping a definition, is a narrowing', () => {
  const open = { type: 'object', properties: { a: { type: 'string' } }, $defs: { thing: { type: 'string' } } };
  assert.match(narrowings(open, { ...open, additionalProperties: false }).join('\n'), /no longer takes other properties/);
  assert.match(narrowings(open, { ...open, $defs: {} }).join('\n'), /\$defs\/thing was removed/);
});

test('a property dropped from an open schema still validates, so it is not a narrowing', () => {
  const open = { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } } };
  assert.deepEqual(narrowings(open, { type: 'object', properties: { a: { type: 'string' } } }), []);
});

const tree = () => {
  const dir = mkdtempSync(join(tmpdir(), 'frozen-'));
  const put = (path, text) => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  return { dir, put };
};

test('a seam is judged against its baseline by kind', () => {
  const { dir, put } = tree();
  put('baselines/a.api.md', report('export const a = 1;\nexport const b = 2;'));
  put('etc/a.api.md', report('export const a = 1;'));
  put('baselines/m.schema.json', JSON.stringify(schema()));
  put('m.schema.json', JSON.stringify(schema({ required: ['id', 'kind'] })));
  assert.deepEqual(judge({ kind: 'api-report', path: 'etc/a.api.md', baseline: 'baselines/a.api.md' }, dir).problems, ['removed or changed: export const b = 2;']);
  assert.deepEqual(judge({ kind: 'json-schema', path: 'm.schema.json', baseline: 'baselines/m.schema.json' }, dir).problems, ['#: "kind" is now required']);
});

test('line endings alone are not a change, and a missing file is', () => {
  const { dir, put } = tree();
  put('baselines/a.api.md', report('export const a = 1;'));
  put('etc/a.api.md', report('export const a = 1;').replace(/\n/g, '\r\n'));
  assert.deepEqual(judge({ kind: 'api-report', path: 'etc/a.api.md', baseline: 'baselines/a.api.md' }, dir).problems, []);
  assert.match(judge({ kind: 'api-report', path: 'etc/gone.api.md', baseline: 'baselines/a.api.md' }, dir).problems[0], /is gone/);
});

test('a library without an API report is unwatched unless the list says why', () => {
  const { dir, put } = tree();
  put('platform/packages/seen/package.json', JSON.stringify({ name: '@augur/seen' }));
  put('platform/packages/seen/api-extractor.json', '{}');
  put('platform/packages/blind/package.json', JSON.stringify({ name: '@augur/blind' }));
  assert.deepEqual(unwatchedLibraries(dir), ['@augur/blind']);
  assert.deepEqual(unwatchedLibraries(dir, ['@augur/blind']), []);
});
