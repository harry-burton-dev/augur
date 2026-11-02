import { describe, expect, it } from 'vitest';
import { createPublicKey, verify } from 'node:crypto';
import { callerHeaders } from '@augur/service-kit';
import { buildApp } from './app.ts';
import { deploymentKey, publicKeyLine, reportingFrom, ReportSender, signReport, reportOf } from './report.ts';
import { MemoryAppStore } from './store.ts';
import { UpdateChecker } from './updates.ts';
import type { Overview } from './overview.ts';

const admin = callerHeaders({ id: 'u-1', name: 'Alex', departments: [], roles: ['admin'] });
const editor = callerHeaders({ id: 'u-2', name: 'Sam', departments: [], roles: ['editor'] });
const at = new Date('2026-11-02T12:00:00Z');

const overview = (extra: Partial<Overview> = {}): Overview => ({
  ring: 'dev',
  timeZone: 'Europe/London',
  feed: 'on',
  units: [
    {
      unit: 'augur',
      name: 'AUGUR',
      running: '0.13.2',
      available: '0.14.0',
      desired: { channel: 'dev', policy: 'automatic', automaticUpTo: 'patch', windows: [], timeZone: 'Europe/London', isDefault: true },
      policy: 'Automatic.',
      window: { open: true },
      lastResult: { kind: 'upgrade', id: 'up-1', from: '0.13.1', version: '0.13.2', state: 'done', finishedAt: '2026-11-01T02:10:00Z', seenBy: 'u-1', seenAt: '2026-11-01T09:00:00Z' },
    },
  ],
  needsYou: [],
  ...extra,
});

describe('reporting what this deployment runs (ADR 0019)', () => {
  it('sends with DEPLOYMENT_ID and PORTAL_URL, exports only without PORTAL_URL, and says why it is off', () => {
    expect(reportingFrom({ DEPLOYMENT_ID: 'augur-workbench', PORTAL_URL: 'https://portal.example/' })).toMatchObject({ mode: 'send', url: 'https://portal.example/api/augur/reports' });
    expect(reportingFrom({ DEPLOYMENT_ID: 'augur-workbench' })).toMatchObject({ mode: 'file' });
    expect(reportingFrom({ PORTAL_URL: 'https://portal.example' })).toMatchObject({ mode: 'off', why: expect.stringContaining('DEPLOYMENT_ID') });
    expect(reportingFrom({ DEPLOYMENT_ID: 'augur-workbench', PORTAL_URL: 'https://p', DEPLOYMENT_REPORTING: 'off' })).toMatchObject({ mode: 'off', why: expect.stringContaining('DEPLOYMENT_REPORTING=off') });
    expect(() => reportingFrom({ DEPLOYMENT_ID: 'Harry’s server' })).toThrow('DEPLOYMENT_ID');
  });

  it('reports versions, health and results in OpAMP’s shapes, with nobody’s id in it, signed with the deployment’s key', async () => {
    const report = reportOf(overview(), { deployment: 'augur-workbench', reason: 'started', now: at });
    expect(report).toMatchObject({
      deployment: 'augur-workbench',
      sentAt: '2026-11-02T12:00:00.000Z',
      health: { healthy: true, componentHealthMap: { augur: { healthy: true } } },
      packageStatuses: { packages: { augur: { agentHasVersion: '0.13.2', serverOfferedVersion: '0.14.0', status: 'installed' } } },
      units: [{ unit: 'augur', running: '0.13.2', lastResult: { state: 'done', from: '0.13.1' } }],
    });
    expect(JSON.stringify(report)).not.toContain('u-1');

    const store = new MemoryAppStore();
    const key = await deploymentKey(store);
    expect(await deploymentKey(store)).toEqual(key);
    const signed = signReport(report, key);
    const pub = createPublicKey({ key: Buffer.from(publicKeyLine(key), 'base64'), format: 'der', type: 'spki' });
    expect(verify(null, Buffer.from(signed.payload), pub, Buffer.from(signed.signature, 'base64'))).toBe(true);
  });

  it('sends when it starts and when something changes, else once a day, and keeps what went wrong', async () => {
    const sent: { reason: string }[] = [];
    let now = at;
    let answer = 202;
    let current = overview();
    const sender = new ReportSender({
      reporting: reportingFrom({ DEPLOYMENT_ID: 'augur-workbench', PORTAL_URL: 'https://portal.example' }),
      store: new MemoryAppStore(),
      overview: async () => current,
      now: () => now,
      log: { info: () => {}, warn: () => {} },
      fetchImpl: (async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(JSON.parse(String(init.body)).payload));
        return new Response(JSON.stringify(answer === 202 ? { kept: true } : { problem: 'No key for augur-workbench.' }), { status: answer });
      }) as typeof fetch,
    });
    expect(await sender.maybeSend('started')).toMatchObject({ ok: true, reason: 'started' });
    expect(await sender.maybeSend('changed')).toBeUndefined();
    current = overview({ units: [{ ...overview().units[0], running: '0.14.0' }] });
    expect(await sender.maybeSend('changed')).toMatchObject({ ok: true });
    now = new Date(at.getTime() + 25 * 3600_000);
    expect(await sender.maybeSend('changed')).toMatchObject({ ok: true, reason: 'daily' });
    answer = 403;
    current = overview({ needsYou: [{ kind: 'failed', unit: 'augur', message: 'AUGUR didn’t finish.' }] });
    expect(await sender.maybeSend('changed')).toMatchObject({ ok: false, problem: 'No key for augur-workbench.' });
    expect(sent.map((r) => r.reason)).toEqual(['started', 'changed', 'daily', 'changed']);
  });

  it('shows admins the mode and public key, and exports the signed record as a file', async () => {
    const updates = new UpdateChecker({ running: { version: '0.13.2', channel: 'stable' }, ring: 'production' });
    const app = await buildApp({ updates, reporting: reportingFrom({ DEPLOYMENT_ID: 'augur-demo' }), now: () => at });
    expect((await app.inject({ method: 'GET', url: '/v1/platform/reporting', headers: editor })).statusCode).toBe(403);
    const view = (await app.inject({ method: 'GET', url: '/v1/platform/reporting', headers: admin })).json();
    expect(view).toMatchObject({ mode: 'file', deployment: 'augur-demo', publicKey: expect.stringMatching(/^MCowBQYDK2Vw/) });
    expect((await app.inject({ method: 'GET', url: '/v1/platform/overview', headers: admin })).json().reporting).toMatchObject({ mode: 'file' });
    const file = await app.inject({ method: 'GET', url: '/v1/platform/reporting/export', headers: admin });
    expect(file.headers['content-disposition']).toBe('attachment; filename="augur-demo-2026-11-02.json"');
    expect(JSON.parse(file.json().payload)).toMatchObject({ deployment: 'augur-demo', reason: 'export', units: [{ unit: 'augur', running: '0.13.2' }] });

    const off = await buildApp({ updates });
    expect((await off.inject({ method: 'GET', url: '/v1/platform/reporting/export', headers: admin })).json()).toMatchObject({ error: 'reporting_off', message: expect.stringContaining('DEPLOYMENT_ID') });
  });
});
