import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fill, madeNames, readFolder, secretValues, specProblems, writeFolder } from './made-secrets.ts';

describe('made secrets', () => {
  it('makes the settings the schema marks x-generate', () => {
    expect(madeNames({ properties: { A_SECRET: { 'x-generate': true }, PLAIN: {}, B_TOKEN: { 'x-generate': true } } })).toEqual(['A_SECRET', 'B_TOKEN']);
  });

  it('takes the environment first, then what was made before, then makes one', () => {
    let n = 0;
    const { values, fresh } = secretValues(['SET', 'KEPT', 'NEW', 'BLANK'], { SET: 'from-env', BLANK: '' }, { SET: 'old', KEPT: 'made-before' }, () => `r${++n}`);
    expect(values).toEqual({ SET: 'from-env', KEPT: 'made-before', NEW: 'r1', BLANK: 'r2' });
    expect(fresh).toEqual(['NEW', 'BLANK']);
  });

  it('makes 64 hex characters', () => {
    expect(secretValues(['A'], {}, {}).values.A).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fills a template from the made secrets, then the environment', () => {
    expect(fill('postgres://u:{PW}@db/x', { PW: 'p' }, {})).toBe('postgres://u:p@db/x');
    expect(fill('a={A},b={B},c={C}', { A: '1' }, { B: '2' })).toBe('a=1,b=2,c=');
  });

  it('refuses a template that names a secret it can never have', () => {
    expect(specProblems({ gateway: { KEY: '{MADE}', OTHER: '{PASSED}' } }, ['MADE'], { PASSED: '' })).toEqual([]);
    expect(specProblems({ gateway: { KEY: '{TYPO}' } }, ['MADE'], {})).toEqual(["gateway: KEY uses {TYPO}, which AUGUR doesn't make and isn't passed to this job."]);
    expect(specProblems({ Gateway: { 'bad name': 'x' } }, [], {})).toHaveLength(2);
    expect(specProblems({ $comment: { x: 'y' } } as never, [], {})).toEqual([]);
  });

  it('writes whole files and removes ones no longer given', () => {
    const dir = mkdtempSync(join(tmpdir(), 'made-'));
    writeFileSync(join(dir, 'GONE'), 'old');
    writeFileSync(join(dir, 'not-a-setting.txt'), 'kept');
    writeFolder(dir, { KEY: 'value' }, 0o444);
    expect(readFolder(dir)).toEqual({ KEY: 'value' });
    expect(readFileSync(join(dir, 'not-a-setting.txt'), 'utf8')).toBe('kept');
    expect(statSync(join(dir, 'KEY')).mode & 0o777).toBe(0o444);
  });

  it('reads a missing folder as empty, and drops a final newline', () => {
    expect(readFolder('/nowhere/at/all')).toEqual({});
    const dir = mkdtempSync(join(tmpdir(), 'made-'));
    writeFileSync(join(dir, 'KEY'), 'value\n');
    expect(readFolder(dir)).toEqual({ KEY: 'value' });
  });
});
