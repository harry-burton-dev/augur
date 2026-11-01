import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nameService, telemetryOn } from './telemetry.js';

describe('telemetry', () => {
  it('is off unless a collector is named, and when the SDK is turned off', () => {
    expect(telemetryOn({})).toBe(false);
    expect(telemetryOn({ OTEL_EXPORTER_OTLP_ENDPOINT: '' })).toBe(false);
    expect(telemetryOn({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-lgtm:4318' })).toBe(true);
    expect(telemetryOn({ OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'http://otel-lgtm:4318/v1/traces' })).toBe(true);
    expect(telemetryOn({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-lgtm:4318', OTEL_SDK_DISABLED: 'true' })).toBe(false);
  });

  it('names the service after its package, with its version, unless the settings do', () => {
    const dir = mkdtempSync(join(tmpdir(), 'svc-'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@augur/registry', version: '1.4.0' }));
    const env: NodeJS.ProcessEnv = { OTEL_RESOURCE_ATTRIBUTES: 'deployment.environment.name=dev' };
    nameService(env, dir);
    expect(env.OTEL_SERVICE_NAME).toBe('registry');
    expect(env.OTEL_RESOURCE_ATTRIBUTES).toBe('deployment.environment.name=dev,service.version=1.4.0');
    const named: NodeJS.ProcessEnv = { OTEL_SERVICE_NAME: 'mine', OTEL_RESOURCE_ATTRIBUTES: 'service.version=9' };
    nameService(named, dir);
    expect(named).toEqual({ OTEL_SERVICE_NAME: 'mine', OTEL_RESOURCE_ATTRIBUTES: 'service.version=9' });
    nameService({}, join(dir, 'nowhere'));
  });
});
