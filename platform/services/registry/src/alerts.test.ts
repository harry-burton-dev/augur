import { describe, expect, it } from 'vitest';
import type { NewNotification } from '@augur/service-kit';
import { noticeOf, unroutedNotice, unroutedOn } from './alerts.ts';
import { DATABASE_URL, registryDb } from './db.testing.ts';

const db = registryDb();

const firing = { status: 'firing', fingerprint: 'abc', startsAt: '2026-11-05T01:00:00Z', labels: { alertname: 'A part of AUGUR is down', component: 'events' }, annotations: { summary: 'events isn’t answering', description: 'events (service) has failed its health checks for at least a minute.' } };

describe.runIf(DATABASE_URL)('Grafana’s alerts as notices', () => {
  it('tells deployment admins once per incident, and again when it clears', () => {
    expect(noticeOf(firing)).toMatchObject({ app: 'admin', audience: ['role:deployment-admin'], key: 'alert:abc:2026-11-05T01:00:00Z', level: 'needs', title: 'events isn’t answering', link: '/status' });
    expect(noticeOf({ ...firing, status: 'resolved', endsAt: '2026-11-05T01:23:00Z' })).toMatchObject({ key: 'alert-cleared:abc:2026-11-05T01:00:00Z', level: 'done', title: 'Cleared: events isn’t answering', detail: 'It lasted 23 minutes.' });
    expect(noticeOf({ status: 'firing' })).toBeUndefined();
  });

  it('takes alerts only with the deployment’s token, and sends each', async () => {
    const sent: NewNotification[] = [];
    const app = await db.app({ alerts: { token: 'secret-token', send: async (n) => void sent.push(n) } });
    const post = (authorization?: string) => app.inject({ method: 'POST', url: '/v1/platform/alerts', headers: authorization ? { authorization } : {}, payload: { alerts: [firing] } });
    expect((await post()).statusCode).toBe(401);
    expect((await post('Bearer wrong')).statusCode).toBe(401);
    const res = await post('Bearer secret-token');
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ told: 1 });
    expect(sent[0].key).toBe('alert:abc:2026-11-05T01:00:00Z');
    const off = await db.app();
    expect((await off.inject({ method: 'POST', url: '/v1/platform/alerts', headers: { authorization: 'Bearer x' }, payload: { alerts: [] } })).json().message).toMatch(/ALERT_WEBHOOK_TOKEN/);
  });

  it('drops what reaches the unrouted address, which needs no token', async () => {
    const sent: NewNotification[] = [];
    const app = await db.app({ alerts: { token: 'secret-token', send: async (n) => void sent.push(n) } });
    const res = await app.inject({ method: 'POST', url: '/v1/platform/alerts/unrouted', payload: { alerts: [firing] } });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ told: 0 });
    expect(sent).toEqual([]);
  });
});

describe('Alert routes outside AUGUR', () => {
  const now = Date.parse('2026-11-15T21:00:00Z');
  it('tells deployment admins weekly which route is missing, and nothing once both are set', () => {
    const notice = unroutedNotice(['ALERT_HEARTBEAT_URL', 'ALERT_OUTSIDE_URL'], now);
    expect(notice).toMatchObject({ app: 'admin', audience: ['role:deployment-admin'], level: 'needs', title: 'Alerts reach no one outside AUGUR', link: '/status' });
    expect(notice?.detail).toMatch(/ALERT_HEARTBEAT_URL .* and ALERT_OUTSIDE_URL .* aren’t set in its \.env\. Until they are/);
    expect(unroutedNotice(['ALERT_OUTSIDE_URL'], now)?.detail).toMatch(/\) isn’t set in its \.env\. Until it is,.* sets it /);
    expect(unroutedNotice(['ALERT_OUTSIDE_URL', 'ALERT_HEARTBEAT_URL'], now)?.key).toBe(notice?.key);
    expect(unroutedNotice(['ALERT_OUTSIDE_URL', 'ALERT_HEARTBEAT_URL'], now + 60 * 60_000)?.key).toBe(notice?.key);
    expect(unroutedNotice(['ALERT_OUTSIDE_URL', 'ALERT_HEARTBEAT_URL'], now + 8 * 24 * 60 * 60_000)?.key).not.toBe(notice?.key);
    expect(unroutedNotice(['ALERT_OUTSIDE_URL'], now)?.key).not.toBe(notice?.key);
    expect(unroutedNotice([], now)).toBeUndefined();
  });

  it('finds the missing routes only on a production server, from compose’s set or empty', () => {
    expect(unroutedOn('production', { ALERT_OUTSIDE_URL: '', ALERT_HEARTBEAT_URL: 'set' })).toEqual(['ALERT_OUTSIDE_URL']);
    expect(unroutedOn('production', {})).toEqual(['ALERT_OUTSIDE_URL', 'ALERT_HEARTBEAT_URL']);
    expect(unroutedOn('production', { ALERT_OUTSIDE_URL: 'set', ALERT_HEARTBEAT_URL: 'set' })).toEqual([]);
    expect(unroutedOn('preview', {})).toEqual([]);
    expect(unroutedOn('dev', {})).toEqual([]);
  });
});
