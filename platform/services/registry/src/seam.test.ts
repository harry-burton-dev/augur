import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Update control (ADR 0067): kept apart from the catalogue so it can leave as its own service. */
const UPDATE_CONTROL = [
  'platform-upgrades',
  'updates',
  'update-schemas',
  'desired-state',
  'after-watch',
  'ring',
  'feed-trust',
  'pipeline',
  'changes',
  'app-updates',
  'app-runner',
  'app-runner-schemas',
  'overview',
  'report',
  'notices',
  'alerts',
];
/** The catalogue's own code, which update control reaches only through the store. */
const CATALOGUE = ['app', 'floors', 'frontends', 'feature-previews'];

const importsOf = (module: string) =>
  [...readFileSync(new URL(`./${module}.ts`, import.meta.url), 'utf8').matchAll(/from '\.\/([a-z-]+)\.ts'/g)].map((m) => m[1]);

describe('the seam between the catalogue and update control', () => {
  it.each(UPDATE_CONTROL)('%s imports none of the catalogue’s code', (module) => {
    expect(importsOf(module).filter((m) => CATALOGUE.includes(m))).toEqual([]);
  });
});
