/**
 * P2's acceptance test (spec 9.1 to 9.3): what the registry refuses in a contract 3 release beyond
 * the schemas, each with a plain reason, and what it only warns about.
 */
import { describe, expect, it } from 'vitest';
import { asksOf2 } from '@augur/app-tools/release2';
import { checkRelease, SERVED_CONTRACTS } from './release-check.ts';
import { exampleRelease, examplePart, releaseOf } from './release3.testing.ts';

const withoutFrontend = (over: Record<string, unknown> = {}, manifest: Record<string, unknown> = {}) => {
  const r = { ...exampleRelease({ frontend: null }), ...over } as Release;
  const { frontend: _f, ...m } = { ...r.manifest, ...manifest };
  const clean = JSON.parse(JSON.stringify(m));
  return { ...r, manifest: clean, asks: asksOf2(clean, r.parts) };
};

type Release = ReturnType<typeof exampleRelease>;
const copy = <T>(v: T): T => structuredClone(v);
const withManifest = async (change: (m: Release['manifest']) => void) => {
  const r = copy(await exampleRelease());
  change(r.manifest);
  return { ...r, asks: asksOf2(r.manifest, r.parts) };
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a test reaches into the workload's YAML shape to break one rule.
const withPart = async (name: string, change: (p: Record<string, any>) => void) => {
  const r = copy(await exampleRelease());
  change(r.parts.find((p) => p.metadata.name === name)!);
  return { ...r, asks: asksOf2(r.manifest, r.parts) };
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
    expect(await refused(releaseOf('events'))).toEqual([
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
    expect((await refused(withoutFrontend({ parts: [] }, { api: undefined }))).join()).toMatch(/neither|frontend.*part/i);
    expect((await refused(await withManifest((m) => (m.contract = 2)))).join()).toMatch(/contract 2.*serves 3/);
  });

  it('refuses asks that aren’t what the parts ask for, a secret in the arguments and two parts of one name', async () => {
    const unseen = copy(exampleRelease());
    unseen.parts[0]!.resources!.internet = { type: 'augur-outbound', params: { hosts: ['x.example.org'], why: 'Fetches things' } };
    expect(checkRelease(unseen).refusals).toEqual([expect.stringMatching(/asks aren’t what/)]);
    expect(await refused(await withPart('migrate', (p) => (p.containers.migrate.args = ['--pw', '${resources.db.password}'])))).toEqual([expect.stringMatching(/db\.password in its arguments/)]);
    // Score's escape is not a reference.
    expect(await refused(await withPart('migrate', (p) => (p.containers.migrate.args = ['--pw', '$${resources.db.password}'])))).toEqual([]);
    expect(await refused(await withPart('worker', (p) => (p.metadata.name = 'web')))).toEqual(expect.arrayContaining([expect.stringMatching(/Two parts are named web/)]));
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
    expect(warnings).toEqual(expect.arrayContaining([expect.stringMatching(/app’s own label/), expect.stringMatching(/note\.print/)]));
    const noFrontend = withoutFrontend();
    expect(checkRelease(noFrontend).warnings.join()).toMatch(/fills/);
  });

  it('reads a part from its Score file, as the release carries it', () => {
    expect(examplePart('web').metadata.name).toBe('web');
  });
});
