import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import { backupLine, healthLine } from './health.js';
import { historyOf, tookWords, type HistoryEntry } from './model/history.js';
import { levelFrom } from './model/levels.js';
import { needsYou } from './model/needs-you.js';
import { formatWhen } from './model/time.js';
import type { OverviewUnit } from './model/types.js';
import { RING_WORDS } from './model/words.js';
import { AUGUR, rowOf, type UnitRow } from './units.js';
import type { Data } from './data.js';
import { quill } from './quill.js';
import { pathOf, unitPath, type Route } from './routes.js';
import { CHANNEL, NEEDS_DEPLOYMENT_ADMIN, OUTCOME, STATE, STEP } from './words.js';

/** What the app keeps between draws that isn't the registry's: how the last thing it tried went. */
export interface Ui {
  /** The open question's state: working on it, or why it didn't work. */
  dialog: { busy?: boolean; error?: string };
  checking?: boolean;
  /** Why the last check, mark as reviewed or cancel didn't work, shown where it was pressed. */
  problem?: { where: 'check' | 'seen' | 'cancel'; words: string };
}

/** What the person can do from a page; each one goes through the registry, which decides. */
export interface Actions {
  go: (path: string) => void;
  checkNow: () => void;
  markSeen: (kind: 'upgrade' | 'app-job', id: string) => void;
  cancel: () => void;
  upgrade: (version: string, settings: Record<string, string>) => void;
  rollBack: (version: string) => void;
  test: (version: string, reason: string) => void;
  install: (app: string, version: string) => void;
  closeDialog: (back: string) => void;
}

export interface View {
  route: Route;
  data: Data;
  ui: Ui;
  on: Actions;
  now: Date;
  /** The deployment's time zone, which every time is shown in. */
  zone: string;
  /** Whether the person holds deployment-admin, as the registry says (contract 3 never tells a frontend their roles). */
  may: boolean;
  /** A person's name from their id, when it's known. */
  nameOf: (id: string, given?: string) => string;
}

/** History entries on each page of a history list. */
export const HISTORY_STEP = 10;

export const when = (v: Pick<View, 'zone' | 'now'>, at?: string | Date) => (at ? formatWhen(at, v.zone, v.now) : 'Not yet');

const level = (running: string, to: string) => ({ patch: 'Patch', minor: 'Minor', major: 'Major' })[levelFrom(running, to)];

export const rowsOf = (v: Pick<View, 'data' | 'now'>): UnitRow[] => {
  const u = v.data.updates;
  const watchingUntil = u?.upgrade?.state === 'done' ? u.upgrade.watch?.until : undefined;
  return v.data.overview?.units.map((x) => rowOf(x, v.data.readAt ?? v.now, x.unit === AUGUR ? watchingUntil : undefined)) ?? [];
};

/** What happens next to a unit, in the table's Status column: its state, and when a window or a pin says more. */
export const statusOf = (v: Pick<View, 'zone' | 'now'>, row: UnitRow, unit?: OverviewUnit): string => {
  const words =
    row.state === 'waiting-window' && row.offered && unit?.window.nextAt
      ? `${level(row.running, row.offered)} update, automatic in the window ${when(v, unit.window.nextAt)}`
      : row.state === 'held' && row.offered
        ? `On hold, ${row.offered} available`
        : row.state === 'halted' && unit?.halted
          ? `Release halted: ${unit.halted.reason}`
          : STATE[row.state].words;
  return row.pin ? `${words} · pinned to ${row.pin}` : words;
};

/** One unit's upgrades or installs, newest first, a page at a time. */
export const historyList = (v: View, unit: string, label: string, entries: HistoryEntry[], missing?: string): RemoteNode => {
  const mine = entries.filter((e) => e.unit === unit);
  return quill('quill-section', { label, count: mine.length || undefined }, [
    missing ? quill('quill-notice', { tone: 'warning' }, `Some of this history couldn’t be read: ${missing}`) : null,
    quill('quill-paged-list', {
      label,
      noun: 'changes',
      pageSize: HISTORY_STEP,
      empty: 'Nothing has changed here yet.',
      items: mine.map((e) => ({
        id: e.id,
        title: [e.how, e.from && `from ${e.from}`, e.to && `to ${e.to}`].filter(Boolean).join(' '),
        detail: [e.by, e.tookMs !== undefined && `took ${tookWords(e.tookMs)}`, e.backup && `backup ${e.backup}`, e.message].filter(Boolean).join(' · '),
        meta: when(v, e.at),
        status: OUTCOME[e.outcome].status,
      })),
    }),
  ]);
};

/** Every upgrade and app job, in the shape each page's history takes. Settings changes are the Settings page's. */
export const entriesOf = (v: View): HistoryEntry[] =>
  historyOf({
    upgrades: v.data.updates?.history ?? [],
    jobs: v.data.jobs ?? [],
    settings: {},
    names: Object.fromEntries((v.data.overview?.units ?? []).map((u) => [u.unit, u.name])),
    augur: AUGUR,
    zone: v.zone,
    nameOf: v.nameOf,
  });

/** The one thing that needs the person most, lit, with one action; the rest are counted. */
const ask = (v: View, rows: UnitRow[]): RemoteNode => {
  const o = v.data.overview!;
  const u = v.data.updates!;
  const up = u.upgrade;
  if (up && (up.state === 'requested' || up.state === 'running')) {
    const done = up.steps.filter((s) => s.state === 'done').length;
    const now = up.steps.find((s) => s.state === 'running');
    return quill('quill-progress', {
      label: `Upgrade in progress: AUGUR ${up.from} to ${up.version}`,
      value: Math.round((done / 6) * 100),
      valueText: now ? `Step ${done + 1} of 6: ${STEP[now.step]}` : up.state === 'requested' ? 'Waiting for the updater to start' : `Step ${done} of 6 done`,
    });
  }
  const items = needsYou(o, v.data.installs?.installed ?? []);
  const first = items[0];
  if (first) {
    const action = first.kind === 'first-upgrade' ? 'Review the upgrade' : 'Review';
    return quill('quill-notice', { tone: 'needs', heading: first.title, action, more: items.length > 1 ? items.length - 1 : undefined, onAction: () => v.on.go(unitPath(first.unit, AUGUR)) }, first.why);
  }
  const augur = rows.find((r) => r.id === AUGUR);
  if (u.next && augur && augur.state !== 'up-to-date') {
    const breaking = u.available?.version === u.next ? u.available.breaking.length : 0;
    const body = [
      `${CHANNEL[u.channel]} channel.`,
      breaking ? `${breaking} breaking ${breaking === 1 ? 'change needs' : 'changes need'} action before you upgrade.` : '',
      v.may ? '' : NEEDS_DEPLOYMENT_ADMIN,
    ]
      .filter(Boolean)
      .join(' ');
    return quill('quill-notice', { tone: 'needs', heading: `Update available: AUGUR ${u.next}`, ...(v.may ? { action: 'Review the upgrade', onAction: () => v.on.go(pathOf({ page: 'augur' })) } : {}) }, body);
  }
  return null;
};

/** What's installed, as a table: the component, what runs, what's on offer and what happens next. */
export const installedTable = (v: View, label: string, rows: UnitRow[], empty: string): RemoteNode => {
  const units = v.data.overview?.units ?? [];
  return quill('quill-table', {
    label,
    noun: 'component',
    columns: [
      { key: 'component', label: 'Component' },
      { key: 'running', label: 'Running' },
      { key: 'available', label: 'Available' },
      { key: 'status', label: 'Status', wrap: true },
    ],
    rows: rows.map((r) => ({
      id: r.id,
      component: r.name,
      running: r.running,
      available: r.offered && r.state !== 'up-to-date' ? r.offered : '—',
      status: statusOf(v, r, units.find((x) => x.unit === r.id)),
    })),
    empty,
    onOpen: (id: string) => v.on.go(unitPath(id, AUGUR)),
  });
};

/** The feed's trust, in a line. */
const signature = (v: View): string | undefined => {
  const t = v.data.overview?.feedTrust;
  if (!t) return undefined;
  const base =
    t.state === 'verified' ? `Signature verified${t.signer ? `, signed by ${t.signer}` : ''}` : t.state === 'mirror' ? `Read from your organisation’s mirror${t.note ? `: ${t.note}` : ''}` : (t.note ?? 'Signature not checked: read from GitHub directly');
  return t.expires ? `${base}. Expires ${when(v, t.expires)}` : base;
};

/** Overview: the one ask, what's installed, and the deployment's status. */
export const overviewPage = (v: View): RemoteNode => {
  const o = v.data.overview!;
  const u = v.data.updates!;
  const rows = rowsOf(v);
  const augur = o.units.find((x) => x.unit === AUGUR);
  const next =
    augur?.window.open && augur.automatic?.takes
      ? `Open now: ${augur.automatic.takes}`
      : augur?.window.nextAt
        ? when(v, augur.window.nextAt)
        : augur && augur.desired.windows.length === 0 && augur.desired.policy === 'automatic'
          ? 'Any time: automatic updates may start whenever one is available'
          : 'None scheduled';
  const feedOff = o.feed === 'off';
  return [
    ask(v, rows),
    quill('quill-section', { label: 'Installed' }, installedTable(v, 'Installed', rows, 'Nothing is installed yet.')),
    quill('quill-section', { label: 'Status' }, [
      quill('quill-details', {
        items: [
          { label: 'Health', value: v.data.status ? healthLine(v.data.status.components).words : (v.data.statusError ? 'Not known: the gateway didn’t answer' : 'Reading') },
          { label: 'Last backup', value: v.data.status ? backupLine(v, v.data.status.backups) : 'Reading' },
          { label: 'Release channel', value: CHANNEL[u.channel], ...(u.channelNote ? { note: u.channelNote } : {}) },
          { label: 'Server', value: RING_WORDS[o.ring] },
          {
            label: 'AUGUR',
            value: u.running.build === 'source' ? `Built from source, based on ${u.running.version}` : u.running.version,
          },
          { label: 'Next maintenance window', value: next, ...(augur?.window.nextAt && augur.automatic?.takes ? { note: augur.automatic.takes } : {}) },
          feedOff
            ? { label: 'Release feed', value: 'Off', note: 'RELEASE_FEED_URL=off on this deployment' }
            : { label: 'Release feed', value: `Checked ${when(v, o.checkedAt ?? u.checkedAt)}`, ...(signature(v) ? { note: signature(v) } : {}) },
          u.updaterSeenAt
            ? { label: 'Updater', value: `Last polled ${when(v, u.updaterSeenAt)}` }
            : { label: 'Updater', value: 'Not set up', note: 'Upgrades started here wait until it is. See docs/upgrade.md.' },
        ],
      }),
      u.problem ? quill('quill-notice', { tone: 'warning', heading: 'The release feed has a problem' }, u.problem) : null,
      quill('quill-button', {
        label: 'Check for updates',
        kind: 'secondary',
        busy: v.ui.checking,
        busyLabel: 'Checking',
        disabled: feedOff,
        ...(feedOff ? { reason: 'The release feed is off on this deployment (RELEASE_FEED_URL=off).' } : {}),
        onPress: v.on.checkNow,
      }),
      v.ui.problem?.where === 'check' ? quill('quill-notice', { tone: 'refused' }, v.ui.problem.words) : null,
    ]),
  ];
};

/** Apps: every installed app, what it runs and what happens next. */
export const appsPage = (v: View): RemoteNode =>
  quill(
    'quill-section',
    { label: 'Installed apps' },
    installedTable(
      v,
      'Installed apps',
      rowsOf(v).filter((r) => r.id !== AUGUR),
      'No apps are installed. Apps are installed from the app feed in Admin, Apps.',
    ),
  );

/** Says once, at the top, that what's shown is older than it should be, and why. */
export const staleNotice = (v: View): RemoteNode =>
  v.data.error ? quill('quill-notice', { tone: 'warning', heading: 'Some of this may be out of date' }, `${v.data.error} What you see was read ${when(v, v.data.readAt)}.`) : null;
