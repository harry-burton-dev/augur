import type { AppContext, FrameState, PlaceItem, RemoteElement, RemoteNode } from '@augur/mfe-sdk/sdk3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppInstalls, AppJob, Deliveries, DesiredState, Overview, OverviewUnit, PlatformStatus, PlatformUpdates } from './model/types.js';
import start, { COMMANDS, OPEN_APP, PLACE_APPS, pathForIntent } from './entry.js';
import { pathOf, routeFor } from './routes.js';

// The shell, as Deployment sees it from its worker: what it draws, what it sets on its pane, what sits
// under Apps, where it moves and whether it asked for the password again. Its `ctx.fetch` ends at
// `answer`, standing in for the gateway and the registry.
type Answer = (path: string, init?: RequestInit) => [number, unknown];

const fakeShell = (answer: Answer, path = '/') => {
  const shell = {
    screen: undefined as RemoteNode,
    pane: {} as FrameState,
    under: new Map<string, PlaceItem[]>(),
    commands: new Map<string, (detail?: unknown) => unknown>(),
    moved: [] as string[],
    calls: [] as { method: string; path: string; body?: unknown }[],
    signedInAgain: 0,
    downloads: [] as string[],
  };
  let navigated: (path: string) => void = () => undefined;
  const root = (put: (node: RemoteNode) => void) => ({ render: put, clear: () => put(null) });
  const ctx: AppContext = {
    person: { id: 'p1', name: 'Sam Admin' },
    workspace: { id: 'ws-org', kind: 'org', name: 'Example Org' },
    path,
    surface: 'screen',
    onNavigate: (h) => {
      navigated = h;
      return () => undefined;
    },
    navigate: (p) => void shell.moved.push(p),
    fetch: async (p, init) => {
      shell.calls.push({ method: init?.method ?? 'GET', path: p, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
      const [status, body] = answer(p, init);
      return status === 204 ? new Response(null, { status }) : Response.json(body, { status });
    },
    frame: {
      screen: root((node) => (shell.screen = node)),
      about: () => root(() => undefined),
      card: root(() => undefined),
      set: (state) => Object.assign(shell.pane, state),
      under: (id, items) => void shell.under.set(id, items),
      onCommand: (id, handler) => {
        shell.commands.set(id, handler);
        return () => shell.commands.delete(id);
      },
    },
    files: { upload: async () => new Response(null, { status: 501 }), download: async (p) => void shell.downloads.push(p), onDrop: () => () => undefined },
    raise: async () => undefined,
    request: async () => Promise.reject(new Error('No app answers that here.')),
    notify: () => undefined,
    signInAgain: () => void shell.signedInAgain++,
    previewOn: () => false,
  };
  return { ctx, shell, move: (p: string) => navigated(p) };
};

const unit = (over: Partial<OverviewUnit> = {}): OverviewUnit => ({
  unit: 'augur',
  name: 'AUGUR',
  running: '0.24.0',
  available: '0.25.0',
  desired: { unit: 'augur', channel: 'beta', policy: 'ask', automaticUpTo: 'patch', windows: [{ day: 0, start: '02:00', hours: 2 }], timeZone: 'Europe/London', setBy: 'default', setAt: '2026-11-01T00:00:00Z', isDefault: true },
  policy: 'AUGUR waits for an admin before taking any release from Beta.',
  window: { open: false, nextAt: '2026-11-15T02:00:00Z' },
  ...over,
});

const overview = (over: Partial<Overview> = {}): Overview => ({
  ring: 'dev',
  timeZone: 'Europe/London',
  feed: 'on',
  checkedAt: '2026-11-09T22:00:00Z',
  units: [
    unit(),
    unit({
      unit: 'mandate',
      name: 'Mandate',
      running: '1.4.0',
      available: '1.4.1',
      policy: 'Mandate takes patch releases by itself in its window.',
      desired: { ...unit().desired, unit: 'mandate', policy: 'automatic' },
      automatic: { takes: 'It takes 1.4.1 by itself in the window.' },
    }),
  ],
  needsYou: [],
  you: { deploymentAdmin: true },
  ...over,
});

const updates = (over: Partial<PlatformUpdates> = {}): PlatformUpdates => ({
  running: { version: '0.24.0', channel: 'beta' },
  channel: 'beta',
  ring: 'dev',
  feed: 'on',
  checkedAt: '2026-11-09T22:00:00Z',
  available: { version: '0.25.0', channel: 'beta', breaking: ['Sessions are signed again.'], parts: [] },
  newer: [{ version: '0.25.0', channel: 'beta', breaking: ['Sessions are signed again.'] }],
  next: '0.25.0',
  needsYou: [{ kind: 'setting', key: 'KNOWLEDGE_CLIENT_SECRET', required: true, message: 'Set KNOWLEDGE_CLIENT_SECRET.' }],
  goBack: [{ version: '0.23.1', channel: 'beta' }],
  history: [{ id: 'h1', from: '0.23.1', version: '0.24.0', requestedBy: 'p1', requestedAt: '2026-11-09T10:00:00Z', finishedAt: '2026-11-09T10:04:00Z', state: 'done' }],
  updaterSeenAt: '2026-11-09T22:29:00Z',
  haltedInstall: { allowed: true },
  ...over,
});

const installs = (over: Partial<AppInstalls> = {}): AppInstalls => ({
  feed: 'on',
  sdkVersion: '3.0.0',
  installed: [{ app: 'mandate', name: 'Mandate', version: '1.4.0', installedAt: '2026-11-01T00:00:00Z', channel: 'beta', policy: 'automatic', update: { version: '1.4.1', channel: 'beta', needs: [] }, older: [{ version: '1.3.0', channel: 'beta' }] }],
  available: [],
  ...over,
});

const jobs: AppJob[] = [{ id: 'j1', app: 'mandate', action: 'install', release: { version: '1.4.0', channel: 'beta' }, requestedBy: 'p2', requestedAt: '2026-11-01T00:00:00Z', state: 'done', finishedAt: '2026-11-01T00:01:00Z' }];

const status = (over: Partial<PlatformStatus> = {}): PlatformStatus => ({
  components: [
    { name: 'gateway', kind: 'gateway', state: 'up', version: '0.25.0', latencyMs: 3, seenAt: '2026-11-09T22:29:00Z' },
    { name: 'registry', kind: 'service', state: 'up', version: '0.25.0', latencyMs: 8, seenAt: '2026-11-09T22:29:00Z' },
    { name: 'knowledge', kind: 'service', state: 'down', problem: 'It didn’t answer.' },
  ],
  backups: {
    state: 'attention',
    problem: 'No copy off the server yet.',
    lastBackup: { at: '2026-11-09T03:00:00Z', ok: true, bytes: 5_242_880 },
    pointInTime: { at: '2026-11-09T03:00:00Z', ok: true, earliest: '2026-11-03T03:00:00Z', lastTest: { at: '2026-11-09T03:10:00Z', ok: true } },
    lastRestoreTest: { at: '2026-11-08T04:00:00Z', ok: true, from: 'local', people: 12 },
  },
  email: { state: 'off', problem: 'No relay is set (SMTP_HOST).' },
  ...over,
});

const deliveries: Deliveries = {
  pushing: { on: true },
  deliveries: [{ app: 'mandate', failures: 3, nextAt: null, lastError: 'HTTP 502', failingSince: '2026-11-09T22:00:00Z', deliveredAt: null, dropped: 0, droppedAt: null, state: 'retrying', words: 'Retrying: 3 tries so far.' }],
};

/** The registry and the gateway, answering each read from what a test gives it, and each change as it says. */
const registry =
  (given: { overview?: Overview; updates?: PlatformUpdates; installs?: AppInstalls; status?: PlatformStatus | null; history?: DesiredState[]; change?: Answer } = {}): Answer =>
  (path, init) => {
    const method = init?.method ?? 'GET';
    if (method !== 'GET' && given.change) return given.change(path, init);
    if (path === '/api/gateway/v1/status') return given.status === null ? [502, { message: 'Bad gateway.' }] : [200, given.status ?? status()];
    if (path === '/api/events/v1/deliveries') return [200, deliveries];
    if (path.endsWith('/platform/overview')) return [200, given.overview ?? overview()];
    if (path.endsWith('/platform/updates')) return [200, given.updates ?? updates()];
    if (path.endsWith('/app-runner/apps')) return [200, given.installs ?? installs()];
    if (path.endsWith('/app-runner/jobs')) return [200, { jobs }];
    if (path.endsWith('/desired-state/history'))
      return [200, { history: path.includes('/augur/') ? given.history ?? [{ ...unit().desired, setBy: 'default' }, { ...unit().desired, policy: 'hold', setBy: 'p1', setAt: '2026-11-08T09:00:00Z' }] : [] }];
    if (path.endsWith('/platform/reporting')) return [200, { mode: 'file', why: 'This deployment can’t reach Backstage, so its record is exported by hand.', deployment: 'workbench', publicKey: 'ssh-ed25519 AAAA' }];
    return [404, { message: 'Not here.' }];
  };

/** Every element in a tree, depth first. */
const elements = (node: RemoteNode): RemoteElement[] =>
  Array.isArray(node) ? node.flatMap(elements) : node && typeof node === 'object' ? [node, ...elements(node.children)] : [];
const text = (node: RemoteNode) => JSON.stringify(node);
const find = (node: RemoteNode, type: string, where: (props: Record<string, unknown>) => boolean = () => true) => elements(node).find((e) => e.type === type && where(e.props ?? {}));
const settle = () => new Promise((r) => setTimeout(r, 0));
const handler = (e: RemoteElement | undefined, name: string) => (e?.props?.[name] as (detail?: unknown) => void) ?? (() => undefined);

const open = async (answer: Answer, path = '/') => {
  const shell = fakeShell(answer, path);
  await start(shell.ctx);
  await settle();
  return shell;
};

afterEach(() => vi.useRealTimers());

describe('routes', () => {
  it('opens the app another app asks for, or the list when it names none', () => {
    expect(pathForIntent({ type: OPEN_APP, payload: { app: 'atlas' } })).toBe(pathOf({ page: 'app', app: 'atlas' }));
    expect(pathForIntent({ type: OPEN_APP, payload: {} })).toBe(pathOf({ page: 'apps' }));
    expect(pathForIntent({ type: 'something.else', payload: {} })).toBeUndefined();
    expect(pathForIntent(undefined)).toBeUndefined();
  });

  it('reads every page and question back from its path', () => {
    for (const r of [
      { page: 'overview' },
      { page: 'augur' },
      { page: 'augur', ask: { kind: 'upgrade', version: '0.25.0' } },
      { page: 'augur', ask: { kind: 'roll-back', version: '0.23.1' } },
      { page: 'augur', ask: { kind: 'test', version: '0.25.1' } },
      { page: 'apps' },
      { page: 'apps', address: '' },
      { page: 'apps', address: 'https://example.test/r/app-release.json' },
      { page: 'app', app: 'mandate' },
      { page: 'app', app: 'mandate', install: '1.4.1' },
      { page: 'app', app: 'mandate', ask: { kind: 'roll-back', version: '1.3.0' } },
      { page: 'app', app: 'mandate', ask: { kind: 'remove' } },
      { page: 'app', app: 'mandate', ask: { kind: 'internet' } },
      { page: 'app', app: 'mandate', ask: { kind: 'new-sign-in' } },
      { page: 'health' },
      { page: 'backups' },
      { page: 'channel' },
    ] as const)
      expect(routeFor(pathOf(r))).toEqual(r);
    expect(routeFor('/nonsense')).toEqual({ page: 'overview' });
    expect(routeFor('/augur/unknown/1.0.0')).toEqual({ page: 'augur' });
  });
});

describe('Deployment', () => {
  it('shows the one ask, what is installed and the status, drawing only Quill by name', async () => {
    const { shell } = await open(registry());
    expect(shell.pane.title).toBe('Overview');
    expect(elements(shell.screen).every((e) => e.type.startsWith('quill-'))).toBe(true);
    const ask = find(shell.screen, 'quill-notice', (p) => p.tone === 'needs');
    expect(ask?.props).toMatchObject({ heading: 'Update available: AUGUR 0.25.0', action: 'Review the upgrade' });
    expect(text(ask?.children)).toContain('1 breaking change needs action');
    const table = find(shell.screen, 'quill-table');
    expect((table?.props?.rows as { component: string; available: string }[]).map((r) => [r.component, r.available])).toEqual([
      ['AUGUR', '0.25.0'],
      ['Mandate', '1.4.1'],
    ]);
    expect(text(table)).toContain('Patch update, automatic in the window');
    expect(text(find(shell.screen, 'quill-details'))).toContain('Beta');
    // Each installed app sits under Apps in the rail.
    expect(shell.under.get(PLACE_APPS)?.map((i) => i.path)).toEqual(['/apps/mandate']);
  });

  it('shows a plain admin what a deployment admin could do, with the role named, and no way in', async () => {
    const { shell } = await open(registry({ overview: overview({ you: { deploymentAdmin: false } }) }));
    const ask = find(shell.screen, 'quill-notice', (p) => p.tone === 'needs');
    expect(ask?.props?.action).toBeUndefined();
    expect(text(ask?.children)).toContain('deployment-admin');
  });

  it('opens a component from the table', async () => {
    const { shell } = await open(registry());
    handler(find(shell.screen, 'quill-table'), 'onOpen')('augur');
    expect(shell.moved).toEqual(['/augur']);
    expect(shell.pane.title).toBe('AUGUR');
  });

  it('shows AUGUR’s updates, roll-back targets and its own upgrade history', async () => {
    const { shell } = await open(registry(), '/augur');
    const offer = find(shell.screen, 'quill-list', (p) => p.label === 'Available updates');
    expect(offer?.props?.items).toMatchObject([{ id: '0.25.0', actions: [{ id: 'upgrade', label: 'Upgrade to 0.25.0' }] }]);
    expect(text(offer)).toContain('1 breaking change');
    const back = find(shell.screen, 'quill-list', (p) => p.label === 'Roll back');
    expect(back?.props?.items).toMatchObject([{ id: '0.23.1', actions: [{ label: 'Roll back to 0.23.1' }] }]);
    const history = find(shell.screen, 'quill-paged-list', (p) => p.label === 'Upgrade history');
    expect(history?.props?.items).toMatchObject([{ id: 'h1', title: 'Upgrade now from 0.23.1 to 0.24.0', status: 'done' }]);
    expect(text(history)).toContain('Sam Admin');
  });

  it('upgrades from its own path, with the settings only a person can give', async () => {
    const { shell } = await open(registry({ change: () => [200, updates({ upgrade: { id: 'u1', from: '0.24.0', version: '0.25.0', requestedBy: 'p1', requestedAt: '', state: 'requested', steps: [] } })] }), '/augur');
    handler(find(shell.screen, 'quill-list', (p) => p.label === 'Available updates'), 'onAction')({ item: '0.25.0', action: 'upgrade' });
    expect(shell.moved.at(-1)).toBe('/augur/upgrade/0.25.0');
    const dialog = find(shell.screen, 'quill-dialog');
    expect(dialog?.props?.heading).toBe('Upgrade to AUGUR 0.25.0?');
    expect(find(dialog?.children, 'quill-text-field')?.props).toMatchObject({ name: 'KNOWLEDGE_CLIENT_SECRET', slot: 'fields' });
    handler(dialog, 'onSubmit')({ KNOWLEDGE_CLIENT_SECRET: ' s3cret ', when: 'now' });
    await settle();
    expect(shell.calls.find((c) => c.method === 'PUT')).toEqual({ method: 'PUT', path: '/api/registry/v1/platform/upgrade', body: { version: '0.25.0', settings: { KNOWLEDGE_CLIENT_SECRET: 's3cret' } } });
    expect(shell.moved.at(-1)).toBe('/augur');
    expect(find(shell.screen, 'quill-dialog')).toBeUndefined();
  });

  it('asks for the password again when the registry needs it, and comes back to the same question', async () => {
    const { shell } = await open(registry({ change: () => [401, { error: 'sign_in_again', message: 'Enter your password again.' }] }), '/augur/upgrade/0.25.0');
    expect(find(shell.screen, 'quill-dialog')).toBeDefined();
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({});
    await settle();
    expect(shell.signedInAgain).toBe(1);
  });

  it('says in the dialog why the registry turned a change down', async () => {
    const { shell } = await open(registry({ change: () => [409, { message: 'An upgrade is already under way.' }] }), '/augur/roll-back/0.23.1');
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({});
    await settle();
    expect(find(shell.screen, 'quill-dialog')?.props).toMatchObject({ heading: 'Roll back to AUGUR 0.23.1?', error: 'An upgrade is already under way.' });
  });

  it('won’t open a question it can’t ask, and says why instead', async () => {
    const plain = await open(registry({ overview: overview({ you: { deploymentAdmin: false } }) }), '/augur/upgrade/0.25.0');
    expect(find(plain.shell.screen, 'quill-dialog')).toBeUndefined();
    expect(text(find(plain.shell.screen, 'quill-notice', (p) => p.tone === 'refused'))).toContain('deployment-admin');
    const skip = await open(registry({ updates: updates({ newer: [{ version: '0.25.0', channel: 'beta', breaking: [] }, { version: '0.26.0', channel: 'beta', breaking: [] }] }) }), '/augur/upgrade/0.26.0');
    expect(text(find(skip.shell.screen, 'quill-notice', (p) => p.tone === 'refused'))).toContain('one release at a time');
  });

  it('follows an upgrade step by step, and cancels one that hasn’t started', async () => {
    const running = updates({
      upgrade: { id: 'u1', from: '0.24.0', version: '0.25.0', requestedBy: 'p1', requestedAt: '2026-11-09T22:30:00Z', state: 'running', steps: [{ step: 'preflight', state: 'done', at: '' }, { step: 'backup', state: 'running', at: '' }] },
    });
    const { shell } = await open(registry({ updates: running }));
    expect(find(shell.screen, 'quill-progress')?.props).toMatchObject({ label: 'Upgrade in progress: AUGUR 0.24.0 to 0.25.0', valueText: 'Step 2 of 6: Back up and verify the backup' });
    const queued = await open(registry({ updates: updates({ upgrade: { ...running.upgrade!, state: 'requested', steps: [] } }), change: () => [200, updates()] }), '/augur');
    expect(find(queued.shell.screen, 'quill-steps')).toBeDefined();
    handler(find(queued.shell.screen, 'quill-ask-twice'), 'onPress')();
    await settle();
    expect(queued.shell.calls.find((c) => c.method === 'DELETE')?.path).toBe('/api/registry/v1/platform/upgrade');
  });

  it('installs an app’s update from its page', async () => {
    const { shell } = await open(registry({ change: () => [200, jobs[0]] }), '/apps/mandate');
    expect(shell.pane.title).toBe('Mandate');
    expect(find(shell.screen, 'quill-paged-list', (p) => p.label === 'Install history')?.props?.items).toMatchObject([{ id: 'j1', status: 'done' }]);
    handler(find(shell.screen, 'quill-list', (p) => p.label === 'Available updates'), 'onAction')({ item: '1.4.1', action: 'install' });
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({});
    await settle();
    expect(shell.calls.find((c) => c.method === 'POST')).toEqual({ method: 'POST', path: '/api/registry/v1/app-runner/jobs', body: { action: 'install', app: 'mandate', version: '1.4.1' } });
    expect(shell.moved.at(-1)).toBe('/apps/mandate');
  });

  it('rolls an app back from its page, saying it goes on hold, at a path of its own', async () => {
    const { shell } = await open(registry({ change: () => [200, jobs[0]] }), '/apps/mandate');
    const back = find(shell.screen, 'quill-list', (p) => p.label === 'Roll back');
    expect(back?.props?.items).toMatchObject([{ id: '1.3.0', actions: [{ id: 'roll-back', label: 'Roll back to 1.3.0' }] }]);
    expect(JSON.stringify(back?.props?.items)).not.toContain('disabled');
    handler(back, 'onAction')({ item: '1.3.0', action: 'roll-back' });
    expect(shell.moved).toEqual(['/apps/mandate/roll-back/1.3.0']);
    const ask = find(shell.screen, 'quill-dialog');
    expect(ask?.props).toMatchObject({ heading: 'Roll Mandate back to 1.3.0?', actionLabel: 'Roll back' });
    expect(String(ask?.props?.summary)).toContain('on hold');
    handler(ask, 'onSubmit')({});
    await settle();
    expect(shell.calls.find((c) => c.method === 'POST')).toEqual({ method: 'POST', path: '/api/registry/v1/app-runner/jobs', body: { action: 'install', app: 'mandate', version: '1.3.0' } });
    expect(shell.moved.at(-1)).toBe('/apps/mandate');
  });

  it('won’t roll back to a release that isn’t an earlier one, and says why', async () => {
    const { shell } = await open(registry(), '/apps/mandate/roll-back/0.1.0');
    expect(find(shell.screen, 'quill-notice', (p) => p.tone === 'refused')?.props?.heading).toBe('Rolling Mandate back to 0.1.0 can’t start now');
  });

  const serverApp = (): AppInstalls =>
    installs({
      dataGraceDays: 30,
      installed: [
        {
          ...installs().installed[0]!,
          developers: ['p7'],
          previews: [{ pr: 42, version: '1.5.0-pr.42', title: 'Faster lists', startedAt: '2026-11-09T00:00:00Z', endsAt: '2026-11-12T00:00:00Z' }],
          internet: { allowed: false, why: ['It reads public holidays'], hosts: ['date.nager.at'] },
          settings: [
            { id: 'keep', label: 'Keep deleted things', type: 'number', required: false, min: 1, max: 90, unit: 'days', default: 30, set: false },
            { id: 'digest', label: 'Daily digest', type: 'boolean', required: false, default: false, set: false },
            { id: 'key', label: 'API key', type: 'secret', required: true, set: true },
          ],
        },
      ],
    });

  it('shows what the server runs for an app: its internet, settings, developers and previews, and its sign-in and removal', async () => {
    const answer = registry({ installs: serverApp() });
    const { shell } = await open((p, init) => (p.startsWith('/api/identity/v1/directory') ? [200, { people: [{ id: 'p7', name: 'Rae Developer', email: 'rae@example.org' }], teams: [] }] : answer(p, init)), '/apps/mandate');
    await settle();
    expect(text(find(shell.screen, 'quill-section', (p) => p.label === 'Internet'))).toContain('date.nager.at');
    expect(find(shell.screen, 'quill-button', (p) => p.label === 'Allow the internet')).toBeDefined();
    expect(find(shell.screen, 'quill-text-field', (p) => p.name === 'setting:keep')?.props).toMatchObject({ label: 'Keep deleted things (days)', value: '' });
    expect(find(shell.screen, 'quill-select', (p) => p.name === 'setting:digest')?.props).toMatchObject({ value: '' });
    expect(find(shell.screen, 'quill-text-field', (p) => p.name === 'setting:key')?.props).toMatchObject({ type: 'password', required: false });
    // The developers are named from the directory, by id.
    expect(shell.calls.some((c) => c.path === '/api/identity/v1/directory?ids=p7')).toBe(true);
    expect(find(shell.screen, 'quill-people-picker')?.props?.value).toEqual([{ kind: 'person', id: 'p7', name: 'Rae Developer' }]);
    expect(text(find(shell.screen, 'quill-list', (p) => p.label === 'Previews running'))).toContain('#42 Faster lists');
    expect(find(shell.screen, 'quill-button', (p) => p.label === 'Issue a new sign-in')).toBeDefined();
    expect(find(shell.screen, 'quill-button', (p) => p.label === 'Remove from the server')?.props?.disabled).toBeUndefined();
  });

  it('saves a setting inline as soon as it changes, and says why a value isn’t one it takes', async () => {
    const { shell } = await open(registry({ installs: serverApp(), change: () => [200, serverApp()] }), '/apps/mandate');
    handler(find(shell.screen, 'quill-text-field', (p) => p.name === 'setting:keep'), 'onCommit')('120');
    expect(text(find(shell.screen, 'quill-notice', (p) => p.tone === 'refused'))).toContain('from 1 to 90 days');
    handler(find(shell.screen, 'quill-text-field', (p) => p.name === 'setting:keep'), 'onCommit')('14');
    handler(find(shell.screen, 'quill-select', (p) => p.name === 'setting:digest'), 'onChange')('true');
    await settle();
    expect(shell.calls.filter((c) => c.method === 'PUT')).toEqual([
      { method: 'PUT', path: '/api/registry/v1/app-runner/apps/mandate/settings/keep', body: { value: 14 } },
      { method: 'PUT', path: '/api/registry/v1/app-runner/apps/mandate/settings/digest', body: { value: true } },
    ]);
  });

  it('asks for the password again when a secret needs it, and comes back to the same page', async () => {
    const { shell } = await open(registry({ installs: serverApp(), change: () => [403, { error: 'sign_in_again', message: 'Enter your password again.' }] }), '/apps/mandate');
    handler(find(shell.screen, 'quill-text-field', (p) => p.name === 'setting:key'), 'onCommit')('s3cret');
    await settle();
    expect(shell.signedInAgain).toBe(1);
  });

  it('allows an app the internet, removes it and issues a new sign-in, each from a question of its own', async () => {
    const answer = registry({ installs: serverApp() });
    const changes = (p: string, init?: RequestInit): [number, unknown] => {
      if (init?.method === 'PUT' && p.endsWith('/internet')) return [200, serverApp()];
      if (init?.method === 'POST' && p.endsWith('/credential')) return [200, { clientId: 'app-mandate', secret: 'new-secret' }];
      if (init?.method === 'POST') return [200, { ...jobs[0], action: 'remove' }];
      return answer(p, init);
    };
    const { shell, move } = await open(changes, '/apps/mandate');
    handler(find(shell.screen, 'quill-button', (p) => p.label === 'Allow the internet'), 'onPress')();
    expect(shell.moved.at(-1)).toBe('/apps/mandate/internet');
    expect(find(shell.screen, 'quill-dialog')?.props).toMatchObject({ heading: 'Let Mandate reach the internet?', danger: true });
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({});
    await settle();
    expect(shell.calls.find((c) => c.method === 'PUT')).toEqual({ method: 'PUT', path: '/api/registry/v1/app-runner/apps/mandate/internet', body: { allowed: true } });

    move('/apps/mandate/new-sign-in');
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({});
    await settle();
    expect(find(shell.screen, 'quill-dialog')?.props?.heading).toBe('Give Mandate’s service this secret');
    expect(find(shell.screen, 'quill-text-field', (p) => p.label === 'Secret')?.props).toMatchObject({ value: 'new-secret', readOnly: true });
    move('/apps/mandate');
    move('/apps/mandate/new-sign-in');
    // Shown once: coming back asks again.
    expect(find(shell.screen, 'quill-dialog')?.props?.heading).toBe('Issue a new sign-in?');

    move('/apps/mandate/remove');
    expect(String(find(shell.screen, 'quill-dialog')?.props?.summary)).toContain('for 30 days');
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({});
    await settle();
    expect(shell.calls.filter((c) => c.method === 'POST').at(-1)).toEqual({ method: 'POST', path: '/api/registry/v1/app-runner/jobs', body: { action: 'remove', app: 'mandate' } });
    expect(shell.moved.at(-1)).toBe('/apps');
  });

  it('keeps a default app from being removed, and a plain admin from changing anything on the server', async () => {
    const def = serverApp();
    def.installed[0]!.default = true;
    const { shell } = await open(registry({ installs: def }), '/apps/mandate/remove');
    expect(text(find(shell.screen, 'quill-notice', (p) => p.tone === 'refused'))).toContain('DEFAULT_APPS');
    const plain = await open(registry({ installs: serverApp(), overview: overview({ you: { deploymentAdmin: false } }) }), '/apps/mandate');
    for (const label of ['Allow the internet', 'Issue a new sign-in', 'Remove from the server']) expect(text(find(plain.shell.screen, 'quill-button', (p) => p.label === label))).toContain('deployment-admin');
    expect(find(plain.shell.screen, 'quill-people-picker')?.props?.disabled).toBe(true);
  });

  it('finds people for the developers, and saves who they are', async () => {
    const answer = registry({ installs: serverApp() });
    const { shell } = await open((p, init) => {
      if (p.startsWith('/api/identity/v1/directory?q=')) return [200, { people: [{ id: 'p8', name: 'Lee Builder' }], teams: [] }];
      if (p.startsWith('/api/identity/v1/directory')) return [200, { people: [{ id: 'p7', name: 'Rae Developer' }], teams: [] }];
      if (init?.method === 'PUT') return [200, serverApp()];
      return answer(p, init);
    }, '/apps/mandate');
    handler(find(shell.screen, 'quill-people-picker'), 'onQuery')('lee');
    await settle();
    expect(find(shell.screen, 'quill-people-picker')?.props?.found).toEqual({ query: 'lee', items: [{ kind: 'person', id: 'p8', name: 'Lee Builder' }] });
    handler(find(shell.screen, 'quill-people-picker'), 'onChange')([
      { kind: 'person', id: 'p7', name: 'Rae Developer' },
      { kind: 'person', id: 'p8', name: 'Lee Builder' },
    ]);
    await settle();
    expect(shell.calls.find((c) => c.method === 'PUT')).toEqual({ method: 'PUT', path: '/api/registry/v1/app-runner/apps/mandate/developers', body: { people: ['p7', 'p8'] } });
  });

  it('holds an app its own service registered at a kept version, follows new ones again, and issues it a new sign-in', async () => {
    const answer = registry();
    const kept = (serving: string) =>
      ['1.1.0', '1.0.0'].map((version) => ({ version, entry: { name: 'Notes', entry: `https://notes.example/${version}/remote.js` }, registeredBy: 'notes', registeredAt: '2026-11-01T00:00:00Z', serving: version === serving }));
    let serving = '1.1.0';
    const { shell } = await open((p, init) => {
      if (p === '/api/registry/v1/apps/notes/versions') return [200, kept(serving)];
      if (p === '/api/registry/v1/apps/notes/pin' && init?.method === 'PUT') {
        serving = '1.0.0';
        return [200, { id: 'notes', pinnedVersion: '1.0.0' }];
      }
      if (p === '/api/registry/v1/apps/notes/pin' && init?.method === 'DELETE') {
        serving = '1.1.0';
        return [200, { id: 'notes' }];
      }
      if (p === '/api/identity/v1/admin/apps/notes/credential') return [200, { clientId: 'app-notes', secret: 's' }];
      return answer(p, init);
    }, '/apps/notes');
    await settle();
    expect(shell.pane.title).toBe('Notes');
    expect(find(shell.screen, 'quill-button', (p) => p.label === 'Follow new versions')).toBeUndefined();
    handler(find(shell.screen, 'quill-list', (p) => p.label === 'Versions kept'), 'onAction')({ item: '1.0.0', action: 'hold' });
    await settle();
    await settle();
    expect(shell.calls.find((c) => c.method === 'PUT')).toEqual({ method: 'PUT', path: '/api/registry/v1/apps/notes/pin', body: { version: '1.0.0' } });
    expect(text(find(shell.screen, 'quill-details'))).toContain('1.0.0, held');
    handler(find(shell.screen, 'quill-button', (p) => p.label === 'Follow new versions'), 'onPress')();
    await settle();
    await settle();
    expect(shell.calls.find((c) => c.method === 'DELETE')?.path).toBe('/api/registry/v1/apps/notes/pin');
    expect(find(shell.screen, 'quill-button', (p) => p.label === 'Follow new versions')).toBeUndefined();
    handler(find(shell.screen, 'quill-button', (p) => p.label === 'Issue a new sign-in'), 'onPress')();
    expect(shell.moved.at(-1)).toBe('/apps/notes/new-sign-in');
  });

  it('says so when no app of that name is installed or registered', async () => {
    const { shell } = await open(registry(), '/apps/nothing');
    await settle();
    expect(find(shell.screen, 'quill-state')?.props).toMatchObject({ kind: 'empty' });
  });

  it('allows a site apps may load from on Apps, and removes one after asking', async () => {
    let list = [{ origin: 'https://apps.example.org', addedBy: 'p1', addedAt: '2026-11-01T00:00:00Z' }];
    const answer = registry();
    const { shell } = await open((p, init) => {
      if (p.endsWith('/origins') && (init?.method ?? 'GET') === 'GET') return [200, list];
      if (p.endsWith('/origins')) {
        const added = { origin: 'https://more.example.org', addedBy: 'p1', addedAt: '2026-11-10T00:00:00Z' };
        list = [...list, added];
        return [200, added];
      }
      if (init?.method === 'DELETE') return [204, null];
      return answer(p, init);
    }, '/apps');
    await settle();
    const sites = () => find(shell.screen, 'quill-list', (p) => p.label === 'Where apps load from');
    expect((sites()?.props?.items as { id: string }[]).map((i) => i.id)).toEqual(['https://apps.example.org']);
    handler(find(shell.screen, 'quill-text-field', (p) => p.name === 'origin'), 'onCommit')('https://more.example.org');
    await settle();
    expect((sites()?.props?.items as { id: string }[]).map((i) => i.id)).toEqual(['https://apps.example.org', 'https://more.example.org']);
    handler(sites(), 'onAction')({ item: 'https://apps.example.org', action: 'remove' });
    expect(find(shell.screen, 'quill-dialog')?.props?.heading).toBe('Stop apps loading from https://apps.example.org?');
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({});
    await settle();
    expect(shell.calls.find((c) => c.method === 'DELETE')?.path).toBe('/api/registry/v1/origins/https%3A%2F%2Fapps.example.org');
    expect((sites()?.props?.items as { id: string }[]).map((i) => i.id)).toEqual(['https://more.example.org']);
    expect(find(shell.screen, 'quill-dialog')).toBeUndefined();
  });

  it('marks a failed result reviewed for every admin', async () => {
    const failed = overview({ units: [unit({ lastResult: { kind: 'upgrade', id: 'u9', state: 'failed', message: 'Verify failed.', finishedAt: '2026-11-09T20:00:00Z' } })] });
    const { shell } = await open(registry({ overview: failed, change: () => [200, overview()] }), '/augur');
    handler(find(shell.screen, 'quill-notice', (p) => p.action === 'Mark as reviewed'), 'onAction')();
    await settle();
    expect(shell.calls.find((c) => c.method === 'POST')?.path).toBe('/api/registry/v1/platform/results/upgrade/u9/seen');
  });

  it('checks for updates from its pane, and follows the shell’s moves', async () => {
    const { shell, move } = await open(registry({ change: () => [200, updates()] }));
    expect(shell.pane.actions).toEqual([{ command: COMMANDS.check }]);
    await shell.commands.get(COMMANDS.check)!();
    await settle();
    expect(shell.calls.find((c) => c.method === 'POST')?.path).toBe('/api/registry/v1/platform/updates/check');
    move('/apps');
    expect(shell.pane.title).toBe('Apps');
  });

  it('shows each component’s settings, reporting and the settings history', async () => {
    const { shell } = await open(registry({ overview: overview({ reporting: { mode: 'file', why: 'Exported by hand.' } }) }), '/settings');
    await settle();
    expect(shell.pane.title).toBe('Settings');
    expect(find(shell.screen, 'quill-select', (p) => p.name === 'channel-augur')?.props).toMatchObject({ value: 'beta', readOnly: true });
    expect(find(find(shell.screen, 'quill-section', (p) => p.label === 'Mandate')?.children, 'quill-select', (p) => p.label === 'Update policy')).toBeDefined();
    expect(find(shell.screen, 'quill-text-field', (p) => p.label === 'Public key')?.props).toMatchObject({ value: 'ssh-ed25519 AAAA', readOnly: true });
    const history = find(shell.screen, 'quill-paged-list', (p) => p.label === 'Settings history');
    expect(history?.props?.items).toMatchObject([{ title: 'AUGUR: settings changed', meta: expect.stringContaining('Sam Admin') }]);
    expect(text(history)).toContain('Before: Ask first');
    handler(find(shell.screen, 'quill-button', (p) => p.label === 'Export the record'), 'onPress')();
    await settle();
    expect(shell.downloads).toEqual(['/api/registry/v1/platform/reporting/export']);
  });

  it('keeps long lists in pages, with a filter, however many apps are installed', async () => {
    const many = overview({ units: [unit(), ...Array.from({ length: 30 }, (_, i) => unit({ unit: `app-${i}`, name: `App ${i}`, running: '1.0.0', available: '1.0.0' }))] });
    const apps = await open(registry({ overview: many }), '/apps');
    expect(find(apps.shell.screen, 'quill-table')?.props).toMatchObject({ pageSize: 10, filterable: true });
  });

  it('shows every part’s health, email and how apps take their events', async () => {
    const { shell } = await open(registry(), '/health');
    expect(shell.pane.title).toBe('Health');
    expect(find(shell.screen, 'quill-check-list', (p) => p.label === '1 of 3 parts down')?.props?.rows).toMatchObject([{ id: 'knowledge', tone: 'problem' }]);
    expect(find(shell.screen, 'quill-table', (p) => p.label === 'Services')?.props?.rows).toMatchObject([{ part: 'gateway', state: 'Healthy, 3 ms' }, { part: 'registry' }, { part: 'knowledge', state: 'Down' }]);
    expect(find(shell.screen, 'quill-check-list', (p) => p.label === 'Email')?.props?.rows).toMatchObject([{ title: 'Email is off', tone: 'info' }]);
    expect(find(shell.screen, 'quill-check-list', (p) => p.label === 'Event deliveries')?.props?.rows).toMatchObject([{ id: 'mandate', tone: 'needs' }]);
    const home = await open(registry());
    expect(text(find(home.shell.screen, 'quill-details'))).toContain('1 of 3 parts down');
  });

  it('shows backups, and says when the gateway can’t be read', async () => {
    const { shell } = await open(registry(), '/backups');
    expect(shell.pane.title).toBe('Backups');
    expect(text(find(shell.screen, 'quill-notice', (p) => p.heading === 'Backups need a look'))).toContain('No copy off the server yet.');
    expect(find(shell.screen, 'quill-check-list')?.props?.rows).toMatchObject([
      { id: 'last', tone: 'ok', detail: expect.stringContaining('5.0 MB') },
      { id: 'offsite', tone: 'needs', detail: expect.stringContaining('OFFSITE_REPOSITORY') },
      { id: 'pit', tone: 'ok' },
      { id: 'replay', tone: 'ok' },
      { id: 'restore', tone: 'ok', detail: expect.stringContaining('12 people') },
    ]);
    const down = await open(registry({ status: null }), '/backups');
    expect(find(down.shell.screen, 'quill-state')?.props).toMatchObject({ kind: 'error', heading: 'The gateway didn’t say how backups are doing' });
  });

  it('shows the release channel, the path to stable and every change of channel', async () => {
    const line: PlatformUpdates['line'] = {
      feed: 'on',
      repository: 'example/augur',
      units: [{ id: 'augur', name: 'AUGUR', versions: { dev: '0.26.0', preview: '0.25.0', production: '0.23.1' }, waiting: ['a', 'b'], previews: [], running: '0.25.0' }],
      steps: [{ from: 'dev', to: 'preview', merged: 3, pulls: [] }, { from: 'preview', to: 'production', merged: 0, pulls: [] }],
      pulls: { promoteToProduction: [{ number: 7, title: 'Promote', url: 'https://example.test/7', unit: 'augur', version: '0.25.0' }] },
    };
    const history = [{ ...unit().desired, setBy: 'default' }, { ...unit().desired, channel: 'stable' as const, setBy: 'p1', setAt: '2026-11-08T09:00:00Z' }];
    const { shell } = await open(registry({ updates: updates({ line }), history }), '/release-channel');
    await settle();
    expect(shell.pane.title).toBe('Release channel');
    expect(find(shell.screen, 'quill-table', (p) => p.label === 'Path to stable')?.props?.rows).toMatchObject([{ component: 'AUGUR (2 changes waiting)', preview: '0.25.0', here: '0.25.0, at Beta' }]);
    expect(find(shell.screen, 'quill-check-list', (p) => p.label === 'Between the stages')?.props?.rows).toMatchObject([
      { title: '3 pull requests on Main that Beta hasn’t got', detail: 'https://github.com/example/augur/compare/preview...dev' },
      { title: 'Stable has everything on Beta', tone: 'ok' },
      { title: 'Promote AUGUR 0.25.0 to Stable is open', tone: 'needs' },
    ]);
    expect(find(shell.screen, 'quill-paged-list', (p) => p.label === 'Channel changes')?.props?.items).toMatchObject([{ title: 'AUGUR: Beta to Stable', meta: expect.stringContaining('Sam Admin') }]);
    const off = await open(registry({ updates: updates({ line: { feed: 'off', units: [], steps: [] } }) }), '/release-channel');
    expect(find(off.shell.screen, 'quill-notice', (p) => p.heading === 'The path to stable can’t be shown')).toBeDefined();
  });

  it('changes a component’s settings, showing the effect before saving', async () => {
    const { shell } = await open(registry({ change: () => [200, overview()] }), '/settings');
    handler(find(find(shell.screen, 'quill-section', (p) => p.label === 'Mandate')?.children, 'quill-button', (p) => p.label === 'Maintenance windows and version pin'), 'onPress')();
    expect(shell.moved.at(-1)).toBe('/settings/mandate');
    expect(find(shell.screen, 'quill-button', (p) => p.label === 'Save settings')?.props).toMatchObject({ disabled: true, reason: 'Nothing has changed yet.' });
    handler(find(shell.screen, 'quill-choice', (p) => p.name === 'policy'), 'onChange')('hold');
    expect(text(find(shell.screen, 'quill-details', (p) => JSON.stringify(p).includes('After you save')))).toContain('On hold: nothing new is offered.');
    handler(find(shell.screen, 'quill-button', (p) => p.label === 'Save settings'), 'onPress')();
    await settle();
    const put = shell.calls.find((c) => c.method === 'PUT');
    expect(put?.path).toBe('/api/registry/v1/platform/units/mandate/desired-state');
    expect(put?.body).toMatchObject({ policy: 'hold', channel: 'beta' });
    expect(shell.moved.at(-1)).toBe('/settings');
    expect(text(shell.screen)).toContain('Saved. The updater follows the new settings');
  });

  it('changes a release channel inline, saving it straight away, on Settings and on Release channel', async () => {
    for (const path of ['/settings', '/release-channel']) {
      const { shell } = await open(registry({ change: () => [200, overview()] }), path);
      handler(find(shell.screen, 'quill-select', (p) => p.name === 'channel-mandate'), 'onChange')('stable');
      await settle();
      const put = shell.calls.find((c) => c.method === 'PUT');
      expect(put?.path).toBe('/api/registry/v1/platform/units/mandate/desired-state');
      expect(put?.body).toMatchObject({ channel: 'stable' });
    }
  });

  it('keeps settings visible but unchangeable for a plain admin, with the role named', async () => {
    const { shell } = await open(registry({ overview: overview({ you: { deploymentAdmin: false } }) }), '/settings/augur');
    expect(find(shell.screen, 'quill-button', (p) => p.label === 'Save settings')).toBeUndefined();
    expect(find(shell.screen, 'quill-table', (p) => p.label === 'Each component’s settings')?.props?.onOpen).toBeUndefined();
    expect(text(find(shell.screen, 'quill-notice', (p) => p.tone === 'refused'))).toContain('deployment-admin');
  });

  it('says the registry isn’t answering, and keeps what it read when a later read fails', async () => {
    const down = await open(() => [503, { message: 'Registry down.' }]);
    expect(find(down.shell.screen, 'quill-state')?.props).toMatchObject({ kind: 'error', heading: 'The registry isn’t answering' });
  });
  it('installs a new app from the feed on Apps, asking for the settings it can’t start without', async () => {
    const offered = installs({
      runnerSeenAt: '2026-11-09T22:29:00Z',
      available: [
        {
          app: 'atlas',
          name: 'Data Atlas',
          description: 'The entities AUGUR knows about.',
          version: '0.3.0',
          channel: 'beta',
          signer: { repository: 'o/atlas', workflow: 'release.yml' },
          asks: { scopes: ['audit:write'], resources: [], limits: { web: { memory: '256Mi', cpu: '500m' } }, floors: ['team'], maxUpload: 10, settings: ['size'] },
          review: { kinds: { web: 'service' }, settings: [{ id: 'size', label: 'Page size', type: 'number', required: true, min: 1, max: 50 }] },
        },
        { app: 'old', name: 'Old', version: '1.0.0', channel: 'stable', problem: 'It is on contract 2.' },
      ],
      removed: [{ app: 'folio', name: 'Artifacts', removedAt: '2026-11-05T00:00:00Z', deleteAt: '2026-12-05T00:00:00Z' }],
      defaultApps: [{ app: 'mandate', state: 'waiting', problem: 'No feed lists it.' }],
    });
    const { shell } = await open(registry({ installs: offered, change: () => [200, jobs[0]] }), '/apps');
    const list = find(shell.screen, 'quill-paged-list', (p) => p.label === 'Available apps');
    expect(list?.props?.items).toMatchObject([{ id: 'atlas@0.3.0', title: 'Data Atlas 0.3.0', meta: 'Beta channel' }, { id: 'old@1.0.0', status: 'failed' }]);
    expect(text(find(shell.screen, 'quill-check-list', (p) => p.label === 'Removed, data kept'))).toContain('Install it again before then');
    expect(text(find(shell.screen, 'quill-check-list', (p) => p.label === 'Default apps waiting'))).toContain('No feed lists it.');

    handler(list, 'onOpen')('atlas@0.3.0');
    expect(shell.moved.at(-1)).toBe('/apps/atlas/install/0.3.0');
    expect(shell.pane.title).toBe('Apps');
    const dialog = find(shell.screen, 'quill-dialog');
    expect(dialog?.props?.heading).toBe('Install Data Atlas 0.3.0?');
    expect(find(dialog!, 'quill-text-field', (p) => p.name === 'setting:size')).toBeDefined();
    expect(text(dialog)).toContain('Signed by o/atlas’s release.yml');

    handler(dialog, 'onSubmit')({ 'setting:size': '99' });
    expect(find(shell.screen, 'quill-dialog')?.props?.error).toBe('Page size takes a number from 1 to 50.');
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({ 'setting:size': '20' });
    await settle();
    expect(shell.calls.find((c) => c.method === 'POST')).toEqual({ method: 'POST', path: '/api/registry/v1/app-runner/jobs', body: { action: 'install', app: 'atlas', version: '0.3.0', settings: { size: 20 } } });
    expect(shell.moved.at(-1)).toBe('/apps');
  });

  it('says why nothing installs without an app runner, and explains a release it can’t install', async () => {
    const offered = installs({ available: [{ app: 'old', name: 'Old', version: '1.0.0', channel: 'stable', problem: 'It is on contract 2.' }] });
    const { shell } = await open(registry({ installs: offered }), '/apps/old/install/1.0.0');
    expect(find(shell.screen, 'quill-notice', (p) => p.heading === 'No app runner yet')).toBeDefined();
    expect(find(shell.screen, 'quill-button', (p) => p.label === 'Install from an address')?.props).toMatchObject({ disabled: true });
    expect(find(shell.screen, 'quill-dialog')).toBeUndefined();
    expect(find(shell.screen, 'quill-notice', (p) => p.heading === 'Installing Old 1.0.0 can’t start now')).toBeDefined();
  });

  it('installs from a release file’s address, keeping the address in the path for signing in again', async () => {
    const url = 'https://example.test/r/app-release.json';
    const release = { id: 'probe', version: '0.1.0', manifest: { name: 'Probe' } };
    let asked = 0;
    const { shell } = await open(
      registry({
        installs: installs({ runnerSeenAt: '2026-11-09T22:29:00Z' }),
        change: (path) => {
          if (path.endsWith('/releases/read')) return asked++ ? [200, { release, refusals: [], warnings: ['It is unsigned by a known feed.'] }] : [401, { error: 'sign_in_again', message: 'Enter your password again.' }];
          return [200, jobs[0]];
        },
      }),
      '/apps',
    );
    handler(find(shell.screen, 'quill-button', (p) => p.label === 'Install from an address'), 'onPress')();
    expect(shell.moved.at(-1)).toBe('/install-from-address');
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({ url });
    await settle();
    expect(shell.signedInAgain).toBe(1);
    expect(shell.moved.at(-1)).toBe(`/install-from-address/${encodeURIComponent(url)}`);
    expect(find(shell.screen, 'quill-text-field', (p) => p.name === 'url')?.props?.value).toBe(url);

    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({ url });
    await settle();
    expect(find(shell.screen, 'quill-dialog')?.props?.heading).toBe('Install Probe 0.1.0?');
    handler(find(shell.screen, 'quill-dialog'), 'onSubmit')({});
    await settle();
    expect(shell.calls.filter((c) => c.method === 'POST').at(-1)).toEqual({ method: 'POST', path: '/api/registry/v1/app-runner/jobs', body: { action: 'install', release } });
    expect(shell.moved.at(-1)).toBe('/apps');
  });
});
