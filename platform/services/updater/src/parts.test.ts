import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { partsFor } from './parts.ts';

const repo = new URL('../../../../', import.meta.url);

describe('the parts the updater restarts', () => {
  it('starts with Keycloak and storage’s set-up, and ends with the gateway and the front door', () => {
    const parts = partsFor();
    expect(parts.order).toEqual(['keycloak', 'storage', 'identity', 'registry', 'events', 'models', 'gateway', 'web']);
    expect(parts.roles).toMatchObject({ storage: 'job', registry: 'service', web: 'service' });
    expect(parts.health).toMatchObject({ registry: 'http://registry:8082/healthz', web: 'http://web:8080/' });
    // AUGUR's Keycloak may migrate its database on its first start, so it's given longer.
    expect(parts.readyMs).toEqual({ keycloak: 300_000 });
  });

  it('knows every platform service', () => {
    const parts = partsFor();
    // The updater replaces itself after the upgrade, apart from the rest. A service is a part once it runs in
    // the deployment's Compose file; until then (a service still being built) there is nothing to restart.
    const compose = readFileSync(new URL('infra/deploy/compose.yml', repo), 'utf8');
    const deployed = new Set([...compose.matchAll(/^ {2}([a-z][a-z0-9-]*):$/gm)].map((m) => m[1]));
    const services = readdirSync(new URL('platform/services/', repo)).filter((s) => s !== 'updater' && deployed.has(s));
    expect(services.length).toBeGreaterThan(5);
    for (const service of services) expect(parts.order).toContain(service);
  });
});
