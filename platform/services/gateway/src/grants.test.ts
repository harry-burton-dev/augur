import { describe, expect, it } from 'vitest';
import { holds, registryGrantsFor, scopeFor } from './grants.ts';

const platform = ['identity', 'registry', 'events', 'models', 'knowledge', 'permissions'];

describe('what an app’s call needs', () => {
  it('maps AUGUR’s admin APIs to platform scopes, and keeps an app’s own registry entry free', () => {
    expect(scopeFor('PUT', '/api/registry/v1/platform/go-back', 'upgrades', platform)).toBe('deployment:upgrade');
    expect(scopeFor('DELETE', '/api/registry/v1/apps/notes', 'upgrades', platform)).toBe('deployment:apps');
    expect(scopeFor('PATCH', '/api/registry/v1/apps/notes', 'admin', platform)).toBe('apps:manage');
    expect(scopeFor('GET', '/api/identity/v1/admin/people?q=a', 'admin', platform)).toBe('people:manage');
    expect(scopeFor('PATCH', '/api/identity/v1/admin/organisation', 'admin', platform)).toBe('org:manage');
    expect(scopeFor('GET', '/api/events/v1/audit', 'admin', platform)).toBe('audit:read');
    expect(scopeFor('GET', '/api/identity/v1/organisation', 'admin', platform)).toBe('org:manage');
    expect(scopeFor('GET', '/api/identity/v1/me/workspaces', 'admin', platform)).toBe('apps:manage');
    expect(scopeFor('GET', '/api/identity/v1/organisation/policy', 'admin', platform)).toBeUndefined();
    expect(scopeFor('PUT', '/api/registry/v1/apps/notes', 'notes', platform)).toBeNull();
    expect(scopeFor('GET', '/api/registry/v1/apps/notes/settings', 'notes', platform)).toBeNull();
    expect(scopeFor('PUT', '/api/registry/v1/apps/notes/versions/1.2.0/frontend', 'notes', platform)).toBeNull();
  });

  it('holds an app to an admin’s scope on the rest of its own entry', () => {
    expect(scopeFor('PUT', '/api/registry/v1/apps/notes/scopes', 'notes', platform)).toBe('apps:manage');
    expect(scopeFor('PUT', '/api/registry/v1/apps/notes/floors/team-1', 'notes', platform)).toBe('apps:manage');
    expect(scopeFor('PATCH', '/api/registry/v1/apps/notes', 'notes', platform)).toBe('apps:manage');
    expect(scopeFor('PUT', '/api/registry/v1/apps/notes/pin', 'notes', platform)).toBe('deployment:apps');
    expect(scopeFor('DELETE', '/api/registry/v1/apps/notes', 'notes', platform)).toBe('deployment:apps');
    expect(scopeFor('POST', '/api/registry/v1/apps/notes/anything', 'notes', platform)).toBeUndefined();
    expect(scopeFor('PUT', '/api/registry/v1/apps/notes-2/scopes', 'notes', platform)).toBe('apps:manage');
    expect(scopeFor('HEAD', '/api/registry/v1/apps/notes/settings', 'notes', platform)).toBeNull();
    expect(scopeFor('PUT', '/api/registry/v1/apps/notes/upstream', 'notes', platform)).toBeUndefined();
    expect(scopeFor('GET', '/api/registry/v1/apps/notes-2/floors', 'notes', platform)).toBe('apps:manage');
    expect(scopeFor('GET', '/api/registry/v1/manifest', 'notes', platform)).toBeUndefined();
  });

  it('lets Admin manage roles and grants with people:manage, and never start “Act as”', () => {
    expect(scopeFor('POST', '/api/permissions/v1/roles', 'admin', platform)).toBe('people:manage');
    expect(scopeFor('GET', '/api/permissions/v1/roles?scope=org:this', 'admin', platform)).toBe('people:manage');
    expect(scopeFor('DELETE', '/api/permissions/v1/grants/g-1?reason=Done', 'admin', platform)).toBe('people:manage');
    expect(scopeFor('POST', '/api/permissions/v1/personas/admin.amara/sessions', 'admin', platform)).toBeUndefined();
    expect(scopeFor('POST', '/access/v1/evaluation', 'admin', platform)).toBeUndefined();
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

  it('keeps "not installed" only a moment, so a just-installed app is granted at once (PER-424)', async () => {
    let now = 0;
    let installed = false;
    let asked = 0;
    const fetchImpl = (async () => {
      asked += 1;
      return installed ? Response.json({ on: true, scopes: [] }) : new Response(null, { status: 404 });
    }) as unknown as typeof fetch;
    const grantsOf = registryGrantsFor({ registryUrl: 'http://registry', ttlMs: 30_000, missMs: 2_000, fetchImpl, now: () => now });
    expect(await grantsOf('starter')).toBeUndefined();
    installed = true;
    now = 1_000;
    expect(await grantsOf('starter')).toBeUndefined();
    now = 2_000;
    expect(await grantsOf('starter')).toEqual({ on: true, scopes: [] });
    // A grant is kept for the whole `ttlMs`.
    now = 20_000;
    await grantsOf('starter');
    expect(asked).toBe(2);
  });
});
