import { describe, expect, it } from 'vitest';
import { holds, registryGrantsFor, scopeFor } from './grants.ts';

const platform = ['identity', 'registry', 'events', 'models', 'knowledge'];

describe('what an app’s call needs', () => {
  it('maps AUGUR’s admin APIs to platform scopes, and keeps an app’s own registry entry free', () => {
    expect(scopeFor('PUT', '/api/registry/v1/platform/go-back', 'upgrades', platform)).toBe('deployment:upgrade');
    expect(scopeFor('DELETE', '/api/registry/v1/apps/notes', 'upgrades', platform)).toBe('deployment:apps');
    expect(scopeFor('PATCH', '/api/registry/v1/apps/notes', 'admin', platform)).toBe('apps:manage');
    expect(scopeFor('GET', '/api/identity/v1/admin/people?q=a', 'admin', platform)).toBe('people:manage');
    expect(scopeFor('PATCH', '/api/identity/v1/admin/organisation', 'admin', platform)).toBe('org:manage');
    expect(scopeFor('GET', '/api/events/v1/audit', 'admin', platform)).toBe('audit:read');
    expect(scopeFor('PUT', '/api/registry/v1/apps/notes', 'notes', platform)).toBeNull();
    expect(scopeFor('GET', '/api/registry/v1/manifest', 'notes', platform)).toBeUndefined();
  });

  it('maps the knowledge graph’s reads and actions to its scopes, retain to extract', () => {
    expect(scopeFor('GET', '/api/knowledge/v1/floors/team/entities?limit=5', 'notes', platform)).toBe('knowledge:read');
    expect(scopeFor('GET', '/api/knowledge/v1/actions', 'notes', platform)).toBe('knowledge:read');
    expect(scopeFor('POST', '/api/knowledge/v1/floors/team/recall', 'notes', platform)).toBe('knowledge:read');
    expect(scopeFor('POST', '/api/knowledge/v1/actions/retain?dryRun=true', 'notes', platform)).toBe('knowledge:extract');
    expect(scopeFor('POST', '/api/knowledge/v1/actions/hold', 'notes', platform)).toBe('knowledge:act');
    expect(scopeFor('DELETE', '/api/knowledge/v1/floors/team', 'notes', platform)).toBeUndefined();
  });

  it('holds a platform scope only from the grant’s platform scopes', () => {
    expect(holds({ scopes: ['notifications:send'], platformScopes: ['audit:read'] }, 'audit:read')).toBe(true);
    expect(holds({ scopes: ['audit:read'] }, 'audit:read')).toBe(false);
    expect(holds({ scopes: ['notifications:send'] }, 'notifications:send')).toBe(true);
  });
});

describe('the registry’s grants', () => {
  it('keeps platform scopes apart, and drops one listed among an app’s own scopes', async () => {
    const fetchImpl = (async () => Response.json({ name: 'Upgrade Centre', on: true, scopes: ['notifications:send', 'deployment:upgrade'], platformScopes: ['deployment:upgrade', 'made:up'] })) as unknown as typeof fetch;
    const grant = await registryGrantsFor({ registryUrl: 'http://registry', fetchImpl })('upgrades');
    expect(grant).toEqual({ name: 'Upgrade Centre', on: true, scopes: ['notifications:send'], platformScopes: ['deployment:upgrade'] });
  });
});
