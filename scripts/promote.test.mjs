import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AUGUR, bakeVerdict, deployTestVerdict, prProblems, promotionRecord, promotionSource, promotionTarget, releaseLineOf, tagOf, unitOf, versionsFrom } from './promote.mjs';

const apps = ['mandate'];

describe('units', () => {
  it('an app’s own folder is the app’s, everything else AUGUR’s', () => {
    assert.equal(unitOf('apps/mandate/service/src/index.ts', apps), 'mandate');
    assert.equal(unitOf('apps/atlas/service/src/index.ts', apps), AUGUR);
    assert.equal(unitOf('platform/services/registry/src/index.ts', apps), AUGUR);
    assert.equal(unitOf('apps/mandatex/manifest.json', apps), AUGUR);
  });

  it('versions come from AUGUR’s release file and each app’s manifest', () => {
    const files = { 'release/augur-release.json': '{"version":"0.9.0"}', 'apps/mandate/manifest.json': '{"version":"0.2.0"}' };
    assert.deepEqual(versionsFrom((p) => files[p], apps), { augur: '0.9.0', mandate: '0.2.0' });
    assert.deepEqual(versionsFrom(() => undefined, apps), { augur: undefined, mandate: undefined });
  });

  it('tags and release branches name the unit and version', () => {
    assert.equal(tagOf(AUGUR, '0.9.0'), 'augur@0.9.0');
    assert.equal(tagOf('mandate', '0.2.0'), 'app/mandate@0.2.0');
    assert.deepEqual(releaseLineOf('release/augur-0.14'), { unit: 'augur', major: 0, minor: 14 });
    assert.deepEqual(releaseLineOf('release/team-notes-1.2'), { unit: 'team-notes', major: 1, minor: 2 });
    assert.equal(releaseLineOf('release/augur'), undefined);
    assert.equal(releaseLineOf('main'), undefined);
    assert.equal(releaseLineOf(undefined), undefined);
  });
});

describe('which pull requests may go where', () => {
  it('anything goes into the trunk', () => {
    assert.deepEqual(prProblems({ base: 'main', head: 'feature/thing' }), []);
    assert.deepEqual(prProblems({ base: 'dev', head: 'feature/thing' }), []);
  });

  it('a release branch takes only a hotfix to its own unit, as a patch on its line', () => {
    const base = 'release/augur-0.14';
    assert.deepEqual(prProblems({ base, head: 'hotfix/login', files: ['platform/x.ts', 'pnpm-lock.yaml', '.changeset/a.md'], appIds: apps, versions: { augur: '0.14.1' } }), []);
    assert.deepEqual(prProblems({ base, head: 'changeset-release/release/augur-0.14', files: ['release/augur-release.json'], appIds: apps, versions: { augur: '0.14.1' } }), []);
    assert.match(prProblems({ base, head: 'feature/thing', files: ['platform/x.ts'], appIds: apps })[0], /Only a hotfix/);
    assert.match(prProblems({ base, head: 'hotfix/login', files: ['platform/x.ts', 'apps/mandate/x.ts'], appIds: apps })[0], /apps\/mandate\/x\.ts/);
    assert.match(prProblems({ base, head: 'hotfix/login', files: ['platform/x.ts'], appIds: apps, versions: { augur: '0.15.0' } })[0], /a hotfix is a patch/);
    assert.match(prProblems({ base: 'release/whatever', head: 'hotfix/x' })[0], /isn't a release branch/);
  });
});

describe('making a release stable', () => {
  const releases = [
    { tagName: 'augur@0.14.1-dev.4', isPrerelease: true },
    { tagName: 'augur@0.14.0', isPrerelease: true },
    { tagName: 'augur@0.13.0', isPrerelease: false },
    { tagName: 'app/mandate@0.1.6', isPrerelease: true },
    { tagName: 'app/mandate@0.1.6-pr.3.1', isPrerelease: true },
  ];

  it('takes the newest beta by default, never a dev build or a preview', () => {
    assert.equal(promotionTarget(AUGUR, undefined, releases).tagName, 'augur@0.14.0');
    assert.equal(promotionTarget('mandate', undefined, releases).tagName, 'app/mandate@0.1.6');
    assert.equal(promotionTarget(AUGUR, '0.13.0', releases).isPrerelease, false);
    assert.equal(promotionTarget(AUGUR, '0.14.1-dev.4', releases), undefined);
    assert.equal(promotionTarget('notes', undefined, releases), undefined);
  });

  it('records who made it stable, from beta', () => {
    assert.deepEqual(promotionRecord({ unit: AUGUR, version: '0.14.0', actor: 'owner', at: 't', run: '1' }), { schema: 'augur.promotion/v2', unit: AUGUR, version: '0.14.0', channel: 'stable', from: 'beta', promotedBy: 'owner', run: '1', at: 't' });
  });
});

describe('bake time (ADR 0018)', () => {
  const d = (deployment, ring, hours, wentBack = false) => ({ deployment, ring, hours, wentBack });

  it('lets a release go stable once a preview deployment has run it for the bake time with no going back', () => {
    assert.deepEqual(bakeVerdict({ evidence: { deployments: [d('augur-preview', 'preview', 80), d('augur-workbench', 'dev', 100)] } }), {
      record: { checked: true, needs: 72, deployment: 'augur-preview', hours: 80 },
    });
  });

  it('refuses one that baked too short, only off preview, or went back anywhere, saying how to override', () => {
    assert.match(bakeVerdict({ evidence: { deployments: [d('augur-preview', 'preview', 30)] } }).problem, /^It has run on augur-preview for 30 hours, and it takes 72\. .*Skip the bake time/);
    assert.match(bakeVerdict({ evidence: { deployments: [d('augur-workbench', 'dev', 200)] } }).problem, /^No preview deployment has reported running it\./);
    assert.match(bakeVerdict({ evidence: { deployments: [d('augur-preview', 'preview', 90), d('augur-workbench', 'dev', 5, true)] } }).problem, /^augur-workbench went back from it\./);
  });

  it('records an override, and refuses when the portal wasn’t asked unless that is overridden too', () => {
    assert.deepEqual(bakeVerdict({ evidence: { deployments: [] }, skip: true }).record, { checked: true, needs: 72, overridden: true, problem: 'No preview deployment has reported running it.' });
    assert.match(bakeVerdict({ notAsked: 'PORTAL_URL isn’t set.' }).problem, /^PORTAL_URL isn’t set\. .*Skip the bake time/);
    assert.deepEqual(bakeVerdict({ notAsked: 'PORTAL_URL isn’t set.', skip: true }), { record: { checked: false, why: 'PORTAL_URL isn’t set.', overridden: true } });
  });
});

describe('the deploy test', () => {
  const result = { version: '0.14.0', passed: true, run: '7', at: 't', from: '0.13.0' };

  it('lets an AUGUR release go stable once its last deploy test passed, and records the run', () => {
    assert.deepEqual(deployTestVerdict({ unit: AUGUR, version: '0.14.0', result }), { record: { run: '7', at: 't', upgradedFrom: '0.13.0' } });
    assert.deepEqual(deployTestVerdict({ unit: AUGUR, version: '0.14.0', result: { ...result, from: null } }).record.upgradedFrom, null);
  });

  it('refuses a release with no result, a failed one, or one for another version, saying what to do', () => {
    assert.match(deployTestVerdict({ unit: AUGUR, version: '0.14.0' }).problem, /^It has no deploy test result\. Run Deploy test/);
    assert.match(deployTestVerdict({ unit: AUGUR, version: '0.14.0', result: { ...result, passed: false } }).problem, /^Its last deploy test failed \(run 7\)\./);
    assert.match(deployTestVerdict({ unit: AUGUR, version: '0.14.0', result: { ...result, passed: 'true' } }).problem, /failed/);
    // The Release workflow's pending result, before the deploy test has replaced it.
    assert.match(deployTestVerdict({ unit: AUGUR, version: '0.14.0', result: { ...result, passed: null } }).problem, /^Its deploy test hasn’t finished \(run 7\)\./);
    assert.match(deployTestVerdict({ unit: AUGUR, version: '0.15.0', result }).problem, /^Its deploy test result is for 0\.14\.0\./);
  });

  it('asks nothing of an app, which has no deploy test', () => {
    assert.deepEqual(deployTestVerdict({ unit: 'mandate', version: '0.1.6' }), {});
  });

  it('goes in the promotion record when there is one', () => {
    const deployTest = { run: '7', at: 't', upgradedFrom: '0.13.0' };
    assert.deepEqual(promotionRecord({ unit: AUGUR, version: '0.14.0', actor: 'owner', at: 't', run: '1', deployTest }).deployTest, deployTest);
  });
});

describe('where a promotion happens', () => {
  const units = { repo: 'harry-burton-dev/augur', here: ['mandate'], own: { notes: 'someone/augur-notes' }, shipped: ['folio'] };

  it('AUGUR and the apps released here are promoted here', () => {
    assert.deepEqual(promotionSource(AUGUR, units), { repo: 'harry-burton-dev/augur', own: false });
    assert.deepEqual(promotionSource('mandate', units), { repo: 'harry-burton-dev/augur', own: false });
  });

  it('an app in its own repository is promoted there', () => {
    assert.deepEqual(promotionSource('notes', units), { repo: 'someone/augur-notes', own: true });
  });

  it('a pillar app is refused, and told to promote AUGUR', () => {
    assert.match(promotionSource('folio', units).problem, /ships with AUGUR.*Promote augur/);
  });

  it('anything else names the units there are', () => {
    assert.equal(promotionSource('nope', units).problem, '"nope" is not a unit: augur, mandate, notes.');
  });
});
