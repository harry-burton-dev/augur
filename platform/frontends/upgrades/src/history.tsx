import { Button, Heading, Select } from '@augur/app-kit';
import { useEffect, useMemo, useState } from 'react';
import type { UpgradesApi } from './api.js';
import type { UpgradesData } from './data.js';
import { Muted, Version, When } from './look.js';
import { filterHistory, historyCsv, historyOf, OUTCOME_WORDS, tookWords, WHO_WORDS, type HistoryEntry, type HistoryFilter, type Outcome, type Who } from './model/history.js';
import type { AppJob, DesiredState } from './model/types.js';
import { AUGUR } from './units.js';

const ALL = '';

/**
 * Everything that changed on this deployment, newest first (spec: "History and audit"): AUGUR's
 * upgrades, every app's installs and removals, and every change of settings with the sentence
 * before and after. Filters by unit, by who started it and by outcome, and exports as CSV.
 * Entries can't be edited or deleted here or anywhere else.
 */
export const History = (p: { data: UpgradesData; api: UpgradesApi; now: Date; zone: string; user: { id: string; name?: string } }) => {
  const units = useMemo(() => p.data.overview?.units ?? [], [p.data.overview?.units]);
  const [jobs, setJobs] = useState<AppJob[]>([]);
  const [settings, setSettings] = useState<Record<string, DesiredState[]>>({});
  const [problems, setProblems] = useState<string[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>({});
  const unitIds = units.map((u) => u.unit).join(',');

  useEffect(() => {
    let live = true;
    const missed: string[] = [];
    void Promise.all([
      p.api.appJobs().catch(() => (missed.push('the apps’ installs and removals'), [] as AppJob[])),
      ...unitIds
        .split(',')
        .filter(Boolean)
        .map((u) =>
          p.api
            .desiredHistory(u)
            .then((h) => [u, h] as const)
            .catch(() => (missed.push(`the settings history of ${units.find((x) => x.unit === u)?.name ?? u}`), [u, [] as DesiredState[]] as const)),
        ),
    ]).then(([j, ...s]) => {
      if (!live) return;
      setJobs(j as AppJob[]);
      setSettings(Object.fromEntries(s as (readonly [string, DesiredState[]])[]));
      setProblems(missed);
    });
    return () => {
      live = false;
    };
    // Read again when the units change, not on every overview poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.api, unitIds]);

  const entries = useMemo(
    () =>
      historyOf({
        upgrades: p.data.updates?.history ?? [],
        jobs,
        settings,
        names: Object.fromEntries(units.map((u) => [u.unit, u.name])),
        augur: AUGUR,
        zone: p.zone,
        nameOf: (id, given) => given ?? (id === p.user.id && p.user.name ? p.user.name : id),
      }),
    [p.data.updates?.history, jobs, settings, units, p.zone, p.user],
  );
  const shown = filterHistory(entries, filter);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([historyCsv(shown)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `upgrade-history-${p.now.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="history">
      <Heading id="history" heading="History" size="l" level={1} summary="Every upgrade, install and change of settings on this deployment, newest first. Nothing here can be edited or deleted." />
      <div className="flex flex-wrap gap-4 items-end">
        <Select
          label="Unit"
          value={filter.unit ?? ALL}
          onChange={(v) => setFilter((f) => ({ ...f, unit: v || undefined }))}
          options={[{ value: ALL, label: 'Every unit' }, ...units.map((u) => ({ value: u.unit, label: u.name }))]}
        />
        <Select
          label="Started by"
          value={filter.who ?? ALL}
          onChange={(v) => setFilter((f) => ({ ...f, who: (v || undefined) as Who | undefined }))}
          options={[{ value: ALL, label: 'Anyone' }, ...(Object.keys(WHO_WORDS) as Who[]).map((w) => ({ value: w, label: WHO_WORDS[w] }))]}
        />
        <Select
          label="Outcome"
          value={filter.outcome ?? ALL}
          onChange={(v) => setFilter((f) => ({ ...f, outcome: (v || undefined) as Outcome | undefined }))}
          options={[{ value: ALL, label: 'Any' }, ...(Object.keys(OUTCOME_WORDS) as Outcome[]).map((o) => ({ value: o, label: OUTCOME_WORDS[o] }))]}
        />
        <Button kind="secondary" size="sm" disabled={shown.length === 0} reason={shown.length === 0 ? 'Nothing to export with these filters.' : undefined} onPress={exportCsv}>
          Export as CSV
        </Button>
      </div>
      <Muted>The signed record for Backstage is exported from the front page, under Worth knowing.</Muted>
      {problems.length > 0 && (
        <p role="alert" className="m-0 text-danger">
          Couldn’t read {problems.join(', ')}, so those are missing below. The rest is complete.
        </p>
      )}
      {entries.length === 0 ? (
        <Muted>Nothing has changed on this deployment yet.</Muted>
      ) : shown.length === 0 ? (
        <Muted>Nothing matches these filters.</Muted>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-3">
          {shown.map((e) => (
            <Entry key={e.id} e={e} zone={p.zone} now={p.now} />
          ))}
        </ul>
      )}
    </section>
  );
};

const Entry = ({ e, zone, now }: { e: HistoryEntry; zone: string; now: Date }) => (
  <li id={e.id} className="flex flex-col gap-1 border-t border-hairline pt-3" data-history={e.id} data-kind={e.kind} data-outcome={e.outcome}>
    <span>
      <strong>{e.unitName}</strong>
      {': '}
      {e.kind === 'setting' ? (
        'settings changed'
      ) : (
        <>
          {e.how}
          {e.from && (
            <>
              {' '}
              from <Version v={e.from} />
            </>
          )}
          {e.to && (
            <>
              {' '}
              to <Version v={e.to} />
            </>
          )}
          {` · ${OUTCOME_WORDS[e.outcome]}`}
        </>
      )}
    </span>
    <span className="text-ink-muted text-small">
      {e.by}, <When at={e.at} zone={zone} now={now} />
      {e.tookMs !== undefined ? ` · took ${tookWords(e.tookMs)}` : ''}
      {e.backup ? ` · backup ${e.backup}` : ''}
    </span>
    {e.kind === 'setting' && (
      <span className="flex flex-col gap-1">
        {e.before && (
          <span>
            <span className="text-ink-muted">Before: </span>
            {e.before}
          </span>
        )}
        <span>
          <span className="text-ink-muted">After: </span>
          {e.after}
        </span>
      </span>
    )}
    {e.message && <span className="text-ink-muted">{e.message}</span>}
  </li>
);
