import { describe, expect, it } from 'vitest';
import type { Meter } from '@opentelemetry/api';
import { noShadow, permissionsShadow, shadowFromEnv } from './shadow.js';

const credentials = { name: 'events', getToken: async () => 'the-token' };

/** A meter that remembers what was counted. */
const counting = () => {
  const counted: { name: string; attrs: Record<string, unknown> }[] = [];
  const meter = { createCounter: (name: string) => ({ add: (_n: number, attrs: Record<string, unknown>) => counted.push({ name, attrs }) }) } as unknown as Meter;
  return { counted, meter };
};

/** The permissions service: personas each person holds, and which subjects may do what. */
const permissions = (allowed: Set<string>, held: Record<string, string[]> = {}, status = 200) => {
  const asked: { path: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    type Asked = { subject: { type: string; id: string }; action: { name: string }; resource: { type: string; id: string }; evaluations: { subject: { type: string; id: string } }[] };
    const body = JSON.parse(String(init.body)) as Asked;
    asked.push({ path, body: body as unknown as Record<string, unknown> });
    if (status !== 200) return new Response(JSON.stringify({ message: 'OpenFGA isn’t answering' }), { status });
    const key = (subject: { type: string; id: string }) => `${subject.type}:${subject.id} ${body.action.name} ${body.resource.type}:${body.resource.id}`;
    if (path.endsWith('/evaluation')) return Response.json({ decision: allowed.has(key(body.subject)) });
    if (path.endsWith('/search/resource')) return Response.json({ results: (held[body.subject.id] ?? []).map((id) => ({ type: 'persona', id })) });
    return Response.json({ evaluations: body.evaluations.map((e) => ({ decision: allowed.has(key(e.subject)) })) });
  }) as unknown as typeof fetch;
  return { asked, fetchImpl };
};

const logs = () => {
  const warned: { details: Record<string, unknown>; message: string }[] = [];
  return { warned, log: { warn: (message: string, details: Record<string, unknown> = {}) => warned.push({ details, message }) } };
};

describe('shadow checks', () => {
  it('counts an agreement, and counts and logs a disagreement with both answers', async () => {
    const { counted, meter } = counting();
    const { warned, log } = logs();
    const { asked, fetchImpl } = permissions(new Set(['person:amara can_see org:this']));
    const shadow = permissionsShadow({ permissionsUrl: 'http://permissions:8087/', credentials, log, meter, fetchImpl });
    shadow.check('events.feed', { id: 'amara' }, { action: 'can_see', resource: { type: 'org', id: 'this' } }, true);
    shadow.check('events.feed', { id: 'tomas' }, { action: 'can_see', resource: { type: 'org', id: 'this' } }, true);
    await shadow.settled();
    expect(asked[0]).toEqual({ path: '/access/v1/evaluation', body: { subject: { type: 'person', id: 'amara' }, action: { name: 'can_see' }, resource: { type: 'org', id: 'this' } } });
    expect(counted).toEqual([
      { name: 'augur.permissions.shadow.checks', attrs: { site: 'events.feed', outcome: 'agree' } },
      { name: 'augur.permissions.shadow.checks', attrs: { site: 'events.feed', outcome: 'disagree' } },
      { name: 'augur.permissions.shadow.disagreements', attrs: { site: 'events.feed' } },
    ]);
    expect(warned).toEqual([
      {
        details: { site: 'events.feed', caller: 'tomas', asked: ['person can_see org:this'], today: true, permissions: false },
        message: 'permissions shadow: events.feed answered yes, the permissions service no',
      },
    ]);
  });

  it('asks as any persona the caller holds, for admin powers', async () => {
    const { counted, meter } = counting();
    const { fetchImpl, asked } = permissions(new Set(['persona:admin.amara can_read_audit org:this']), { amara: ['ops-head', 'admin.amara'], tomas: [] });
    const shadow = permissionsShadow({ permissionsUrl: 'http://permissions:8087', credentials, log: logs().log, meter, fetchImpl });
    const audit = { action: 'can_read_audit', resource: { type: 'org', id: 'this' }, as: 'persona' } as const;
    shadow.check('events.audit', { id: 'amara' }, audit, true);
    shadow.check('events.audit', { id: 'tomas' }, audit, false);
    await shadow.settled();
    expect(counted.map((c) => c.attrs.outcome)).toEqual(['agree', 'agree']);
    expect(asked.find((a) => a.path.endsWith('/evaluations'))!.body.evaluations).toEqual([{ subject: { type: 'persona', id: 'ops-head' } }, { subject: { type: 'persona', id: 'admin.amara' } }]);
    // Someone who holds no persona is a no without asking further.
    expect(asked.filter((a) => a.path.endsWith('/evaluations'))).toHaveLength(1);
  });

  it('allows when any of several questions is allowed, as “a lead of the team, or an admin” does', async () => {
    const { counted, meter } = counting();
    const { fetchImpl } = permissions(new Set(['persona:admin.amara admin floor:port']), { amara: ['admin.amara'] });
    const shadow = permissionsShadow({ permissionsUrl: 'http://permissions:8087', credentials, log: logs().log, meter, fetchImpl });
    const leadOrAdmin = [
      { action: 'can_act_as_lead', resource: { type: 'floor', id: 'port' } },
      { action: 'admin', resource: { type: 'floor', id: 'port' }, as: 'persona' },
    ] as const;
    shadow.check('events.team-notices', { id: 'amara' }, leadOrAdmin, true);
    await shadow.settled();
    expect(counted.map((c) => c.attrs.outcome)).toEqual(['agree']);
  });

  it('counts a question the permissions service can’t answer as unanswered, never as a disagreement', async () => {
    const { counted, meter } = counting();
    const { warned, log } = logs();
    const shadow = permissionsShadow({ permissionsUrl: 'http://permissions:8087', credentials, log, meter, fetchImpl: permissions(new Set(), {}, 503).fetchImpl });
    shadow.check('events.feed', { id: 'amara' }, { action: 'can_see', resource: { type: 'org', id: 'this' } }, true);
    await shadow.settled();
    expect(counted).toEqual([{ name: 'augur.permissions.shadow.checks', attrs: { site: 'events.feed', outcome: 'unanswered' } }]);
    expect(warned).toEqual([]);
  });

  it('skips a comparison when too many are in flight, so it can’t load a busy service', async () => {
    const { counted, meter } = counting();
    const shadow = permissionsShadow({ permissionsUrl: 'http://permissions:8087', credentials, log: logs().log, meter, maxInFlight: 1, fetchImpl: permissions(new Set()).fetchImpl });
    const q = { action: 'can_see', resource: { type: 'org', id: 'this' } };
    shadow.check('a', { id: 'amara' }, q, false);
    shadow.check('a', { id: 'amara' }, q, false);
    await shadow.settled();
    expect(counted.map((c) => c.attrs.outcome).sort()).toEqual(['agree', 'skipped']);
  });

  it('is off without PERMISSIONS_URL or the service’s own sign-in', () => {
    expect(shadowFromEnv(credentials, logs().log, {})).toBe(noShadow);
    expect(shadowFromEnv(undefined, logs().log, { PERMISSIONS_URL: 'http://permissions:8087' })).toBe(noShadow);
    expect(shadowFromEnv(credentials, logs().log, { PERMISSIONS_URL: 'http://permissions:8087' })).not.toBe(noShadow);
  });
});
