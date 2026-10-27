import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, describeConfig, loadConfig, type Setting } from './config.js';

const settings: Setting[] = [
  { name: 'REGISTRY_URL', about: 'where the registry is.', required: true },
  { name: 'SERVICE_CLIENT_SECRET', about: 'its sign-in secret.', required: true, secret: true },
  { name: 'ORG_NAME', about: 'what the top floor is called.' },
];

const fileWith = (text: string) => {
  const path = join(mkdtempSync(join(tmpdir(), 'config-')), 'secret');
  writeFileSync(path, text);
  return path;
};

describe('loadConfig', () => {
  it('lists every missing required setting at once in production', () => {
    const env = { NODE_ENV: 'production', SERVICE_CLIENT_SECRET: '' };
    try {
      loadConfig('registry', settings, env);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect((err as ConfigError).problems).toEqual(['REGISTRY_URL is not set: where the registry is.', 'SERVICE_CLIENT_SECRET is not set: its sign-in secret.']);
      expect((err as Error).message).toMatch(/^registry can't start/);
    }
  });

  it('leaves local runs to their defaults', () => {
    expect(() => loadConfig('registry', settings, { NODE_ENV: 'development' })).not.toThrow();
  });

  it('reads a secret from <NAME>_FILE, without its final newline', () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'production', REGISTRY_URL: 'http://registry:8082', SERVICE_CLIENT_SECRET_FILE: fileWith('s3cret\n') };
    loadConfig('events', settings, env);
    expect(env.SERVICE_CLIENT_SECRET).toBe('s3cret');
    expect(describeConfig(settings, env).find((s) => s.name === 'SERVICE_CLIENT_SECRET')).toEqual(expect.objectContaining({ source: 'file', secret: true }));
  });

  it('refuses a secret given both ways, and a file that can’t be read', () => {
    const both = { SERVICE_CLIENT_SECRET: 'a', SERVICE_CLIENT_SECRET_FILE: fileWith('b') };
    expect(() => loadConfig('events', settings, both)).toThrow(/both set/);
    const missing = { SERVICE_CLIENT_SECRET_FILE: '/nowhere/secret' };
    expect(() => loadConfig('events', settings, missing)).toThrow(/can't be read \(ENOENT\)/);
  });

  it('never reads <NAME>_FILE for a setting that isn’t a secret', () => {
    const env: NodeJS.ProcessEnv = { REGISTRY_URL_FILE: '/nowhere' };
    loadConfig('events', settings, env);
    expect(env.REGISTRY_URL).toBeUndefined();
  });

  it('describes each setting with where it came from, and never a secret’s value', () => {
    const env = { REGISTRY_URL: 'http://registry:8082', SERVICE_CLIENT_SECRET: 's3cret' };
    expect(describeConfig(settings, env)).toEqual([
      { name: 'REGISTRY_URL', about: 'where the registry is.', required: true, secret: false, source: 'environment', value: 'http://registry:8082' },
      { name: 'SERVICE_CLIENT_SECRET', about: 'its sign-in secret.', required: true, secret: true, source: 'environment' },
      { name: 'ORG_NAME', about: 'what the top floor is called.', required: false, secret: false, source: 'unset' },
    ]);
  });
});
