import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { partsFor, shippedAppsFrom } from './parts.ts';

const repo = new URL('../../../../', import.meta.url);

describe('the parts the updater restarts', () => {
  it('puts the apps that ship with AUGUR between the platform’s services and its front door, each with its workers', () => {
    const parts = partsFor(shippedAppsFrom({ apps: { notes: { repo: 'o/notes', port: 8095, workers: ['notes-indexer'] }, maps: { port: 8096 } } }));
    expect(parts.order).toEqual(['keycloak', 'storage', 'identity', 'registry', 'events', 'models', 'notes', 'notes-indexer', 'maps', 'gateway', 'web']);
    expect(parts.roles).toMatchObject({ storage: 'job', notes: 'service', 'notes-indexer': 'worker', web: 'service' });
    expect(parts.health).toMatchObject({ notes: 'http://notes:8095/healthz', maps: 'http://maps:8096/healthz', registry: 'http://registry:8082/healthz' });
    expect(parts.health['notes-indexer']).toBeUndefined();
    // AUGUR's Keycloak may migrate its database on its first start, so it's given longer.
    expect(parts.readyMs).toEqual({ keycloak: 300_000 });
  });

  it('refuses a shipped-apps file it can’t read, and an app that takes a platform part’s name', () => {
    expect(() => shippedAppsFrom({})).toThrow(/no "apps"/);
    expect(() => shippedAppsFrom({ apps: { notes: {} } })).toThrow(/notes .* no "port"/);
    expect(() => shippedAppsFrom({ apps: { notes: { port: 8095, workers: 'x' } } })).toThrow(/image names/);
    expect(() => partsFor([{ id: 'registry', port: 9000, workers: [] }])).toThrow(/"registry" is named twice/);
  });

  it('knows every app in release/shipped-apps.json and every platform service', () => {
    const parts = partsFor(shippedAppsFrom(JSON.parse(readFileSync(new URL('release/shipped-apps.json', repo), 'utf8'))));
    for (const id of Object.keys(JSON.parse(readFileSync(new URL('release/shipped-apps.json', repo), 'utf8')).apps)) expect(parts.roles[id]).toBe('service');
    // The updater replaces itself after the upgrade, apart from the rest.
    const services = readdirSync(new URL('platform/services/', repo)).filter((s) => s !== 'updater');
    for (const service of services) expect(parts.order).toContain(service);
  });
});
