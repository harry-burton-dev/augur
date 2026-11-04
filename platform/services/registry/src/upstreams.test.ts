import { describe, expect, it } from 'vitest';
import { upstreamProblem } from './upstreams.ts';

describe('upstreamProblem', () => {
  it('takes the containers that run apps and hosts elsewhere', () => {
    for (const ok of [
      'http://app-library:8090',
      'http://app-library-blue:8080',
      'http://app-team-notes-pr12:8080',
      'https://expenses.apps.example.org',
      'http://10.0.4.12:8080',
      'http://[2001:db8::1]:8080',
    ]) expect(upstreamProblem(ok), ok).toBeUndefined();
  });

  it('refuses AUGUR’s own parts however they are written', () => {
    for (const bad of [
      'http://identity:8081',
      'http://identity.:8081',
      'http://IDENTITY:8081',
      'http://platform-identity-1:8081',
      'http://identity.platform_default:8081',
      'http://evil:1',
      'http://x:1',
      'http://127.0.0.2:80',
      'http://127.1:80',
      'http://2130706433:80',
      'http://0x7f.1:80',
      'http://0.0.0.0:80',
      'http://169.254.169.254',
      'http://172.18.0.5:8080',
      'http://[::1]:80',
      'http://[::]:80',
      'http://[::ffff:127.0.0.1]:80',
      'http://[fe80::1]:80',
      'http://a.localhost:80',
    ]) expect(upstreamProblem(bad), bad).toBeTypeOf('string');
  });
});
