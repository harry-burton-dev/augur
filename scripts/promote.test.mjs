import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AUGUR, prProblems, promotionRecord, promotionTarget, releaseLineOf, tagOf, unitOf, versionsFrom } from './promote.mjs';

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
