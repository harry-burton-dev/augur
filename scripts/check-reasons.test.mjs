import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingReasons } from './check-reasons.mjs';

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
