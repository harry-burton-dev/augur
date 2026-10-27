import { describe, expect, it } from 'vitest';
import { verifyArgs } from './server.ts';

describe('signature checks', () => {
  it('check against Sigstore online, or offline against a mirrored trust root', () => {
    const online = verifyArgs('https://github.com/o/r/.github/workflows/release.yml@refs/heads/main', 'https://token.actions.githubusercontent.com', 'ghcr.io/o/r/x@sha256:aa');
    expect(online).not.toContain('--offline=true');
    expect(online.at(-1)).toBe('ghcr.io/o/r/x@sha256:aa');
    const offline = verifyArgs('id', 'issuer', 'mirror.example/x@sha256:aa', '/deploy/releases/trusted_root.json');
    expect(offline).toEqual(expect.arrayContaining(['--offline=true', '--trusted-root', '/deploy/releases/trusted_root.json']));
    expect(offline.at(-1)).toBe('mirror.example/x@sha256:aa');
  });
});
