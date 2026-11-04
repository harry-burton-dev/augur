import { describe, expect, it } from 'vitest';
import { verifyArgs } from './server.ts';
import { AUGUR_REPOSITORIES, augurDevIdentity, isDevBuild, releaseIdentity, repositoryOfIdentity } from './signers.ts';

describe('release signers', () => {
  const identity = releaseIdentity('o/r/.github/workflows/release.yml');
  const matches = (ref: string) => new RegExp(identity).test(`https://github.com/o/r/.github/workflows/release.yml@${ref}`);

  it('take a release made on main, a hotfix branch, or (before 0.14) preview or production, and nothing else', () => {
    expect(matches('refs/heads/main')).toBe(true);
    expect(matches('refs/heads/release/augur-0.14')).toBe(true);
    expect(matches('refs/heads/release/team-notes-1.2')).toBe(true);
    expect(matches('refs/heads/release/augur')).toBe(false);
    expect(matches('refs/heads/release/augur-0.14x')).toBe(false);
    expect(matches('refs/heads/hotfix/login')).toBe(false);
    expect(matches('refs/heads/preview')).toBe(true);
    expect(matches('refs/heads/production')).toBe(true);
    expect(matches('refs/heads/dev')).toBe(false);
    expect(matches('refs/heads/production-copy')).toBe(false);
    expect(matches('refs/pull/12/merge')).toBe(false);
    expect(new RegExp(identity).test('https://github.com/o/rx/.github/workflows/release.yml@refs/heads/main')).toBe(false);
    expect(new RegExp(identity).test('https://github.com/o/r/.github/workflows/releaseXyml@refs/heads/main')).toBe(false);
  });

  it('name the repository a fork’s IMAGE_SIGNER is in, so its dev builds are taken from there too', () => {
    expect(repositoryOfIdentity('https://github.com/acme/augur/.github/workflows/release.yml@refs/heads/main')).toBe('acme/augur');
    expect(repositoryOfIdentity(releaseIdentity('acme/augur/.github/workflows/release.yml'))).toBe('acme/augur');
    // The publisher's own, under both its names, names no one repository: its dev signer stays as it was.
    expect(repositoryOfIdentity(releaseIdentity(AUGUR_REPOSITORIES.map((r) => `${r}/.github/workflows/release.yml`)))).toBeUndefined();
    expect(repositoryOfIdentity('')).toBeUndefined();
  });

  it('are checked as a pattern, while an exact identity stays exact', () => {
    expect(verifyArgs(identity, 'issuer', 'x@sha256:aa').slice(0, 3)).toEqual(['verify', '--certificate-identity-regexp', identity]);
    expect(verifyArgs('https://github.com/o/r/x@refs/pull/1/merge', 'issuer', 'x@sha256:aa')[1]).toBe('--certificate-identity');
  });

  it('know AUGUR’s dev builds by version, and who signs them', () => {
    expect(isDevBuild('0.12.1-dev.48')).toBe(true);
    expect(isDevBuild('0.12.1')).toBe(false);
    expect(isDevBuild('0.12.1-pr.3.4')).toBe(false);
    const dev = new RegExp(augurDevIdentity('o/r'));
    expect(dev.test('https://github.com/o/r/.github/workflows/augur-dev.yml@refs/heads/main')).toBe(true);
    expect(dev.test('https://github.com/o/r/.github/workflows/augur-dev.yml@refs/heads/dev')).toBe(true);
    expect(dev.test('https://github.com/o/r/.github/workflows/augur-dev.yml@refs/heads/release/augur-0.14')).toBe(false);
    expect(dev.test('https://github.com/o/r/.github/workflows/release.yml@refs/heads/main')).toBe(false);
  });

  it('take AUGUR’s releases and dev builds under its repository’s name now or before, and no other', () => {
    const release = new RegExp(releaseIdentity(AUGUR_REPOSITORIES.map((r) => `${r}/.github/workflows/release.yml`)));
    const dev = new RegExp(augurDevIdentity(AUGUR_REPOSITORIES));
    for (const repository of AUGUR_REPOSITORIES) {
      expect(release.test(`https://github.com/${repository}/.github/workflows/release.yml@refs/heads/main`)).toBe(true);
      expect(dev.test(`https://github.com/${repository}/.github/workflows/augur-dev.yml@refs/heads/main`)).toBe(true);
    }
    expect(release.test('https://github.com/harry-burton-dev/augur-mandate/.github/workflows/release.yml@refs/heads/main')).toBe(false);
    expect(release.test('https://github.com/harry-burton-dev/augurx/.github/workflows/release.yml@refs/heads/main')).toBe(false);
    expect(release.test('https://github.com/harry-burton-dev/augur/.github/workflows/augur-dev.yml@refs/heads/main')).toBe(false);
    expect(dev.test('https://github.com/harry-burton-dev/im-platform/.github/workflows/augur-dev.yml@refs/pull/1/merge')).toBe(false);
  });
});
