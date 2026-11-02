import { policySentence } from './sentence.js';
import type { AppJob, DesiredState, Upgrade } from './types.js';

/** Who started a change, as the spec names them: a person, the updater by itself, or the watch. */
export type Who = 'person' | 'itself' | 'watch';
export type Outcome = 'done' | 'went-back' | 'failed' | 'cancelled' | 'under-way' | 'changed';

export interface HistoryEntry {
  id: string;
  kind: 'upgrade' | 'app-job' | 'setting';
  unit: string;
  unitName: string;
  at: string;
  who: Who;
  /** The person's name, "By itself" or "Watch". */
  by: string;
  /** How it started: Upgrade now, Automatic, Install, Remove from the server, Changed settings. */
  how: string;
  from?: string;
  to?: string;
  outcome: Outcome;
  tookMs?: number;
  backup?: string;
  /** For a setting change: the sentence before and after. */
  before?: string;
  after?: string;
  message?: string;
}

export const OUTCOME_WORDS: Record<Outcome, string> = {
  done: 'Done',
  'went-back': 'Went back by itself',
  failed: 'Stopped partway',
  cancelled: 'Cancelled',
  'under-way': 'Under way',
  changed: 'Settings changed',
};

export const WHO_WORDS: Record<Who, string> = { person: 'A person', itself: 'By itself', watch: 'Watch' };

/** The registry's name for a change nobody started. */
const AUTOMATIC = 'automatic';

const outcomeOf = (state: string): Outcome =>
  state === 'done' ? 'done' : state === 'rolled-back' ? 'went-back' : state === 'failed' ? 'failed' : state === 'cancelled' ? 'cancelled' : 'under-way';

const took = (from: string, to?: string) => (to ? Math.max(0, Date.parse(to) - Date.parse(from)) : undefined);

/** A person's name when it's known (the person reading, or one the registry named), otherwise their id. */
export type NameOf = (id: string, given?: string) => string;

/**
 * One list for the deployment, newest first (spec: "History and audit"): AUGUR's upgrades and go
 * backs, every app's installs and removals, and every change of settings with the sentence before
 * and after. A default record isn't a change, so it's left out; the first change compares with it.
 */
export const historyOf = (input: {
  upgrades: Omit<Upgrade, 'steps'>[];
  jobs: AppJob[];
  settings: Record<string, DesiredState[]>;
  names: Record<string, string>;
  augur: string;
  /** The deployment's zone, for a record kept before records named theirs. */
  zone: string;
  nameOf: NameOf;
}): HistoryEntry[] => {
  const unitName = (u: string) => input.names[u] ?? u;
  const upgrades = input.upgrades.map((u): HistoryEntry => {
    const outcome = outcomeOf(u.state);
    const who: Who = outcome === 'went-back' && u.watch?.tripped ? 'watch' : u.requestedBy === AUTOMATIC ? 'itself' : 'person';
    return {
      id: u.id,
      kind: 'upgrade',
      unit: input.augur,
      unitName: unitName(input.augur),
      at: u.requestedAt,
      who,
      by: who === 'person' ? input.nameOf(u.requestedBy, u.requestedByName) : WHO_WORDS[who],
      how: u.requestedBy === AUTOMATIC ? 'Automatic' : 'Upgrade now',
      from: u.from,
      to: u.version,
      outcome,
      tookMs: took(u.requestedAt, u.finishedAt),
      ...(u.backup ? { backup: u.backup } : {}),
      ...(u.message ? { message: u.message } : {}),
    };
  });
  const jobs = input.jobs
    .filter((j) => j.action === 'install' || j.action === 'remove')
    .map((j): HistoryEntry => {
      const who: Who = j.requestedBy === AUTOMATIC ? 'itself' : 'person';
      return {
        id: j.id,
        kind: 'app-job',
        unit: j.app,
        unitName: unitName(j.app),
        at: j.requestedAt,
        who,
        by: who === 'person' ? input.nameOf(j.requestedBy) : WHO_WORDS[who],
        how: j.action === 'remove' ? 'Remove from the server' : who === 'itself' ? 'Automatic' : 'Install',
        ...(j.release ? { to: j.release.version } : {}),
        outcome: outcomeOf(j.state),
        tookMs: took(j.requestedAt, j.finishedAt),
        ...(j.message ? { message: j.message } : {}),
      };
    });
  const settings = Object.entries(input.settings).flatMap(([unit, records]) => {
    const oldestFirst = [...records].sort((a, b) => Date.parse(a.setAt) - Date.parse(b.setAt));
    return oldestFirst.flatMap((r, i): HistoryEntry[] => {
      if (r.setBy === 'default') return [];
      const before = oldestFirst[i - 1];
      return [
        {
          id: `setting-${unit}-${r.setAt}`,
          kind: 'setting',
          unit,
          unitName: unitName(unit),
          at: r.setAt,
          who: 'person',
          by: input.nameOf(r.setBy),
          how: 'Changed settings',
          outcome: 'changed',
          ...(before ? { before: policySentence({ ...before, timeZone: before.timeZone ?? input.zone }) } : {}),
          after: policySentence({ ...r, timeZone: r.timeZone ?? input.zone }),
        },
      ];
    });
  });
  return [...upgrades, ...jobs, ...settings].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
};

export interface HistoryFilter {
  unit?: string;
  who?: Who;
  outcome?: Outcome;
}

export const filterHistory = (entries: HistoryEntry[], f: HistoryFilter) =>
  entries.filter((e) => (!f.unit || e.unit === f.unit) && (!f.who || e.who === f.who) && (!f.outcome || e.outcome === f.outcome));

/** How long it took, in words: "4 min", "40 s". */
export const tookWords = (ms?: number) => (ms === undefined ? '' : ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`);

const cell = (v: string | number | undefined) => {
  const s = v === undefined ? '' : String(v);
  // Quote every cell, double inner quotes (RFC 4180), and stop a spreadsheet reading a formula.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** The history as CSV (RFC 4180), for a support request or an air-gapped deployment's records. */
export const historyCsv = (entries: HistoryEntry[]): string =>
  [
    ['When (UTC)', 'Unit', 'Change', 'From', 'To', 'Who', 'Outcome', 'Took', 'Backup', 'Before', 'After', 'Message'].map(cell).join(','),
    ...entries.map((e) =>
      [e.at, e.unitName, e.how, e.from, e.to, e.by, OUTCOME_WORDS[e.outcome], tookWords(e.tookMs), e.backup, e.before, e.after, e.message].map(cell).join(','),
    ),
  ].join('\r\n') + '\r\n';
