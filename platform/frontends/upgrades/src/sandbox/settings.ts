import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import { historyOf, type HistoryEntry } from '../model/history.js';
import { pinChoices } from '../model/levels.js';
import { DAY_NAMES, desiredProblems, MAX_WINDOWS, policySentence, timeZones } from '../model/sentence.js';
import { formatWhen, nextWindows } from '../model/time.js';
import type { AutomaticLevel, Channel, DesiredState, DesiredStateInput, OverviewUnit, Policy, ReportingView, Ring, Window } from '../model/types.js';
import { channelsFor, RING_WORDS } from '../model/words.js';
import { AUGUR } from '../units.js';
import { quill } from './quill.js';
import { pathOf } from './routes.js';
import { HISTORY_STEP, when, type View } from './view.js';
import { CHANNEL, NEEDS_DEPLOYMENT_ADMIN, POLICY } from './words.js';

/** What the Settings page reads beyond the overview, when it opens: each unit's settings history and the reporting view. */
export interface SettingsData {
  history?: Record<string, DesiredState[]>;
  /** The units whose history couldn't be read. */
  missing: string[];
  reporting?: ReportingView;
  reportingError?: string;
}

/** A unit's settings as the person is changing them. */
export type Draft = DesiredStateInput & { timeZone: string };

/** What the Settings page can do, beyond moving. */
export interface SettingsActions {
  edit: (draft: Draft) => void;
  save: (unit: string, draft: Draft) => void;
  exportRecord: () => void;
}

export interface SettingsView extends View {
  settings: SettingsData;
  draft?: Draft;
  /** Saving, or why saving didn't work. */
  saving?: { busy?: boolean; error?: string };
  /** Whether the last save went through, for the unit's line. */
  saved?: string;
  exporting?: { busy?: boolean; error?: string };
  act: SettingsActions;
}

export const draftOf = (u: OverviewUnit): Draft => ({
  channel: u.desired.channel,
  policy: u.desired.policy,
  automaticUpTo: u.desired.automaticUpTo,
  ...(u.desired.pin ? { pin: u.desired.pin } : {}),
  windows: u.desired.windows.map((w) => ({ ...w })),
  timeZone: u.desired.timeZone,
});

/** The fields the registry stores, in a fixed order, to tell whether anything changed. */
export const same = (a: Draft, b: Draft) =>
  JSON.stringify([a.channel, a.policy, a.automaticUpTo, a.pin ?? '', a.windows, a.timeZone]) === JSON.stringify([b.channel, b.policy, b.automaticUpTo, b.pin ?? '', b.windows, b.timeZone]);

const POLICY_DETAIL: Record<Policy, string> = {
  automatic: 'Updates install by themselves, as far as you allow below.',
  ask: 'Each new release waits for an admin to approve it.',
  hold: 'Nothing new is offered until you take it off hold.',
};

/** Every half hour of the day, for a window's start. */
const STARTS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/**
 * How one unit takes new releases: release channel, update policy, how far Automatic goes, a version pin
 * and the weekly maintenance windows in a time zone. What's set now and what saving would set sit side
 * by side, with the next three windows, so the effect shows before saving.
 */
const editor = (v: SettingsView, unit: OverviewUnit, ring: Ring, draft: Draft): RemoteNode => {
  const start = draftOf(unit);
  const set = (patch: Partial<Draft>) => v.act.edit({ ...draft, ...patch });
  const setWindow = (i: number, patch: Partial<Window>) => set({ windows: draft.windows.map((w, j) => (j === i ? { ...w, ...patch } : w)) });
  const isAugur = unit.unit === AUGUR;
  const choices = pinChoices(unit.running);
  const pinMode = !draft.pin ? 'none' : choices.some((c) => c.range === draft.pin) ? draft.pin : 'custom';
  const problems = desiredProblems(draft);
  const unchanged = same(draft, start);
  const automatic = draft.policy === 'automatic';
  const full = draft.windows.length >= MAX_WINDOWS;
  const next = automatic ? nextWindows(draft.windows, draft.timeZone, v.now, 3) : [];
  const saveWhyNot = unchanged ? 'Nothing has changed yet.' : problems.length ? problems.join(' ') : undefined;
  const deploymentZone = v.zone;
  const close = () => v.on.go(pathOf({ page: 'settings' }));
  return [
    quill('quill-choice', {
      label: 'Release channel',
      name: 'channel',
      ...(isAugur ? { hint: 'AUGUR’s release channel is set by RELEASE_CHANNEL in the server’s .env (docs/upgrade.md).' } : {}),
      value: draft.channel,
      options: channelsFor(ring).map((c) => {
        const allowed = isAugur ? c.channel === start.channel : c.allowed;
        return { value: c.channel, label: CHANNEL[c.channel], ...(allowed ? {} : { disabled: true, reason: isAugur ? 'Change RELEASE_CHANNEL in .env to track this channel.' : (c.reason ?? '') }) };
      }),
      onChange: (value: string) => set({ channel: value as Channel }),
    }),
    quill('quill-choice', {
      label: 'Update policy',
      name: 'policy',
      value: draft.policy,
      options: (['automatic', 'ask', 'hold'] as Policy[]).map((p) => ({ value: p, label: POLICY[p], detail: POLICY_DETAIL[p] })),
      onChange: (value: string) => set({ policy: value as Policy }),
    }),
    quill('quill-choice', {
      label: 'Automatic installs',
      name: 'automaticUpTo',
      hint: 'A major release always waits for an admin.',
      disabled: !automatic,
      ...(automatic ? {} : { reason: 'Only the Automatic policy uses this.' }),
      value: draft.automaticUpTo,
      options: [
        { value: 'patch', label: 'Patch releases only' },
        { value: 'minor', label: 'Patch and minor releases' },
      ],
      onChange: (value: string) => set({ automaticUpTo: value as AutomaticLevel }),
    }),
    quill('quill-choice', {
      label: 'Version pin',
      name: 'pin',
      hint: 'A pin keeps this component inside a range of versions, whatever the policy.',
      value: pinMode,
      options: [
        { value: 'none', label: 'Not pinned' },
        ...choices.map((c) => ({ value: c.range, label: c.label, detail: c.range })),
        { value: 'custom', label: 'A range of your own', detail: 'Type it below, such as ^1.2.0' },
      ],
      onChange: (value: string) => set({ pin: value === 'none' ? undefined : value === 'custom' ? (pinMode === 'custom' ? draft.pin : choices[0]!.range) : value }),
    }),
    pinMode === 'custom'
      ? quill('quill-text-field', {
          label: 'Version range',
          name: 'range',
          placeholder: '^1.2.0',
          value: draft.pin ?? '',
          ...(problems.some((m) => m.includes('version range')) ? { state: 'error' as const, message: problems.find((m) => m.includes('version range')) } : {}),
          onChange: (value: string) => set({ pin: value }),
        })
      : null,
    quill('quill-choice', {
      label: 'Maintenance windows',
      name: 'when',
      hint: 'An upgrade an admin starts runs when they ask, whatever the windows.',
      disabled: !automatic,
      ...(automatic ? {} : { reason: 'Only the Automatic policy uses maintenance windows.' }),
      value: draft.windows.length ? 'windows' : 'any',
      options: [
        { value: 'any', label: 'At any time' },
        { value: 'windows', label: 'Only in these weekly windows' },
      ],
      onChange: (value: string) => set({ windows: value === 'any' ? [] : draft.windows.length ? draft.windows : [{ day: 0, start: '02:00', hours: 2 }] }),
    }),
    ...draft.windows.map((w, i) =>
      quill('quill-section', { label: `Window ${i + 1}`, level: 4 }, [
        quill('quill-select', { label: 'Day', value: String(w.day), options: DAY_NAMES.map((d, day) => ({ value: String(day), label: d })), onChange: (value: string) => setWindow(i, { day: Number(value) }) }),
        quill('quill-select', { label: 'Starts at', value: w.start, options: STARTS.includes(w.start) ? STARTS : [w.start, ...STARTS], onChange: (value: string) => setWindow(i, { start: value }) }),
        quill('quill-select', {
          label: 'Lasts',
          value: String(w.hours),
          options: Array.from({ length: 24 }, (_, h) => ({ value: String(h + 1), label: `${h + 1} hour${h ? 's' : ''}` })),
          onChange: (value: string) => setWindow(i, { hours: Number(value) }),
        }),
        quill('quill-button', { label: 'Remove this window', kind: 'ghost', size: 'sm', onPress: () => set({ windows: draft.windows.filter((_, j) => j !== i) }) }),
      ]),
    ),
    draft.windows.length
      ? quill('quill-button', {
          label: 'Add a window',
          kind: 'secondary',
          size: 'sm',
          disabled: full,
          ...(full ? { reason: `At most ${MAX_WINDOWS} windows.` } : {}),
          onPress: () => {
            const last = draft.windows.at(-1)!;
            set({ windows: [...draft.windows, { day: (last.day + 1) % 7, start: last.start, hours: last.hours }] });
          },
        })
      : null,
    quill('quill-select', {
      label: 'Time zone',
      hint: 'Maintenance windows are read in this zone.',
      value: draft.timeZone,
      options: timeZones(deploymentZone, start.timeZone, 'UTC').map((z) => ({ value: z, label: z === deploymentZone ? `${z} (this deployment’s)` : z })),
      onChange: (value: string) => set({ timeZone: value }),
    }),
    quill('quill-details', {
      items: [
        { label: 'Now', value: unit.policy },
        { label: 'After you save', value: unchanged ? 'The same.' : policySentence(draft) },
        ...(next.length ? [{ label: 'Next windows', value: next.map((o) => formatWhen(o.start, draft.timeZone, v.now)).join('; ') }] : []),
      ],
    }),
    problems.length ? quill('quill-notice', { tone: 'refused' }, problems.join(' ')) : null,
    v.saving?.error ? quill('quill-notice', { tone: 'refused', heading: 'Not saved' }, /Nothing was changed/.test(v.saving.error) ? v.saving.error : `${v.saving.error} Nothing was changed.`) : null,
    quill('quill-button', {
      label: 'Save settings',
      kind: 'primary',
      busy: v.saving?.busy,
      busyLabel: 'Saving',
      disabled: Boolean(saveWhyNot),
      ...(saveWhyNot ? { reason: saveWhyNot } : {}),
      onPress: () => v.act.save(unit.unit, draft),
    }),
    quill('quill-button', { label: 'Cancel', kind: 'secondary', onPress: close }),
    unchanged ? null : quill('quill-notice', { tone: 'info' }, 'Saving may ask for your password again, and is kept in the settings history with your name. After signing in again, make the changes again.'),
  ];
};

/** One component's settings: the sentence, who set it, and the way into changing it. */
const unitSettings = (v: SettingsView, unit: OverviewUnit, ring: Ring, editing: boolean): RemoteNode =>
  quill(
    'quill-section',
    { label: unit.name },
    editing && v.draft
      ? editor(v, unit, ring, v.draft)
      : [
          quill('quill-details', {
            items: [
              { label: 'Release channel', value: CHANNEL[unit.desired.channel] },
              { label: 'Update policy', value: unit.policy, ...(unit.automatic?.takes || unit.automatic?.waits ? { note: unit.automatic.takes ?? unit.automatic.waits } : {}) },
              unit.desired.isDefault ? { label: 'Set by', value: 'The defaults: nobody has changed them on this server.' } : { label: 'Set by', value: v.nameOf(unit.desired.setBy), note: when(v, unit.desired.setAt) },
            ],
          }),
          v.saved === unit.unit ? quill('quill-notice', { tone: 'info' }, 'Saved. The updater follows the new settings from its next check.') : null,
          quill('quill-button', {
            label: 'Change settings',
            kind: 'secondary',
            disabled: !v.may,
            ...(v.may ? {} : { reason: NEEDS_DEPLOYMENT_ADMIN }),
            onPress: () => v.on.go(pathOf({ page: 'settings', edit: unit.unit })),
          }),
        ],
  );

const MODE: Record<ReportingView['mode'], string> = { send: 'Sent to Backstage', file: 'Exported by hand', off: 'Off' };
const REASON: Record<NonNullable<ReportingView['last']>['reason'], string> = {
  started: 'when the registry started',
  changed: 'after a change',
  heartbeat: 'the regular record',
  daily: 'the daily record',
  export: 'an export',
};

/** How this deployment reports what it runs to Backstage (ADR 0019): why, its name there, the key, the last send, and an export. */
const reporting = (v: SettingsView): RemoteNode => {
  const brief = v.data.overview?.reporting;
  const view = v.settings.reporting;
  const mode = view?.mode ?? brief?.mode;
  const why = view?.why ?? brief?.why;
  if (!mode || !why) return null;
  const last = view?.last;
  return quill('quill-section', { label: 'Reporting to Backstage' }, [
    quill('quill-notice', { tone: 'info' }, why),
    quill('quill-details', {
      items: [
        { label: 'Reporting', value: MODE[mode] },
        ...(view?.deployment ? [{ label: 'Name in Backstage', value: view.deployment }] : []),
        ...(mode === 'send'
          ? [last ? (last.ok ? { label: 'Last sent', value: when(v, last.at), note: REASON[last.reason] } : { label: 'Last sent', value: `Not accepted ${when(v, last.at)}`, note: last.problem }) : { label: 'Last sent', value: 'Nothing sent since the registry started.' }]
          : []),
      ],
    }),
    view?.publicKey
      ? quill('quill-text-field', { label: 'Public key', hint: 'For the annotation augur.dev/report-key on this deployment in Backstage. Select it to copy it.', value: view.publicKey, readOnly: true, multiline: true, rows: 2 })
      : null,
    v.settings.reportingError ? quill('quill-notice', { tone: 'warning' }, `The reporting details couldn’t be read: ${v.settings.reportingError}`) : null,
    quill('quill-button', {
      label: 'Export the record',
      kind: mode === 'file' ? 'primary' : 'secondary',
      busy: v.exporting?.busy,
      busyLabel: 'Exporting',
      disabled: mode === 'off',
      ...(mode === 'off' ? { reason: why } : {}),
      onPress: v.act.exportRecord,
    }),
    v.exporting?.error ? quill('quill-notice', { tone: 'refused' }, v.exporting.error) : null,
  ]);
};

/** Every change of settings, newest first, with the sentence before and after. */
const settingsHistory = (v: SettingsView): RemoteNode => {
  const units = v.data.overview?.units ?? [];
  const entries: HistoryEntry[] = v.settings.history
    ? historyOf({ upgrades: [], jobs: [], settings: v.settings.history, names: Object.fromEntries(units.map((u) => [u.unit, u.name])), augur: AUGUR, zone: v.zone, nameOf: v.nameOf })
    : [];
  const key = 'settings';
  const shown = v.ui.shown[key] ?? HISTORY_STEP;
  const missing = v.settings.missing.map((u) => units.find((x) => x.unit === u)?.name ?? u);
  return quill('quill-section', { label: 'Settings history', count: entries.length || undefined }, [
    missing.length ? quill('quill-notice', { tone: 'warning' }, `The settings history of ${missing.join(', ')} couldn’t be read, so it’s missing below. The rest is complete.`) : null,
    quill('quill-list', {
      label: 'Settings history',
      noun: ['change', 'changes'],
      density: 'compact',
      loading: !v.settings.history,
      empty: 'Nobody has changed the settings on this deployment yet.',
      items: entries.slice(0, shown).map((e) => ({
        id: e.id,
        title: `${e.unitName}: settings changed`,
        detail: [e.before && `Before: ${e.before}`, `After: ${e.after ?? ''}`].filter(Boolean).join(' '),
        meta: `${e.by}, ${when(v, e.at)}`,
      })),
    }),
    entries.length > shown ? quill('quill-more', { shown, total: entries.length, noun: 'changes', step: HISTORY_STEP, onMore: () => v.on.more(key) }) : null,
  ]);
};

/** Settings: each component's update policy and maintenance windows, reporting, and the history of changes to them. */
export const settingsPage = (v: SettingsView, edit?: string): RemoteNode => {
  const o = v.data.overview!;
  const editing = edit && v.may ? edit : undefined;
  return [
    edit && !v.may ? quill('quill-notice', { tone: 'refused', heading: 'Settings can’t be changed here' }, NEEDS_DEPLOYMENT_ADMIN) : null,
    quill('quill-details', { items: [{ label: 'Server', value: RING_WORDS[o.ring], note: 'SERVER_RING in .env decides which release channels it may track.' }, { label: 'Time zone', value: o.timeZone }] }),
    ...o.units.map((u) => unitSettings(v, u, o.ring, editing === u.unit)),
    reporting(v),
    settingsHistory(v),
  ];
};
