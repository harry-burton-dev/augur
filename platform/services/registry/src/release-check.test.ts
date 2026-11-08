/**
 * P2's acceptance test (spec 9.1 to 9.3): what the registry refuses in a contract 3 release beyond
 * the schemas, each with a plain reason, and what it only warns about.
 */
import { describe, expect, it } from 'vitest';
import { checkRelease, SERVED_CONTRACTS } from './manifest.ts';
import { exampleRelease, examplePart } from './release3.testing.ts';

type Release = Awaited<ReturnType<typeof exampleRelease>>;
const copy = <T>(v: T): T => structuredClone(v);
const withManifest = async (change: (m: Release['manifest']) => void) => {
  const r = copy(await exampleRelease());
  change(r.manifest);
  return r;
};
const withPart = async (name: string, change: (p: Record<string, any>) => void) => {
  const r = copy(await exampleRelease());
  change(r.parts.find((p: any) => p.metadata.name === name));
  return r;
};
const refused = async (r: Release) => checkRelease(r).refusals;

describe('a contract 3 release at the registry (9.1 to 9.3)', () => {
  it('accepts the spec’s example', async () => {
    expect(checkRelease(await exampleRelease()).refusals).toEqual([]);
  });

  it('refuses what fails the schemas, giving the first three reasons with paths (9.1)', async () => {
    const r = await withManifest((m) => {
      delete m.contract;
      m.frontend.entry = '/abs.js';
      m.scopes.push('BAD');
      m.icon = 7;
    });
    const { refusals } = checkRelease(r);
    expect(refusals.length).toBeLessThanOrEqual(3);
    expect(refusals.join('\n')).toMatch(/\/manifest/);
  });

  it('refuses each rule of 9.2 with a plain reason', async () => {
    expect(await refused(await exampleRelease({ id: 'events' }).then((r) => ({ ...r, manifest: { ...r.manifest, id: 'events' } })))).toEqual([
      expect.stringMatching(/"events" is kept for the events service/),
    ]);
    expect(await refused(await withManifest((m) => m.scopes.push('maps:draw')))).toEqual([expect.stringMatching(/maps:draw/)]);
    // Two inbound parts, and an inbound part that is a worker.
    expect((await refused(await withPart('worker', (p) => (p.resources.gateway.params = { inbound: true })))).join()).toMatch(/inbound/);
    // A secret output handed over as a variable, not a file.
    expect((await refused(await withPart('web', (p) => (p.containers.web.variables.SECRET = '${resources.db.password}'))))[0]).toMatch(/password.*file|file.*password/i);
    expect(checkRelease(await exampleRelease(), { resources: ['augur-gateway', 'augur-database', 'augur-telemetry', 'augur-settings', 'augur-scratch', 'augur-bucket', 'augur-files'] }).refusals).toEqual([
      expect.stringMatching(/augur-outbound/),
    ]);
    expect((await refused(await withManifest((m) => delete m.api))).join()).toMatch(/inbound/);
    expect((await refused(await withPart('web', (p) => (p.resources.gateway.params = {})))).join()).toMatch(/api/);
    expect(await refused(await withManifest((m) => (m.contributes.radial[0].command = 'note.print')))).toEqual([expect.stringMatching(/note\.print/)]);
    expect(await refused(await withManifest((m) => m.contributes.places.push({ ...m.contributes.places[0] })))).toEqual([expect.stringMatching(/recent/)]);
    expect(await refused(await withManifest((m) => m.contributes.commands.push({ ...m.contributes.commands[0] })))).toEqual([expect.stringMatching(/note\.new/)]);
    expect(await refused(await withManifest((m) => m.contributes.about.push({ ...m.contributes.about[0] })))).toEqual([expect.stringMatching(/details/)]);
    expect(await refused(await withManifest((m) => m.contributes.settings.push({ ...m.contributes.settings[0] })))).toEqual([expect.stringMatching(/retentionDays/)]);
    expect((await refused(await exampleRelease({ frontend: null, parts: [] }).then((r) => ({ ...r, manifest: { ...r.manifest, frontend: undefined, api: undefined } })))).join()).toMatch(/neither|frontend.*part/i);
    expect((await refused(await withManifest((m) => (m.contract = 2)))).join()).toMatch(/contract 2.*serves 3/);
  });

  it('serves contract 3, and only 3, at its first release (11.5, 11.6)', () => {
    expect(SERVED_CONTRACTS).toEqual([3]);
  });

  it('warns, and still accepts, for 9.3', async () => {
    const r = await withManifest((m) => {
      m.contributes.places[0].label = m.name;
      m.contributes.commands.push({ id: 'note.print', label: 'Print note', icon: 'printer' });
    });
    const { refusals, warnings } = checkRelease(r);
    expect(refusals).toEqual([]);
    expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/Recent|Notes/), expect.stringMatching(/note\.print/)]));
    const noFrontend = await exampleRelease({ frontend: null }).then((x) => ({ ...x, manifest: { ...x.manifest, frontend: undefined } }));
    expect(checkRelease(noFrontend).warnings.join()).toMatch(/fills/);
  });

  it('reads a part from its Score file, as the release carries it', () => {
    expect(examplePart('web').metadata.name).toBe('web');
  });
});
