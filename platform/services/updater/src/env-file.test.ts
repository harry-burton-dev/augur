import { describe, expect, it } from 'vitest';
import { envQuoted, envValue, withEnvValue } from './env-file.ts';

describe('the settings file', () => {
  const text = '# The release\nPLATFORM_VERSION=0.2.0\nPLATFORM_URL="https://augur.example.org"\n# PLATFORM_IMAGES=ghcr.io/x\nEMPTY=\n';

  it('reads a setting as Compose does, without quotes, and not from a comment', () => {
    expect(envValue(text, 'PLATFORM_VERSION')).toBe('0.2.0');
    expect(envValue(text, 'PLATFORM_URL')).toBe('https://augur.example.org');
    expect(envValue(text, 'PLATFORM_IMAGES')).toBeUndefined();
    expect(envValue(text, 'EMPTY')).toBe('');
  });

  it('changes a setting in place and keeps everything else', () => {
    expect(withEnvValue(text, 'PLATFORM_VERSION', '0.3.0')).toBe(text.replace('0.2.0', '0.3.0'));
    expect(withEnvValue('A=1', 'B', '2')).toBe('A=1\nB=2\n');
    expect(withEnvValue('A=1\n', 'A', "'$1 $&'")).toBe("A='$1 $&'\n");
  });

  it('quotes a value that needs it, and refuses one that can’t be written', () => {
    expect(envQuoted('https://s3.example.org:9000/x')).toBe('https://s3.example.org:9000/x');
    expect(envQuoted('Acme & Co $HOME')).toBe("'Acme & Co $HOME'");
    expect(envQuoted("it's")).toBeUndefined();
    expect(envQuoted('a\nB=c')).toBeUndefined();
  });
});
