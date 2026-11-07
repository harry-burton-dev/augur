import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { KEPT_VERSIONS, PgAppStore, RouteTakenError, UnknownVersionError, type AppStore } from './store.ts';

const library = { id: 'library', name: 'Library', route: '/library', entry: '/apps/library/entry.js', version: '0.1.0', sdk: '^1.0.0' };

/** The same behaviour from every store. */
const behavesLikeAStore = (make: () => AppStore, reset: () => Promise<void> = async () => {}) => {
  let store: AppStore;
  beforeEach(async () => {
    await reset();
    store = make();
  });

  it('keeps an app’s upstream while it registers new versions', async () => {
    await store.put(library, 'library');
    expect(await store.setUpstream('nothing', 'http://x:1')).toBeUndefined();
    expect((await store.setUpstream('library', 'http://app-library:8090'))?.upstream).toBe('http://app-library:8090');
    await store.put({ ...library, version: '0.2.0' }, 'library');
    expect((await store.records())[0].upstream).toBe('http://app-library:8090');
    expect((await store.setUpstream('library', null))?.upstream).toBeUndefined();
  });

  it('keeps a version’s newest frontend, and forgets them with the app', async () => {
    const first = await store.putFrontend({ app: 'library', version: '0.1.0', digest: 'sha256:a', files: ['entry.js'], bytes: 10, publishedBy: 'library' });
    expect(first).toMatchObject({ app: 'library', version: '0.1.0', digest: 'sha256:a', files: ['entry.js'], bytes: 10 });
    expect(await store.putFrontend({ app: 'library', version: '0.1.0', digest: 'sha256:b', folder: '0.1.0_b', files: ['x.js'], bytes: 1, publishedBy: 'library' })).toMatchObject({ digest: 'sha256:b', folder: '0.1.0_b', files: ['x.js'] });
    await store.putFrontend({ app: 'papers', version: '1.0.0', digest: 'sha256:c', files: ['entry.js'], bytes: 1, publishedBy: 'papers' });
    expect((await store.frontends('library')).map((f) => f.version)).toEqual(['0.1.0']);
    expect(await store.frontends()).toHaveLength(2);
    await store.put(library, 'library');
    await store.remove('library', 'u-1');
    expect((await store.frontends()).map((f) => f.app)).toEqual(['papers']);
  });

  it('keeps one upgrade open at a time, with each step it took', async () => {
    const ask = (id: string) => store.requestUpgrade({ id, from: '0.2.0', version: '0.3.0', images: { web: 'web@sha256:aa' }, requestedBy: 'u-1', requestedByName: 'Alex' });
    expect(await store.upgrade()).toBeUndefined();
    expect(await ask('up-1')).toBe(true);
    expect(await ask('up-2')).toBe(false);
    expect(await store.progressUpgrade('up-2', { step: 'preflight', state: 'done' })).toBeUndefined();
    expect((await store.progressUpgrade('up-1', { step: 'preflight', state: 'running' }))?.state).toBe('running');
    expect(await store.cancelUpgrade('up-1')).toBe(false);
    await store.progressUpgrade('up-1', { step: 'preflight', state: 'done' });
    const done = await store.progressUpgrade('up-1', { step: 'verify', state: 'done' }, { state: 'done', message: 'Running 0.3.0' });
    expect(done).toMatchObject({ id: 'up-1', state: 'done', message: 'Running 0.3.0', images: { web: 'web@sha256:aa' } });
    expect(done?.steps.map((s) => `${s.step} ${s.state}`)).toEqual(['preflight done', 'verify done']);
    expect(done?.finishedAt).toBeDefined();
    // A finished upgrade keeps its light watch (ADR 0020, amended 2 Nov); an open one has none.
    const watching = { state: 'watching' as const, since: '2026-11-01T02:20:00.000Z', until: '2026-11-02T02:20:00.000Z', calls: 3, serverErrors: 0, signInMisses: 0 };
    expect(await store.setAfterWatch('up-1', watching)).toBe(true);
    expect((await store.upgrade())?.afterWatch).toEqual(watching);
    expect(await ask('up-3')).toBe(true);
    expect(await store.setAfterWatch('up-3', watching)).toBe(false);
    expect(await store.cancelUpgrade('up-3')).toBe(true);
    expect((await store.upgrade())?.state).toBe('cancelled');
    // The history keeps every one, newest first, with who asked.
    expect((await store.upgrades()).map((u) => `${u.id} ${u.state} ${u.requestedByName}`)).toEqual(['up-3 cancelled Alex', 'up-1 done Alex']);
    await store.forgetPerson('someone-else');
    expect((await store.upgrades()).map((u) => u.requestedByName)).toEqual(['Alex', 'Alex']);
    await store.forgetPerson('u-1');
    expect(await store.upgrades()).toEqual([expect.not.objectContaining({ requestedByName: expect.anything() }), expect.not.objectContaining({ requestedByName: expect.anything() })]);
    expect((await store.upgrades()).map((u) => u.requestedBy)).toEqual(['u-1', 'u-1']);
    // The place it has followed domain events to.
    expect(await store.followedTo()).toBeUndefined();
    await store.setFollowedTo('12');
    await store.setFollowedTo('13');
    expect(await store.followedTo()).toBe('13');
    expect((await store.upgrades(1)).map((u) => u.id)).toEqual(['up-3']);
    // Only the names of settings entered for an upgrade are kept, never their values.
    expect(await store.requestUpgrade({ id: 'up-4', from: '0.3.0', version: '0.4.0', images: {}, requestedBy: 'u-1', settingNames: ['OBJECT_STORE_URL'] })).toBe(true);
    expect((await store.upgrade())?.settingNames).toEqual(['OBJECT_STORE_URL']);
    expect(await store.cancelUpgrade('up-4')).toBe(true);
  });

  it('keeps one job open per app for the app runner, oldest first', async () => {
    const ask = (id: string, app: string, action: 'install' | 'remove' = 'remove') => store.requestAppJob({ id, app, action, requestedBy: 'u-1' });
    expect(await store.nextAppJob()).toBeUndefined();
    expect(await ask('j-1', 'notes')).toBe(true);
    expect(await ask('j-2', 'notes')).toBe(false);
    expect(await ask('j-3', 'tasks')).toBe(true);
    expect((await store.nextAppJob())?.id).toBe('j-1');
    expect((await store.progressAppJob('j-1', { step: 'remove', state: 'running' }))?.state).toBe('running');
    expect(await store.cancelAppJob('j-1')).toBe(false);
    const done = await store.progressAppJob('j-1', { step: 'remove', state: 'done' }, { state: 'done' });
    expect(done).toMatchObject({ app: 'notes', action: 'remove', state: 'done', steps: [{ step: 'remove', state: 'done' }] });
    expect(await store.progressAppJob('j-1', { step: 'remove', state: 'done' })).toBeUndefined();
    expect((await store.nextAppJob())?.id).toBe('j-3');
    expect(await store.cancelAppJob('j-3')).toBe(true);
    expect(await store.nextAppJob()).toBeUndefined();
    expect((await store.appJobs('notes')).map((j) => j.id)).toEqual(['j-1']);
    expect(await store.appJobs()).toHaveLength(2);
  });

  it('knows which apps the runner installed, and how each follows new releases', async () => {
    const release = (version: string) => ({ schema: 'augur.app-release/v1' as const, id: 'notes', version, channel: 'stable', manifest: { ...library, id: 'notes', version }, service: { image: 'x@sha256:aa' }, frontend: null, signer: { repository: 'o/r', workflow: '.github/workflows/release.yml' } });
    const finish = async (id: string, job: Parameters<AppStore['requestAppJob']>[0], state: 'done' | 'failed' = 'done') => {
      await store.requestAppJob({ ...job, id });
      await store.progressAppJob(id, { step: 'retire', state: 'done' }, { state });
    };
    await finish('i-1', { id: '', app: 'notes', action: 'install', release: release('1.0.0'), requestedBy: 'u-1' });
    await finish('i-2', { id: '', app: 'notes', action: 'install', release: release('1.1.0'), requestedBy: 'u-1' }, 'failed');
    expect((await store.installedApps()).map((i) => `${i.app} ${i.release.version}`)).toEqual(['notes 1.0.0']);
    await finish('i-3', { id: '', app: 'notes', action: 'remove', requestedBy: 'u-1' });
    expect(await store.installedApps()).toEqual([]);
    expect(await store.follows()).toEqual([]);
    await store.setFollow({ app: 'notes', channel: 'beta', policy: 'ask', setBy: 'u-1' });
    await store.setFollow({ app: 'notes', channel: 'stable', policy: 'hold', setBy: 'u-2' });
    expect(await store.follows()).toEqual([expect.objectContaining({ app: 'notes', channel: 'stable', policy: 'hold', setBy: 'u-2' })]);
  });

  it('keeps each unit’s desired state with its history, keeps a follow’s other fields, and marks results looked at', async () => {
    await store.setDesiredState({ unit: 'augur', channel: 'stable', policy: 'automatic', automaticUpTo: 'minor', pin: '0.13.x', windows: [{ day: 0, start: '02:00', hours: 3 }], timeZone: 'Europe/London', setBy: 'u-1' });
    await store.setDesiredState({ unit: 'augur', channel: 'stable', policy: 'hold', automaticUpTo: 'minor', windows: [], setBy: 'u-2' });
    expect(await store.desiredStates()).toEqual([expect.objectContaining({ unit: 'augur', policy: 'hold', windows: [], setBy: 'u-2' })]);
    expect((await store.desiredStateHistory('augur')).map((h) => `${h.policy} ${h.pin ?? '-'} ${h.timeZone ?? '-'}`)).toEqual(['hold - -', 'automatic 0.13.x Europe/London']);
    // AUGUR's record isn't an app's follow; a follow keeps the rest of its app's record.
    expect(await store.follows()).toEqual([]);
    await store.setDesiredState({ unit: 'notes', channel: 'stable', policy: 'automatic', automaticUpTo: 'patch', pin: '1.x', windows: [], setBy: 'u-1' });
    await store.setFollow({ app: 'notes', channel: 'beta', policy: 'ask', setBy: 'u-3' });
    expect((await store.desiredStates()).find((s) => s.unit === 'notes')).toMatchObject({ channel: 'beta', policy: 'ask', automaticUpTo: 'patch', pin: '1.x', setBy: 'u-3' });

    await store.requestUpgrade({ id: 'up-9', from: '0.1.0', version: '0.2.0', images: {}, requestedBy: 'u-1' });
    expect(await store.markSeen('upgrade', 'up-9', 'u-1')).toBe(false);
    await store.progressUpgrade('up-9', { step: 'verify', state: 'failed' }, { state: 'failed' });
    expect(await store.markSeen('upgrade', 'up-9', 'u-1')).toBe(true);
    expect(await store.upgrade()).toMatchObject({ id: 'up-9', seenBy: 'u-1', seenAt: expect.any(String) });
    expect(await store.markSeen('app-job', 'none', 'u-1')).toBe(false);
  });

  it('keeps pull requests’ previews apart from the app, and who may try them', async () => {
    const release = (version: string) => ({ schema: 'augur.app-release/v1' as const, id: 'notes', version, channel: 'preview', manifest: { ...library, id: 'notes', version }, service: { image: 'x@sha256:aa' }, frontend: null, signer: { repository: 'o/r', workflow: '.github/workflows/release.yml' } });
    expect(await store.requestAppJob({ id: 'p-1', app: 'notes', action: 'preview', release: release('1.1.0-pr.3.1'), pr: 3, requestedBy: 'automatic' })).toBe(true);
    expect(await store.requestAppJob({ id: 'p-2', app: 'notes', action: 'preview', release: release('1.1.0-pr.3.2'), pr: 3, requestedBy: 'automatic' })).toBe(false);
    // Another pull request, and the app itself, each have their own.
    expect(await store.requestAppJob({ id: 'p-3', app: 'notes', action: 'preview', release: release('1.1.0-pr.4.1'), pr: 4, requestedBy: 'automatic' })).toBe(true);
    expect(await store.requestAppJob({ id: 'i-1', app: 'notes', action: 'remove', requestedBy: 'u-1' })).toBe(true);
    await store.progressAppJob('p-1', { step: 'switch', state: 'done' }, { state: 'done', upstream: 'http://app-notes-pr3:8080' });
    await store.progressAppJob('p-3', { step: 'start', state: 'failed' }, { state: 'failed' });
    await store.progressAppJob('i-1', { step: 'remove', state: 'done' }, { state: 'done' });
    expect(await store.runningPreviews()).toEqual([expect.objectContaining({ app: 'notes', pr: 3, upstream: 'http://app-notes-pr3:8080', release: expect.objectContaining({ version: '1.1.0-pr.3.1' }) })]);
    expect((await store.appJobs('notes')).find((j) => j.id === 'p-1')).toMatchObject({ pr: 3, upstream: 'http://app-notes-pr3:8080' });
    expect(await store.installedApps()).toEqual([]);
    await store.requestAppJob({ id: 'p-4', app: 'notes', action: 'preview-remove', pr: 3, requestedBy: 'automatic' });
    await store.progressAppJob('p-4', { step: 'remove', state: 'done' }, { state: 'done' });
    expect(await store.runningPreviews()).toEqual([]);

    expect((await store.setDevelopers('notes', ['u-2', 'u-3'], 'u-1')).map((d) => d.person).sort()).toEqual(['u-2', 'u-3']);
    await store.choosePreview('u-2', 'notes', 3);
    await store.choosePreview('u-3', 'notes', 3);
    await store.choosePreview('u-2', 'notes', 4);
    expect(await store.previewChoices('u-2')).toEqual([{ person: 'u-2', app: 'notes', pr: 4 }]);
    // Taken off the developers, their choice goes too.
    await store.setDevelopers('notes', ['u-2'], 'u-1');
    expect((await store.developers()).map((d) => d.person)).toEqual(['u-2']);
    expect(await store.previewChoices()).toEqual([{ person: 'u-2', app: 'notes', pr: 4 }]);
    await store.choosePreview('u-2', 'notes', null);
    expect(await store.previewChoices()).toEqual([]);
  });

  it('grants what an app first asks for, and only what an admin grants after', async () => {
    await store.put({ ...library, scopes: ['notifications:send'] }, 'library');
    await store.put({ ...library, version: '0.2.0', scopes: ['notifications:send', 'audit:write'] }, 'library');
    expect((await store.records())[0].grantedScopes).toEqual(['notifications:send']);
    expect((await store.grant('library', ['notifications:send', 'audit:write']))?.grantedScopes).toEqual(['notifications:send', 'audit:write']);
    expect(await store.grant('nothing', [])).toBeUndefined();
  });

  it('keeps an admin’s upload limit while the app registers new versions', async () => {
    await store.put({ ...library, maxUpload: 200 }, 'library');
    expect((await store.limitUploads('library', 50))?.uploadLimitMb).toBe(50);
    await store.put({ ...library, version: '0.2.0', maxUpload: 200 }, 'library');
    expect((await store.records())[0].uploadLimitMb).toBe(50);
    expect((await store.limitUploads('library', null))?.uploadLimitMb).toBeUndefined();
    expect(await store.limitUploads('nothing', 5)).toBeUndefined();
  });

  it('keeps an admin’s settings while the app registers new versions, until they’re taken away', async () => {
    await store.put(library, 'library');
    const set = await store.setSetting('library', 'retentionDays', 90, 'u-1');
    expect(set?.settings?.retentionDays).toMatchObject({ value: 90, setBy: 'u-1' });
    expect(Date.parse(set!.settings!.retentionDays.setAt)).not.toBeNaN();
    await store.setSetting('library', 'other', 3, 'u-2');
    await store.put({ ...library, version: '0.2.0' }, 'library');
    expect(Object.keys((await store.records())[0].settings ?? {}).sort()).toEqual(['other', 'retentionDays']);
    expect((await store.setSetting('library', 'retentionDays', null, 'u-1'))?.settings?.retentionDays).toBeUndefined();
    expect((await store.setSetting('library', 'other', null, 'u-1'))?.settings).toBeUndefined();
    expect(await store.setSetting('nothing', 'other', 5, 'u-1')).toBeUndefined();
  });

  it('keeps the first deployment key it is given', async () => {
    expect(await store.deploymentKey()).toBeUndefined();
    expect(await store.keepDeploymentKey({ privateKey: 'a', publicKey: 'A' })).toEqual({ privateKey: 'a', publicKey: 'A' });
    expect(await store.keepDeploymentKey({ privateKey: 'b', publicKey: 'B' })).toEqual({ privateKey: 'a', publicKey: 'A' });
  });

  it('keeps who gets each feature preview, and who turned one on, until the app goes', async () => {
    await store.put(library, 'library');
    expect((await store.setFeaturePreview('library', 'board', 'everyone', 'u-1'))?.featurePreviews?.board).toMatchObject({ mode: 'everyone', setBy: 'u-1' });
    await store.put({ ...library, version: '0.2.0' }, 'library');
    expect((await store.records())[0].featurePreviews?.board.mode).toBe('everyone');
    expect((await store.setFeaturePreview('library', 'board', null, 'u-1'))?.featurePreviews).toBeUndefined();
    expect(await store.setFeaturePreview('nothing', 'board', 'off', 'u-1')).toBeUndefined();

    await store.setFeatureOptIn('u-1', 'library', 'board', true);
    await store.setFeatureOptIn('u-1', 'library', 'board', true);
    await store.setFeatureOptIn('u-2', 'library', 'tags', true);
    expect(await store.featureOptIns({ person: 'u-1' })).toEqual([{ person: 'u-1', app: 'library', preview: 'board' }]);
    expect(await store.featureOptIns({ app: 'library' })).toHaveLength(2);
    await store.setFeatureOptIn('u-1', 'library', 'board', false);
    expect(await store.featureOptIns({ person: 'u-1' })).toEqual([]);
    await store.remove('library', 'u-1');
    expect(await store.featureOptIns()).toEqual([]);
  });

  it('keeps one rule per app and floor, and forgets them with the app', async () => {
    await store.put(library, 'service');
    await store.setRule({ app: 'library', workspace: 'w-fin', state: 'on', carriesOn: false, setBy: 'u-1' });
    await store.setRule({ app: 'library', workspace: 'w-leg', state: 'off', carriesOn: true, setBy: 'u-1' });
    await store.setRule({ app: 'library', workspace: 'w-fin', state: 'blocked', carriesOn: false, setBy: 'u-2' });
    const rules = await store.rules('library');
    expect(rules.map(({ setAt, ...r }) => (expect(Date.parse(setAt)).not.toBeNaN(), r)).sort((a, b) => a.workspace.localeCompare(b.workspace))).toEqual([
      { app: 'library', workspace: 'w-fin', state: 'blocked', carriesOn: true, setBy: 'u-2' },
      { app: 'library', workspace: 'w-leg', state: 'off', carriesOn: true, setBy: 'u-1' },
    ]);
    expect(await store.clearRule('library', 'w-leg')).toBe(true);
    expect(await store.clearRule('library', 'w-leg')).toBe(false);
    expect(await store.rules('papers')).toEqual([]);
    await store.remove('library', 'u-1');
    expect(await store.rules()).toEqual([]);
  });

  it('adds, replaces and lists apps', async () => {
    expect(await store.put(library, 'service')).toBe(true);
    expect(await store.put({ ...library, version: '0.2.0' }, 'service')).toBe(false);
    expect(await store.list()).toEqual([{ ...library, version: '0.2.0' }]);
  });

  it('turns apps off and on, and keeps them off when they register again', async () => {
    await store.put(library, 'service');
    expect(await store.setEnabled('library', false)).toBe(true);
    await store.put({ ...library, version: '0.2.0' }, 'library');
    const [record] = await store.records();
    expect(record).toMatchObject({ entry: { version: '0.2.0' }, enabled: false, registeredBy: 'library' });
    expect(Date.parse(record.registeredAt)).not.toBeNaN();
    expect(await store.setEnabled('library', true)).toBe(true);
    expect((await store.records())[0].enabled).toBe(true);
    expect(await store.setEnabled('nothing', false)).toBe(false);
  });

  it('keeps the last versions, newest first, and keeps a pinned one past that', async () => {
    for (const minor of [1, 2, 3, 4, 5, 6, 7]) await store.put({ ...library, version: `0.${minor}.0` }, 'library');
    expect((await store.versions('library')).map((v) => v.version)).toEqual(['0.7.0', '0.6.0', '0.5.0', '0.4.0', '0.3.0']);
    expect(KEPT_VERSIONS).toBe(5);
    await store.pin('library', '0.3.0');
    for (const minor of [8, 9]) await store.put({ ...library, version: `0.${minor}.0` }, 'library');
    expect((await store.versions('library')).map((v) => v.version)).toEqual(['0.9.0', '0.8.0', '0.7.0', '0.6.0', '0.5.0', '0.3.0']);
  });

  it('holds a pinned app at its version while new versions register, then serves the newest when let go', async () => {
    await store.put(library, 'library');
    await store.put({ ...library, version: '0.2.0', name: 'Library 2' }, 'library');
    const pinned = await store.pin('library', '0.1.0');
    expect(pinned).toMatchObject({ entry: { version: '0.1.0', name: 'Library' }, pinnedVersion: '0.1.0' });
    expect(await store.put({ ...library, version: '0.3.0' }, 'library')).toBe(false);
    expect((await store.list())[0].version).toBe('0.1.0');
    expect((await store.versions('library'))[0].version).toBe('0.3.0');
    const free = await store.pin('library', null);
    expect(free?.entry.version).toBe('0.3.0');
    expect(free?.pinnedVersion).toBeUndefined();
    await store.put({ ...library, version: '0.4.0' }, 'library');
    expect((await store.list())[0].version).toBe('0.4.0');
  });

  it('refuses a version it doesn’t have, and an app it doesn’t know', async () => {
    await store.put(library, 'library');
    await expect(store.pin('library', '9.9.9')).rejects.toBeInstanceOf(UnknownVersionError);
    expect(await store.pin('nothing', '0.1.0')).toBeUndefined();
  });

  it('keeps the origins apps may load from', async () => {
    expect(await store.allowOrigin('https://apps.example.org', 'u-1')).toBe(true);
    expect(await store.allowOrigin('https://apps.example.org', 'u-2')).toBe(false);
    expect(await store.origins()).toEqual([{ origin: 'https://apps.example.org', addedBy: 'u-1', addedAt: expect.any(String) }]);
    expect(await store.removeOrigin('https://apps.example.org')).toBe(true);
    expect(await store.removeOrigin('https://apps.example.org')).toBe(false);
    expect(await store.origins()).toEqual([]);
  });

  it('removes apps', async () => {
    await store.put(library, 'service');
    expect(await store.remove('library', 'u-1')).toBe(true);
    expect(await store.remove('library', 'u-1')).toBe(false);
    expect(await store.list()).toEqual([]);
    // Remembered until it's registered again.
    expect(await store.removed('library')).toBe(true);
    await store.put(library, 'updater');
    expect(await store.removed('library')).toBe(false);
  });
};


// Runs wherever DATABASE_URL points at a Postgres; CI starts one for it.
describe.runIf(process.env.DATABASE_URL)('PgAppStore', () => {
  let store: PgAppStore;
  let admin: pg.Pool;

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query('drop schema if exists registry cascade');
    store = await PgAppStore.connect(process.env.DATABASE_URL!);
  });
  afterAll(async () => {
    await store.close();
    await admin.end();
  });

  behavesLikeAStore(
    () => store,
    async () => {
      await admin.query('truncate registry.apps, registry.allowed_origins, registry.upgrades, registry.app_frontends, registry.app_jobs, registry.app_follows, registry.app_developers, registry.preview_choices, registry.desired_states, registry.desired_state_history, registry.deployment_key cascade');
    },
  );

  it('migrates once, however often it starts', async () => {
    await Promise.all([store.migrate(), store.migrate()]);
    const { rows } = await admin.query('select id from registry.migrations');
    expect(rows.map((r) => r.id).sort()).toEqual(['001_apps', '002_enabled', '003_versions', '004_origins', '005_floors', '006_upgrades', '007_upload_limit', '008_settings', '009_frontends', '010_upstream', '011_app_jobs', '012_app_follows', '013_previews', '014_upgrade_names', '015_feature_previews', '016_desired_state', '017_deployment_key', '018_after_watch', '019_frontend_folders', '020_upgrade_setting_names', '021_removed_apps', '022_followed_events']);
  });

  it('lets the database refuse a second app on a taken route, so racing registrations cannot both win', async () => {
    await admin.query('truncate registry.apps cascade');
    await store.put(library, 'service');
    await expect(store.put({ ...library, id: 'papers' }, 'service')).rejects.toBeInstanceOf(RouteTakenError);
  });

  it('records who registered an app', async () => {
    await admin.query('truncate registry.apps cascade');
    await store.put(library, 'u-1');
    const { rows } = await admin.query('select registered_by from registry.apps');
    expect(rows).toEqual([{ registered_by: 'u-1' }]);
  });
});
