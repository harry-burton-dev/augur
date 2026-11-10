import { describe, expect, it } from 'vitest';
import type { Caller, Shadow, ShadowQuestion } from '@augur/service-kit';
import { roleChecks } from './roles.ts';

/** A shadow that remembers what it was asked to compare. */
const remembering = () => {
  const compared: { site: string; caller: string; question: ShadowQuestion; today: boolean }[] = [];
  const shadow: Shadow = { check: (site, caller, question, today) => void compared.push({ site, caller: caller.id, question: question as ShadowQuestion, today }), settled: async () => {} };
  return { compared, shadow };
};

const person = (id: string, roles: string[]) => ({ id, roles }) as unknown as Caller;

describe('role checks in shadow mode', () => {
  it('decides by today’s role and asks the permissions service the same question as any persona held', () => {
    const { compared, shadow } = remembering();
    const roles = roleChecks(shadow);
    expect(roles.admin('registry.catalogue', person('amara', ['admin']))).toBe(true);
    expect(roles.deploymentAdmin('registry.upgrades.start', person('amara', ['admin']), 'can_upgrade')).toBe(false);
    expect(roles.admin('registry.overview', person('tomas', []), 'admin')).toBe(false);
    expect(compared).toEqual([
      { site: 'registry.catalogue', caller: 'amara', question: { action: 'can_manage_apps', resource: { type: 'org', id: 'this' }, as: 'persona' }, today: true },
      { site: 'registry.upgrades.start', caller: 'amara', question: { action: 'can_upgrade', resource: { type: 'deployment', id: 'this' }, as: 'persona' }, today: false },
      { site: 'registry.overview', caller: 'tomas', question: { action: 'admin', resource: { type: 'org', id: 'this' }, as: 'persona' }, today: false },
    ]);
  });

  it('asks nothing when no one signed in', () => {
    const { compared, shadow } = remembering();
    expect(roleChecks(shadow).admin('registry.catalogue', undefined)).toBe(false);
    expect(compared).toEqual([]);
  });
});
