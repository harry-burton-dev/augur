import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AUGUR, moved, pathsOf, prProblems, promoteBranch, promotionOf, tagOf, unitOf, versionsFrom } from './promote.mjs';

const apps = ['mandate'];

describe('units', () => {
  it('an app’s own folder is the app’s, everything else AUGUR’s', () => {
    assert.equal(unitOf('apps/mandate/service/src/index.ts', apps), 'mandate');
    assert.equal(unitOf('apps/atlas/service/src/index.ts', apps), AUGUR);
    assert.equal(unitOf('platform/services/registry/src/index.ts', apps), AUGUR);
    assert.equal(unitOf('apps/mandatex/manifest.json', apps), AUGUR);
    assert.deepEqual(pathsOf('mandate', ['apps/mandate/manifest.json', 'docs/x.md'], apps), ['apps/mandate/manifest.json']);
  });

  it('versions come from AUGUR’s release file and each app’s manifest', () => {
    const files = { 'release/augur-release.json': '{"version":"0.9.0"}', 'apps/mandate/manifest.json': '{"version":"0.2.0"}' };
    assert.deepEqual(versionsFrom((p) => files[p], apps), { augur: '0.9.0', mandate: '0.2.0' });
    assert.deepEqual(versionsFrom(() => undefined, apps), { augur: undefined, mandate: undefined });
  });

  it('a unit moves when its version differs, but not a new app still on 0.0.0', () => {
    assert.deepEqual(moved({ augur: '0.8.0', mandate: '0.1.1' }, { augur: '0.9.0', mandate: '0.1.1', notes: '0.0.0' }), [{ unit: 'augur', from: '0.8.0', to: '0.9.0' }]);
    assert.deepEqual(moved({ augur: '0.8.0' }, { augur: '0.8.0', notes: '0.1.0' }), [{ unit: 'notes', from: undefined, to: '0.1.0' }]);
  });

  it('tags and promotion branches name the unit and version', () => {
    assert.equal(tagOf(AUGUR, '0.9.0'), 'augur@0.9.0');
    assert.equal(tagOf('mandate', '0.2.0'), 'app/mandate@0.2.0');
    assert.equal(promoteBranch('team-notes', '1.2.0-beta.1'), 'promote/team-notes-1.2.0-beta.1');
    assert.deepEqual(promotionOf('promote/team-notes-1.2.0-beta.1'), { unit: 'team-notes', version: '1.2.0-beta.1' });
    assert.deepEqual(promotionOf('promote/augur-0.9.0'), { unit: 'augur', version: '0.9.0' });
    assert.equal(promotionOf('promote/augur'), undefined);
    assert.equal(promotionOf(undefined), undefined);
  });
});

describe('which pull requests may go where', () => {
  it('anything goes into dev', () => {
    assert.deepEqual(prProblems({ base: 'dev', head: 'claude/thing', pending: ['.changeset/a.md'] }), []);
  });

  it('preview takes dev, a back-merge from production or a hotfix, all versioned', () => {
    assert.deepEqual(prProblems({ base: 'preview', head: 'dev' }), []);
    assert.deepEqual(prProblems({ base: 'preview', head: 'production' }), []);
    assert.deepEqual(prProblems({ base: 'preview', head: 'hotfix/login' }), []);
    assert.equal(prProblems({ base: 'preview', head: 'claude/thing' }).length, 1);
    assert.match(prProblems({ base: 'preview', head: 'dev', pending: ['.changeset/a.md'] })[0], /Version packages/);
  });

  it('production takes a promotion of one unit’s files, or a hotfix', () => {
    assert.deepEqual(prProblems({ base: 'production', head: 'promote/mandate-0.2.0', files: ['apps/mandate/manifest.json', 'pnpm-lock.yaml'], appIds: apps }), []);
    assert.deepEqual(prProblems({ base: 'production', head: 'promote/augur-0.9.0', files: ['platform/x.ts', 'release/augur-release.json'], appIds: apps }), []);
    assert.match(prProblems({ base: 'production', head: 'promote/mandate-0.2.0', files: ['apps/mandate/manifest.json', 'platform/x.ts'], appIds: apps })[0], /platform\/x\.ts/);
    assert.match(prProblems({ base: 'production', head: 'promote/augur-0.9.0', files: ['apps/mandate/manifest.json'], appIds: apps })[0], /apps\/mandate/);
    assert.deepEqual(prProblems({ base: 'production', head: 'hotfix/login', files: ['platform/x.ts', 'apps/mandate/x.ts'], appIds: apps }), []);
    assert.equal(prProblems({ base: 'production', head: 'dev' }).length, 1);
    assert.equal(prProblems({ base: 'production', head: 'preview' }).length, 1);
  });
});
