import { About, AppFrame, Button, FrontPage, Heading, iconNames, RailLink, type IconName } from '@augur/app-kit';
import type { AppManifestEntry, MountContext } from '@augur/mfe-sdk';
import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { upgradesApi } from './api.js';
import { useUpgrades, type UpgradesData } from './data.js';
import { AppJobLine, Following, GoBackDialog, HaltedInstallDialog, InstallDialog, UpgradeDialog } from './change.js';
import { SettingsEditor, type Draft } from './editor.js';
import { History } from './history.js';
import { Reporting } from './reporting.js';
import { resumeFrom, takeDraft, takeEntered, takeReason, type Resume } from './model/flow.js';
import { haltedInstallWhyNot } from './model/halted.js';
import { Facts, Muted, Section, StateMark, Version, When } from './look.js';
import { needsYou } from './model/needs-you.js';
import { canChange } from './model/roles.js';
import type { GoBackTarget, Overview as OverviewData, PlatformUpdates } from './model/types.js';
import { CHANNEL_WORDS, POLICY_WORDS, RING_WORDS } from './model/words.js';
import { AUGUR, levelWord, rowOf, type UnitRow } from './units.js';

export type Route = { page: 'overview' } | { page: 'unit'; unit: string } | { page: 'history' };

/** Which page a path inside the Upgrade Centre opens. Anything unknown opens the overview. */
export const routeFor = (path: string): Route => {
  const [first, second] = path.split('#')[0]!.split('/').filter(Boolean);
  if (first === AUGUR) return { page: 'unit', unit: AUGUR };
  if (first === 'apps' && second) return { page: 'unit', unit: second };
  if (first === 'history') return { page: 'history' };
  return { page: 'overview' };
};

const deploymentZone = (overview?: OverviewData) => overview?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

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

/** This app's id in the manifest, where its name and icon come from. */
const APP_ID = 'upgrades';

const iconOf = (name: string | undefined, fallback: IconName): IconName => (name && (iconNames as readonly string[]).includes(name) ? (name as IconName) : fallback);

export const App = ({ ctx }: { ctx: Pick<MountContext, 'fetch' | 'path' | 'user'> }) => {
  const api = useMemo(() => upgradesApi(ctx), [ctx]);
  const { data, checkNow, took, tookUpdates, reload } = useUpgrades(api);
  const { path, go, Link } = useNavigation(ctx);
  const [apps, setApps] = useState<AppManifestEntry[]>([]);
  useEffect(() => {
    api.manifest().then((m) => setApps(Array.isArray(m) ? m : []), () => setApps([]));
  }, [api]);
  const [resume, setResume] = useState<Resume | undefined>(() => {
    const { resume: r, rest } = resumeFrom(window.location.search);
    if (r) window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest}`);
    return r;
  });
  const route = routeFor(path);
  const now = data.readAt ?? new Date();
  const zone = deploymentZone(data.overview);
  const gate = canChange(ctx.user.roles);
  const watchingUntil = data.updates?.upgrade?.state === 'done' ? data.updates.upgrade.watch?.until : undefined;
  const rows = data.overview?.units.map((u) => rowOf(u, now, u.unit === AUGUR ? watchingUntil : undefined)) ?? [];
  const me = apps.find((a) => a.id === APP_ID);
  const unitIcon = (id: string): IconName => (id === AUGUR ? 'server' : iconOf(apps.find((a) => a.id === id)?.icon, 'apps'));
  const shown = route.page === 'unit' ? rows.find((r) => r.id === route.unit) : undefined;
  const shownUnit = shown && data.overview?.units.find((x) => x.unit === shown.id);

  return (
    <div className="h-full text-body text-ink" data-upgrades>
      <AppFrame
        app={{ name: me?.name ?? APP_ID, icon: iconOf(me?.icon, 'download') }}
        onFront={() => go('/')}
        railLabel="What this deployment runs"
        rail={
          <>
            {rows.map((r) => (
              <RailLink key={r.id} icon={unitIcon(r.id)} label={r.name} current={route.page === 'unit' && route.unit === r.id} onPress={() => go(r.to)} />
            ))}
            <RailLink icon="history" label="History" current={route.page === 'history'} onPress={() => go('/history')} />
          </>
        }
        drawerLabel="About this unit"
        drawer={shown && shownUnit ? <UnitAbout row={shown} unit={shownUnit} zone={zone} now={now} portal={data.updates?.portalUrl} /> : undefined}
        busy={data.loading && !data.overview}
        screen={path}
      >
        <div className="flex flex-col gap-7" aria-live="polite">
          {data.error && (
            <p role="alert" className="m-0 text-danger">
              {data.error} What you see below was read <When at={data.readAt} zone={zone} now={new Date()} />.
            </p>
          )}
          {data.loading && !data.overview ? (
            <Muted>Reading what this deployment runs…</Muted>
          ) : !data.overview || !data.updates ? (
            <Muted>The registry isn't answering, so nothing can be shown or changed here. Check it with `pc logs registry`.</Muted>
          ) : route.page === 'overview' ? (
            <Overview name={me?.name} data={data} rows={rows} now={now} zone={zone} checkNow={checkNow} took={took} api={api} Link={Link} />
          ) : route.page === 'history' ? (
            <History data={data} api={api} now={now} zone={zone} user={ctx.user} />
          ) : (
            <Unit
              key={route.unit}
              data={data}
              row={shown}
              unit={route.unit}
              now={now}
              zone={zone}
              gate={gate}
              api={api}
              took={took}
              tookUpdates={tookUpdates}
              reload={reload}
              resume={resume}
              resumed={() => setResume(undefined)}
            />
          )}
        </div>
      </AppFrame>
    </div>
  );
};

/** The drawer on a unit's page: what it is, its state, where to read more, and its last result. */
const UnitAbout = (p: { row: UnitRow; unit: OverviewData['units'][number]; zone: string; now: Date; portal?: string }) => (
  <About
    what={`${p.row.name} ${p.row.running}, following ${CHANNEL_WORDS[p.unit.desired.channel]} releases.`}
    floor="The same on every floor: it belongs to this deployment."
    lifecycle={<StateMark state={p.row.state} />}
    links={p.portal ? <a href={p.portal} className="text-ink underline">This deployment in Backstage</a> : undefined}
    history={
      p.unit.lastResult ? (
        <span>
          {OUTCOME[p.unit.lastResult.state] ?? p.unit.lastResult.state}
          {p.unit.lastResult.version ? ` (${p.unit.lastResult.version})` : ''}, <When at={p.unit.lastResult.finishedAt} zone={p.zone} now={p.now} />
        </span>
      ) : undefined
    }
    words={{ noOwner: 'This deployment’s admins look after it.' }}
  />
);

type LinkC = ReturnType<typeof useNavigation>['Link'];
type Gate = ReturnType<typeof canChange>;

const Overview = (p: {
  name?: string;
  data: UpgradesData;
  rows: UnitRow[];
  now: Date;
  zone: string;
  checkNow: () => Promise<void>;
  took: (o: OverviewData) => void;
  api: ReturnType<typeof upgradesApi>;
  Link: LinkC;
}) => {
  const u = p.data.updates!;
  const o = p.data.overview!;
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string>();
  const [seenError, setSeenError] = useState<string>();
  const items = needsYou(o, p.data.installs?.installed ?? []);
  const augur = o.units.find((x) => x.unit === AUGUR);
  const trust = o.feedTrust;
  const offered = p.rows.filter((r) => r.offered && r.state !== 'up-to-date');

  const next = augur?.window.open && augur.automatic?.takes ? (
    <>A window is open now: {augur.automatic.takes}</>
  ) : augur?.window.nextAt ? (
    <>
      Next maintenance window <When at={augur.window.nextAt} zone={p.zone} now={p.now} />. {augur.automatic?.takes ? augur.automatic.takes : 'Nothing will run in it by itself.'}
    </>
  ) : augur && augur.desired.windows.length === 0 && augur.desired.policy === 'automatic' ? (
    'Automatic upgrades may start at any time on this server.'
  ) : (
    'Nothing scheduled.'
  );

  return (
    <FrontPage
      eyebrow={RING_WORDS[o.ring]}
      heading={p.name ?? APP_ID}
      summary={items.length ? `${items.length} ${items.length === 1 ? 'thing needs' : 'things need'} you.` : offered.length ? `${offered.length} on offer.` : 'Everything is up to date.'}
      sections={[
        {
          id: 'needs-you',
          title: 'Needs you',
          count: items.length || undefined,
          empty: 'Nothing needs you.',
          children: items.length ? (
            <>
              <ul className="m-0 p-0 list-none flex flex-col gap-3">
                {items.map((i) => (
                  <li key={i.key} className="flex flex-col gap-1 rounded-card bg-surface-raised p-4" data-need={i.kind}>
                    <strong>{i.title}</strong>
                    <span className="text-ink-muted">{i.why}</span>
                    <span className="flex gap-4 items-center">
                      <p.Link to={i.action.to}>{i.action.verb}</p.Link>
                      {i.result && (
                        <Button
                          kind="tertiary"
                          size="sm"
                          onPress={async () => {
                            setSeenError(undefined);
                            await p.api
                              .markSeen(i.result!.kind, i.result!.id)
                              .then(p.took)
                              .catch((e: unknown) => setSeenError(e instanceof Error ? e.message : String(e)));
                          }}
                        >
                          I've looked at this
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {seenError && (
                <p role="alert" className="m-0 text-danger">
                  {seenError}
                </p>
              )}
            </>
          ) : undefined,
        },
        {
          id: 'offer',
          title: 'On offer',
          count: offered.length || undefined,
          empty: 'Everything is up to date.',
          children: offered.length ? (
            <ul className="m-0 p-0 list-none flex flex-col gap-2">
              {offered.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-3 items-center" data-offer={r.id}>
                  <p.Link to={r.to}>{r.name}</p.Link>
                  <span>
                    <Version v={r.running} /> to <Version v={r.offered!} />
                  </span>
                  <StateMark state={r.state} />
                </li>
              ))}
            </ul>
          ) : undefined,
        },
        {
          id: 'worth-knowing',
          title: 'Worth knowing',
          empty: '',
          children: (
            <div className="flex flex-col gap-6">
              <Facts
                rows={[
                  ['Server', RING_WORDS[o.ring]],
                  [
                    'AUGUR',
                    u.running.build === 'source' ? (
                      <span key="v">
                        Built from source, based on <Version v={u.running.version} />
                      </span>
                    ) : (
                      <Version key="v" v={u.running.version} />
                    ),
                  ],
                  ['Following', `${CHANNEL_WORDS[u.channel]} releases`],
                  ['Next', <span key="n">{next}</span>],
                  ['Updater', u.updaterSeenAt ? <span key="s">Last asked for work <When at={u.updaterSeenAt} zone={p.zone} now={p.now} /></span> : 'Not set up yet, so upgrades from here wait. See docs/upgrade.md.'],
                  ...(u.portalUrl ? ([['Fleet', <a key="b" href={u.portalUrl} className="text-ink underline">Open Backstage</a>]] as [string, ReactNode][]) : []),
                ]}
              />
              <table className="w-full border-collapse">
                <caption className="text-left text-small text-ink-muted pb-2">Everything this deployment runs</caption>
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
                      <td className="py-3">{POLICY_WORDS[r.policy]}</td>
                      <td className="py-3">
                        <StateMark state={r.state} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Facts
                rows={[
                  ['Release feed', o.feed === 'off' ? 'Off on this deployment (RELEASE_FEED_URL=off)' : <When key="c" at={o.checkedAt ?? u.checkedAt} zone={p.zone} now={p.now} />],
                  ...(trust
                    ? ([
                        [
                          'Signature',
                          trust.state === 'verified'
                            ? `Checked${trust.signer ? `, signed by ${trust.signer}` : ''}`
                            : trust.state === 'mirror'
                              ? `Read from your organisation's mirror${trust.note ? `: ${trust.note}` : ''}`
                              : trust.note ?? 'Not checked: read from GitHub directly',
                        ],
                        ...(trust.expires ? ([['Expires', <When key="e" at={trust.expires} zone={p.zone} now={p.now} />]] as [string, ReactNode][]) : []),
                      ] as [string, ReactNode][])
                    : []),
                  ...(u.problem ? ([['Problem', <span key="p" className="text-danger">{u.problem}</span>]] as [string, ReactNode][]) : []),
                ]}
              />
              <div>
                <Button
                  kind="secondary"
                  busy={checking}
                  busyLabel="Checking"
                  disabled={o.feed === 'off'}
                  reason={o.feed === 'off' ? 'The release feed is off on this deployment (RELEASE_FEED_URL=off).' : undefined}
                  onPress={async () => {
                    setChecking(true);
                    setCheckError(undefined);
                    await p.checkNow().catch((e: unknown) => setCheckError(e instanceof Error ? e.message : String(e)));
                    setChecking(false);
                  }}
                >
                  Check now
                </Button>
                {checkError && (
                  <p role="alert" className="m-0 mt-2 text-danger">
                    {checkError}
                  </p>
                )}
              </div>
              <Reporting overview={o} api={p.api} zone={p.zone} now={p.now} />
            </div>
          ),
        },
      ]}
    />
  );
};

const Unit = (p: {
  data: UpgradesData;
  row?: UnitRow;
  unit: string;
  now: Date;
  zone: string;
  gate: Gate;
  api: ReturnType<typeof upgradesApi>;
  took: (o: OverviewData) => void;
  tookUpdates: (u: PlatformUpdates) => void;
  reload: () => Promise<void>;
  resume?: Resume;
  resumed: () => void;
}) => {
  const back = p.resume?.kind === 'settings' && p.resume.unit === p.unit ? p.resume : undefined;
  const [editing, setEditing] = useState(Boolean(back));
  const [kept] = useState(() => (back ? takeDraft<Draft>(p.unit) : undefined));
  const [saved, setSaved] = useState(false);
  /** The dialog open now, if any: back from entering the password, it opens again by itself. */
  const [asking, setAsking] = useState<Resume | undefined>(() => (p.resume && p.resume.kind !== 'settings' && (p.resume.kind === 'install' ? p.resume.app === p.unit : p.unit === AUGUR) ? p.resume : undefined));
  const [entered] = useState(() => (asking?.kind === 'upgrade' ? takeEntered() : {}));
  const [keptReason] = useState(() => (asking?.kind === 'halted' ? takeReason(asking.version) : ''));
  useEffect(() => {
    if ((asking && asking === p.resume) || back) p.resumed();
  }, []);
  if (!p.row) return <Muted>Nothing called “{p.unit}” is installed on this deployment.</Muted>;
  const unit = p.data.overview!.units.find((x) => x.unit === p.unit)!;
  const isAugur = p.unit === AUGUR;
  const u = p.data.updates!;
  const app = p.data.installs?.installed.find((a) => a.app === p.unit);
  const releases = isAugur ? [...(u.available ? [u.available] : []), ...u.newer.filter((r) => r.version !== u.available?.version)] : app?.update ? [app.update] : [];
  const goBack: GoBackTarget[] = isAugur ? (u.goBack ?? []) : (app?.older ?? []);
  const upgrade = isAugur ? u.upgrade : undefined;
  const augurBusy = upgrade?.state === 'requested' || upgrade?.state === 'running';
  const jobBusy = app?.job?.state === 'requested' || app?.job?.state === 'running';
  /** Why a release can't be taken from here now, or nothing when it can. */
  const whyNot = (version: string): string | undefined => {
    if (!p.gate.allowed) return p.gate.reason;
    if (isAugur) {
      if (augurBusy) return 'Wait for the upgrade under way to finish.';
      if (!u.next) return 'Nothing can be upgraded to right now: check for new releases first.';
      if (version !== u.next) return `Upgrade to ${u.next} first: AUGUR moves one release at a time.`;
      return undefined;
    }
    return jobBusy ? 'Wait for the server to finish its current job with this app.' : undefined;
  };
  const goBackWhyNot = (g: GoBackTarget): string | undefined =>
    !p.gate.allowed
      ? p.gate.reason
      : !isAugur
        ? 'Going back an app is done from Admin, Apps, for now.'
        : g.halted
          ? `Halted: ${g.halted.reason}`
          : g.problem
            ? g.problem
            : g.breakingAfter
              ? `${g.breakingAfter} is breaking in between, so going back needs the backup (docs/upgrade.md).`
              : augurBusy
                ? 'Wait for the upgrade under way to finish.'
                : undefined;
  const haltedWhyNot = isAugur ? haltedInstallWhyNot(u, p.gate) : undefined;
  const haltedAsked = asking?.kind === 'halted' ? u.newer.find((r) => r.version === asking.version && r.halted) : undefined;
  const ask = (version: string) => setAsking(isAugur ? { kind: 'upgrade', version } : { kind: 'install', app: p.unit, version });

  return (
    <>
      <header className="flex flex-col gap-2">
        <Heading heading={p.row.name} size="l" level={1} />
        <p className="m-0 flex gap-3 items-center">
          <Version v={p.row.running} /> <StateMark state={p.row.state} />
        </p>
        {isAugur && u.running.build === 'source' && (
          <Muted>
            This server runs AUGUR built from source, so it carries the number of the last release it’s based on. Releases newer than that are offered below; upgrading replaces the build
            with released images.
          </Muted>
        )}
      </header>

      {upgrade && (
        <Following
          upgrade={upgrade}
          running={u.running.version}
          updaterSeenAt={u.updaterSeenAt}
          zone={p.zone}
          now={p.now}
          canCancel={p.gate.allowed}
          cancelReason={p.gate.allowed ? undefined : p.gate.reason}
          onCancel={async () => p.tookUpdates(await p.api.cancel())}
        />
      )}
      {app?.job && <AppJobLine job={app.job} zone={p.zone} now={p.now} />}

      <Section title="How it moves" id="policy">
        {editing ? (
          <SettingsEditor
            unit={unit}
            ring={p.data.overview!.ring}
            deploymentZone={p.zone}
            now={p.now}
            api={p.api}
            took={(o) => {
              p.took(o);
              setSaved(true);
            }}
            onDone={() => setEditing(false)}
            kept={kept}
          />
        ) : (
          <HowItMoves unit={unit} zone={p.zone} now={p.now} gate={p.gate} saved={saved} onChange={() => (setSaved(false), setEditing(true))} />
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
                  <>
                    <span className="text-danger">Halted: {r.halted.reason}. It isn't offered.</span>
                    {isAugur && (
                      <span>
                        <Button kind="tertiary" size="sm" disabled={Boolean(haltedWhyNot)} reason={haltedWhyNot} onPress={() => setAsking({ kind: 'halted', version: r.version })}>
                          Install {r.version} for a test
                        </Button>
                      </span>
                    )}
                  </>
                ) : (
                  <span>
                    <Button kind="primary" size="sm" disabled={Boolean(whyNot(r.version))} reason={whyNot(r.version)} onPress={() => ask(r.version)}>
                      Upgrade {p.row!.name} to {r.version}
                    </Button>
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
      </Section>

      <Section title="Go back" id="go-back">
        {goBack.length === 0 ? (
          <Muted>There's no earlier release on this channel to go back to.</Muted>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {goBack.slice(0, 5).map((g) => (
              <li key={g.version} className="flex flex-wrap gap-3 items-center" data-go-back={g.version}>
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
                <Button kind="tertiary" size="sm" disabled={Boolean(goBackWhyNot(g))} reason={goBackWhyNot(g)} onPress={() => setAsking({ kind: 'go-back', version: g.version })}>
                  Go back to {g.version}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {asking?.kind === 'upgrade' && u.next === asking.version && (
        <UpgradeDialog updates={u} api={p.api} entered={entered} took={p.tookUpdates} onClose={() => setAsking(undefined)} />
      )}
      {asking?.kind === 'halted' && haltedAsked?.halted && (
        <HaltedInstallDialog
          updates={u}
          version={haltedAsked.version}
          halted={haltedAsked.halted}
          api={p.api}
          reason={keptReason}
          took={p.tookUpdates}
          onClose={() => setAsking(undefined)}
        />
      )}
      {asking?.kind === 'go-back' && <GoBackDialog updates={u} version={asking.version} api={p.api} took={p.tookUpdates} onClose={() => setAsking(undefined)} />}
      {asking?.kind === 'install' && app && (
        <InstallDialog app={app} version={asking.version} api={p.api} done={() => void p.reload()} onClose={() => setAsking(undefined)} />
      )}
    </>
  );
};

/** What a unit's settings are now, who set them, and the way into changing them. */
const HowItMoves = (p: { unit: OverviewData['units'][number]; zone: string; now: Date; gate: Gate; saved: boolean; onChange: () => void }) => (
  <>
    <p className="m-0">{p.unit.policy}</p>
    {p.unit.automatic?.takes && <Muted>{p.unit.automatic.takes}</Muted>}
    {p.unit.automatic?.waits && <Muted>{p.unit.automatic.waits}</Muted>}
    <Muted>
      {p.unit.desired.isDefault ? (
        'These are the defaults: nobody has changed them on this server.'
      ) : (
        <>
          Set by {p.unit.desired.setBy} <When at={p.unit.desired.setAt} zone={p.zone} now={p.now} />.
        </>
      )}
    </Muted>
    {p.saved && <p role="status" className="m-0">Saved. The updater follows the new settings from its next check.</p>}
    <span>
      <Button kind="secondary" disabled={!p.gate.allowed} reason={p.gate.allowed ? undefined : p.gate.reason} onPress={p.onChange}>
        Change settings
      </Button>
    </span>
  </>
);

const OUTCOME: Record<string, string> = {
  requested: 'Waiting for the updater',
  running: 'Running',
  done: 'Done',
  'rolled-back': 'Went back by itself',
  failed: 'Stopped partway',
  cancelled: 'Cancelled',
};

