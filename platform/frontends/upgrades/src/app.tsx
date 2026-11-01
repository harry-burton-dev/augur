import type { MountContext } from '@augur/mfe-sdk';
import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { upgradesApi } from './api.js';
import { useUpgrades, type UpgradesData } from './data.js';
import { Facts, Muted, Section, StateMark, Version, When } from './look.js';
import { loadSeen, markSeen, needsYou } from './model/needs-you.js';
import { canChange } from './model/roles.js';
import { policySentence } from './model/sentence.js';
import { nextWindows } from './model/time.js';
import type { GoBackTarget, UnitRecord } from './model/types.js';
import { CHANNEL_WORDS, POLICY_WORDS, RING_WORDS } from './model/words.js';
import { AUGUR, appRows, augurRow, levelWord, type UnitRow } from './units.js';

/** Where Admin's own Upgrade Centre page is, which still makes the changes until this app's flow ships. */
const ADMIN_UPGRADES = '/admin/updates';

export type Route = { page: 'overview' } | { page: 'unit'; unit: string } | { page: 'history' };

/** Which page a path inside the Upgrade Centre opens. Anything unknown opens the overview. */
export const routeFor = (path: string): Route => {
  const [first, second] = path.split('/').filter(Boolean);
  if (first === AUGUR) return { page: 'unit', unit: AUGUR };
  if (first === 'apps' && second) return { page: 'unit', unit: second };
  if (first === 'history') return { page: 'history' };
  return { page: 'overview' };
};

const deploymentZone = (records: UpgradesData['records']) => records[AUGUR]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

/** A link inside the app: it moves the address and the page without reloading the shell. */
const useNavigation = (ctx: Pick<MountContext, 'path'>) => {
  const [path, setPath] = useState(ctx.path || '/');
  const base = useMemo(() => {
    const here = window.location.pathname;
    return ctx.path && here.endsWith(ctx.path) ? here.slice(0, here.length - ctx.path.length) : here.replace(/\/$/, '');
  }, [ctx.path]);
  useEffect(() => {
    const back = () => setPath(window.location.pathname.slice(base.length) || '/');
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, [base]);
  const go = useCallback(
    (to: string) => {
      window.history.pushState(window.history.state, '', `${base}${to === '/' ? '' : to}`);
      setPath(to);
    },
    [base],
  );
  const Link = useCallback(
    ({ to, children, current }: { to: string; children: ReactNode; current?: boolean }) => (
      <a
        href={`${base}${to === '/' ? '' : to}`}
        aria-current={current ? 'page' : undefined}
        className="text-ink underline-offset-4 hover:underline aria-[current=page]:font-semibold"
        onClick={(e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          go(to);
        }}
      >
        {children}
      </a>
    ),
    [base, go],
  );
  return { path, go, Link };
};

export const App = ({ ctx }: { ctx: Pick<MountContext, 'fetch' | 'path' | 'user'> }) => {
  const api = useMemo(() => upgradesApi(ctx), [ctx]);
  const { data, checkNow } = useUpgrades(api);
  const { path, Link } = useNavigation(ctx);
  const route = routeFor(path);
  const now = data.readAt ?? new Date();
  const zone = deploymentZone(data.records);
  const gate = canChange(ctx.user.roles);
  const rows = data.updates ? [augurRow(data.updates, data.records[AUGUR], now), ...(data.installs ? appRows(data.installs, data.records, now) : [])] : [];

  return (
    <div className="flex flex-wrap gap-7 p-edge text-body text-ink min-h-full" data-upgrades>
      <nav aria-label="Upgrade Centre" className="flex flex-col gap-2 w-[var(--measure-rail)] shrink-0">
        <Link to="/" current={route.page === 'overview'}>
          Overview
        </Link>
        {rows.map((r) => (
          <Link key={r.id} to={r.to} current={route.page === 'unit' && route.unit === r.id}>
            {r.name}
          </Link>
        ))}
        <Link to="/history" current={route.page === 'history'}>
          History
        </Link>
      </nav>
      <main className="flex flex-col gap-7 flex-1 max-w-wide" aria-live="polite">
        {data.error && (
          <p role="alert" className="m-0 text-danger">
            {data.error} What you see below was read <When at={data.readAt} zone={zone} now={new Date()} />.
          </p>
        )}
        {data.loading && !data.updates ? (
          <Muted>Reading what this deployment runs…</Muted>
        ) : !data.updates ? (
          <Muted>The registry isn't answering, so nothing can be shown or changed here. Check it with `pc logs registry`.</Muted>
        ) : route.page === 'overview' ? (
          <Overview data={data} rows={rows} now={now} zone={zone} gate={gate} checkNow={checkNow} Link={Link} />
        ) : route.page === 'history' ? (
          <History data={data} now={now} zone={zone} />
        ) : (
          <Unit data={data} row={rows.find((r) => r.id === route.unit)} unit={route.unit} now={now} zone={zone} gate={gate} />
        )}
      </main>
    </div>
  );
};

type LinkC = ReturnType<typeof useNavigation>['Link'];
type Gate = ReturnType<typeof canChange>;

const Overview = (p: { data: UpgradesData; rows: UnitRow[]; now: Date; zone: string; gate: Gate; checkNow: () => Promise<void>; Link: LinkC }) => {
  const u = p.data.updates!;
  const [seen, setSeen] = useState(loadSeen);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string>();
  const items = needsYou(u, p.data.installs?.installed ?? [], seen);
  const record = p.data.records[AUGUR];
  const next = record ? nextWindows(record.windows, record.timeZone, p.now, 1)[0] : undefined;
  const trust = u.feedTrust;

  return (
    <>
      <Section title="Needs you" id="needs-you">
        {items.length === 0 ? (
          <Muted>Nothing needs you.</Muted>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-3">
            {items.map((i) => (
              <li key={i.key} className="flex flex-col gap-1 rounded-card bg-surface-raised p-4" data-need={i.kind}>
                <strong>{i.title}</strong>
                <span className="text-ink-muted">{i.why}</span>
                <span>
                  <p.Link to={i.action.to}>{i.action.verb}</p.Link>
                  {(i.kind === 'failed' || i.kind === 'went-back') && (
                    <button
                      type="button"
                      className="ml-4 text-ink-muted underline-offset-4 hover:underline bg-transparent border-0 cursor-pointer"
                      onClick={() => {
                        markSeen(i.key.replace(/^result-/, ''));
                        setSeen(loadSeen());
                      }}
                    >
                      I've looked at this
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="This deployment" id="deployment">
        <Facts
          rows={[
            ['Server', u.ring ? RING_WORDS[u.ring] : 'Not set (SERVER_RING in .env)'],
            ['AUGUR', <Version key="v" v={u.running.version} />],
            ['Following', `${CHANNEL_WORDS[u.channel]} releases`],
            ['Updater', u.updaterSeenAt ? <span key="s">Last asked for work <When at={u.updaterSeenAt} zone={p.zone} now={p.now} /></span> : 'Not set up yet, so upgrades from here wait. See docs/upgrade.md.'],
            ...(u.portalUrl ? ([['Fleet', <a key="b" href={u.portalUrl} className="text-ink underline">Open Backstage</a>]] as [string, ReactNode][]) : []),
          ]}
        />
      </Section>

      <Section title="Units" id="units">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-small text-ink-muted">
              <th className="font-normal py-2">Unit</th>
              <th className="font-normal py-2">Running</th>
              <th className="font-normal py-2">Policy</th>
              <th className="font-normal py-2">State</th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((r) => (
              <tr key={r.id} className="border-t border-hairline" data-unit={r.id}>
                <td className="py-3">
                  <p.Link to={r.to}>{r.name}</p.Link>
                </td>
                <td className="py-3">
                  <Version v={r.running} />
                  {r.pin && <span className="text-ink-muted"> · pinned to {r.pin}</span>}
                  {r.held && <span className="text-ink-muted"> · held</span>}
                </td>
                <td className="py-3">{r.policy ? POLICY_WORDS[r.policy] : <span className="text-ink-muted">An admin starts each upgrade</span>}</td>
                <td className="py-3">
                  <StateMark state={r.state} />
                  {r.offered && r.state !== 'up-to-date' && (
                    <span className="text-ink-muted">
                      {' '}
                      <Version v={r.offered} />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Next" id="next">
        {next ? (
          <Muted>
            Next maintenance window <When at={next.start} zone={p.zone} now={p.now} />.
          </Muted>
        ) : record?.windows === 'any' ? (
          <Muted>Automatic upgrades may run at any time on this server.</Muted>
        ) : (
          <Muted>Nothing scheduled. AUGUR upgrades start when an admin asks.</Muted>
        )}
      </Section>

      <Section title="Last checked" id="checked">
        <Facts
          rows={[
            ['Release feed', u.feed === 'off' ? 'Off on this deployment (RELEASE_FEED_URL=off)' : <When key="c" at={u.checkedAt} zone={p.zone} now={p.now} />],
            ...(trust
              ? ([
                  [
                    'Signature',
                    trust.state === 'verified'
                      ? `Checked${trust.signer ? `, signed by ${trust.signer}` : ''}`
                      : trust.state === 'mirror'
                        ? `Read from a mirror${trust.note ? `: ${trust.note}` : ''}`
                        : trust.note ?? 'Not checked',
                  ],
                  ...(trust.expires ? ([['Expires', <When key="e" at={trust.expires} zone={p.zone} now={p.now} />]] as [string, ReactNode][]) : []),
                ] as [string, ReactNode][])
              : []),
            ...(u.problem ? ([['Problem', <span key="p" className="text-danger">{u.problem}</span>]] as [string, ReactNode][]) : []),
          ]}
        />
        <div>
          <ui-button
            kind="secondary"
            busy={checking || undefined}
            disabled={u.feed === 'off' || undefined}
            reason={u.feed === 'off' ? 'The release feed is off on this deployment (RELEASE_FEED_URL=off).' : undefined}
            onClick={async () => {
              setChecking(true);
              setCheckError(undefined);
              await p.checkNow().catch((e: unknown) => setCheckError(e instanceof Error ? e.message : String(e)));
              setChecking(false);
            }}
          >
            Check now
          </ui-button>
          {checkError && (
            <p role="alert" className="m-0 mt-2 text-danger">
              {checkError}
            </p>
          )}
        </div>
      </Section>
    </>
  );
};

const flowNotHere = 'Upgrading from this page arrives in the next release of the Upgrade Centre. Until then, use Admin, Upgrade Centre.';

const Unit = (p: { data: UpgradesData; row?: UnitRow; unit: string; now: Date; zone: string; gate: Gate }) => {
  if (!p.row) return <Muted>Nothing called “{p.unit}” is installed on this deployment.</Muted>;
  const record: UnitRecord | undefined = p.data.records[p.unit];
  const isAugur = p.unit === AUGUR;
  const u = p.data.updates!;
  const app = p.data.installs?.installed.find((a) => a.app === p.unit);
  const releases = isAugur ? [...(u.available ? [u.available] : []), ...u.newer.filter((r) => r.version !== u.available?.version)] : app?.update ? [app.update] : [];
  const goBack: GoBackTarget[] = isAugur ? (u.goBack ?? []) : (app?.older ?? []);
  const actionReason = p.gate.allowed ? flowNotHere : p.gate.reason;

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-title m-0">{p.row.name}</h1>
        <p className="m-0 flex gap-3 items-center">
          <Version v={p.row.running} /> <StateMark state={p.row.state} />
        </p>
      </header>

      <Section title="How it moves" id="policy">
        {record ? (
          <p className="m-0">
            {policySentence({ name: p.row.name, channel: record.channel, policy: record.policy, windows: record.windows, pin: record.pin })}
          </p>
        ) : isAugur ? (
          <Muted>
            AUGUR follows {CHANNEL_WORDS[u.channel]} releases, and an admin starts each upgrade. Policies, pins and maintenance windows arrive with the next updater release.
          </Muted>
        ) : (
          <Muted>
            {p.row.name} follows {CHANNEL_WORDS[app!.channel]} releases. Policy: {POLICY_WORDS[app!.policy]}.
          </Muted>
        )}
        {record?.hold && (
          <Muted>
            Held by {record.hold.byName ?? record.hold.by} <When at={record.hold.at} zone={p.zone} now={p.now} />
            {record.hold.note ? `: ${record.hold.note}` : '.'}
          </Muted>
        )}
      </Section>

      <Section title="On offer" id="offer">
        {releases.length === 0 ? (
          <Muted>You're up to date.</Muted>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-3">
            {releases.map((r) => (
              <li key={r.version} className="flex flex-col gap-1 border-t border-hairline pt-3" data-release={r.version}>
                <span className="flex gap-3 items-baseline">
                  <strong>
                    <Version v={r.version} />
                  </strong>
                  <span className="text-ink-muted text-small">
                    {[levelWord(p.row!.running, r.version), CHANNEL_WORDS[r.channel], 'breaking' in r && r.breaking.length ? 'Breaking' : ''].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {r.halted ? (
                  <span className="text-danger">Halted: {r.halted.reason}. It isn't offered.</span>
                ) : (
                  <span>
                    <ui-button kind="primary" size="small" disabled reason={actionReason}>
                      Upgrade {p.row!.name} to {r.version}
                    </ui-button>
                  </span>
                )}
                {'needs' in r && r.needs.length > 0 && <span className="text-ink-muted">{r.needs.join(' ')}</span>}
              </li>
            ))}
          </ul>
        )}
        {isAugur && u.needsYou.filter((n) => n.kind !== 'halted').length > 0 && (
          <ul className="m-0 pl-5 text-ink-muted">
            {u.needsYou
              .filter((n) => n.kind !== 'halted')
              .map((n) => (
                <li key={`${n.kind}-${n.key ?? n.message}`}>{n.message}</li>
              ))}
          </ul>
        )}
        {p.gate.allowed && releases.length > 0 && (
          <Muted>
            For now, upgrade from <a href={ADMIN_UPGRADES} className="text-ink underline">Admin, Upgrade Centre</a>.
          </Muted>
        )}
      </Section>

      <Section title="Go back" id="go-back">
        {goBack.length === 0 ? (
          <Muted>There's no earlier release on this channel to go back to.</Muted>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {goBack.slice(0, 5).map((g) => (
              <li key={g.version} className="flex gap-3 items-baseline" data-go-back={g.version}>
                <Version v={g.version} />
                <span className="text-ink-muted">
                  {g.halted
                    ? `Halted: ${g.halted.reason}`
                    : g.problem
                      ? g.problem
                      : g.breakingAfter
                        ? `Blocked: ${g.breakingAfter} is breaking in between`
                        : 'Can go back straight away'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
};

const OUTCOME: Record<string, string> = {
  requested: 'Waiting for the updater',
  running: 'Running',
  done: 'Done',
  'rolled-back': 'Went back by itself',
  failed: 'Stopped partway',
  cancelled: 'Cancelled',
};

const History = (p: { data: UpgradesData; now: Date; zone: string }) => {
  const entries = p.data.updates?.history ?? [];
  return (
    <Section title="History" id="history">
      {entries.length === 0 ? (
        <Muted>No upgrades yet on this deployment.</Muted>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-3">
          {entries.map((h) => (
            <li key={h.id} className="flex flex-col gap-1 border-t border-hairline pt-3" data-history={h.id}>
              <span>
                AUGUR <Version v={h.from} /> to <Version v={h.version} />: {OUTCOME[h.state] ?? h.state}
              </span>
              <span className="text-ink-muted text-small">
                {h.requestedByName ?? h.requestedBy}, <When at={h.requestedAt} zone={p.zone} now={p.now} />
                {h.backup ? ` · backup ${h.backup}` : ''}
              </span>
              {h.message && <span className="text-ink-muted">{h.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};
