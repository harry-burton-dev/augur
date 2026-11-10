// Asking the permissions service who settles and raises (plan PR 6c-2): one batch per 50 questions, only for
// team floors, and no answer is no role.
import { describe, expect, it } from 'vitest';
import { permissionsRoles, RolesUnavailable } from './permissions.ts';

const credentials = { name: 'knowledge', getToken: async () => 'the-token' };
type Asked = { subject: { id: string }; evaluations: { action: { name: string }; resource: { id: string } }[] };

const service = (decide: (relation: string, floor: string) => boolean, status = 200) => {
  const asked: Asked[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Asked;
    asked.push(body);
    return new Response(JSON.stringify(status === 200 ? { evaluations: body.evaluations.map((e) => ({ decision: decide(e.action.name, e.resource.id) })) } : { message: 'OpenFGA isn’t answering' }), { status });
  }) as typeof fetch;
  return { asked, roles: permissionsRoles({ permissionsUrl: 'http://permissions:8087/', credentials, fetchImpl }) };
};

describe('who settles and raises, from the permissions service', () => {
  it('asks for team floors only, as the person, and keeps what it allows', async () => {
    const s = service((relation, floor) => floor === 't1' && relation === 'can_settle');
    const held = await s.roles('alice', [{ id: 'org', kind: 'org' }, { id: 't1', kind: 'team', parent: 'org' }, { id: 't2', kind: 'team', parent: 'org' }]);
    expect(held).toEqual([{ floor: 't1', role: 'settler' }]);
    expect(s.asked).toHaveLength(1);
    expect(s.asked[0]!.subject.id).toBe('alice');
    expect(s.asked[0]!.evaluations.map((e) => `${e.action.name} ${e.resource.id}`)).toEqual(['can_settle t1', 'can_raise t1', 'can_settle t2', 'can_raise t2']);
  });

  it('asks in batches the service takes', async () => {
    const s = service(() => true);
    const floors = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, kind: 'team' as const, parent: 'org' }));
    expect(await s.roles('alice', floors)).toHaveLength(60);
    expect(s.asked.map((a) => a.evaluations.length)).toEqual([50, 10]);
  });

  it('says it couldn’t tell when the service can’t answer, so the caller gives no role', async () => {
    await expect(service(() => true, 503).roles('alice', [{ id: 't1', kind: 'team', parent: 'org' }])).rejects.toBeInstanceOf(RolesUnavailable);
  });
});
