import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingReasons, platformWords } from './check-reasons.mjs';

test('finds a disabled kit button without a reason', () => {
  const text = 'html`<ui-button kind="ghost" ?disabled=${!e.can.edit} @click=${() => (this.dialog = "edit")}>Edit</ui-button>`';
  assert.deepEqual(missingReasons(text), ['1: <ui-button>']);
});

test('accepts one that says why, and ones that are never disabled', () => {
  const text = [
    'html`<ui-button ?disabled=${!e.can.edit} reason=${e.can.why ?? ""}>Edit</ui-button>`',
    'html`<ui-button @click=${() => go()}>Open</ui-button>`',
    '<ui-icon-button label="Find" icon="find"></ui-icon-button>',
  ].join('\n');
  assert.deepEqual(missingReasons(text), []);
});

test('reads JSX props and plain attributes too', () => {
  assert.deepEqual(missingReasons('<ui-button kind="tertiary" disabled={switching} onClick={() => go()}>Use</ui-button>'), ['1: <ui-button>']);
  assert.deepEqual(missingReasons('<ui-icon-button label="Find" disabled></ui-icon-button>'), ['1: <ui-icon-button>']);
});

test('finds "the platform" in text people read: strings, templates and JSX text', () => {
  const text = [
    "throw new Error('Can’t reach the platform. Try again.');",
    'const why = `${app.name} needs a newer version of The Platform.`;',
    '<p>Every change made through the platform.</p>',
  ].join('\n');
  assert.deepEqual(platformWords(text).map((p) => p.split(':')[0]), ['1', '2', '3']);
});

test('leaves comments alone, and lines marked as code only', () => {
  const text = [
    '// Talks to the platform’s gateway.',
    '/* the platform',
    '   keeps this */',
    "const url = 'https://example.org/x'; // the platform",
    '// check-reasons: code-only',
    "const kind = 'the platform';",
    "const other = 'the platform'; // check-reasons: code-only",
    "const say = 'AUGUR answered.';",
  ].join('\n');
  assert.deepEqual(platformWords(text), []);
});
