import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { health, packageVersion } from './version.js';

describe('versions', () => {
  it('reads the release version from the package a module is in', () => {
    const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(packageVersion(import.meta.url)).toBe(version);
  });

  it('reports the release and the API version on health', () => {
    expect(health('registry', '1.2.3', 'v1')).toEqual({ status: 'ok', service: 'registry', version: '1.2.3', api: 'v1' });
    expect(health('gateway', '1.2.3')).toEqual({ status: 'ok', service: 'gateway', version: '1.2.3' });
  });
});
