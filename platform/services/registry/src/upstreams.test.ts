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

// Contract 3 (spec 9.8): the rule is the deployment's own networks, which the runner tells the
// registry, not a fixed range. An app hosted on another machine installs without a code change.
describe('upstreamProblem on contract 3 (9.8)', () => {
  const own = { networks: ['172.18.0.0/16', '10.20.0.0/16', 'fd00:a::/64'] };

  it('takes any address outside the deployment’s own networks', () => {
    for (const ok of ['http://10.30.30.40:8080', 'http://172.20.0.5:8080', 'http://[fd00:b::5]:8080', 'https://notes.apps.example.org'])
      expect(upstreamProblem(ok, own), ok).toBeUndefined();
    // With no networks told yet, only loopback and link-local are refused.
    expect(upstreamProblem('http://10.20.30.40:8080', { networks: [] })).toBeUndefined();
    expect(upstreamProblem('http://172.18.0.5:8080', { networks: [] })).toBeUndefined();
  });

  it('refuses an address on one of the deployment’s own networks, naming it', () => {
    expect(upstreamProblem('http://10.20.30.40:8080', own)).toMatch(/10\.20\.0\.0\/16/);
    expect(upstreamProblem('http://172.18.0.5:8080', own)).toMatch(/172\.18\.0\.0\/16/);
    expect(upstreamProblem('http://[fd00:a::9]:8080', own)).toMatch(/fd00:a::\/64/);
  });

  it('still refuses loopback, link-local and AUGUR’s own names', () => {
    for (const bad of ['http://127.0.0.1:80', 'http://169.254.169.254', 'http://[::1]:80', 'http://[fe80::1]:80', 'http://identity:8081'])
      expect(upstreamProblem(bad, own), bad).toBeTypeOf('string');
  });
});
