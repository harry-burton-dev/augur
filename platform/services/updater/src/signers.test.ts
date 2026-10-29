import { describe, expect, it } from 'vitest';
import { verifyArgs } from './server.ts';
import { releaseIdentity } from './signers.ts';

describe('release signers', () => {
  const identity = releaseIdentity('o/r/.github/workflows/release.yml');
  const matches = (ref: string) => new RegExp(identity).test(`https://github.com/o/r/.github/workflows/release.yml@${ref}`);

  it('take a release made on main, preview or production, and nothing else', () => {
    expect(matches('refs/heads/main')).toBe(true);
    expect(matches('refs/heads/preview')).toBe(true);
    expect(matches('refs/heads/production')).toBe(true);
    expect(matches('refs/heads/dev')).toBe(false);
    expect(matches('refs/heads/production-copy')).toBe(false);
    expect(matches('refs/pull/12/merge')).toBe(false);
    expect(new RegExp(identity).test('https://github.com/o/rx/.github/workflows/release.yml@refs/heads/main')).toBe(false);
    expect(new RegExp(identity).test('https://github.com/o/r/.github/workflows/releaseXyml@refs/heads/main')).toBe(false);
  });

  it('are checked as a pattern, while an exact identity stays exact', () => {
    expect(verifyArgs(identity, 'issuer', 'x@sha256:aa').slice(0, 3)).toEqual(['verify', '--certificate-identity-regexp', identity]);
    expect(verifyArgs('https://github.com/o/r/x@refs/pull/1/merge', 'issuer', 'x@sha256:aa')[1]).toBe('--certificate-identity');
  });
});
